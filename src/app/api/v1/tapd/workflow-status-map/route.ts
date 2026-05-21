import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/v1/tapd/workflow-status-map
 * 获取指定项目的工作流状态中英文名对应关系
 * 
 * 查询参数：
 * - workspace_id: 项目ID（必填）
 * - system: 系统类型 'story' | 'bug'（必填，默认 'story'）
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const workspaceId = searchParams.get('workspace_id');
    const system = searchParams.get('system') || 'story';

    if (!workspaceId) {
      return NextResponse.json(
        { success: false, message: '缺少 workspace_id 参数' },
        { status: 400 }
      );
    }

    if (!['story', 'bug'].includes(system)) {
      return NextResponse.json(
        { success: false, message: 'system 参数必须是 story 或 bug' },
        { status: 400 }
      );
    }

    // 1. 获取系统配置的 TAPD 账号
    const config = await prisma.systemSetting.findUnique({
      where: { key: 'tapd_api_config' },
    });

    if (!config?.value) {
      return NextResponse.json(
        { success: false, message: '未配置 TAPD API 账号' },
        { status: 400 }
      );
    }

    let tapdConfig: { apiUser?: string; apiPassword?: string };
    try {
      tapdConfig = JSON.parse(config.value);
    } catch {
      return NextResponse.json(
        { success: false, message: 'TAPD 配置格式错误' },
        { status: 500 }
      );
    }

    const { apiUser, apiPassword } = tapdConfig;
    if (!apiUser || !apiPassword || apiUser === 'your_api_user') {
      return NextResponse.json(
        { success: false, message: 'TAPD API 凭据未配置或为占位符，请到系统设置中配置 TAPD API 凭据' },
        { status: 400 }
      );
    }

    // 2. 构造 Basic Auth
    const credentials = Buffer.from(`${apiUser.trim()}:${apiPassword.trim()}`).toString('base64');
    
    // 3. 调用 TAPD 工作流状态映射 API
    const url = `https://api.tapd.cn/workflows/status_map?workspace_id=${workspaceId}&system=${system}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(10000), // 10秒超时
    });

    if (!response.ok) {
      throw new Error(`TAPD API 返回错误: HTTP ${response.status}`);
    }

    const data = await response.json();

    if (data.status !== 1) {
      throw new Error(data.info || '获取工作流状态映射失败');
    }

    // 4. 返回状态映射数据
    return NextResponse.json({
      success: true,
      data: {
        workspaceId,
        system,
        statusMap: data.data, // { "planning": "规划中", "developing": "实现中", ... }
        rawResponse: data,
      },
    });

  } catch (error) {
    console.error('获取工作流状态映射失败:', error);
    const message = error instanceof Error ? error.message : '获取工作流状态映射失败';
    return NextResponse.json(
      { success: false, message },
      { status: 500 }
    );
  }
}
