import { NextRequest, NextResponse } from 'next/server';
import {
  syncWorkspaceWorkflow,
  getAllWorkflowsOverview,
} from '@/lib/workflow-status-service';

/**
 * POST /api/v1/tapd/workflow-status/refresh
 * 刷新指定项目的工作流配置（强制从TAPD API重新获取）
 * 
 * 请求体:
 * - workspaceId?: string - 单个项目ID（可选，不传则刷新所有）
 * - workspaceIds?: string[] - 多个项目ID（可选）
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { workspaceId, workspaceIds } = body;

    console.log(`🔄 [API] 收到工作流刷新请求`);

    // 如果没有指定项目，则刷新所有已缓存的项目
    if (!workspaceId && (!workspaceIds || workspaceIds.length === 0)) {
      const overview = await getAllWorkflowsOverview();
      
      if (overview.length === 0) {
        return NextResponse.json(
          { success: false, message: '没有找到已缓存的项目，请先执行初始化' },
          { status: 400 }
        );
      }

      const allWorkspaceIds = overview.map(o => o.workspaceId);
      
      console.log(`📋 [API] 将刷新所有 ${allWorkspaceIds.length} 个项目`);
      
      // 批量刷新（使用forceRefresh模式）
      const results = [];
      for (let i = 0; i < allWorkspaceIds.length; i++) {
        const wsId = allWorkspaceIds[i];
        
        // 添加延迟避免API限流
        if (i > 0) {
          await new Promise(resolve => setTimeout(resolve, 300));
        }
        
        const result = await syncWorkspaceWorkflow(wsId, { 
          forceRefresh: true,
          workspaceName: overview.find(o => o.workspaceId === wsId)?.workspaceName,
        });
        
        results.push({ workspaceId: wsId, ...result });
      }

      const successCount = results.filter(r => r.success).length;
      const failedCount = results.filter(r => !r.success).length;

      return NextResponse.json({
        success: failedCount === 0,
        message: `全部刷新完成: 成功${successCount}个, 失败${failedCount}个`,
        data: {
          total: results.length,
          success: successCount,
          failed: failedCount,
          results,
        },
      });
    }

    // 刷新指定的单个或多个项目
    const ids: string[] = workspaceIds || (workspaceId ? [workspaceId] : []);
    
    if (ids.length === 0) {
      return NextResponse.json(
        { success: false, message: '请提供workspaceId或workspaceIds' },
        { status: 400 }
      );
    }

    const results = [];
    
    for (let i = 0; i < ids.length; i++) {
      if (i > 0) {
        await new Promise(resolve => setTimeout(resolve, 300));
      }
      
      const result = await syncWorkspaceWorkflow(ids[i], { forceRefresh: true });
      results.push({ workspaceId: ids[i], ...result });
    }

    const successCount = results.filter(r => r.success).length;

    return NextResponse.json({
      success: successCount === ids.length,
      message: `刷新完成: 成功${successCount}/${ids.length}`,
      data: { results },
    });

  } catch (error) {
    console.error('❌ [API] 工作流刷新失败:', error);
    const message = error instanceof Error ? error.message : '刷新失败';
    
    return NextResponse.json(
      { success: false, message },
      { status: 500 }
    );
  }
}
