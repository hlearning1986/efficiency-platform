/**
 * GET /api/v1/workload/test-real-data
 * 测试接口：验证 TAPD 真实任务数据的获取和处理
 *
 * 功能：
 * 1. 调用 TAPD Task API 获取真实任务列表
 * 2. 验证多人处理人拆分逻辑（";"分隔）
 * 3. 计算每日预估工时（基于 effort 字段）
 * 4. 调用 TAPD Timesheet API 获取实际工时
 * 5. 输出完整的数据处理日志
 *
 * 使用方式：
 * http://localhost:3001/api/v1/workload/test-real-data?workspaceId=189291&startDate=2026-05-25&endDate=2026-06-01&personName=徐梦雨
 */

import { NextRequest, NextResponse } from 'next/server';
import { getWorkspaceData, getWorkspaceTimesheets, getAllTeamConfigs } from '../_lib/data.provider';
import { buildDailyLoad } from '../_lib/daily.decomposer';
import { calcWorkDays } from '../_lib/workday.calc';

export async function GET(req: NextRequest) {
  try {
    const sp = new URL(req.url).searchParams;
    const workspaceId = sp.get('workspaceId');
    const startDate = sp.get('startDate') || '2026-05-25';
    const endDate = sp.get('endDate') || '2026-06-01';
    const personName = sp.get('personName');

    if (!workspaceId) {
      return NextResponse.json({
        success: false,
        message: '缺少 workspaceId 参数',
        usage: '?workspaceId=189291&startDate=2026-05-25&endDate=2026-06-01&personName=徐梦雨',
      });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    console.log(`\n${'='.repeat(80)}`);
    console.log(`[test-real-data] 开始测试真实数据`);
    console.log(`[test-real-data] Workspace ID: ${workspaceId}`);
    console.log(`[test-real-data] 日期范围: ${startDate} ~ ${endDate}`);
    console.log(`[test-real-data] 目标人员: ${personName || '全部'}`);
    console.log(`${'='.repeat(80)}\n`);

    // ---- 1. 获取 Task 数据 ----
    console.log(`[test-real-data] 步骤1: 获取 Task 数据...`);
    const workspaceData = await getWorkspaceData(workspaceId, { start, end });

    console.log(`[test-real-data] ✅ 获取到 ${workspaceData.tasks.length} 条任务（已拆分多人）`);

    // 打印前5条任务的详细信息
    console.log(`[test-real-data] 前5条任务详情:`);
    workspaceData.tasks.slice(0, 5).forEach((t, i) => {
      console.log(`  [${i + 1}] ${t.name?.slice(0, 30)} | 处理人:${t.owner} | 工时:${t.effort}h | ${t.begin?.toISOString().slice(0, 10)} ~ ${t.due?.toISOString().slice(0, 10)}`);
    });

    // ---- 2. 过滤指定人员的任务 ----
    let targetTasks = workspaceData.tasks;
    if (personName) {
      targetTasks = workspaceData.tasks.filter(t =>
        t.owner === personName || t.owner?.includes(personName)
      );
      console.log(`[test-real-data] 📌 过滤人员 "${personName}" 的任务: ${targetTasks.length} 条`);
    }

    // ---- 3. 计算每日预估工时 ----
    console.log(`\n[test-real-data] 步骤2: 计算每日预估工时...`);

    const workDays = calcWorkDays({
      startDate: start,
      endDate: end,
      holidays: new Set(),
      extraWorkdays: new Set(),
    });

    console.log(`[test-real-data] 工作日数量: ${workDays.length} 天`);

    const taskInputs = targetTasks.map(t => ({
      id: t.id || '',
      name: t.name || '',
      owner: t.owner || '',
      status: t.status || '',
      effort: t.effort || 0,
      effortCompleted: t.effortCompleted || 0,
      begin: t.begin,
      due: t.due,
      workspaceId: t.workspaceId,
    }));

    const dailyBreakdown = buildDailyLoad(
      taskInputs,
      start,
      end,
      new Set(),
      new Set(),
      new Date() // referenceDate = 今天
    );

    console.log(`[test-real-data] ✅ 每日预估工时计算完成:`);
    Object.entries(dailyBreakdown).forEach(([date, hours]) => {
      if (hours > 0) {
        console.log(`  📅 ${date}: ${hours}h (预估)`);
      }
    });

    // ---- 4. 获取 Timesheet 实际工时 ----
    console.log(`\n[test-real-data] 步骤3: 获取 Timesheet 实际工时...`);
    const timesheets = await getWorkspaceTimesheets(workspaceId, { start, end });

    console.log(`[test-real-data] ✅ 获取到 ${timesheets.length} 条 timesheet 记录`);

    // 按人员和日期分组统计实际工时
    const dailyActualHours: Record<string, Record<string, number>> = {};

    for (const ts of timesheets) {
      let owner = ts.owner;
      if (!owner) continue;

      // 清理异常字符
      owner = owner.replace(/[\s;,，；、。.]+$/, '').trim();

      if (!dailyActualHours[owner]) {
        dailyActualHours[owner] = {};
      }

      const dateKey = ts.spentdate.toISOString().slice(0, 10);
      dailyActualHours[owner][dateKey] = (dailyActualHours[owner][dateKey] || 0) + ts.timespent;
    }

    // 打印目标人员的实际工时
    if (personName && dailyActualHours[personName]) {
      console.log(`[test-real-data] 📌 人员 "${personName}" 的实际工时:`);
      Object.entries(dailyActualHours[personName]).forEach(([date, hours]) => {
        console.log(`  📅 ${date}: ${hours}h (实际)`);
      });
    }

    // ---- 5. 统计汇总 ----
    const totalEstimated = Object.values(dailyBreakdown).reduce((sum, h) => sum + h, 0);
    const totalActual = personName && dailyActualHours[personName]
      ? Object.values(dailyActualHours[personName]).reduce((sum, h) => sum + h, 0)
      : 0;

    console.log(`\n${'='.repeat(80)}`);
    console.log(`[test-real-data] 📊 数据汇总:`);
    console.log(`[test-real-data]   - 总任务数: ${targetTasks.length} 条`);
    console.log(`[test-real-data]   - 总预估工时: ${totalEstimated.toFixed(1)}h`);
    if (personName) {
      console.log(`[test-real-data]   - 总实际工时: ${totalActual.toFixed(1)}h`);
      console.log(`[test-real-data]   - 平均饱和度: ${workDays.length > 0 ? ((totalActual / (workDays.length * 8)) * 100).toFixed(1) : 0}%`);
    }
    console.log(`${'='.repeat(80)}\n`);

    // ---- 6. 返回结果 ----
    return NextResponse.json({
      success: true,
      testInfo: {
        workspaceId,
        workspaceName: workspaceData.workspaceName,
        dateRange: { start: startDate, end: endDate },
        targetPerson: personName || null,
      },
      taskStats: {
        totalTasks: workspaceData.tasks.length,
        filteredTasks: targetTasks.length,
        sampleTasks: targetTasks.slice(0, 5).map(t => ({
          name: t.name?.slice(0, 50),
          owner: t.owner,
          effort: t.effort,
          begin: t.begin?.toISOString().slice(0, 10),
          due: t.due?.toISOString().slice(0, 10),
          status: t.status,
        })),
      },
      dailyBreakdown: dailyBreakdown,           // 每日预估工时 { "2026-05-25": 4.5 }
      dailyActualHours: personName ? (dailyActualHours[personName] || {}) : dailyActualHours,  // 每日实际工时
      summary: {
        totalEstimatedHours: Math.round(totalEstimated * 10) / 10,
        totalActualHours: Math.round(totalActual * 10) / 10,
        workDaysCount: workDays.length,
        avgDailyCapacity: workDays.length * 8,
        saturation: workDays.length > 0 ? Math.round((totalActual / (workDays.length * 8)) * 100) : 0,
      },
      rawTimesheets: timesheets.slice(0, 10),  // 前10条原始timesheet记录（用于调试）
    });

  } catch (error) {
    console.error('[test-real-data] Error:', error);
    return NextResponse.json({
      success: false,
      message: error instanceof Error ? error.message : '未知错误',
      error: String(error),
    }, { status: 500 });
  }
}
