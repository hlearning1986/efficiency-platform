/**
 * GET /api/v1/workload/persons/[name]/detail
 * 人员明细API - 返回日历热力图 + 项目工时分布 + 任务时间线
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
} from '../../../_lib/data.provider';
import { buildDailyLoad } from '../../../_lib/daily.decomposer';
import { calcWorkDays, getDateRangeArray } from '../../../_lib/workday.calc';
import {
  DAILY_CAPACITY_HOURS,
  getProjectColor,
} from '../../../_lib/constants';
import type {
  PersonDetailResponse,
  CalendarDayItem,
  ProjectDistItem,
  TaskTimelineItem,
  TaskStatus,
  PersonListItem,
} from '../../../_lib/types';

interface RouteParams {
  params: Promise<{ name: string }>;
}

export async function GET(req: NextRequest, context: RouteParams) {
  try {
    // ---- 1. 解析参数 ----
    const { name: encodedName } = await context.params;
    const displayName = decodeURIComponent(encodedName);

    const sp = new URL(req.url).searchParams;
    const sd = sp.get('startDate');
    const ed = sp.get('endDate');

    if (!sd || !ed) {
      return NextResponse.json(
        { success: false, message: '缺少日期参数' },
        { status: 400 }
      );
    }

    const start = new Date(sd);
    const end = new Date(ed);

    // ---- 2. 获取基础数据 ----
    const [teamConfigs, roleMappings, projectNameMap] = await Promise.all([
      getAllTeamConfigs(),
      getMemberRoleMappings(),
      getProjectNameMap(),
    ]);

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
        console.error(`[detail] Failed to load ${wsId}:`, error);
      }
    }

    // ---- 4. 过滤该人员的全部任务 ----
    const personTasks: Array<{
      id: string;
      name: string;
      owner?: string | null;
      workspaceId: string;
      effort?: number | null;
      effortCompleted?: number | null;
      begin?: Date | null;
      due?: Date | null;
      status?: string | null;
      storyId?: string | null;
    }> = [];

    for (const [, wd] of workspaceDataMap) {
      for (const t of wd.tasks) {
        if (t.owner === displayName) {
          personTasks.push({
            id: t.id,
            name: t.name,
            owner: t.owner,
            workspaceId: t.workspaceId,
            effort: t.effort ? parseFloat(String(t.effort)) : undefined,
            effortCompleted: t.effortCompleted
              ? parseFloat(String(t.effortCompleted))
              : undefined,
            begin: t.begin,
            due: t.due,
            status: t.status,
            storyId: t.storyId,
          });
        }
      }
    }

    // ---- 5. 计算工作日和每日分解 ----
    const workDays = calcWorkDays({
      start,
      end,
      holidays: new Set(),
      extraWorkdays: new Set(),
    });

    const allDates = getDateRangeArray(start, end);
    const dailyBreakdown = buildDailyLoad(
      personTasks.map((t) => ({
        id: t.id,
        name: t.name,
        owner: t.owner || '',
        status: t.status || '',
        effort: t.effort || 0,
        effortCompleted: t.effortCompleted || 0,
        begin: t.begin || undefined,
        due: t.due || undefined,
        storyId: t.storyId || undefined,
        workspaceId: t.workspaceId,
      })),
      start,
      end,
      new Set(),
      new Set()
    );

    // ---- 6. 构建日历热力图数据 ----
    const calendarHeatmap: CalendarDayItem[] = allDates.map((dateStr) => {
      const d = new Date(dateStr);
      const hours = dailyBreakdown[dateStr] || 0;
      const saturation =
        DAILY_CAPACITY_HOURS > 0
          ? Math.round((hours / DAILY_CAPACITY_HOURS) * 1000) / 10
          : 0;

      // 统计当天涉及的项目
      const dayProjects = new Set<string>();
      let taskCount = 0;

      for (const t of personTasks) {
        if (t.begin && t.due) {
          const tb = new Date(t.begin);
          const td = new Date(t.due);
          if (d >= tb && d <= td) {
            dayProjects.add(t.workspaceId);
            taskCount++;
          }
        }
      }

      return {
        date: dateStr,
        dayOfWeek: d.getDay(),
        isWorkday: d.getDay() !== 0 && d.getDay() !== 6,
        isHoliday: false,
        isExtraWorkday: false,
        saturation,
        actualHours: hours,
        capacityHours: DAILY_CAPACITY_HOURS,
        projects: [...dayProjects].map(
          (ws) => projectNameMap.get(ws) || ws
        ),
        taskCount,
      };
    });

    // ---- 7. 构建项目工时分布 ----
    const projectEffortMap = new Map<string, number>();
    for (const t of personTasks) {
      projectEffortMap.set(
        t.workspaceId,
        (projectEffortMap.get(t.workspaceId) || 0) + (t.effort || 0)
      );
    }

    const totalEffort = [...projectEffortMap.values()].reduce(
      (s, v) => s + v,
      0
    );

    const projectDistribution: ProjectDistItem[] = [
      ...projectEffortMap.entries(),
    ]
      .map(([wsId, hours]) => ({
        projectId: wsId,
        projectName: projectNameMap.get(wsId) || `项目${wsId}`,
        hours: Math.round(hours * 10) / 10,
        percentage:
          totalEffort > 0
            ? Math.round((hours / totalEffort) * 1000) / 10
            : 0,
        color: getProjectColor(wsId),
      }))
      .sort((a, b) => b.hours - a.hours);

    // ---- 8. 构建任务时间线 ----
    const statusLabelMap: Record<string, string> = {
      done: '已完成',
      closed: '已完成',
      in_progress: '进行中',
      processing: '进行中',
      todo: '待开始',
    };

    const taskTimeline: TaskTimelineItem[] = personTasks
      .map((t) => {
        const status = normalizeTaskStatus(t.status || '');
        const actHours = t.effortCompleted || 0;
        const estHours = t.effort || 0;
        const progressPct =
          estHours > 0 ? Math.round((actHours / estHours) * 1000) / 10 : 0;

        // 计算每日工时（均摊到工作日）
        const dailyHours: Record<string, number> = {};
        if (t.begin && t.due) {
          const taskWorkDays = calcWorkDays({
            start: new Date(t.begin),
            end: new Date(t.due),
            holidays: new Set(),
            extraWorkdays: new Set(),
          });
          const dailyAvg =
            estHours > 0 && taskWorkDays.length > 0
              ? Math.round((estHours / taskWorkDays.length) * 100) / 100
              : 0;

          for (const tw of taskWorkDays) {
            dailyHours[tw.toISOString().slice(0, 10)] = dailyAvg;
          }
        }

        return {
          id: t.id,
          name: t.name,
          projectName: projectNameMap.get(t.workspaceId) || '',
          projectId: t.workspaceId,
          status,
          statusLabel: statusLabelMap[status] || t.status || '未知',
          startDate: t.begin ? t.begin.toISOString().slice(0, 10) : '',
          endDate: t.due ? t.due.toISOString().slice(0, 10) : '',
          estHours,
          actHours,
          progressPct,
          dailyHours,
          color: getProjectColor(t.workspaceId),
          storyId: t.storyId || undefined,
          storyName: '', // TODO: 可选查询story名称
        };
      })
      .sort((a, b) => a.startDate.localeCompare(b.startDate));

    // ---- 9. 构建人员基本信息 ----
    const person: PersonListItem = {
      name: displayName,
      avatar: generateAvatarColor(displayName),
      team: '', // 由前端从列表获取
      project: '',
      role: 'frontend', // 默认值，实际由归因器确定
      roleName: '前端开发',
      days: workDays.length,
      actual: personTasks.reduce((s, t) => s + (t.effort || 0), 0),
      cap: workDays.length * DAILY_CAPACITY_HOURS,
      sat:
        workDays.length > 0
          ? Math.round(
              (personTasks.reduce((s, t) => s + (t.effort || 0), 0) /
                (workDays.length * DAILY_CAPACITY_HOURS)) *
                1000
            ) / 10
          : 0,
    };

    // ---- 10. 构建响应 ----
    const response: PersonDetailResponse = {
      person,
      calendarHeatmap,
      projectDistribution,
      taskTimeline,
    };

    return NextResponse.json({ success: true, data: response });
  } catch (error) {
    console.error('[GET /workload/persons/[name]/detail]', error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : '服务器内部错误',
      },
      { status: 500 }
    );
  }
}

/**
 * 规范化任务状态
 */
function normalizeTaskStatus(raw: string): TaskStatus {
  const l = raw.toLowerCase();
  if (['done', 'closed'].includes(l)) return 'done';
  if (['in_progress', 'processing'].includes(l)) return 'in_progress';
  return 'todo';
}

/**
 * 根据姓名生成头像颜色
 */
function generateAvatarColor(name: string): string {
  const colors = [
    '#1677ff', '#722ed1', '#13c2c2', '#eb2f96',
    '#fa8c16', '#52c41a',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0;
  }
  return colors[Math.abs(hash) % colors.length];
}
