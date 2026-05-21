import { NextRequest, NextResponse } from 'next/server';

interface TapdWorkspace {
  id: string;
  name: string;
  [key: string]: unknown;
}

/**
 * POST /api/v1/resources/tapd/projects
 * 获取 TAPD 项目（工作空间）列表
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { apiUser, apiPassword } = body;

    if (!apiUser || !apiPassword) {
      return NextResponse.json(
        { success: false, projects: [] },
        { status: 400 },
      );
    }

    const credentials = Buffer.from(`${apiUser}:${apiPassword}`).toString('base64');

    const response = await fetch('https://api.tapd.cn/workspaces', {
      method: 'GET',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      return NextResponse.json(
        {
          success: false,
          projects: [],
          message: `获取项目列表失败: ${response.status} ${errorText}`,
        },
        { status: response.status },
      );
    }

    const data = await response.json();

    // TAPD API 返回格式: { data: Array<{id, name, ...}> } 或 { workspace: Array<...> }
    const rawList: TapdWorkspace[] =
      data?.data ?? data?.workspace ?? data?.Workspaces ?? [];

    const projects = rawList.map((item) => ({
      id: String(item.id),
      name: item.name || '',
    }));

    return NextResponse.json({
      success: true,
      projects,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '未知错误';
    return NextResponse.json(
      { success: false, projects: [], message: `请求异常: ${message}` },
      { status: 500 },
    );
  }
}
