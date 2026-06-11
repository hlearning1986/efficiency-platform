import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import type { FieldType, FieldDataType } from '@prisma/client';

// POST /api/v1/agile/field-configs/quick-setup - 一键配置（从TAPD自动拉取默认字段）
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { teamConfigId } = body;
    
    // 默认字段配置（基于交互稿设计）
    const defaultFields = [
      {
        name: 'ID',
        fieldKey: 'tapdId',
        fieldType: 'FIXED' as FieldType,
        dataType: 'LINK_TEXT' as FieldDataType,
        tapdField: 'ID',
        isEditable: false,
        sortOrder: 20,
        width: 85,
      },
      {
        name: '标题',
        fieldKey: 'title',
        fieldType: 'FIXED' as FieldType,
        dataType: 'LINK_TEXT' as FieldDataType,
        tapdField: '标题',
        isEditable: false,
        sortOrder: 30,
        width: 250,
      },
      {
        name: '产品',
        fieldKey: 'product',
        fieldType: 'FIXED' as FieldType,
        dataType: 'TEXT' as FieldDataType,
        tapdField: '产品',
        isEditable: false,
        sortOrder: 40,
        width: 100,
      },
      {
        name: '状态',
        fieldKey: 'statusLabel',
        fieldType: 'FIXED' as FieldType,
        dataType: 'TEXT' as FieldDataType,
        tapdField: '状态',
        isEditable: false,
        sortOrder: 45,
        width: 90,
      },
      {
        name: '优先级',
        fieldKey: 'priority',
        fieldType: 'CUSTOM' as FieldType,
        dataType: 'NUMBER' as FieldDataType,
        tapdField: '故事优先级',
        isEditable: false,
        sortOrder: 50,
        width: 60,
      },
      {
        name: '处理人',
        fieldKey: 'owner',
        fieldType: 'FIXED' as FieldType,
        dataType: 'TEXT' as FieldDataType,
        tapdField: '处理人',
        isEditable: false,
        sortOrder: 60,
        width: 80,
      },
      {
        name: '后端',
        fieldKey: 'backend',
        fieldType: 'ROLE_EFFORT' as FieldType,
        dataType: 'NUMBER' as FieldDataType,
        tapdField: null,
        isEditable: true,
        sortOrder: 70,
        width: 90,
      },
      {
        name: '前端',
        fieldKey: 'frontend',
        fieldType: 'ROLE_EFFORT' as FieldType,
        dataType: 'NUMBER' as FieldDataType,
        tapdField: null,
        isEditable: true,
        sortOrder: 80,
        width: 90,
      },
      {
        name: '移动端',
        fieldKey: 'mobile',
        fieldType: 'ROLE_EFFORT' as FieldType,
        dataType: 'NUMBER' as FieldDataType,
        tapdField: null,
        isEditable: true,
        sortOrder: 85,
        width: 90,
      },
      {
        name: '测试',
        fieldKey: 'test',
        fieldType: 'ROLE_EFFORT' as FieldType,
        dataType: 'NUMBER' as FieldDataType,
        tapdField: null,
        isEditable: true,
        sortOrder: 110,
        width: 90,
      },
      {
        name: '提测时间',
        fieldKey: 'testDate',
        fieldType: 'CUSTOM' as FieldType,
        dataType: 'DATE' as FieldDataType,
        tapdField: '提测时间',
        isEditable: false,
        sortOrder: 120,
        width: 110,
      },
      {
        name: '发布计划',
        fieldKey: 'releasePlan',
        fieldType: 'FIXED' as FieldType,
        dataType: 'DATE' as FieldDataType,
        tapdField: '发布计划',
        isEditable: false,
        sortOrder: 130,
        width: 110,
      },
      {
        name: '备注',
        fieldKey: 'remark',
        fieldType: 'CUSTOM' as FieldType,
        dataType: 'MULTI_LINE' as FieldDataType,
        tapdField: '备注',
        isEditable: true,
        sortOrder: 140,
        width: 120,
      },
    ];
    
    let createdCount = 0;
    let skippedCount = 0;
    const errors: string[] = [];
    
    for (const field of defaultFields) {
      try {
        // 检查是否已存在
        const existing = await prisma.sprintFieldConfig.findFirst({
          where: {
            fieldKey: field.fieldKey,
            teamConfigId: teamConfigId || null,
          },
        });
        
        if (existing) {
          skippedCount++;
          continue; // 跳过已存在的字段
        }
        
        // 创建新字段配置
        await prisma.sprintFieldConfig.create({
          data: {
            ...field,
            teamConfigId: teamConfigId || null,
          },
        });
        
        createdCount++;
      } catch (error) {
        errors.push(`创建字段 "${field.name}" 失败: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
    
    return NextResponse.json({
      success: true,
      message: `一键配置完成：新增 ${createdCount} 个字段，跳过 ${skippedCount} 个已存在字段`,
      data: {
        createdCount,
        skippedCount,
        totalFields: defaultFields.length,
        errors: errors.length > 0 ? errors : undefined,
      },
    });
  } catch (error) {
    console.error('Error in quick setup:', error);
    return NextResponse.json(
      { success: false, message: '一键配置失败', error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
