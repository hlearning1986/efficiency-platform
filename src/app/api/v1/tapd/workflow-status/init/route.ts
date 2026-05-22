import { NextRequest, NextResponse } from 'next/server';
import {
  syncWorkspaceWorkflow,
  initMultipleWorkflows,
} from '@/lib/workflow-status-service';

/**
 * POST /api/v1/tapd/workflow-status/init
 * 初始化单个或多个项目的工作流配置
 * 
 * 请求体:
 * - workspaceId: string | string[] - 项目ID（单个或数组）
 * - forceRefresh?: boolean - 是否强制刷新
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { workspaceIds, workspaceId, forceRefresh = false } = body;

    // 支持单个ID或数组
    const ids: string[] = Array.isArray(workspaceIds)
      ? workspaceIds
      : (workspaceId ? [workspaceId] : []);

    if (!ids || ids.length === 0) {
      return NextResponse.json(
        { success: false, message: '请提供workspaceId或workspaceIds参数' },
        { status: 400 }
      );
    }

    console.log(`🚀 [API] 收到工作流初始化请求: ${ids.length} 个项目`);

    // 单个项目
    if (ids.length === 1) {
      const result = await syncWorkspaceWorkflow(ids[0], { forceRefresh });
      return NextResponse.json({
        success: result.success,
        message: result.message,
        data: result,
      });
    }

    // 多个项目
    const batchResult = await initMultipleWorkflows(ids, { forceRefresh });
    
    return NextResponse.json({
      success: true,
      message: `批量初始化完成: 成功${batchResult.success}个, 失败${batchResult.failed}个`,
      data: batchResult,
    });

  } catch (error) {
    console.error('❌ [API] 工作流初始化失败:', error);
    const message = error instanceof Error ? error.message : '初始化失败';
    
    return NextResponse.json(
      { success: false, message },
      { status: 500 }
    );
  }
}
