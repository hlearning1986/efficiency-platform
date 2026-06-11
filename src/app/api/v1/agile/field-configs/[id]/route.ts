import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import type { FieldType, FieldDataType } from '@prisma/client';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/v1/agile/field-configs/[id] - 获取单个字段配置
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    
    const fieldConfig = await prisma.sprintFieldConfig.findUnique({
      where: { id },
    });
    
    if (!fieldConfig) {
      return NextResponse.json(
        { success: false, message: '字段配置不存在' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      data: fieldConfig,
    });
  } catch (error) {
    console.error('Error fetching field config:', error);
    return NextResponse.json(
      { success: false, message: '获取字段配置失败', error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// PUT /api/v1/agile/field-configs/[id] - 更新字段配置
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();
    const {
      name,
      fieldKey,
      fieldType,
      dataType,
      tapdField,
      isVisible,
      isEditable,
      sortOrder,
      width,
    } = body;
    
    // 检查是否存在
    const existing = await prisma.sprintFieldConfig.findUnique({
      where: { id },
    });
    
    if (!existing) {
      return NextResponse.json(
        { success: false, message: '字段配置不存在' },
        { status: 404 }
      );
    }
    
    // 如果修改了fieldKey，检查是否冲突
    if (fieldKey && fieldKey !== existing.fieldKey) {
      const conflict = await prisma.sprintFieldConfig.findFirst({
        where: {
          fieldKey,
          teamConfigId: existing.teamConfigId,
          id: { not: id },
        },
      });
      
      if (conflict) {
        return NextResponse.json(
          { success: false, message: `字段标识符 "${fieldKey}" 已存在` },
          { status: 409 }
        );
      }
    }
    
    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (fieldKey !== undefined) updateData.fieldKey = fieldKey;
    if (fieldType !== undefined) updateData.fieldType = fieldType as FieldType;
    if (dataType !== undefined) updateData.dataType = dataType as FieldDataType;
    if (tapdField !== undefined) updateData.tapdField = tapdField;
    if (isVisible !== undefined) updateData.isVisible = isVisible;
    if (isEditable !== undefined) updateData.isEditable = isEditable;
    if (sortOrder !== undefined) updateData.sortOrder = sortOrder;
    if (width !== undefined) updateData.width = width;
    
    const fieldConfig = await prisma.sprintFieldConfig.update({
      where: { id },
      data: updateData,
    });
    
    return NextResponse.json({
      success: true,
      message: '字段配置更新成功',
      data: fieldConfig,
    });
  } catch (error) {
    console.error('Error updating field config:', error);
    return NextResponse.json(
      { success: false, message: '更新字段配置失败', error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// DELETE /api/v1/agile/field-configs/[id] - 删除字段配置
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    
    // 检查是否存在
    const existing = await prisma.sprintFieldConfig.findUnique({
      where: { id },
    });
    
    if (!existing) {
      return NextResponse.json(
        { success: false, message: '字段配置不存在' },
        { status: 404 }
      );
    }
    
    await prisma.sprintFieldConfig.delete({
      where: { id },
    });
    
    return NextResponse.json({
      success: true,
      message: '字段配置删除成功',
    });
  } catch (error) {
    console.error('Error deleting field config:', error);
    return NextResponse.json(
      { success: false, message: '删除字段配置失败', error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
