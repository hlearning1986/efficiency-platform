import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/v1/tapd/debug/statuses - 调试：获取所有状态值及分布
 */
export async function GET() {
  try {
    // 查询所有不重复的状态值
    const allStatuses = await prisma.tapdStory.findMany({
      select: {
        status: true,
        workspaceId: true,
        workspaceName: true,
      },
      distinct: ['status', 'workspaceId'],
      where: {
        status: { not: null },
      },
      orderBy: [
        { workspaceName: 'asc' },
        { status: 'asc' },
      ],
    });

    // 统计每个状态的出现次数
    const statusCounts = await prisma.tapdStory.groupBy({
      by: ['status'],
      _count: true,
      where: {
        status: { not: null },
      },
      orderBy: {
        _count: {
          status: 'desc',
        },
      },
    });

    // 按项目分组统计状态
    const projectStatusMap: Record<string, Array<{ status: string; count: number }>> = {};
    
    for (const item of allStatuses) {
      const key = item.workspaceId;
      if (!projectStatusMap[key]) {
        projectStatusMap[key] = [];
      }
      
      // 找到该状态在该项目的计数
      const countInfo = statusCounts.find((s) => s.status === item.status);
      projectStatusMap[key].push({
        status: item.status!,
        count: countInfo?._count || 0,
        workspaceName: item.workspaceName || `项目 ${item.workspaceId}`,
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        totalDistinctStatuses: statusCounts.length,
        statusSummary: statusCounts.map((s) => ({
          status: s.status,
          count: s._count,
        })),
        projectDistribution: Object.entries(projectStatusMap).map(([workspaceId, statuses]) => ({
          workspaceId,
          workspaceName: statuses[0]?.workspaceName || workspaceId,
          statuses: statuses.map((s) => ({
            status: s.status,
            count: s.count,
          })),
        })),
        rawStatuses: allStatuses,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '查询失败';
    console.error('Debug query error:', error);
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
