/**
 * 数据提供层
 * DB优先 + TAPD API兜底策略
 *
 * 数据获取优先级：
 * 1. 先查Prisma（本地数据库）
 * 2. 查询失败或无数据时，调用TAPD API补充
 * 3. 支持从TAPD API同步真实工作区数据到team_config表
 */

import { prisma } from '@/lib/prisma';

// ============================================================
// 类型定义
// ============================================================

/** Workspace原始数据 */
export interface WorkspaceRawData {
  workspaceId: string;
  workspaceName: string;
  tasks: Array<{
    id: string;
    name: string;
    owner?: string | null;
    status?: string | null;
    effort?: number | null;
    effortCompleted?: number | null;
    begin?: Date | null;
    due?: Date | null;
    storyId?: string | null;
    workspaceId: string;
  }>;
}

/** 团队配置 */
export interface TeamConfigItem {
  id: string;
  name: string;
  tapdProjectIds: string[];
}

/** 成员角色映射 */
export interface MemberRoleMapping {
  workspaceId: string;
  memberName: string;
  role: string;
}

// ============================================================
// TAPD API 工具函数（保留供其他功能使用）
// ============================================================

/**
 * 获取系统配置的TAPD凭据
 * 供其他模块调用TAPD API时使用
 */
export async function getTapdCredentials(): Promise<{ apiUser: string; apiPassword: string } | null> {
  try {
    const config = await prisma.systemSetting.findUnique({
      where: { key: 'tapd_api_config' },
    });

    if (!config?.value) return null;

    const tapdConfig = JSON.parse(config.value);
    const { apiUser, apiPassword } = tapdConfig;

    if (!apiUser || !apiPassword || apiUser === 'your_api_user') {
      return null;
    }

    return { apiUser, apiPassword };
  } catch (error) {
    console.error('[data.provider] getTapdCredentials error:', error);
    return null;
  }
}

// ============================================================
// 团队配置获取
// ============================================================

/**
 * 获取所有团队配置
 * 只从team_config表读取，不进行任何自动同步
 * 团队配置由用户在"系统设置-团队配置"页面手动管理
 *
 * @returns 团队配置数组
 */
export async function getAllTeamConfigs(): Promise<TeamConfigItem[]> {
  try {
    const list = await prisma.teamConfig.findMany({
      orderBy: { createdAt: 'asc' },
    });

    return list.map((item) => ({
      id: item.id,
      name: item.name,
      tapdProjectIds: JSON.parse(item.tapdProjectIds || '[]') as string[],
    }));
  } catch (error) {
    console.error('[data.provider] getAllTeamConfigs error:', error);
    return [];
  }
}

// ============================================================
// 角色映射获取
// ============================================================

/**
 * 获取成员角色映射
 * @returns 角色映射数组
 */
export async function getMemberRoleMappings(): Promise<MemberRoleMapping[]> {
  try {
    const mappings = await prisma.tapdMemberRoleMapping.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'asc' },
    });

    return mappings.map((m) => ({
      workspaceId: m.workspaceId,
      memberName: m.memberName,
      role: m.role,
    }));
  } catch (error) {
    console.error('[data.provider] getMemberRoleMappings error:', error);
    return [];
  }
}

// ============================================================
// 项目名称映射
// ============================================================

/**
 * 获取项目ID→名称映射
 * 从teamConfigs的tapdProjectIds中提取所有workspaceId
 * 然后查询TapdWorkspace表获取名称
 */
export async function getProjectNameMap(): Promise<Map<string, string>> {
  const map = new Map<string, string>();

  try {
    // 获取所有团队配置中的workspace ID
    const teamConfigs = await getAllTeamConfigs();
    const allWsIds = [...new Set(teamConfigs.flatMap((tc) => tc.tapdProjectIds))];

    if (allWsIds.length === 0) return map;

    // 批量查询workspace信息
    const workspaces = await prisma.tapdWorkspace.findMany({
      where: { id: { in: allWsIds } },
      select: { id: true, name: true },
    });

    for (const ws of workspaces) {
      // ⭐ 判断：如果名称看起来像纯数字/ID，尝试从TAPD API获取真实名称
      let finalName = ws.name;
      if (!finalName || /^\d+$/.test(finalName) || finalName.startsWith('项目')) {
        console.log(`[data.provider] Workspace ${ws.id} 名称无效(${ws.name})，尝试从API获取...`);
        try {
          const apiName = await fetchWorkspaceNameFromAPI(ws.id);
          if (apiName && !/^\d+$/.test(apiName)) {
            finalName = apiName;
            console.log(`[data.provider] 从API获取到真实名称: ${ws.id} -> ${apiName}`);
            // 更新数据库
            try {
              await prisma.tapdWorkspace.update({
                where: { id: ws.id },
                data: { name: apiName },
              });
              console.log(`[data.provider] 已更新数据库: workspace ${ws.id} -> ${apiName}`);
            } catch (updateErr) {
              console.warn('[data.provider] 更新workspace名称失败:', updateErr);
            }
          }
        } catch (err) {
          console.warn(`[data.provider] API获取workspace名称失败:`, err);
          if (!finalName) finalName = `项目${ws.id}`;
        }
      }

      map.set(ws.id, finalName || `项目${ws.id}`);
    }

    // 对于未找到的workspace，使用默认名称并尝试从API获取
    for (const wsId of allWsIds) {
      if (!map.has(wsId)) {
        let defaultName = `项目${wsId}`;
        try {
          const apiName = await fetchWorkspaceNameFromAPI(wsId);
          if (apiName && !/^\d+$/.test(apiName)) {
            defaultName = apiName;
            // 插入新记录到数据库
            try {
              await prisma.tapdWorkspace.create({
                data: { id: wsId, name: apiName },
              });
            } catch (insertErr) {
              // 忽略已存在的记录错误
            }
          }
        } catch (err) {
          console.warn(`[data.provider] 获取未知workspace ${wsId} 名称失败:`, err);
        }
        map.set(wsId, defaultName);
      }
    }

    // ⭐ 最终日志：输出映射结果
    console.log(`[data.provider] getProjectNameMap 完成，共 ${map.size} 个项目`);
    for (const [id, name] of map.entries()) {
      console.log(`  - ${id}: "${name}"`);
    }
  } catch (error) {
    console.error('[data.provider] getProjectNameMap error:', error);
  }

  return map;
}

/**
 * ⭐ 新增：从 TAPD API 获取工作空间的真实名称
 *
 * 使用 TAPD OpenAPI 接口获取 workspace 信息
 */
async function fetchWorkspaceNameFromAPI(workspaceId: string): Promise<string | null> {
  try {
    // 获取系统配置的TAPD账号（与 fetchTasksFromAPI 一致）
    const config = await prisma.systemSetting.findUnique({
      where: { key: 'tapd_api_config' },
    });

    if (!config?.value) {
      console.warn('[data.provider] 未配置TAPD API账号');
      return null;
    }

    let tapdConfig;
    try {
      tapdConfig = JSON.parse(config.value);
    } catch {
      console.warn('[data.provider] TAPD配置格式错误');
      return null;
    }

    const { apiUser, apiPassword } = tapdConfig;
    if (!apiUser || !apiPassword) {
      console.warn('[data.provider] TAPD API凭据未配置');
      return null;
    }

    // 构造Basic Auth（与 fetchTasksFromAPI 一致）
    const credentials = Buffer.from(`${apiUser}:${apiPassword}`).toString('base64');

    // 调用 TAPD Workspace API（使用官方文档的正确格式）
    // 参考: https://open.tapd.cn/document/api-doc/API文档/api_reference/workspace/get_workspace_info.html
    const apiUrl = `https://api.tapd.cn/workspaces/get_workspace_info?workspace_id=${workspaceId}`;

    console.log(`[data.provider] 调用TAPD Workspace API: ${apiUrl}`);

    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.warn(`[data.provider] TAPD workspace API 返回 ${response.status}: ${response.statusText}`);
      return null;
    }

    const json = await response.json();

    console.log(`[data.provider] TAPD Workspace API 原始响应:`, JSON.stringify(json).slice(0, 500));

    // 解析返回的数据结构（根据官方文档）
    // 官方格式: { status: 1, data: { Workspace: { id: "...", name: "..." } }, info: "success" }
    if (json?.status === 1 && json?.data?.Workspace) {
      const workspaceData = json.data.Workspace;
      console.log(`[data.provider] ✅ 成功解析Workspace数据:`, {
        id: workspaceData.id,
        name: workspaceData.name,
        prettyName: workspaceData.pretty_name,
      });
      return workspaceData.name;
    }

    // 兼容其他可能的格式
    const workspaceData =
      json?.data?.Workspace ||
      json?.Workspace ||
      json?.workspace ||
      json?.data;

    if (workspaceData?.name) {
      console.log(`[data.provider] ✅ 使用兼容格式解析成功:`, workspaceData.name);
      return workspaceData.name;
    }

    console.warn(
      '[data.provider] ⚠️ TAPD workspace API 返回数据结构异常:',
      JSON.stringify(json).slice(0, 500)
    );
    return null;
  } catch (error) {
    console.error('[data.provider] fetchWorkspaceNameFromAPI error:', error);
    return null;
  }
}

// ============================================================
// Workspace任务数据获取
// ============================================================

/**
 * 获取指定workspace的任务数据
 * 优先从TAPD官方API实时获取，失败时回退到本地数据库
 *
 * 按照规则：
 * 1. 只取Task数据（不用Story）
 * 2. 取查询时间周期范围内的task（task的预计开始到预计结束在查询范围）
 * 3. 支持多人任务拆分（owner字段用;分割）
 *
 * @param workspaceId - TAPD工作空间ID
 * @param dateRange - 日期范围筛选
 * @returns 任务列表
 */
export async function getWorkspaceData(
  workspaceId: string,
  dateRange: { start: Date; end: Date }
): Promise<WorkspaceRawData> {
  let workspaceName = '';
  let tasks: WorkspaceRawData['tasks'] = [];

  try {
    // ---- 1. 获取workspace基本信息 ----
    const ws = await prisma.tapdWorkspace.findUnique({
      where: { id: workspaceId },
      select: { id: true, name: true },
    });
    workspaceName = ws?.name || `项目${workspaceId}`;

    // ---- 2. 获取Task数据（优先API，回退DB）----
    let taskList: any[] = [];

    // 策略1：优先从TAPD官方API获取
    try {
      const apiTasks = await fetchTasksFromAPI(workspaceId, dateRange);
      if (apiTasks.length > 0) {
        taskList = apiTasks;
        console.log(`[data.provider] Workspace ${workspaceId}: ${taskList.length} tasks from API`);
      } else {
        throw new Error('API返回空数据');
      }
    } catch (apiError) {
      console.warn(`[data.provider] API获取Task失败，回退到数据库:`, apiError);
      
      // 策略2：回退到本地数据库
      taskList = await fetchTasksFromDB(workspaceId, dateRange);
      console.log(`[data.provider] Workspace ${workspaceId}: ${taskList.length} tasks from DB`);
    }

    // ---- 3. 处理多人任务拆分 ----
    // 规则：如有2个处理人（用;分割），则计算该task的处理人有2个
    // 清理owner字段：去除所有异常字符（分号、空格、逗号等）
    const cleanOwner = (name: string | null): string => {
      if (!name) return '';
      return name.replace(/[\s;,，；、。.\n\r\t]+/g, ' ').trim();
    };

    const splitOwners = (ownerStr: string | null): string[] => {
      if (!ownerStr) return [];
      const cleaned = cleanOwner(ownerStr);
      if (!cleaned) return [];
      // 按;或中文分号分割
      return cleaned.split(/[;；]/).map(s => s.trim()).filter(Boolean);
    };

    // 转换格式并拆分多人任务
    for (const t of taskList) {
      const owners = splitOwners(t.owner);

      // 如果没有处理人，跳过
      if (owners.length === 0) continue;

      // 如果只有1个处理人，直接添加
      if (owners.length === 1) {
        tasks.push({
          id: t.id,
          name: t.name,
          owner: owners[0],
          status: t.status,
          effort: t.effort ? parseFloat(t.effort) : undefined,
          effortCompleted: t.effortCompleted ? parseFloat(t.effortCompleted) : undefined,
          begin: t.begin ? new Date(t.begin) : undefined,
          due: t.due ? new Date(t.due) : undefined,
          storyId: t.storyId || undefined,
          iterationId: t.iteration_id || undefined,  // 迭代ID
          workspaceId: t.workspaceId,
        });
      } else {
        // 多人任务：拆分为多条记录，每条对应一个处理人
        // 预估工时平均分配给每个处理人
        const avgEffort = t.effort ? parseFloat(t.effort) / owners.length : undefined;
        const avgEffortCompleted = t.effortCompleted ? parseFloat(t.effortCompleted) / owners.length : undefined;

        for (const owner of owners) {
          tasks.push({
            id: t.id,
            name: t.name,
            owner: owner,
            status: t.status,
            effort: avgEffort,
            effortCompleted: avgEffortCompleted,
            begin: t.begin ? new Date(t.begin) : undefined,
            due: t.due ? new Date(t.due) : undefined,
            storyId: t.storyId || undefined,
            iterationId: t.iteration_id || undefined,  // 迭代ID
            workspaceId: t.workspaceId,
          });
        }
      }
    }

    console.log(`[data.provider] Workspace ${workspaceId}: ${taskList.length} tasks (raw), ${tasks.length} tasks (after multi-owner split)`);
  } catch (error) {
    console.error(`[data.provider] getWorkspaceData(${workspaceId}) error:`, error);
    // 返回空结果而非抛出异常，保证系统可用性
  }

  return {
    workspaceId,
    workspaceName,
    tasks,
  };
}

// ============================================================
// Timesheet（实际工时）数据获取
// ============================================================

/**
 * Timesheet数据结构
 */
export interface TimesheetData {
  id: string;
  entityType: string;    // story, task, bug
  entityId: string;
  timespent: number;     // 花费工时
  spentdate: Date;       // 花费日期
  owner: string;
  workspaceId: string;
}

/**
 * 获取指定workspace和时间范围内的实际工时数据
 * 优先从TAPD官方API实时获取，失败时回退到本地数据库
 *
 * 规则：人员task的实际花费工时来自timesheet表
 *
 * @param workspaceId - TAPD工作空间ID
 * @param dateRange - 日期范围筛选
 * @returns 工时记录列表
 */
export async function getWorkspaceTimesheets(
  workspaceId: string,
  dateRange: { start: Date; end: Date }
): Promise<TimesheetData[]> {
  // 策略1：优先尝试从TAPD官方API获取（实时数据）
  try {
    const apiData = await fetchTimesheetsFromAPI(workspaceId, dateRange);
    if (apiData.length > 0) {
      console.log(`[data.provider] Workspace ${workspaceId}: ${apiData.length} timesheet records from API`);
      return apiData;
    }
  } catch (apiError) {
    console.warn(`[data.provider] API获取Timesheet失败，回退到数据库:`, apiError);
  }

  // 策略2：回退到本地数据库
  try {
    const dbData = await fetchTimesheetsFromDB(workspaceId, dateRange);
    console.log(`[data.provider] Workspace ${workspaceId}: ${dbData.length} timesheet records from DB`);
    return dbData;
  } catch (dbError) {
    console.error(`[data.provider] 数据库获取Timesheet也失败:`, dbError);
    return [];
  }
}

/**
 * 从TAPD官方API获取Timesheet数据
 */
async function fetchTimesheetsFromAPI(
  workspaceId: string,
  dateRange: { start: Date; end: Date }
): Promise<TimesheetData[]> {
  // 方案A：直接调用TAPD官方API（更简单高效）
  try {
    const { prisma } = await import('@/lib/prisma');
    
    // 获取系统配置的TAPD账号
    const config = await prisma.systemSetting.findUnique({
      where: { key: 'tapd_api_config' },
    });

    if (!config?.value) {
      throw new Error('未配置TAPD API账号');
    }

    let tapdConfig;
    try {
      tapdConfig = JSON.parse(config.value);
    } catch {
      throw new Error('TAPD配置格式错误');
    }

    const { apiUser, apiPassword } = tapdConfig;
    if (!apiUser || !apiPassword) {
      throw new Error('TAPD API凭据未配置');
    }

    // 构造Basic Auth
    const credentials = Buffer.from(`${apiUser}:${apiPassword}`).toString('base64');

    // 直接调用TAPD Timesheet API
    const apiUrl = `https://api.tapd.cn/timesheets?workspace_id=${workspaceId}&spentdate_start=${formatDate(dateRange.start)}&spentdate_end=${formatDate(dateRange.end)}&limit=200&page=1`;

    const resp = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/json',
      },
    });

    if (!resp.ok) {
      throw new Error(`HTTP ${resp.status}`);
    }

    const result = await resp.json();

    // TAPD API返回格式: { data: [{ Timesheet: {...} }, ...], info: "success" }
    const items = result.data || [];

    // 提取并转换数据
    const timesheets: TimesheetData[] = [];

    for (const item of items) {
      // TAPD返回格式: { Timesheet: { id, entity_type, ... } }
      const ts = item.Timesheet || item;

      if (!ts.owner || !ts.spentdate) continue;
      
      const timespent = parseFloat(ts.timespent);
      if (isNaN(timespent) || timespent <= 0) continue;  // 只统计有效工时

      timesheets.push({
        id: ts.id,
        entityType: ts.entity_type || 'task',
        entityId: String(ts.entity_id || ''),
        timespent: timespent,
        spentdate: new Date(ts.spentdate),
        owner: ts.owner,
        workspaceId: workspaceId,
      });
    }

    console.log(`[data.provider] TAPD API返回 ${items.length} 条原始记录，有效记录 ${timesheets.length} 条`);
    
    return timesheets;

  } catch (error) {
    console.error('[data.provider] fetchTimesheetsFromAPI error:', error);
    throw error;  // 抛出错误，让外层回退到数据库查询
  }
}

/**
 * 从本地数据库获取Timesheet数据（回退方案）
 */
async function fetchTimesheetsFromDB(
  workspaceId: string,
  dateRange: { start: Date; end: Date }
): Promise<TimesheetData[]> {
  const timesheets = await prisma.tapdTimesheet.findMany({
    where: {
      workspaceId,
      isDelete: false,
      spentdate: {
        gte: dateRange.start,
        lte: dateRange.end,
      },
      owner: { not: null },
    },
    select: {
      id: true,
      entityType: true,
      entityId: true,
      timespent: true,
      spentdate: true,
      owner: true,
      workspaceId: true,
    },
  });

  return timesheets.map(ts => ({
    id: ts.id,
    entityType: ts.entityType,
    entityId: ts.entityId,
    timespent: ts.timespent || 0,
    spentdate: new Date(ts.spentdate!),
    owner: ts.owner!,
    workspaceId: ts.workspaceId,
  }));
}

/**
 * 格式化日期为YYYY-MM-DD格式（TAPD API要求）
 */
function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// ============================================================
// Task数据获取（TAPD API + 数据库回退）
// ============================================================

/**
 * 从TAPD官方API获取Task数据
 * API文档：https://open.tapd.cn/document/api-doc/API文档/api_reference/task/get_tasks.html
 *
 * @param workspaceId - TAPD工作空间ID
 * @param dateRange - 日期范围筛选（用于后过滤）
 * @returns 任务列表（原始格式）
 */
async function fetchTasksFromAPI(
  workspaceId: string,
  dateRange: { start: Date; end: Date }
): Promise<any[]> {
  // 获取系统配置的TAPD账号
  const config = await prisma.systemSetting.findUnique({
    where: { key: 'tapd_api_config' },
  });

  if (!config?.value) {
    throw new Error('未配置TAPD API账号');
  }

  let tapdConfig;
  try {
    tapdConfig = JSON.parse(config.value);
  } catch {
    throw new Error('TAPD配置格式错误');
  }

  const { apiUser, apiPassword } = tapdConfig;
  if (!apiUser || !apiPassword) {
    throw new Error('TAPD API凭据未配置');
  }

  // 构造Basic Auth
  const credentials = Buffer.from(`${apiUser}:${apiPassword}`).toString('base64');

  // 调用TAPD Task API
  // 注意：必须通过fields参数显式请求begin/due等字段，否则TAPD默认可能不返回这些字段
  const requiredFields = [
    'id', 'name', 'description', 'workspace_id', 'creator', 'created', 'modified',
    'status', 'owner', 'cc', 'begin', 'due', 'story_id', 'iteration_id',
    'priority_label', 'priority', 'progress', 'completed',
    'effort_completed', 'exceed', 'remain', 'effort'
  ].join(',');
  const apiUrl = `https://api.tapd.cn/tasks?workspace_id=${workspaceId}&limit=200&page=1&fields=${requiredFields}`;

  console.log(`[data.provider] 调用TAPD Task API: ${apiUrl}`);

  const resp = await fetch(apiUrl, {
    method: 'GET',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/json',
    },
  });

  if (!resp.ok) {
    throw new Error(`HTTP ${resp.status}`);
  }

  const result = await resp.json();

  // TAPD API返回格式: { data: [{ Task: {...} }, ...], info: "success" }
  const rawItems = result.data || [];

  console.log(`[data.provider] TAPD Task API返回 ${rawItems.length} 条原始记录`);

  // 调试：打印第一条任务的完整字段，确认TAPD实际返回的字段名
  if (rawItems.length > 0) {
    const sampleTask = rawItems[0].Task || rawItems[0];
    console.log(`[data.provider] ⭐ TAPD任务样例字段:`, Object.keys(sampleTask).join(', '));
    // 打印所有包含日期/时间的关键字段
    const dateFields = {};
    for (const [k, v] of Object.entries(sampleTask)) {
      if (k.toLowerCase().includes('date') || k.toLowerCase().includes('start') ||
          k.toLowerCase().includes('end') || k.toLowerCase().includes('due') ||
          k.toLowerCase().includes('begin') || k.toLowerCase().includes('expect') ||
          k.toLowerCase().includes('dead') || k.toLowerCase().includes('complete')) {
        dateFields[k] = v;
      }
    }
    if (Object.keys(dateFields).length > 0) {
      console.log(`[data.provider] ⭐ TAPD日期相关字段:`, JSON.stringify(dateFields));
    } else {
      console.log(`[data.provider] ⚠️ TAPD任务中未找到任何日期相关字段！`);
    }
    // 检查邓明霜相关的任务
    const dengTasks = rawItems.filter((item: any) => {
      const t = item.Task || item;
      return t.owner && (t.owner.includes('邓明霜') || t.owner.includes('deng'));
    });
    if (dengTasks.length > 0) {
      console.log(`[data.provider] ⭐ 邓明霜相关任务数: ${dengTasks.length}`);
      dengTasks.slice(0, 2).forEach((item: any, i: number) => {
        const t = item.Task || item;
        console.log(`[data.provider]   [${i}] ${t.name} | owner=${t.owner} | 全部字段:`, JSON.stringify(t).slice(0, 500));
      });
    }
  }

  // 转换为统一格式并按时间范围过滤
  const filteredTasks = rawItems
    .map((item: any) => {
      const task = item.Task || item;
      
      return {
        id: task.id,
        name: task.name,
        owner: task.owner,
        status: task.status,
        effort: task.effort,           // 预估工时 ✅ 关键字段！
        effortCompleted: task.effort_completed || task.effortCompleted,  // 完成工时
        remain: task.remain,           // 剩余工时
        // TAPD API 可能使用不同字段名表示预计开始/结束日期，按优先级尝试
        begin: task.begin || task.expect_start || task.start || null,
        due: task.due || task.expect_complete || task.deadline || task.end || null,
        storyId: task.story_id || task.storyId,
        workspaceId: workspaceId,
      };
    })
    .filter((task: any) => {
      // 按时间范围过滤：task的预计开始到预计结束在查询范围内
      const taskBegin = task.begin ? new Date(task.begin).getTime() : 0;
      const taskDue = task.due ? new Date(task.due).getTime() : Infinity;
      const rangeStart = dateRange.start.getTime();
      const rangeEnd = dateRange.end.getTime();

      // 任务时间段与查询范围有交集
      // 条件：任务开始 <= 查询结束 且 任务结束 >= 查询开始
      return (taskBegin <= rangeEnd && taskDue >= rangeStart);
    });

  console.log(`[data.provider] 过滤后剩余 ${filteredTasks.length} 条任务`);

  return filteredTasks;
}

/**
 * 从本地数据库获取Task数据（回退方案）
 *
 * @param workspaceId - TAPD工作空间ID
 * @param dateRange - 日期范围筛选
 * @returns 任务列表
 */
async function fetchTasksFromDB(
  workspaceId: string,
  dateRange: { start: Date; end: Date }
): Promise<any[]> {
  return prisma.tapdTask.findMany({
    where: {
      workspaceId,
      // 任务时间与查询范围有交集
      AND: [
        // begin不为空且 <= 查询结束日期，或者begin为空
        {
          OR: [
            {
              AND: [
                { begin: { not: null } },
                { begin: { lte: dateRange.end } },
              ],
            },
            { begin: null },
          ],
        },
        // due不为空且 >= 查询开始日期，或者due为空
        {
          OR: [
            {
              AND: [
                { due: { not: null } },
                { due: { gte: dateRange.start } },
              ],
            },
            { due: null },
          ],
        },
      ],
    },
    select: {
      id: true,
      name: true,
      owner: true,
      status: true,
      effort: true,           // 预估工时
      effortCompleted: true,  // 完成工时
      remain: true,           // 剩余工时
      begin: true,            // 预计开始
      due: true,              // 预计结束
      storyId: true,
      workspaceId: true,
    },
  });
}
