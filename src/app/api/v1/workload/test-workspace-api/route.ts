/**
 * 测试 TAPD Workspace API - 获取工作空间真实名称
 *
 * 用于调试：查看 TAPD Workspace API 的实际返回数据结构
 * 访问: GET /api/v1/workload/test-workspace-api?workspaceId=189291
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/prisma';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspaceId') || '189291';

    console.log(`\n[test-workspace-api] ========== 开始测试 Workspace API ==========`);
    console.log(`[test-workspace-api] 目标 workspaceId: ${workspaceId}`);

    // 1. 先查看数据库中的记录
    const dbRecord = await prisma.tapdWorkspace.findUnique({
      where: { id: workspaceId },
      select: { id: true, name: true, createdAt: true, updatedAt: true },
    });

    console.log(`[test-workspace-api] 数据库记录:`);
    console.log(`  ID: ${dbRecord?.id}`);
    console.log(`  Name: "${dbRecord?.name}"`);
    console.log(`  CreatedAt: ${dbRecord?.createdAt}`);
    console.log(`  UpdatedAt: ${dbRecord?.updatedAt}`);

    // 2. 获取 TAPD API 配置
    const config = await prisma.systemSetting.findUnique({
      where: { key: 'tapd_api_config' },
    });

    if (!config?.value) {
      return NextResponse.json({
        success: false,
        error: '未配置TAPD API账号',
        dbRecord,
      });
    }

    let tapdConfig;
    try {
      tapdConfig = JSON.parse(config.value);
    } catch (e) {
      return NextResponse.json({
        success: false,
        error: 'TAPD配置格式错误',
        rawConfig: config.value,
        dbRecord,
      });
    }

    const { apiUser, apiPassword } = tapdConfig;

    console.log(`[test-workspace-api] TAPD API 配置:`);
    console.log(`  User: ${apiUser ? '✅ 已配置' : '❌ 未配置'}`);
    console.log(`  Password: ${apiPassword ? '✅ 已配置' : '❌ 未配置'}`);

    // 3. 构造 Basic Auth
    const credentials = Buffer.from(`${apiUser}:${apiPassword}`).toString('base64');

    // 4. 尝试多种 TAPD API 格式（根据官方文档）
    const apiUrls = [
      `https://api.tapd.cn/workspaces/get_workspace_info?workspace_id=${workspaceId}`,  // ✅ 官方文档格式
      `https://api.tapd.cn/workspaces/${workspaceId}`,                                  // 备用格式
    ];

    const results = [];

    for (let i = 0; i < apiUrls.length; i++) {
      const apiUrl = apiUrls[i];
      console.log(`\n[test-workspace-api] --- 尝试 API 格式 ${i + 1} ---`);
      console.log(`[test-workspace-api] URL: ${apiUrl}`);

      try {
        const response = await fetch(apiUrl, {
          method: 'GET',
          headers: {
            Authorization: `Basic ${credentials}`,
            'Content-Type': 'application/json',
          },
        });

        console.log(`[test-workspace-api] 响应状态: ${response.status} ${response.statusText}`);

        const json = await response.json();
        console.log(`[test-workspace-api] 原始响应数据:`);
        console.log(JSON.stringify(json, null, 2).slice(0, 1000));  // 只打印前1000字符

        results.push({
          format: i + 1,
          url: apiUrl,
          status: response.status,
          statusText: response.statusText,
          data: json,
        });
      } catch (err) {
        console.error(`[test-workspace-api] API调用失败:`, err);
        results.push({
          format: i + 1,
          url: apiUrl,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    // 5. 返回所有结果
    console.log(`\n[test-workspace-api] ========== 测试完成 ==========\n`);

    return NextResponse.json({
      success: true,
      testInfo: {
        workspaceId,
        dbRecord,
        tapdConfig: {
          user: apiUser,
          passwordSet: !!apiPassword,
        },
      },
      apiResults: results,
    });
  } catch (error) {
    console.error('[test-workspace-api] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '未知错误',
      },
      { status: 500 }
    );
  }
}
