import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/v1/tapd/debug/config - 检查 TAPD API 配置
 */
export async function GET() {
  try {
    // 1. 检查数据库中的 TAPD 配置
    const config = await prisma.systemSetting.findUnique({
      where: { key: 'tapd_api_config' },
    });

    let tapdConfig = null;
    let configStatus = 'not_configured';
    let configMessage = '';

    if (config?.value) {
      try {
        tapdConfig = JSON.parse(config.value);
        const { apiUser, apiPassword } = tapdConfig;
        
        if (!apiUser || !apiPassword) {
          configStatus = 'incomplete';
          configMessage = 'API 凭据不完整（缺少 apiUser 或 apiPassword）';
        } else if (apiUser === 'your_api_user' || apiPassword === 'your_api_password') {
          configStatus = 'placeholder';
          configMessage = '使用的是占位符值，需要配置真实的 TAPD API 凭据';
        } else {
          configStatus = 'configured';
          configMessage = 'TAPD API 配置正常';
        }
      } catch (e) {
        configStatus = 'invalid_json';
        configMessage = `配置格式错误: ${e instanceof Error ? e.message : String(e)}`;
      }
    } else {
      configMessage = '未找到 TAPD API 配置（key: tapd_api_config）';
    }

    // 2. 检查环境变量
    const envCheck = {
      TAPD_API_URL: process.env.TAPD_API_URL || '未设置',
      TAPD_API_KEY: process.env.TAPD_API_KEY ? `${process.env.TAPD_API_KEY.substring(0, 10)}...` : '未设置',
      TAPD_API_USER: process.env.TAPD_API_USER || '未设置',
      TAPD_WORKSPACE_ID: process.env.TAPD_WORKSPACE_ID || '未设置',
    };

    // 3. 测试 TAPD API 连通性
    let apiTestResult = null;
    if (configStatus === 'configured' && tapdConfig) {
      try {
        const { apiUser, apiPassword } = tapdConfig;
        const credentials = Buffer.from(`${apiUser}:${apiPassword}`).toString('base64');
        
        const testResp = await fetch('https://www.tapd.cn/api/workspaces/list', {
          method: 'POST',
          headers: {
            Authorization: `Basic ${credentials}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({}),
        });

        if (testResp.ok) {
          const testData = await testResp.json();
          apiTestResult = {
            status: 'success',
            httpStatus: testResp.status,
            data: testData,
            message: 'TAPD API 连接成功',
          };
        } else {
          apiTestResult = {
            status: 'http_error',
            httpStatus: testResp.status,
            message: `HTTP 错误: ${testResp.status} ${testResp.statusText}`,
          };
        }
      } catch (error) {
        apiTestResult = {
          status: 'connection_failed',
          message: `连接失败: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    }

    // 4. 获取最近的同步记录
    const recentSyncJobs = await prisma.tapdSyncRecord.findMany({
      orderBy: { startedAt: 'desc' },
      take: 5,
      select: {
        id: true,
        workspaceIds: true,
        status: true,
        errorMsg: true,
        startedAt: true,
        finishedAt: true,
        progress: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        timestamp: new Date().toISOString(),
        databaseConfig: {
          exists: !!config,
          status: configStatus,
          message: configMessage,
          config: tapdConfig ? {
            apiUser: tapdConfig.apiUser ? `${tapdConfig.apiUser.substring(0, 5)}...` : null,
            hasApiPassword: !!tapdConfig.apiPassword,
          } : null,
        },
        environmentVariables: envCheck,
        apiConnectivityTest: apiTestResult,
        recentSyncJobs: recentSyncJobs.map((job) => ({
          ...job,
          startedAt: job.startedAt?.toISOString(),
          finishedAt: job.finishedAt?.toISOString(),
        })),
        recommendations: getRecommendations(configStatus, apiTestResult),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '诊断失败';
    console.error('TAPD Config Debug error:', error);
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

function getRecommendations(
  configStatus: string, 
  apiTest: { status?: string } | null
): string[] {
  const recommendations: string[] = [];
  
  if (configStatus === 'not_configured') {
    recommendations.push('⚠️ 未配置 TAPD API：请到系统设置中添加 TAPD API 凭据');
  } else if (configStatus === 'placeholder') {
    recommendations.push('⚠️ 使用占位符：请将 .env 或系统设置中的 TAPD_API_USER 和 TAPD_API_PASSWORD 替换为真实值');
  } else if (configStatus === 'incomplete') {
    recommendations.push('❌ 配置不完整：请同时配置 apiUser 和 apiPassword');
  }
  
  if (apiTest?.status === 'connection_failed') {
    recommendations.push('🔌 网络连接失败：请检查网络连接和防火墙设置');
    recommendations.push('🔌 确认可以访问 https://www.tapd.cn');
  } else if (apiTest?.status === 'http_error') {
    recommendations.push(`🔑 API 认证失败：${apiTest.message}`);
    recommendations.push('🔑 请检查 TAPD API User 和 Password 是否正确');
  }
  
  if (recommendations.length === 0 && configStatus === 'configured') {
    recommendations.push('✅ TAPD 配置正常，可以开始同步数据');
  }
  
  return recommendations;
}
