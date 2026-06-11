/**
 * GET /api/v1/workload/debug-tapd-timesheet
 * 直接测试TAPD Timesheet API调用
 */

import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const report = {
      timestamp: new Date().toISOString(),
      steps: [] as string[],
      apiResult: null as any,
    };

    // Step 1: 获取系统配置
    report.steps.push('Step 1: 检查TAPD API配置...');

    const { prisma } = await import('@/lib/prisma');
    const config = await prisma.systemSetting.findUnique({
      where: { key: 'tapd_api_config' },
    });

    if (!config?.value) {
      return NextResponse.json({ success: false, message: '未配置TAPD API', data: report });
    }

    let tapdConfig;
    try {
      tapdConfig = JSON.parse(config.value);
      report.steps.push(`✅ 配置存在: user=${tapdConfig.apiUser}`);
    } catch (e) {
      return NextResponse.json({ success: false, message: '配置格式错误', data: report });
    }

    // Step 2: 构造Basic Auth
    const credentials = Buffer.from(`${tapdConfig.apiUser}:${tapdConfig.apiPassword}`).toString('base64');
    report.steps.push(`✅ Basic Auth已生成`);

    // Step 3: 调用TAPD Timesheet API
    const workspaceId = '35153283';
    const startDate = '2026-06-01';
    const endDate = '2026-06-08';

    report.steps.push(`Step 3: 调用TAPD Timesheet API...`);
    report.steps.push(`   URL: https://api.tapd.cn/timesheets?workspace_id=${workspaceId}&spentdate_start=${startDate}&spentdate_end=${endDate}&limit=200`);

    const apiUrl = `https://api.tapd.cn/timesheets?workspace_id=${workspaceId}&spentdate_start=${startDate}&spentdate_end=${endDate}&limit=200&page=1`;

    const resp = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/json',
      },
    });

    if (!resp.ok) {
      report.steps.push(`❌ HTTP错误: ${resp.status} ${resp.statusText}`);
      const errorText = await resp.text();
      report.steps.push(`   错误详情: ${errorText.substring(0, 200)}`);
      return NextResponse.json({ success: false, message: `HTTP ${resp.status}`, data: report });
    }

    const result = await resp.json();
    report.apiResult = result;

    // 分析结果
    if (result.data) {
      report.steps.push(`✅ API调用成功`);
      report.steps.push(`   返回数据量: ${Array.isArray(result.data) ? result.data.length : '非数组'}`);

      if (Array.isArray(result.data) && result.data.length > 0) {
        report.steps.push(`   示例数据: ${JSON.stringify(result.data[0]).substring(0, 300)}`);
      }
    } else {
      report.steps.push(`⚠️ 返回数据为空或格式异常`);
      report.steps.push(`   完整响应: ${JSON.stringify(result).substring(0, 500)}`);
    }

    return NextResponse.json({ success: true, data: report });
  } catch (error) {
    console.error('[debug-tapd-timesheet] Error:', error);
    return NextResponse.json(
      { success: false, message: (error as Error).message, stack: (error as Error).stack?.split('\n').slice(0, 5), data: { timestamp: new Date().toISOString() } },
      { status: 500 }
    );
  }
}
