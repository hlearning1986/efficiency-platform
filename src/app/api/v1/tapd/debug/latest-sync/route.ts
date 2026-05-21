import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/v1/tapd/debug/latest-sync - 查看最新同步记录和错误信息
 */
export async function GET() {
  try {
    // 获取最新的10条同步记录
    const recentSyncs = await prisma.tapdSyncRecord.findMany({
      orderBy: { startedAt: 'desc' },
      take: 10,
    });

    // 获取最新的一条失败记录的详细信息
    const latestFailed = await prisma.tapdSyncRecord.findFirst({
      where: { status: 'failed' },
      orderBy: { startedAt: 'desc' },
    });

    return NextResponse.json({
      success: true,
      data: {
        timestamp: new Date().toISOString(),
        latestFailedRecord: latestFailed ? {
          id: latestFailed.id,
          workspaceIds: latestFailed.workspaceIds,
          dataTypes: latestFailed.dataTypes,
          status: latestFailed.status,
          errorMsg: latestFailed.errorMsg,
          startedAt: latestFailed.startedAt,
          finishedAt: latestFailed.finishedAt,
          duration: latestFailed.finishedAt 
            ? `${Math.round((latestFailed.finishedAt.getTime() - latestFailed.startedAt.getTime()) / 1000)}秒`
            : null,
        } : null,

        recentSyncRecords: recentSyncs.map((record) => ({
          id: record.id,
          workspaceIds: record.workspaceIds,
          dataTypes: record.dataTypes,
          status: record.status,
          errorMsg: record.errorMsg,
          startedAt: record.startedAt,
          finishedAt: record.finishedAt,
          storyCount: record.storyCount,
          taskCount: record.taskCount,
          iterationCount: record.iterationCount,
          bugCount: record.bugCount,
        })),

        analysis: {
          totalRecent: recentSyncs.length,
          failedCount: recentSyncs.filter((r) => r.status === 'failed').length,
          successCount: recentSyncs.filter((r) => r.status === 'completed').length,
          failureRate: recentSyncs.length > 0 
            ? ((recentSyncs.filter((r) => r.status === 'failed').length / recentSyncs.length) * 100).toFixed(1) + '%'
            : '0%',
        },
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '查询失败';
    console.error('Latest Sync Debug error:', error);
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
