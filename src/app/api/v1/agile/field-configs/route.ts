import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import type { FieldType, FieldDataType } from '@prisma/client';

// GET /api/v1/agile/field-configs - 获取字段配置列表
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const teamConfigId = searchParams.get('teamConfigId');
    
    let fieldConfigs;
    
    if (teamConfigId) {
      // 如果指定了项目ID，优先获取该项目的配置
      const projectConfigs = await prisma.sprintFieldConfig.findMany({
        where: { teamConfigId: teamConfigId },
        orderBy: { sortOrder: 'asc' },
      });
      
      if (projectConfigs.length > 0) {
        // 项目有配置，直接使用项目配置（不包含全局配置）
        fieldConfigs = projectConfigs;
      } else {
        // 项目没有配置，fallback到全局配置
        fieldConfigs = await prisma.sprintFieldConfig.findMany({
          where: { teamConfigId: null },
          orderBy: { sortOrder: 'asc' },
        });
      }
    } else {
      // 未指定项目ID，获取所有配置或仅全局配置
      fieldConfigs = await prisma.sprintFieldConfig.findMany({
        where: { teamConfigId: null },
        orderBy: { sortOrder: 'asc' },
      });
    }
    
    return NextResponse.json({
      success: true,
      data: fieldConfigs,
      total: fieldConfigs.length,
    });
  } catch (error) {
    console.error('Error fetching field configs:', error);
    return NextResponse.json(
      { success: false, message: '获取字段配置失败', error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// POST /api/v1/agile/field-configs - 新增字段配置
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      name,
      fieldKey,
      fieldType,
      dataType,
      tapdField,
      isEditable = false,
      sortOrder = 0,
      width,
      teamConfigId,
    } = body;
    
    // 验证必填字段
    if (!name || !fieldKey || !fieldType || !dataType) {
      return NextResponse.json(
        { success: false, message: '缺少必填字段：name, fieldKey, fieldType, dataType' },
        { status: 400 }
      );
    }
    
    // 检查fieldKey是否已存在（同一团队配置下）
    const existing = await prisma.sprintFieldConfig.findFirst({
      where: {
        fieldKey,
        teamConfigId: teamConfigId || null,
      },
    });
    
    if (existing) {
      return NextResponse.json(
        { success: false, message: `字段标识符 "${fieldKey}" 已存在` },
        { status: 409 }
      );
    }
    
    const fieldConfig = await prisma.sprintFieldConfig.create({
      data: {
        name,
        fieldKey,
        fieldType: fieldType as FieldType,
        dataType: dataType as FieldDataType,
        tapdField,
        isEditable,
        sortOrder,
        width,
        teamConfigId,
      },
    });
    
    return NextResponse.json({
      success: true,
      message: '字段配置创建成功',
      data: fieldConfig,
    });
  } catch (error) {
    console.error('Error creating field config:', error);
    return NextResponse.json(
      { success: false, message: '创建字段配置失败', error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
