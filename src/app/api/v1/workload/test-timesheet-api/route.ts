/**
 * GET /api/v1/workload/test-timesheet-api
 * 测试TAPD API获取Timesheet数据
 */

import { NextResponse } from 'next/server';
import { getWorkspaceTimesheets } from '../_lib/data.provider';

export async function GET() {
  try {
    const report = {
      timestamp: new Date().toISOString(),
      testResult: {},
    };

    // 测试获取一个workspace的Timesheet数据
    const workspaceId = '35153283';  // 使用一个已知的workspaceId
    const startDate = new Date('2026-06-01');
    const endDate = new Date('2026-06-08');

    console.log(`[test-timesheet-api] Testing workspace ${workspaceId} from ${startDate.toISOString()} to ${endDate.toISOString()}`);

    const timesheets = await getWorkspaceTimesheets(workspaceId, { start: startDate, end: endDate });

    report.testResult = {
      workspaceId,
      dateRange: `${startDate.toDateString()} - ${endDate.toDateString()}`,
      totalRecords: timesheets.length,
      sampleData: timesheets.slice(0, 5).map(ts => ({
        owner: ts.owner,
        timespent: ts.timespent,
        spentdate: ts.spentdate.toDateString(),
        entityType: ts.entityType,
      })),
      uniqueOwners: [...new Set(timesheets.map(ts => ts.owner))].length,
      totalHours: timesheets.reduce((sum, ts) => sum + ts.timespent, 0),
    };

    return NextResponse.json({ success: true, data: report });
  } catch (error) {
    console.error('[test-timesheet-api] Error:', error);
    return NextResponse.json(
      { success: false, message: (error as Error).message, stack: (error as Error).stack?.split('\n').slice(0, 10) },
      { status: 500 }
    );
  }
}
