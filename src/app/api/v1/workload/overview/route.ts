/**
 * GET /api/v1/workload/overview
 * 概览API - 返回组织级饱和度 + 团队列表 + 角色端汇总
 *
 * Query Params:
 *   - startDate: 开始日期 (YYYY-MM-DD)
 *   - endDate: 结束日期 (YYYY-MM-DD)
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getAllTeamConfigs,
  getMemberRoleMappings,
  getProjectNameMap,
  getWorkspaceData,
  getWorkspaceTimesheets,  // 新增：获取实际工时数据
} from '../_lib/data.provider';
import { buildTeamTree } from '../_lib/team.aggregator';
import { calcWorkDays, getDateRangeArray } from '../_lib/workday.calc';
import { buildDailyLoad } from '../_lib/daily.decomposer';
import {
  calcPersonSaturation,
  aggregateByRole,
  aggregateByTeam,
  aggregateOrg,
} from '../_lib/saturation.engine';
import type { WorkloadOverviewResponse } from '../_lib/types';

export async function GET(req: NextRequest) {
  try {
    // ---- 1. 解析参数 ----
    const sp = new URL(req.url).searchParams;
    const sd = sp.get('startDate');
    const ed = sp.get('endDate');

    if (!sd || !ed) {
      return NextResponse.json(
        { success: false, message: '缺少日期参数 startDate/endDate' },
        { status: 400 }
      );
    }

    const start = new Date(sd);
    const end = new Date(ed);

    // ---- 2. 并行获取基础数据 ----
    const [teamConfigs, roleMappings, projectNameMap] = await Promise.all([
      getAllTeamConfigs(),
      getMemberRoleMappings(),
      getProjectNameMap(),
    ]);

    if (teamConfigs.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          org: {
            totalPeople: 0,
            totalCapacity: 0,
            totalActual: 0,
            saturation: 0,
          },
          teams: [],
          roleSummary: [],
        },
      });
    }

    // ---- 3. 获取所有workspace的任务数据 ----
    const allWorkspaceIds = new Set<string>(
      teamConfigs.flatMap((tc) => tc.tapdProjectIds)
    );

    const workspaceDataMap = new Map<
      string,
      Awaited<ReturnType<typeof getWorkspaceData>>
    >();

    for (const wsId of allWorkspaceIds) {
      try {
        const data = await getWorkspaceData(wsId, { start, end });
        workspaceDataMap.set(wsId, data);
      } catch (error) {
        console.error(`[overview] Failed to load workspace ${wsId}:`, error);
      }
    }

    // ---- 4. 合并所有任务 ----
    const allTasks: Array<{
      id: string;                        // TAPD任务ID（用于链接）
      owner: string;
      workspaceId: string;
      effort: number;
      effortCompleted?: number;          // 完成工时
      iterationId?: string;              // 迭代ID
      begin?: Date;
      due?: Date;
      status?: string;
      name: string;
      storyId?: string;
    }> = [];

    for (const [, wd] of workspaceDataMap) {
      for (const t of wd.tasks) {
        if (t.owner) {
          allTasks.push({
            id: t.id || t.name,           // TAPD任务ID（优先用ID，fallback到name）
            owner: t.owner,
            workspaceId: t.workspaceId,
            effort: t.effort || 0,
            effortCompleted: t.effortCompleted || 0,  // 完成工时
            iterationId: t.iterationId,              // 迭代ID
            begin: t.begin,
            due: t.due,
            status: t.status || '',
            name: t.name,
            storyId: t.storyId,
          });
        }
      }
    }

    // ---- 4.5 获取Timesheet实际工时数据（从TAPD API或数据库）----
    const allTimesheets: Array<{
      owner: string;
      workspaceId: string;
      timespent: number;
      spentdate: Date;
    }> = [];

    for (const wsId of allWorkspaceIds) {  // 使用已定义的allWorkspaceIds
      try {
        const timesheets = await getWorkspaceTimesheets(wsId, { start, end });
        for (const ts of timesheets) {
          if (ts.owner && ts.timespent > 0) {
            allTimesheets.push({
              owner: ts.owner,
              workspaceId: ts.workspaceId,
              timespent: ts.timespent,
              spentdate: ts.spentdate,
            });
          }
        }
      } catch (error) {
        console.error(`[overview] Failed to load timesheets for ${wsId}:`, error);
      }
    }

    // ---- 5. 计算工作日和每日工时分解 ----
    const workDays = calcWorkDays({
      startDate: start,
      endDate: end,
      holidays: new Set(),     // TODO: 接入假日API
      extraWorkdays: new Set(), // TODO: 接入加班日API
    });

    const dailyBreakdowns = new Map<string, Record<string, number>>();

    // ⭐ 新增：按人员/日期分解 Timesheet 实际工时
    const dailyActualHoursMap = new Map<string, Record<string, number>>();

    // 统一的名称清理函数（与 team.aggregator.ts 保持一致）
    const cleanOwner = (name: string | null | undefined): string => {
      if (!name) return '';
      return name.replace(/[\s;,，；、。.\n\r\t]+/g, ' ').trim();
    };

    // 按人员分组任务（使用清理后的名称作为key）
    const personTasks = new Map<typeof allTasks>();
    for (const t of allTasks) {
      const name = cleanOwner(t.owner);
      if (!name) continue;
      if (!personTasks.has(name)) personTasks.set(name, []);
      personTasks.get(name)!.push(t);
    }

    // ⭐ 新增：按人员分组 Timesheet 实际工时（使用清理后的名称作为key）
    const personTimesheets = new Map<typeof allTimesheets>();
    for (const ts of allTimesheets) {
      const name = cleanOwner(ts.owner);
      if (!name) continue;
      if (!personTimesheets.has(name)) personTimesheets.set(name, []);
      personTimesheets.get(name)!.push(ts);
    }

    // 为每个人计算每日预估工时（来自任务）
    for (const [name, tasks] of personTasks) {
      const breakdown = buildDailyLoad(
        tasks.map((t) => ({
          id: t.name,
          name: t.name,
          owner: t.owner,
          status: t.status || '',
          effort: t.effort,
          effortCompleted: t.effortCompleted || 0,
          begin: t.begin,
          due: t.due,
          workspaceId: t.workspaceId,
        })),
        start,
        end,
        new Set(),
        new Set()
      );
      dailyBreakdowns.set(name, breakdown);

      // 调试：检查邓明霜的每日工时
      if (name.includes('邓明霜') || name.includes('deng')) {
        const totalHours = Object.values(breakdown).reduce((s, h) => s + h, 0);
        console.log(`[overview] dailyBreakdowns key="${name}", 任务数=${tasks.length}, 总预估工时=${totalHours}h`, JSON.stringify(breakdown));
      }
    }

    // ⭐ 新增：为每个人计算每日实际工时（来自 Timesheet）
    for (const [name, timesheets] of personTimesheets) {
      const actualHours: Record<string, number> = {};
      for (const ts of timesheets) {
        const dateKey = ts.spentdate.toISOString().slice(0, 10);
        actualHours[dateKey] = (actualHours[dateKey] || 0) + ts.timespent;
      }
      dailyActualHoursMap.set(name, actualHours);
    }

    // ---- 6. 构建团队归因树 ----
    const { teamPersonMap } = await buildTeamTree({
      teamConfigs: teamConfigs.map((tc) => ({
        id: tc.id,
        name: tc.name,
        tapdProjectIds: tc.tapdProjectIds,
      })),
      allTasks,
      allTimesheets,  // 传入Timesheet实际工时数据
      roleMappings,
      workDays,
      dailyBreakdowns,
      dailyActualHoursMap,  // ⭐ 新增：传入每日实际工时数据
      projectNameMap,
    });

    // ---- 7. 计算各层级聚合结果 ----
    // Level-5 → Level-2: 团队聚合
    const teamRawConfigs = teamConfigs.map((tc) => ({
      teamId: tc.id,
      teamName: tc.name,
      projectIds: tc.tapdProjectIds,
      projectNames: projectNameMap,
      persons: teamPersonMap.get(tc.id) || [],
    }));

    const teams = aggregateByTeam(teamRawConfigs);

    // Level-4: 角色端聚合（按新规则：过去实际工时 + 未来预估工时）
    const allPersons = [...teamPersonMap.values()].flat();
    const roleSummary = aggregateByRole(allPersons, workDays);  // ⭐ 传入 workDays 参数

    // Level-1: 组织汇总
    const org = aggregateOrg(teams);

    // ---- 8. 构建响应 ----
    // 补全人员数据：包含前端组件所需的全部字段
    // taskList 已在 buildTeamTree 内部从 ptMap 构建，直接复用
    const fullPersonResults = allPersons.map((p) => ({
      name: p.name,
      role: p.role,
      roleName: p.roleName,
      teamName: p.teamName,
      mainProject: p.mainProject,
      project: p.mainProject,              // 前端 CalendarHeatmap 需要
      totalEffort: p.totalEffort,
      actual: p.totalEffort,               // 前端需要实际工时字段
      capacity: p.capacity,
      saturation: p.saturation,
      workDayCount: p.workDayCount,
      dailyBreakdown: p.dailyBreakdown || {},       // 日历热力图需要每日预估工时
      dailyActualHours: p.dailyActualHours || {},   // 日历热力图需要每日实际工时
      taskList: p.taskList || [],          // 直接使用 buildTeamTree 构建的 taskList
      loanStatus: p.loanStatus,
    }));

    const response: WorkloadOverviewResponse = {
      org,
      teams,
      roleSummary,
      personSatResults: fullPersonResults,
    };

    return NextResponse.json({ success: true, data: response });
  } catch (error) {
    console.error('[GET /workload/overview]', error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : '服务器内部错误',
      },
      { status: 500 }
    );
  }
}
