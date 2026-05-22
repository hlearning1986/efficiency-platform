import { NextRequest, NextResponse } from 'next/server';
import {
  getWorkspaceWorkflowDetails,
  getAllWorkflowsOverview,
  getSyncLogs,
  getWorkflowStatusMap,
  exportWorkflowConfig,
} from '@/lib/workflow-status-service';

/**
 * GET /api/v1/tapd/workflow-status/list
 * 查询工作流配置列表和详情
 * 
 * 查询参数:
 * - workspaceId: string - 指定项目ID（可选）
 * - system: 'story' | 'bug' - 系统类型（可选）
 * - action: 'overview' | 'details' | 'logs' | 'export' | 'map' - 查询类型
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const workspaceId = searchParams.get('workspaceId');
    const system = searchParams.get('system') as 'story' | 'bug' | null;
    const action = searchParams.get('action') || 'overview';

    console.log(`📋 [API] 工作流查询: action=${action}, workspace=${workspaceId || 'all'}`);

    switch (action) {
      case 'overview':
        // 获取所有项目的概览信息
        const overview = await getAllWorkflowsOverview();
        return NextResponse.json({
          success: true,
          data: overview,
          count: overview.length,
        });

      case 'details':
        // 获取指定项目的详细配置
        if (!workspaceId) {
          return NextResponse.json(
            { success: false, message: 'details模式需要workspaceId参数' },
            { status: 400 }
          );
        }
        
        const details = await getWorkspaceWorkflowDetails(
          workspaceId,
          (system as any) || 'story'
        );
        
        return NextResponse.json({
          success: true,
          data: details,
          count: details.length,
        });

      case 'logs':
        // 获取同步日志
        const limit = parseInt(searchParams.get('limit') || '50');
        const logs = await getSyncLogs(workspaceId || undefined, limit);
        
        return NextResponse.json({
          success: true,
          data: logs,
          count: logs.length,
        });

      case 'export':
        // 导出配置为JSON
        const config = await exportWorkflowConfig(workspaceId || undefined);
        
        return NextResponse.json({
          success: true,
          data: config,
        });

      case 'map':
        // 获取状态映射对象（用于前端显示）
        if (!workspaceId) {
          return NextResponse.json(
            { success: false, message: 'map模式需要workspaceId参数' },
            { status: 400 }
          );
        }
        
        const map = await getWorkflowStatusMap(
          workspaceId,
          (system as any) || 'story'
        );
        
        return NextResponse.json({
          success: true,
          data: map,
          workspaceId,
          system: system || 'story',
        });

      default:
        return NextResponse.json(
          { success: false, message: `未知的action: ${action}` },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('❌ [API] 工作流查询失败:', error);
    const message = error instanceof Error ? error.message : '查询失败';
    
    return NextResponse.json(
      { success: false, message },
      { status: 500 }
    );
  }
}
