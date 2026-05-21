import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/v1/tapd/sync/jobs/:id - 查询单个同步任务状态
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const job = await prisma.tapdSyncRecord.findUnique({
      where: { id },
    });

    if (!job) {
      return NextResponse.json({ success: false, message: '任务不存在' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: job });
  } catch (error) {
    const message = error instanceof Error ? error.message : '查询任务失败';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
