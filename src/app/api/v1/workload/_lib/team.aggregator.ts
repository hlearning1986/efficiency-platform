/**
 * 团队归因聚合器
 * 构建人员→团队的归属关系树
 *
 * 核心规则：
 * 1. 统计人员在各workspace的工时，取最大工时的workspace所属团队为主团队
 * 2. 外部工时占比>30%标记借调状态
 * 3. 角色：DB映射优先 > 默认frontend
 */

import type {
  PersonSatResult,
  WorkloadRole,
  DailyRecord,
} from './types';
import { ROLE_LABELS, DAILY_CAPACITY_HOURS } from './constants';

/** 输入数据结构 */
export interface TeamTreeInput {
  teamConfigs: Array<{
    id: string;
    name: string;
    tapdProjectIds: string[];
  }>;
  allTasks: Array<{
    owner: string;
    workspaceId: string;
    effort: number;
    begin?: Date;
    due?: Date;
    status?: string;
    name: string;
    storyId?: string;
  }>;
  /** Timesheet实际工时数据（新增） */
  allTimesheets?: Array<{
    owner: string;
    workspaceId: string;
    timespent: number;
    spentdate: Date;
  }>;
  roleMappings: Array<{
    workspaceId: string;
    memberName: string;
    role: string;
  }>;
  workDays: Date[];
  dailyBreakdowns: Map<string, DailyRecord>;           // 每日预估工时（来自任务）
  dailyActualHoursMap?: Map<string, DailyRecord>;      // ⭐ 新增：每日实际工时（来自Timesheet）
  projectNameMap: Map<string, string>;
}

/**
 * 构建团队归因树
 *
 * @param input - 归因输入数据
 * @returns 团队-人员映射 + 人员-团队映射
 */
export async function buildTeamTree(
  input: TeamTreeInput
): Promise<{
  teamPersonMap: Map<string, PersonSatResult[]>;
  personTeamMap: Map<string, string>;
}> {
  const {
    teamConfigs,
    allTasks,
    allTimesheets = [],  // 新增：默认为空数组
    roleMappings,
    workDays,
    dailyBreakdowns,
    dailyActualHoursMap = new Map(),  // ⭐ 新增：每日实际工时数据
    projectNameMap,
  } = input;

  // ---- 构建 workspace → team 反向映射 ----
  const wsToTeam = new Map<string, string>();
  const tidToName = new Map<string, string>();
  const tidToPids = new Map<string, string[]>();

  for (const tc of teamConfigs) {
    tidToName.set(tc.id, tc.name);
    tidToPids.set(tc.id, tc.tapdProjectIds);
    for (const pid of tc.tapdProjectIds) {
      wsToTeam.set(pid, tc.id);
    }
  }

  // ---- 角色缓存 (workspaceId:memberName → role) ----
  const mrCache = new Map<string, string>();
  for (const rm of roleMappings) {
    mrCache.set(`${rm.workspaceId}:${rm.memberName}`, rm.role);
  }

  // ---- 按人分组任务 ----
  // 清理owner字段：去除所有异常字符（分号、空格、逗号、换行等）
  const cleanOwner = (name: string | null | undefined): string => {
    if (!name) return '';
    return name.replace(/[\s;,，；、。.\n\r\t]+/g, ' ').trim();
  };

  const ptMap = new Map<string, typeof allTasks>();
  for (const t of allTasks) {
    const owner = cleanOwner(t.owner);
    if (!owner) continue;
    if (!ptMap.has(owner)) ptMap.set(owner, []);
    ptMap.get(owner)!.push(t);
  }

  // ---- 初始化返回结果 ----
  const tpm = new Map<string, PersonSatResult[]>(); // teamId → persons[]
  const ptm = new Map<string, string>();             // personName → teamId

  // ---- 遍历每个人员，按(人+项目)维度展开 ----
  // 注意：不再按姓名去重，同一人参与多个TAPD项目会生成多条记录
  const processedNames = new Set<string>();

  // 调试：打印所有人员名称（前20个），帮助排查数据丢失
  const allPersonNames = Array.from(ptMap.keys());
  console.log(`[team.aggregator] 总人数(去重后): ${allPersonNames.length}, 前20人: ${allPersonNames.slice(0, 20).join(', ')}`);

  // 检查 dailyBreakdowns 中是否有邓明霜的数据
  const dengKey = allPersonNames.find(n => n.includes('邓明霜') || n.includes('deng'));
  if (dengKey) {
    console.log(`[team.aggregator] 找到邓明霜 key="${dengKey}", 任务数=${ptMap.get(dengKey)?.length}`);
    console.log(`[team.aggregator] dailyBreakdowns有此key? ${dailyBreakdowns.has(dengKey)}`, dailyBreakdowns.get(dengKey));
    console.log(`[team.aggregator] dailyActualHoursMap有此key? ${dailyActualHoursMap.has(dengKey)}`, dailyActualHoursMap.get(dengKey));
    // 打印该人员的任务详情
    const dengTasks = ptMap.get(dengKey) || [];
    console.log(`[team.aggregator] 邓明霜任务详情:`);
    dengTasks.slice(0, 5).forEach((t, i) => {
      console.log(`  [${i}] ${t.name} | ws=${t.workspaceId} | effort=${t.effort} | begin=${t.begin} | due=${t.due} | status=${t.status}`);
    });
  } else {
    // 尝试原始名称查找
    console.log(`[team.aggregator] 未找到"邓明霜"，尝试模糊搜索...`);
    const fuzzyMatch = allPersonNames.find(n => n.includes('邓') || n.includes('明') || n.includes('霜'));
    if (fuzzyMatch) console.log(`[team.aggregator] 模糊匹配: "${fuzzyMatch}"`);
    else console.log(`[team.aggregator] 所有人员名中无"邓/明/霜"字样`);
  }

  for (const [pname, allPersonTasks] of ptMap) {
    // 跳过已处理的人员（实现按姓名去重 - 仅用于跳过无效人员）
    if (processedNames.has(pname)) {
      continue;
    }

    // 过滤无效的owner（空值、系统账号等）
    if (!pname || pname.trim() === '' ||
        pname.includes('未分配') || pname.includes('系统') ||
        pname.length < 2 || pname.length > 20) {
      processedNames.add(pname);
      continue;
    }

    // 统计该人员在各项目的工时
    const peMap = new Map<string, number>();
    for (const t of allPersonTasks) {
      peMap.set(t.workspaceId, (peMap.get(t.workspaceId) || 0) + (t.effort || 0));
    }

    // 如果该人员没有任何有效项目数据，跳过
    if (peMap.size === 0) {
      processedNames.add(pname);
      continue;
    }

    // 确定角色（从角色映射中查找）- 多级匹配策略（基于所有任务）
    let role: WorkloadRole | undefined = undefined;

    // Level 1: 精确匹配 workspaceId:memberName
    for (const t of allPersonTasks) {
      const c = mrCache.get(`${t.workspaceId}:${pname}`);
      if (c) {
        const n = normalizeRole(c);
        if (n) { role = n; break; }
      }
    }
    // Level 2: 跨workspace仅按姓名匹配
    if (!role) {
      for (const [key, value] of mrCache.entries()) {
        const [, mappedName] = key.split(':');
        if (mappedName === pname) {
          const n = normalizeRole(value);
          if (n) { role = n; break; }
        }
      }
    }
    // Level 3: 模糊匹配
    if (!role) {
      const cleanName = pname.replace(/\s+/g, '');
      for (const [key, value] of mrCache.entries()) {
        const [, mappedName] = key.split(':');
        if (mappedName.replace(/\s+/g, '') === cleanName && cleanName.length > 0) {
          const n = normalizeRole(value);
          if (n) { role = n; break; }
        }
      }
    }

    // 如果仍未匹配到角色，跳过该人员
    if (!role) {
      console.log(`[team.aggregator] Skip unconfigured person: ${pname}`);
      processedNames.add(pname);
      continue;
    }

    processedNames.add(pname);

    // ===== 按(人+项目)维度展开：每个项目生成一条 PersonSatResult =====
    for (const [wsId, projEffort] of peMap) {
      // 过滤出该项目下的任务
      const tasks = allPersonTasks.filter(t => t.workspaceId === wsId);

      // 确定团队
      const tid = wsToTeam.get(wsId) || '';
      const tname = tidToName.get(tid) || '未分配团队';

      // 确定项目名称
      const mproj = projectNameMap.get(wsId) || wsId;

      // 检查借调状态
      let ls: string | undefined;
      let isLoanPerson = false;
      const tpids = tidToPids.get(tid) || [];

      for (const t of tasks) {
        const roleKey = `${t.workspaceId}:${pname}`;
        const roleValue = mrCache.get(roleKey);
        if (roleValue && (roleValue.includes('借调') || roleValue.toLowerCase().includes('loan'))) {
          isLoanPerson = true;
          ls = `借调人员（${projectNameMap.get(t.workspaceId) || t.workspaceId}）`;
          break;
        }
      }

      // 计算借调工作日天数
      const loanWorkDaySet = new Set<string>();
      for (const t of tasks) {
        if (!tpids.includes(t.workspaceId) && t.begin && t.due) {
          for (const day of workDays) {
            if (day >= t.begin && day <= t.due) {
              loanWorkDaySet.add(day.toISOString().slice(0, 10));
            }
          }
        }
      }
      const loanWorkDayCount = loanWorkDaySet.size;
      const normalWorkDayCount = Math.max(0, workDays.length - loanWorkDayCount);

      // 计算饱和度（基于该项目任务）
      const now = new Date();
      // 使用cleanOwner统一处理timesheet的owner名称，避免原始名称（如"邓明霜;"）与清理后名称不匹配
      const personTimesheets = allTimesheets.filter(ts => cleanOwner(ts.owner) === pname);

      // 过去实际工时
      let pastActualHours = 0;
      for (const day of workDays) {
        if (day <= now) {
          const dayStr = day.toISOString().slice(0, 10);
          pastActualHours += personTimesheets
            .filter(ts => ts.spentdate.toISOString().slice(0, 10) === dayStr)
            .reduce((sum, ts) => sum + ts.timespent, 0);
        }
      }

      // 未来预估工时（仅该项目）
      let futureEstimateHours = 0;
      for (const t of tasks) {
        if (!t.begin || !t.due || !t.effort) continue;
        const hasFutureWorkDay = workDays.some(day => day > now && day >= t.begin! && day <= t.due!);
        if (hasFutureWorkDay) futureEstimateHours += t.effort;
      }

      const totalInput = pastActualHours + futureEstimateHours;

      // 容量计算
      let cap: number;
      if (isLoanPerson) {
        cap = loanWorkDayCount > 0 ? loanWorkDayCount * DAILY_CAPACITY_HOURS : (normalWorkDayCount > 0 ? normalWorkDayCount * DAILY_CAPACITY_HOURS : DAILY_CAPACITY_HOURS);
      } else {
        cap = loanWorkDayCount > 0 ? normalWorkDayCount * DAILY_CAPACITY_HOURS : workDays.length * DAILY_CAPACITY_HOURS;
      }

      const sat = cap > 0 ? Math.round((totalInput / cap) * 1000) / 10 : 0;

      // 构建人员结果（按项目维度）
      const person: PersonSatResult = {
        name: pname,
        role,
        roleName: ROLE_LABELS[role],
        teamName: tname,
        mainProject: mproj,
        totalEffort: Math.round(totalInput * 10) / 10,
        capacity: cap,
        saturation: sat,
        workDayCount: workDays.length,
        dailyBreakdown: dailyBreakdowns.get(pname) || {},
        dailyActualHours: dailyActualHoursMap.get(pname) || {},
        loanStatus: ls,
        loanWorkDayCount: loanWorkDayCount,
        isLoanPerson: isLoanPerson,
        taskList: tasks.map(t => ({
          id: t.id,
          name: t.name,
          workspaceId: t.workspaceId,
          projectName: projectNameMap.get(t.workspaceId),
          iterationId: t.iterationId,
          effort: t.effort || 0,
          effortCompleted: t.effortCompleted || 0,
          begin: t.begin,
          due: t.due,
          status: t.status || '',
        })),
      };

      // 添加到对应团队
      if (!tpm.has(tid)) tpm.set(tid, []);
      tpm.get(tid)!.push(person);

      // 记录人员-团队映射（主团队）
      if (!ptm.has(pname)) ptm.set(pname, tid);
    }
  }

  return { teamPersonMap: tpm, personTeamMap: ptm };
}

/**
 * 规范化角色字符串为WorkloadRole类型
 */
function normalizeRole(raw: string): WorkloadRole | null {
  const l = raw.toLowerCase().trim();
  if (l.includes('前端') || l.includes('frontend') || l.includes('fe') || l.includes('web')) return 'frontend';
  if (l.includes('后端') || l.includes('backend') || l.includes('be') || l.includes('server')) return 'backend';
  if (l.includes('移动') || l.includes('mobile') || l.includes('ios') || l.includes('android')) return 'mobile';
  if (l.includes('测试') || l.includes('test') || l.includes('qa') || l.includes('qc')) return 'test';
  return null;
}
