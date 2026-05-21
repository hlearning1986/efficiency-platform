import { NextRequest, NextResponse } from 'next/server';

interface FetchStoriesRequest {
  apiUser: string;
  apiPassword: string;
  workspaceIds: string[];
  createdBegin?: string;
  createdEnd?: string;
  completedBegin?: string;
  completedEnd?: string;
  status?: string[];
}

/**
 * POST /api/v1/resources/tapd/fetch-stories
 * 分页获取 TAPD 需求（Story）列表
 */
export async function POST(req: NextRequest) {
  try {
    const body: FetchStoriesRequest = await req.json();
    const {
      apiUser,
      apiPassword,
      workspaceIds,
      createdBegin,
      createdEnd,
      completedBegin,
      completedEnd,
      status,
    } = body;

    if (!apiUser || !apiPassword || !workspaceIds?.length) {
      return NextResponse.json(
        { success: false, stories: [], total: 0, message: '缺少必要参数' },
        { status: 400 },
      );
    }

    const credentials = Buffer.from(`${apiUser}:${apiPassword}`).toString('base64');
    const allStories: unknown[] = [];

    for (const workspaceId of workspaceIds) {
      let page = 1;
      let hasMore = true;

      while (hasMore) {
        const params = new URLSearchParams({
          workspace_id: workspaceId,
          limit: '200',
          page: String(page),
        });

        // 时间范围: created 字段
        if (createdBegin) {
          params.set('created', `${createdBegin}~${createdEnd || ''}`);
        }

        // 完成时间范围
        if (completedBegin) {
          params.set('completed', `${completedBegin}~${completedEnd || ''}`);
        }

        // 状态筛选（管道符分隔）
        if (status && status.length > 0) {
          params.set('status', status.join('|'));
        }

        const url = `https://api.tapd.cn/stories?${params.toString()}`;

        const response = await fetch(url, {
          method: 'GET',
          headers: {
            Authorization: `Basic ${credentials}`,
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          const errorText = await response.text().catch(() => '');
          console.error(
            `获取 stories 失败 [workspace=${workspaceId}, page=${page}]: ${response.status} ${errorText}`,
          );
          break;
        }

        const data = await response.json();

        // TAPD 返回格式: { data: Array<Story> } 或 { Story: Array<...> }
        const stories: unknown[] =
          data?.data ?? data?.Story ?? data?.stories ?? [];

        if (stories.length === 0) {
          hasMore = false;
        } else {
          allStories.push(...stories);
          page++;

          // 如果返回数量小于 limit，说明没有更多数据
          if (stories.length < 200) {
            hasMore = false;
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      stories: allStories,
      total: allStories.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '未知错误';
    return NextResponse.json(
      { success: false, stories: [], total: 0, message: `请求异常: ${message}` },
      { status: 500 },
    );
  }
}
