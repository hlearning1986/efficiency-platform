/**
 * GET /api/v1/workload/debug-overview-error
 * 诊断overview接口500错误
 */

import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const report = {
      timestamp: new Date().toISOString(),
      steps: [] as string[],
      error: null as string | null,
    };

    report.steps.push('Step 1: 测试Timesheet数据获取...');

    try {
      const { getWorkspaceTimesheets } = await import('../_lib/data.provider');
      
      const workspaceId = '35153283';
      const startDate = new Date('2026-06-07');
      const endDate = new Date('2026-06-13');

      report.steps.push(`   调用 getWorkspaceTimesheets(${workspaceId}, ${startDate.toDateString()} ~ ${endDate.toDateString()})`);

      const timesheets = await getWorkspaceTimesheets(workspaceId, { start: startDate, end: endDate });

      report.steps.push(`✅ 成功! 返回 ${timesheets.length} 条记录`);
      
      if (timesheets.length > 0) {
        const sample = timesheets[0];
        report.steps.push(`   示例: owner=${sample.owner}, timespent=${sample.timespent}, date=${sample.spentdate.toDateString()}`);
      }
    } catch (error) {
      report.error = (error as Error).message;
      report.stack = (error as Error).stack?.split('\n').slice(0, 10);
      report.steps.push(`❌ 失败: ${report.error}`);
    }

    return NextResponse.json({ success: true, data: report });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: (error as Error).message },
      { status: 500 }
    );
  }
}
