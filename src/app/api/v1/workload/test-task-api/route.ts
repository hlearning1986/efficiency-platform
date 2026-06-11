/**
 * GET /api/v1/workload/test-task-api
 * 测试TAPD API获取Task数据（预估工时）
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const report = {
      timestamp: new Date().toISOString(),
      testResult: {},
    };

    // 直接调用TAPD Task API
    const workspaceId = '35153283';
    const startDate = new Date('2026-06-01');
    const endDate = new Date('2026-06-15');

    // 获取TAPD配置
    const config = await prisma.systemSetting.findUnique({
      where: { key: 'tapd_api_config' },
    });

    if (!config?.value) {
      return NextResponse.json({ success: false, message: '未配置TAPD API' });
    }

    const tapdConfig = JSON.parse(config.value);
    const credentials = Buffer.from(`${tapdConfig.apiUser}:${tapdConfig.apiPassword}`).toString('base64');

    // 调用TAPD Task API
    const formatDate = (date: Date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    const apiUrl = `https://api.tapd.cn/tasks?workspace_id=${workspaceId}&begin=${formatDate(startDate)}&due=${formatDate(endDate)}&limit=200&page=1`;

    console.log(`[test-task-api] Calling TAPD Task API...`);

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
    const items = result.data || [];

    // 统计有效数据
    const tasksWithOwner = items.filter((item: any) => {
      const task = item.Task || item;
      return task.owner;
    });

    const tasksWithEffort = items.filter((item: any) => {
      const task = item.Task || item;
      return task.effort && parseFloat(task.effort) > 0;
    });

    const totalEffort = items.reduce((sum: number, item: any) => {
      const task = item.Task || item;
      return sum + (parseFloat(task.effort) || 0);
    }, 0);

    const uniqueOwners = new Set(tasksWithOwner.map((item: any) => (item.Task || item).owner));

    report.testResult = {
      workspaceId,
      dateRange: `${startDate.toDateString()} - ${endDate.toDateString()}`,
      totalRecords: items.length,
      withOwner: tasksWithOwner.length,
      withEffort: tasksWithEffort.length,
      uniqueOwners: uniqueOwners.size,
      totalEffortHours: Math.round(totalEffort * 100) / 100,
      sampleData: items.slice(0, 5).map((item: any) => {
        const task = item.Task || item;
        return {
          name: task.name?.substring(0, 40),
          owner: task.owner,
          effort: task.effort,
          begin: task.begin,
          due: task.due,
        };
      }),
    };

    return NextResponse.json({ success: true, data: report });
  } catch (error) {
    console.error('[test-task-api] Error:', error);
    return NextResponse.json(
      { success: false, message: (error as Error).message, stack: (error as Error).stack?.split('\n').slice(0, 10) },
      { status: 500 }
    );
  }
}
