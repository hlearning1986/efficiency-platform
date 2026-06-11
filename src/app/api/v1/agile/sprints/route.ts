import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const TAPD_API_ENDPOINT = process.env.TAPD_API_ENDPOINT || 'https://api.tapd.cn';
const TAPD_TOKEN = process.env.TAPD_TOKEN;

async function fetchFromTAPD<T>(path: string, params: Record<string, string> = {}) {
  if (!TAPD_TOKEN) return null;

  try {
    const searchParams = new URLSearchParams(params);
    const url = `${TAPD_API_ENDPOINT}/${path}?${searchParams.toString()}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${TAPD_TOKEN}`,
        'Content-Type': 'application/json',
      },
      next: { revalidate: 60 },
    });

    if (!response.ok) return null;

    const result: { status: number; data: T[]; info: string } = await response.json();
    return result.status === 1 ? result.data : null;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const workspaceId = searchParams.get('workspaceId');
    const useRealtime = searchParams.get('realtime') === 'true';

    if (!workspaceId) {
      return NextResponse.json(
        { success: false, message: '缺少项目ID' },
        { status: 400 },
      );
    }

    let sprints: Array<{
      id: string;
      name: string;
      startDate?: Date | null;
      endDate?: Date | null;
      status?: string;
    }> = [];
    let dataSource = 'local';

    if (useRealtime && TAPD_TOKEN) {
      console.log(`[Sprint API] 使用 TAPD 实时数据。workspaceId=${workspaceId}`);

      const tapdIterations = await fetchFromTAPD<{
        id: string;
        name: string;
        workspace_id: string;
        startdate: string | null;
        enddate: string | null;
        status: string;
      }>('iterations', {
        workspace_id: workspaceId,
        limit: '200',
        order: 'created desc',
      });

      if (tapdIterations && tapdIterations.length > 0) {
        sprints = tapdIterations.map((iter) => ({
          id: iter.id,
          name: iter.name,
          startDate: iter.startdate ? new Date(iter.startdate) : null,
          endDate: iter.enddate ? new Date(iter.enddate) : null,
          status: iter.status === 'open' ? 'ACTIVE' : 'CLOSED',
        }));
        dataSource = 'tapd_realtime';
        console.log(
          `[Sprint API] 从 TAPD 获取到 ${sprints.length} 个迭代`,
        );
      }
    }

    if (sprints.length === 0) {
      const tapdIterations = await prisma.tapdIteration.findMany({
        where: {
          workspaceId,
        },
        orderBy: { startDate: 'desc' },
        select: {
          id: true,
          name: true,
          startDate: true,
          endDate: true,
          status: true,
        },
      });

      if (tapdIterations.length > 0) {
        sprints = tapdIterations.map((iter) => ({
          id: iter.id,
          name: iter.name,
          startDate: iter.startDate,
          endDate: iter.endDate,
          status: iter.status || 'ACTIVE',
        }));
        dataSource = 'local_iteration_table';
      }
    }

    if (sprints.length === 0) {
      console.log(
        `[Sprint API] 本地表无数据，从 tapd_story 表聚合。workspaceId=${workspaceId}`,
      );

      const storyIterations = await prisma.tapdStory.findMany({
        where: {
          workspaceId,
          iterationId: { not: null },
        },
        select: {
          iterationId: true,
          iterationName: true,
          created: true,
        },
        distinct: ['iterationId'],
        orderBy: { created: 'desc' },
      });

      const iterationCountMap = new Map<string, number>();
      const allStories = await prisma.tapdStory.groupBy({
        by: ['iterationId'],
        where: {
          workspaceId,
          iterationId: { not: null },
        },
        _count: { id: true },
      });

      allStories.forEach((item) => {
        if (item.iterationId) {
          iterationCountMap.set(item.iterationId, item._count.id);
        }
      });

      sprints = storyIterations
        .filter((item) => item.iterationId)
        .map((item) => ({
          id: item.iterationId!,
          name:
            item.iterationName ||
            `迭代 ${item.iterationId?.slice(-6) || ''} (${iterationCountMap.get(item.iterationId!) || 0}条需求)`,
          status: 'ACTIVE',
        }));
      dataSource = 'local_story_aggregate';
    }

    return NextResponse.json({
      success: true,
      data: {
        sprints: sprints.map((s) => ({
          id: s.id,
          name: s.name,
          startDate: s.startDate?.toISOString().split('T')[0] || '',
          endDate: s.endDate?.toISOString().split('T')[0] || '',
          status: s.status || 'ACTIVE',
        })),
        source: dataSource,
        fetchedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Error fetching sprints:', error);
    return NextResponse.json(
      {
        success: false,
        message: '获取迭代列表失败',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
