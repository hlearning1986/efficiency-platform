import { NextRequest, NextResponse } from 'next/server';
import { fullSyncWithSkill, getLatestSyncRecord, getSyncHistory } from '@/lib/sync/tapd-skill-sync';

/**
 * GET /api/v1/sync - 查询同步状态和历史
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type') || 'latest';

    if (type === 'history') {
      const limit = parseInt(searchParams.get('limit') || '20', 10);
      const records = await getSyncHistory(limit);
      return NextResponse.json({ success: true, records });
    }

    // 默认返回最近一次同步记录
    const record = await getLatestSyncRecord();
    return NextResponse.json({ success: true, record });
  } catch (error) {
    const message = error instanceof Error ? error.message : '查询同步状态失败';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

/**
 * POST /api/v1/sync - 触发数据同步（使用 TAPD OpenAPI Skill）
 * 自动使用系统配置的 TAPD 账号
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { workspaceIds, createdBegin, createdEnd } = body;

    if (!workspaceIds?.length) {
      return NextResponse.json(
        { success: false, message: '未选择项目' },
        { status: 400 },
      );
    }

    // 检查是否有正在运行的同步任务
    const latestRecord = await getLatestSyncRecord();
    if (latestRecord && latestRecord.status === 'running') {
      return NextResponse.json({
        success: false,
        message: '已有同步任务正在运行，请稍后再试',
        record: latestRecord,
      });
    }

    // 异步执行同步（不阻塞响应）
    const { prisma } = await import('@/lib/prisma');
    const syncRecord = await prisma.tapdSyncRecord.create({
      data: {
        syncType: 'full',
        workspaceIds,
        status: 'running',
      },
    });

    // 在后台执行同步（使用 Skill）
    fullSyncWithSkill({
      workspaceIds,
      createdBegin,
      createdEnd,
    }).then(async (result) => {
      // 更新同步记录
      await prisma.tapdSyncRecord.update({
        where: { id: syncRecord.id },
        data: {
          status: result.success ? 'success' : 'failed',
          storyCount: result.storyCount,
          taskCount: result.taskCount,
          finishedAt: new Date(),
          errorMsg: result.error,
        },
      });
    }).catch(async (err) => {
      console.error('[Sync] Background sync failed:', err);
      await prisma.tapdSyncRecord.update({
        where: { id: syncRecord.id },
        data: {
          status: 'failed',
          finishedAt: new Date(),
          errorMsg: err instanceof Error ? err.message : String(err),
        },
      });
    });

    return NextResponse.json({
      success: true,
      message: '同步任务已启动',
      syncRecordId: syncRecord.id,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '同步请求失败';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
