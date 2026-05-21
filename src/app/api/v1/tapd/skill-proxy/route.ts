import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/v1/tapd/skill-proxy
 * 使用 TAPD OpenAPI Skill 方式调用 TAPD API
 * 自动使用系统配置的 TAPD 账号
 */
export async function POST(req: NextRequest) {
  try {
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

    // 2. 获取请求参数
    const body = await req.json();
    const { service, action, params = {}, workspaceIds, fields } = body;

    if (!service || !action) {
      return NextResponse.json(
        { success: false, message: '缺少 service 或 action 参数' },
        { status: 400 }
      );
    }

    // 3. 构造 Basic Auth
    const credentials = Buffer.from(`${apiUser.trim()}:${apiPassword.trim()}`).toString('base64');
    const headers: Record<string, string> = {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/json',
    };

    // 4. 根据 service 和 action 构造请求
    const results: unknown[] = [];
    const errors: string[] = [];

    // 确定 workspace 列表
    const wsList = workspaceIds && workspaceIds.length > 0 
      ? workspaceIds 
      : ['48763054']; // 默认项目

    // 5. 调用 TAPD API
    for (const wsId of wsList) {
      try {
        const result = await callTapdApi(service, action, wsId, params, headers, fields);
        results.push({ workspaceId: wsId, data: result });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`项目 ${wsId}: ${msg}`);
      }
    }

    return NextResponse.json({
      success: errors.length === 0 || results.length > 0,
      data: results,
      errors: errors.length > 0 ? errors : undefined,
    });

  } catch (error) {
    const message = error instanceof Error ? error.message : '调用 TAPD API 失败';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

/**
 * 调用 TAPD API
 * @param fields 可选的字段列表，用于优化传输（只返回指定字段）
 */
async function callTapdApi(
  service: string,
  action: string,
  workspaceId: string,
  params: Record<string, unknown>,
  headers: Record<string, string>,
  fields?: string[],
): Promise<unknown> {
  const TAPD_API_BASE = 'https://api.tapd.cn';

  // 根据 service 构造路径
  let path = '';
  switch (service) {
    case 'stories':
    case 'story':
      path = '/stories';
      break;
    case 'tasks':
    case 'task':
      path = '/tasks';
      break;
    case 'bugs':
    case 'bug':
      path = '/bugs';
      break;
    case 'iterations':
    case 'iteration':
      path = '/iterations';
      break;
    case 'workspaces':
    case 'workspace':
      path = '/workspaces';
      break;
    case 'comments':
    case 'comment':
      path = '/comments';
      break;
    case 'timesheets':
    case 'timesheet':
      path = '/timesheets';
      break;
    case 'workflows':
    case 'workflow':
      path = '/workflows';
      break;
    default:
      throw new Error(`不支持的服务: ${service}`);
  }

  // 构造查询参数
  const queryParams = new URLSearchParams();
  queryParams.append('workspace_id', workspaceId);
  
  // 添加额外参数
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) {
      queryParams.append(key, String(value));
    }
  }

  // 添加 fields 参数（优化传输，只返回指定字段）
  if (fields && fields.length > 0) {
    queryParams.append('fields', fields.join(','));
  }

  const url = `${TAPD_API_BASE}${path}?${queryParams.toString()}`;

  // 设置 30 秒超时
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers,
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('TAPD API 请求超时（30秒）');
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}
