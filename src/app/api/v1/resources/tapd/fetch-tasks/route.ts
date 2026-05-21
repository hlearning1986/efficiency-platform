import { NextRequest, NextResponse } from 'next/server';

interface FetchTasksRequest {
  apiUser: string;
  apiPassword: string;
  workspaceIds: string[];
  storyIds: string[];
}

/**
 * POST /api/v1/resources/tapd/fetch-tasks
 * 获取 TAPD 任务（Task）列表
 */
export async function POST(req: NextRequest) {
  try {
    const body: FetchTasksRequest = await req.json();
    const { apiUser, apiPassword, workspaceIds, storyIds } = body;

    if (!apiUser || !apiPassword || !workspaceIds?.length) {
      return NextResponse.json(
        { success: false, tasks: [], total: 0, message: '缺少必要参数' },
        { status: 400 },
      );
    }

    const credentials = Buffer.from(`${apiUser}:${apiPassword}`).toString('base64');
    const allTasks: unknown[] = [];

    for (const workspaceId of workspaceIds) {
      let page = 1;
      let hasMore = true;

      while (hasMore) {
        const params = new URLSearchParams({
          workspace_id: workspaceId,
          limit: '200',
          page: String(page),
        });

        // 按 Story ID 过滤（parent_id）
        if (storyIds && storyIds.length > 0) {
          params.set('parent_id', storyIds.join('|'));
        }

        const url = `https://api.tapd.cn/tasks?${params.toString()}`;

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
            `获取 tasks 失败 [workspace=${workspaceId}, page=${page}]: ${response.status} ${errorText}`,
          );
          break;
        }

        const data = await response.json();

        // TAPD 返回格式: { data: Array<Task> } 或 { Task: Array<...> }
        const tasks: unknown[] =
          data?.data ?? data?.Task ?? data?.tasks ?? [];

        if (tasks.length === 0) {
          hasMore = false;
        } else {
          allTasks.push(...tasks);
          page++;

          // 如果返回数量小于 limit，说明没有更多数据
          if (tasks.length < 200) {
            hasMore = false;
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      tasks: allTasks,
      total: allTasks.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '未知错误';
    return NextResponse.json(
      { success: false, tasks: [], total: 0, message: `请求异常: ${message}` },
      { status: 500 },
    );
  }
}
