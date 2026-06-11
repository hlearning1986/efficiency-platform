/**
 * GET /api/v1/workload/debug-timesheet-data
 * 检查Timesheet表数据
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const report = {
      timestamp: new Date().toISOString(),
      timesheet: {},
      task: {},
    };

    // 1. Timesheet数据统计
    const tsCount = await prisma.tapdTimesheet.count({
      where: { isDelete: false },
    });

    const tsSample = await prisma.tapdTimesheet.findMany({
      where: { isDelete: false },
      take: 5,
      select: {
        id: true,
        entityType: true,
        entityId: true,
        timespent: true,
        spentdate: true,
        owner: true,
        workspaceId: true,
      },
      orderBy: { spentdate: 'desc' },
    });

    // 按日期范围统计
    const today = new Date();
    const weekAgo = new Date(today);
    weekAgo.setDate(today.getDate() - 7);

    const tsThisWeek = await prisma.tapdTimesheet.count({
      where: {
        isDelete: false,
        spentdate: {
          gte: weekAgo,
          lte: today,
        },
      },
    });

    // 唯一owner统计
    const tsOwners = await prisma.tapdTimesheet.findMany({
      where: { isDelete: false, owner: { not: null } },
      select: { owner: true },
      distinct: ['owner'],
      take: 20,
    });

    // 2. Task数据（用于对比）
    const taskCount = await prisma.tapdTask.count();

    const taskSample = await prisma.tapdTask.findMany({
      take: 5,
      select: {
        id: true,
        name: true,
        owner: true,
        effort: true,
        effortCompleted: true,
        begin: true,
        due: true,
        workspaceId: true,
      },
    });

    // 有预估工时的task
    const tasksWithEffort = await prisma.tapdTask.count({
      where: {
        effort: { not: null },
        OR: [
          { effort: { gt: 0 } },
        ],
      },
    });

    report.timesheet = {
      totalRecords: tsCount,
      thisWeekRecords: tsThisWeek,
      uniqueOwners: tsOwners.length,
      sampleOwners: tsOwners.map(t => t.owner),
      sampleData: tsSample,
    };

    report.task = {
      totalRecords: taskCount,
      withEffort: tasksWithEffort,
      sampleData: taskSample,
    };

    return NextResponse.json({ success: true, data: report });
  } catch (error) {
    console.error('[debug-timesheet-data] Error:', error);
    return NextResponse.json(
      { success: false, message: (error as Error).message, stack: (error as Error).stack?.split('\n').slice(0, 5) },
      { status: 500 }
    );
  }
}
