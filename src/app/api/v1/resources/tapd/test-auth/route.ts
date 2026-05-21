import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/v1/resources/tapd/test-auth
 * 测试 TAPD API 认证是否有效
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { apiUser, apiPassword } = body;

    if (!apiUser || !apiPassword) {
      return NextResponse.json(
        { success: false, message: '缺少 apiUser 或 apiPassword 参数' },
        { status: 400 },
      );
    }

    const credentials = Buffer.from(`${apiUser}:${apiPassword}`).toString('base64');

    const response = await fetch('https://api.tapd.cn/quickstart/testauth', {
      method: 'GET',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/json',
      },
    });

    if (response.ok) {
      return NextResponse.json({
        success: true,
        message: 'TAPD 认证成功',
      });
    }

    const errorText = await response.text().catch(() => '');
    return NextResponse.json(
      {
        success: false,
        message: `TAPD 认证失败: ${response.status} ${response.statusText}${errorText ? ` - ${errorText}` : ''}`,
      },
      { status: response.status },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : '未知错误';
    return NextResponse.json(
      { success: false, message: `请求异常: ${message}` },
      { status: 500 },
    );
  }
}
