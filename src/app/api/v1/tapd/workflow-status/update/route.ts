import { NextRequest, NextResponse } from 'next/server';
import {
  updateWorkflowStatus,
  deleteWorkflowStatus,
  clearWorkspaceWorkflow,
} from '@/lib/workflow-status-service';

/**
 * PUT /api/v1/tapd/workflow-status/update
 * 更新单条工作流状态映射
 * 
 * 请求体:
 * - id: number - 记录ID（必填）
 * - statusValue?: string - 新的中文状态值
 * - sortOrder?: number - 新的排序顺序
 * - isActive?: boolean - 是否启用
 */

/**
 * DELETE /api/v1/tapd/workflow-status/update
 * 删除单条工作流状态映射
 * 
 * 查询参数:
 * - id: number - 记录ID（必填）
 * - workspaceId?: string + clear=true - 清除整个项目的缓存
 */

// PUT: 更新记录
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, ...updateData } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, message: '缺少id参数' },
        { status: 400 }
      );
    }

    console.log(`✏️ [API] 更新工作流记录: id=${id}`);

    const updated = await updateWorkflowStatus(id, updateData);

    if (!updated) {
      return NextResponse.json(
        { success: false, message: '记录不存在或更新失败' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: '更新成功',
      data: updated,
    });

  } catch (error) {
    console.error('❌ [API] 更新工作流记录失败:', error);
    const message = error instanceof Error ? error.message : '更新失败';
    
    return NextResponse.json(
      { success: false, message },
      { status: 500 }
    );
  }
}

// DELETE: 删除记录或清除缓存
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const workspaceId = searchParams.get('workspaceId');
    const clear = searchParams.get('clear') === 'true';
    const system = searchParams.get('system') as 'story' | 'bug' | null;

    // 清除整个项目的缓存
    if (clear && workspaceId) {
      console.log(`🗑️ [API] 清除项目工作流缓存: ${workspaceId}`);
      
      const deletedCount = await clearWorkspaceWorkflow(
        workspaceId,
        (system as any) || undefined
      );

      return NextResponse.json({
        success: true,
        message: `已清除 ${deletedCount} 条记录`,
        data: { deletedCount },
      });
    }

    // 删除单条记录
    if (!id) {
      return NextResponse.json(
        { success: false, message: '请提供id参数，或使用clear=true+workspaceId清除缓存' },
        { status: 400 }
      );
    }

    console.log(`🗑️ [API] 删除工作流记录: id=${id}`);

    const success = await deleteWorkflowStatus(parseInt(id));

    if (!success) {
      return NextResponse.json(
        { success: false, message: '记录不存在或删除失败' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: '删除成功',
    });

  } catch (error) {
    console.error('❌ [API] 删除工作流记录失败:', error);
    const message = error instanceof Error ? error.message : '删除失败';
    
    return NextResponse.json(
      { success: false, message },
      { status: 500 }
    );
  }
}
