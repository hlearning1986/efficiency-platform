/**
 * 核心饱和度计算引擎（纯函数）
 * 实现5级聚合路径：人员 → 角色 → 项目 → 团队 → 组织
 *
 * 所有函数均为无副作用的纯函数，便于独立测试
 */

import type {
  PersonSatResult,
  RoleAggResult,
  TeamAggResult,
  OrgAggResult,
  ProjAggResult,
  WorkloadRole,
  SaturationLevel,
} from './types';
import {
  SATURATION_THRESHOLDS,
  ROLE_LABELS,
  DAILY_CAPACITY_HOURS,
  ROLE_KEYS,
  ROLE_COLORS,
} from './constants';

/** 数值精度处理：保留1位小数 */
export function rp(v: number): number {
  return Math.round(v * 10) / 10;
}

// ============================================================
// 饱和度等级辅助函数
// ============================================================

/**
 * 获取饱和度等级
 * @param sat - 饱和度百分比 (0-100+)
 * @returns 饱和度等级
 */
export function getSaturationLevel(sat: number): SaturationLevel {
  if (sat <= SATURATION_THRESHOLDS.low) return 'low';
  if (sat <= SATURATION_THRESHOLDS.normal) return 'normal';
  if (sat <= SATURATION_THRESHOLDS.high) return 'high';
  return 'over';
}

/**
 * 获取饱和度对应的颜色
 */
export function getSatColor(sat: number): string {
  const level = getSaturationLevel(sat);
  const colors: Record<SaturationLevel, string> = {
    low: '#00b42a',
    normal: '#1677ff',
    high: '#ff7d00',
    over: '#f53f3f',
  };
  return colors[level];
}

// ============================================================
// Level-5: 单人饱和度计算
// ============================================================

/**
 * 计算单个人员的饱和度
 *
 * @param p - 人员数据
 * @returns 人员饱和度结果
 */
export function calcPersonSaturation(p: {
  name: string;
  role: WorkloadRole;
  teamName: string;
  mainProject: string;
  tasks: Array<{ effort?: number }>;
  workDays: Date[];
  dailyBreakdown: Record<string, number>;
  dailyCapacityH?: number;
}): PersonSatResult {
  const {
    name,
    tasks,
    workDays,
    dch = DAILY_CAPACITY_HOURS,
    role,
    teamName,
    mainProject,
    dailyBreakdown,
  } = p;

  const cap = workDays.length * dch;
  const eff = tasks.reduce((s, t) => s + (t.effort || 0), 0);

  return {
    name,
    role,
    roleName: ROLE_LABELS[role],
    teamName,
    mainProject,
    totalEffort: rp(eff),
    capacity: cap,
    capacity: cap,
    saturation: cap > 0 ? rp((eff / cap) * 100) : 0,
    workDayCount: workDays.length,
    dailyBreakdown,
  };
}

// ============================================================
// Level-4: 角色端聚合（按新规则）
// ============================================================

/**
 * 按角色维度聚合人员饱和度 - 新版计算规则
 *
 * ⭐ 新规则（2026-06-08）：
 *   分子 = Σ(角色人员每日实际工时[已过去日期]) + Σ(角色人员每日预估工时[未来日期])
 *   分母 = 角色人员数 × 工作日天数 × 8h
 *
 * @param persons - 人员饱和度结果列表（必须包含 dailyActualHours 和 dailyBreakdown）
 * @param workDays - 查询范围内的工作日数组（用于判断过去/未来）
 * @returns 角色聚合结果数组（只包含4个核心角色：前端/后端/移动端/测试）
 */
export function aggregateByRole(
  persons: PersonSatResult[],
  workDays?: Date[]
): RoleAggResult[] {
  // 初始化4个角色的累加器
  const m = new Map<WorkloadRole, {
    pastActualHours: number;    // 已过去日期的实际工时总和
    futureEstHours: number;     // 未来日期的预估工时总和
    peopleSet: Set<string>;     // 去重人数集合
  }>();

  for (const r of ROLE_KEYS) {
    m.set(r, { pastActualHours: 0, futureEstHours: 0, peopleSet: new Set() });
  }

  // 获取当前时间（用于判断过去/未来）
  const now = new Date();
  // 将今天的时间设为23:59:59.999，确保今天被视为"过去"
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  // 遍历所有人员，按角色分组累加
  for (const p of persons) {
    const e = m.get(p.role);
    if (!e) continue;  // 跳过非核心角色的人员

    // 添加到人数集合（去重）
    e.peopleSet.add(p.name);

    // 如果有工作日数据，按新规则计算
    if (workDays && workDays.length > 0) {
      for (const day of workDays) {
        const dayStr = day.toISOString().slice(0, 10);
        const isPast = day <= todayEnd;

        if (isPast) {
          // ===== 已过去日期：使用实际工时（来自 Timesheet）=====
          e.pastActualHours += p.dailyActualHours?.[dayStr] || 0;
        } else {
          // ===== 未来日期：使用预估工时（来自任务 effort）=====
          e.futureEstHours += p.dailyBreakdown?.[dayStr] || 0;
        }
      }
    } else {
      // 兜底逻辑：如果没有工作日数据，使用 totalEffort 作为总投入
      // 这种情况不应该发生，但作为防御性编程
      e.pastActualHours += p.totalEffort || 0;
    }
  }

  // 构建返回结果（只返回4个核心角色）
  const workDayCount = workDays?.length || 1;  // 防止除零

  return ROLE_KEYS.map((r) => {
    const e = m.get(r)!;

    // 计算分子：过去实际工时 + 未来预估工时
    const totalInputHours = e.pastActualHours + e.futureEstHours;

    // 计算分母：人数 × 工作日数 × 8h
    const totalCapacity = e.peopleSet.size * workDayCount * DAILY_CAPACITY_HOURS;

    // 计算饱和度
    const saturation = totalCapacity > 0
      ? rp((totalInputHours / totalCapacity) * 100)
      : 0;

    console.log(`[aggregateByRole] ${r}: people=${e.peopleSet.size}, pastActual=${rp(e.pastActualHours)}h, futureEst=${rp(e.futureEstHours)}h, total=${rp(totalInputHours)}h, capacity=${totalCapacity}h, sat=${saturation}%`);

    return {
      role: r,
      roleName: ROLE_LABELS[r],
      totalHours: rp(totalInputHours),     // 总投入工时（实际+预估）
      totalCap: rp(totalCapacity),         // 总容量
      peopleCount: e.peopleSet.size,       // 去重人数
      saturation: saturation,              // 饱和度百分比
      color: ROLE_COLORS[r] || '#1677ff', // UI颜色
    };
  });
}

// ============================================================
// Level-3: 项目级聚合
// ============================================================

/**
 * 按项目维度聚合人员饱和度
 *
 * @param data - 项目数据数组（包含workspaceId、名称和所属人员）
 * @returns 项目聚合结果数组
 */
export function aggregateByProject(
  data: Array<{
    workspaceId: string;
    workspaceName: string;
    persons: PersonSatResult[];
  }>
): ProjAggResult[] {
  return data.map((proj) => {
    // 初始化各角色的累加器
    const rm = new Map<WorkloadRole, { h: number; c: number }>();
    for (const r of ROLE_KEYS) {
      rm.set(r, { h: 0, c: 0 });
    }

    let th = 0; // 总工时
    let tc = 0; // 总容量

    // 累加该项目下所有人员的工时
    for (const p of proj.persons) {
      const e = rm.get(p.role)!;
      e.h += p.totalEffort;
      e.c += p.capacity;
      th += p.totalEffort;
      tc += p.capacity;
    }

    // 构建该项目的角色明细
    const roles = ROLE_KEYS.map((r) => {
      const e = rm.get(r)!;
      return {
        r,
        roleName: ROLE_LABELS[r],
        hours: rp(e.h),
        cap: rp(e.c),
        saturation: e.c > 0 ? rp((e.h / e.c) * 100) : 0,
      };
    });

    return {
      projectId: proj.workspaceId,
      projectName: proj.workspaceName,
      roles,
      totalHours: rp(th),
      totalCap: rp(tc),
      saturation: tc > 0 ? rp((th / tc) * 100) : 0,
    };
  });
}

// ============================================================
// Level-2: 团队级聚合
// ============================================================

/** 团队原始配置输入 */
export interface TeamRawConfig {
  teamId: string;
  teamName: string;
  projectIds: string[];
  projectNames: Map<string, string>;
  persons: PersonSatResult[];
}

/**
 * 按团队维度聚合人员饱和度
 *
 * 团队饱和度计算规则（3场景）：
 *
 * 场景1：团队无人员被借调、并且无借调其他团队人员
 *   分母 = Σ(所有团队成员的工作日天数 × 8)
 *
 * 场景2：团队人员被借调、无借调其他团队人员
 *   分母 = Σ(非借调团队成员的工作日天数 × 8) + Σ(被借调人员(工作日天数-被借调工作日天数) × 8)
 *
 * 场景3：团队人员被借调、并借调其他团队人员（双向）
 *   分母 = Σ(非借调成员工作日×8) + Σ(被借调成员(工作日-被借调日)×8) + Σ(借调人员借调工作日×8)
 *
 * 特殊情况：如团队人员都是借调人员
 *   分母 = Σ(所有借调人员的借调工作日 × 8)
 *
 * @param configs - 团队配置数组
 * @returns 团队聚合结果数组
 */
export function aggregateByTeam(configs: TeamRawConfig[]): TeamAggResult[] {
  return configs.map((tc) => {
    // ---- 分子：累加所有人员的总投入工时 ----
    let totalInputHours = 0;
    const ps = new Set<string>();

    // ---- 分母：按3场景规则计算团队容量 ----
    let normalCap = 0;       // 非借调成员: workDayCount × 8
    let loanOutCap = 0;      // 被借调成员: (workDayCount - loanWorkDayCount) × 8
    let loanInCap = 0;       // 借调入成员: loanWorkDayCount × 8

    let hasLoanOutPerson = false;  // 是否有被借调出去的人员
    let hasLoanInPerson = false;   // 是否有借调进来的人员
    let allLoanIn = true;          // 特殊情况标记：是否全部是借调人员

    for (const p of tc.persons) {
      totalInputHours += p.totalEffort;
      ps.add(p.name);

      const personWorkDays = p.workDayCount || 1;
      const loanOutDays = p.loanWorkDayCount || 0;
      const isLoanIn = !!p.isLoanPerson;

      if (isLoanIn) {
        // ===== 借调入人员：分母 = 借调工作日天数 × 8 =====
        hasLoanInPerson = true;
        // 借调人员的容量已在per-person计算时用公式C设置，这里重新按规则计算
        loanInCap += Math.max(loanOutDays, 1) * DAILY_CAPACITY_HOURS;
      } else if (loanOutDays > 0) {
        // ===== 被借调出人员：分母 = (工作日天数 - 被借调工作日天数) × 8 =====
        hasLoanOutPerson = true;
        allLoanIn = false;
        loanOutCap += Math.max(personWorkDays - loanOutDays, 1) * DAILY_CAPACITY_HOURS;
      } else {
        // ===== 正常人员：分母 = 工作日天数 × 8 =====
        allLoanIn = false;
        normalCap += personWorkDays * DAILY_CAPACITY_HOURS;
      }
    }

    // 计算最终分母和饱和度
    let teamCapacity: number;
    let scenario: string;

    if (!hasLoanOutPerson && !hasLoanInPerson) {
      // ===== 场景1：无借调 =====
      teamCapacity = normalCap;
      scenario = '场景1-无借调';
    } else if (hasLoanOutPerson && !hasLoanInPerson) {
      // ===== 场景2：仅被借调出 =====
      teamCapacity = normalCap + loanOutCap;
      scenario = '场景2-被借调出';
    } else if (allLoanIn && tc.persons.length > 0) {
      // ===== 特殊情况：全部是借调人员 =====
      teamCapacity = loanInCap;
      scenario = '特殊-全借调';
    } else {
      // ===== 场景3：双向借调 =====
      teamCapacity = normalCap + loanOutCap + loanInCap;
      scenario = '场景3-双向借调';
    }

    const saturation = teamCapacity > 0 ? rp((totalInputHours / teamCapacity) * 100) : 0;

    console.log(
      `[aggregateByTeam] 团队 "${tc.teamName}" [${scenario}]: ` +
      `人数=${ps.size}, 总工时=${rp(totalInputHours)}h, ` +
      `正常=${rp(normalCap)}h, 被借调扣减=${rp(loanOutCap)}h, 借调入=${rp(loanInCap)}h, ` +
      `容量=${rp(teamCapacity)}h, 饱和度=${saturation}%`
    );

    // ⭐ 新增：按 TAPD 项目分组，计算每个项目的角色饱和度
    const projects: ProjAggResult[] = [];

    // 按项目名称分组人员（优先使用 mainProject，否则从 projectNames 映射中查找）
    const projectGroups = new Map<string, typeof tc.persons>();
    for (const p of tc.persons) {
      // 获取项目名称（优先级：mainProject > 从projectIds映射中查找 > 未分配）
      let projName = p.mainProject || '';

      // 如果 mainProject 为空或是"未知"，尝试从 team 配置的 projectNames 中查找
      if (!projName || projName === '未知' || projName === '未分配') {
        // 尝试使用第一个项目ID作为默认项目名
        if (tc.projectIds.length > 0 && tc.projectNames.size > 0) {
          projName = tc.projectNames.get(tc.projectIds[0]) || tc.projectIds[0];
        } else {
          projName = '未分配项目';
        }
      }

      if (!projectGroups.has(projName)) {
        projectGroups.set(projName, []);
      }
      projectGroups.get(projName)!.push(p);
    }

    // ⭐ 调试日志：输出分组结果
    if (tc.persons.length > 0) {
      console.log(`[aggregateByTeam] 团队 "${tc.teamName}" 项目分组:`, [...projectGroups.keys()]);
    }

    // 为每个项目计算角色分布和饱和度
    for (const [projName, projPersons] of projectGroups) {
      // 找到对应的项目ID（从projectIds中查找）
      const projId = tc.projectIds.find(id => tc.projectNames.get(id) === projName) || `proj-${projName}`;

      // 按角色分组
      const roleGroups = new Map<WorkloadRole, { hours: number; cap: number; count: number }>();
      let projTotalHours = 0;
      let projTotalCap = 0;

      for (const p of projPersons) {
        if (!roleGroups.has(p.role)) {
          roleGroups.set(p.role, { hours: 0, cap: 0, count: 0 });
        }
        const rg = roleGroups.get(p.role)!;
        rg.hours += p.totalEffort;
        rg.cap += p.capacity;
        rg.count++;
        projTotalHours += p.totalEffort;
        projTotalCap += p.capacity;
      }

      // 构建角色列表
      const roles: ProjRoleAgg[] = [];
      for (const [role, data] of roleGroups) {
        roles.push({
          role,
          roleName: ROLE_LABELS[role] || role,
          hours: rp(data.hours),
          cap: rp(data.cap),
          saturation: data.cap > 0 ? rp((data.hours / data.cap) * 100) : 0,
        });
      }

      // 添加到项目列表
      projects.push({
        projectId: projId,
        projectName: projName,  // ⭐ 关键：这个字段会被前端显示
        roles,
        totalHours: rp(projTotalHours),
        totalCap: rp(projTotalCap),
        saturation: projTotalCap > 0 ? rp((projTotalHours / projTotalCap) * 100) : 0,
      });

      // ⭐ 调试：输出每个项目的详细信息
      console.log(`[aggregateByTeam]   项目 "${projName}" (ID=${projId}):`, {
        sat: Math.round(projTotalCap > 0 ? (projTotalHours / projTotalCap) * 100 : 0) + '%',
        rolesCount: roles.length,
        personsCount: projPersons.length,
      });
    }

    return {
      teamId: tc.teamId,
      teamName: tc.teamName,
      projectIds: tc.projectIds,
      projectName: tc.projectIds.map((id) => tc.projectNames.get(id) || id),
      peopleCount: ps.size,
      actualHours: rp(totalInputHours),
      capacityHours: rp(teamCapacity),
      saturation: saturation,  // 使用按3场景规则计算的饱和度
      projects,  // ⭐ 新增：返回项目级角色饱和度数据
    };
  });

  // ⭐ 日志：输出团队聚合结果（包含项目和角色数据）
  if (configs.length > 0) {
    console.log('[aggregateByTeam] 团队聚合完成，共', configs.length, '个团队');
    for (const team of configs.slice(0, 3)) {  // 只打印前3个团队
      const result = configs.find(t => t.teamId === team.teamId);
      if (result?.projects) {
        console.log(`[aggregateByTeam] 团队 "${team.teamName}":`, {
          peopleCount: result.peopleCount,
          projectCount: result.projects.length,
          projects: result.projects.map(p => ({
            name: p.projectName,
            sat: p.saturation + '%',
            rolesCount: p.roles.length,
            roles: p.roles.map(r => ({
              role: r.roleName,
              sat: r.saturation + '%',
              hours: r.hours + 'h/' + r.cap + 'h',
            })),
          })),
        });
      }
    }
  }
}

// ============================================================
// Level-1: 组织级汇总
// ============================================================

/**
 * 组织级饱和度汇总
 *
 * @param teams - 团队聚合结果列表
 * @returns 组织汇总结果
 */
export function aggregateOrg(teams: TeamAggResult[]): OrgAggResult {
  let ta = 0; // 总实际工时
  let tp = 0; // 总人数
  let tc = 0; // 总容量

  for (const t of teams) {
    ta += t.actualHours;
    tc += t.capacityHours;
    tp += t.peopleCount;
  }

  return {
    totalPeople: tp,
    totalCapacity: rp(tc),
    totalActual: rp(ta),
    saturation: tc > 0 ? rp((ta / tc) * 100) : 0,
  };
}
