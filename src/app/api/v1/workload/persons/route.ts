/**
 * GET /api/v1/workload/persons
 * 人员列表API - 返回筛选后的人员饱和度数据
 *
 * Query Params:
 *   - startDate: 开始日期 (YYYY-MM-DD)
 *   - endDate: 结束日期 (YYYY-MM-DD)
 *   - teamId: 团队ID（可选）
 *   - projectId: 项目ID（可选）
 *   - role: 角色（可选：frontend/backend/mobile/test）
 *   - name: 姓名搜索关键词（可选，模糊匹配）
 *   - page: 页码（默认1）
 *   - pageSize: 每页条数（默认50）
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
import { calcWorkDays } from '../_lib/workday.calc';
import { buildDailyLoad } from '../_lib/daily.decomposer';
import type { PersonListItem } from '../_lib/types';
import { DEFAULT_PAGE_SIZE } from '../_lib/constants';

export async function GET(req: NextRequest) {
  try {
    // ---- 1. 解析参数 ----
    const sp = new URL(req.url).searchParams;
    const sd = sp.get('startDate');
    const ed = sp.get('endDate');
    const tid = sp.get('teamId') || '';
    const pid = sp.get('projectId') || '';
    const role = sp.get('role') as string | undefined;
    const nk = sp.get('name') || '';
    const pg = parseInt(sp.get('page') || '1', 10);
    const psz = parseInt(sp.get('pageSize') || String(DEFAULT_PAGE_SIZE), 10);

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

    // ---- 3. 获取workspace任务数据 ----
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
        console.error(`[persons] Failed to load ${wsId}:`, error);
      }
    }

    // ---- 4. 合并所有任务 ----
    const allTasks: Array<{
      owner: string;
      workspaceId: string;
      effort: number;
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
            owner: t.owner,
            workspaceId: t.workspaceId,
            effort: t.effort || 0,
            begin: t.begin,
            due: t.due,
            status: t.status || '',
            name: t.name,
            storyId: t.storyId,
          });
        }
      }
    }

    // ---- 5. 计算工作日和每日分解 ----
    const workDays = calcWorkDays({
      startDate: start,
      endDate: end,
      holidays: new Set(),
      extraWorkdays: new Set(),
    });

    const dailyBreakdowns = new Map<string, Record<string, number>>();
    const personTasks = new Map<typeof allTasks>();

    // 统一的名称清理函数（与 team.aggregator.ts 保持一致）
    const cleanOwner = (name: string | null | undefined): string => {
      if (!name) return '';
      return name.replace(/[\s;,，；、。.\n\r\t]+/g, ' ').trim();
    };

    for (const t of allTasks) {
      const name = cleanOwner(t.owner);
      if (!name) continue;
      if (!personTasks.has(name)) personTasks.set(name, []);
      personTasks.get(name)!.push(t);
    }

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
    }

    // ---- 5.5 获取Timesheet实际工时数据（从TAPD API或数据库）----
    const allTimesheets: Array<{
      owner: string;
      workspaceId: string;
      timespent: number;
      spentdate: Date;
    }> = [];

    for (const wsId of allWorkspaceIds) {
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
        console.error(`[persons] Failed to load timesheets for ${wsId}:`, error);
      }
    }

    console.log(`[persons] Total tasks: ${allTasks.length}, Total timesheets: ${allTimesheets.length}`);

    // ---- 6. 构建团队归因树 ----
    const { teamPersonMap } = await buildTeamTree({
      teamConfigs: teamConfigs.map((tc) => ({
        id: tc.id,
        name: tc.name,
        tapdProjectIds: tc.tapdProjectIds,
      })),
      allTasks,
      allTimesheets,  // ✅ 新增：传入Timesheet实际工时数据
      roleMappings,
      workDays,
      dailyBreakdowns,
      projectNameMap,
    });

    // ---- 7. 筛选处理 ----
    let allPersons: PersonListItem[] = [];

    if (tid) {
      // 按团队筛选
      allPersons = (teamPersonMap.get(tid) || []).map((p) => ({
        name: p.name,
        avatar: generateAvatarColor(p.name),
        team: p.teamName,
        project: p.mainProject,
        role: p.role,
        roleName: p.roleName,
        days: p.workDayCount,
        actual: p.totalEffort,
        cap: p.capacity,
        sat: p.saturation,
        loanStatus: p.loanStatus,
        // ⭐ 传递真实的每日任务数据
        dailyBreakdown: p.dailyBreakdown || {},
        dailyActualHours: p.dailyActualHours || {},
        // ⭐ 新增：传递该人员的真实任务列表
        taskList: (personTasks.get(p.name) || []).map(t => ({
          id: t.id,
          name: t.name,
          workspaceId: t.workspaceId,
          effort: t.effort || 0,
          effortCompleted: t.effortCompleted || 0,
          begin: t.begin,
          due: t.due,
          status: t.status || '',
        })),
      }));
    } else {
      // 返回所有人员（按人+项目展开）
      for (const [, persons] of teamPersonMap) {
        for (const p of persons) {
          allPersons.push({
            name: p.name,
            avatar: generateAvatarColor(p.name),
            team: p.teamName,
            project: p.mainProject,
            role: p.role,
            roleName: p.roleName,
            days: p.workDayCount,
            actual: p.totalEffort,
            cap: p.capacity,
            sat: p.saturation,
            loanStatus: p.loanStatus,
            dailyBreakdown: p.dailyBreakdown || {},
            dailyActualHours: p.dailyActualHours || {},
            taskList: (personTasks.get(p.name) || []).map(t => ({
              id: t.id,
              name: t.name,
              workspaceId: t.workspaceId,
              effort: t.effort || 0,
              effortCompleted: t.effortCompleted || 0,
              begin: t.begin,
              due: t.due,
              status: t.status || '',
            })),
          });
        }
      }
    }

    // ---- 7.5 按人名合并（人员饱和度明细需要一人一条记录） ----
    // 同一人在多个TAPD项目的数据合并为一条：工时累加、项目名称拼接、任务列表合并
    const mergedMap = new Map<string, PersonListItem>();
    for (const p of allPersons) {
      const existing = mergedMap.get(p.name);
      if (existing) {
        // 累加工时和容量
        existing.actual = Math.round((existing.actual + p.actual) * 10) / 10;
        existing.cap = Math.round((existing.cap + p.cap) * 10) / 10;
        // 取最高饱和度
        existing.sat = Math.max(existing.sat, p.sat);
        // 合并团队名称（去重）
        if (p.team && !existing.team.includes(p.team)) {
          existing.team = existing.team ? `${existing.team}&${p.team}` : p.team;
        }
        // 合并项目名称（去重）
        if (p.project && !existing.project.includes(p.project)) {
          existing.project = existing.project ? `${existing.project}&${p.project}` : p.project;
        }
        // 合并每日工时
        for (const [date, hours] of Object.entries(p.dailyBreakdown)) {
          existing.dailyBreakdown[date] = (existing.dailyBreakdown[date] || 0) + hours;
        }
        for (const [date, hours] of Object.entries(p.dailyActualHours)) {
          existing.dailyActualHours[date] = (existing.dailyActualHours[date] || 0) + hours;
        }
        // 合并任务列表（去重）
        const existingTaskIds = new Set(existing.taskList.map(t => t.id));
        for (const t of p.taskList) {
          if (!existingTaskIds.has(t.id)) {
            existing.taskList.push(t);
          }
        }
      } else {
        mergedMap.set(p.name, { ...p });
      }
    }
    // 用合并后的数据替换
    allPersons = Array.from(mergedMap.values());

    // 应用其他筛选条件
    if (role) {
      allPersons = allPersons.filter((p) => p.role === role);
    }

    if (nk) {
      const keyword = nk.toLowerCase();
      allPersons = allPersons.filter((p) =>
        p.name.toLowerCase().includes(keyword)
      );
    }

    if (pid) {
      // 按项目筛选：检查该人员的任务是否包含该项目
      allPersons = allPersons.filter((p) => {
        const tasks = personTasks.get(p.name) || [];
        return tasks.some((t) => t.workspaceId === pid);
      });
    }

    // ---- 8. 分页 ----
    const total = allPersons.length;
    const startIndex = (pg - 1) * psz;
    const pagedPersons = allPersons.slice(startIndex, startIndex + psz);

    return NextResponse.json({
      success: true,
      data: {
        total,
        persons: pagedPersons,
      },
    });
  } catch (error) {
    console.error('[GET /workload/persons]', error);
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
