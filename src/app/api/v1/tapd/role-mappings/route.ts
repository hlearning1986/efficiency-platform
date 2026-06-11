import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/v1/tapd/role-mappings
 * 查询角色人员映射
 * Query: workspaceId, role?, memberName?
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const workspaceId = searchParams.get('workspaceId');
    const role = searchParams.get('role');
    const memberName = searchParams.get('memberName');

    if (!workspaceId) {
      return NextResponse.json(
        { success: false, message: '缺少 workspaceId 参数' },
        { status: 400 },
      );
    }

    const where: Record<string, unknown> = {
      workspaceId,
      isActive: true,
    };
    if (role) where.role = role;
    if (memberName) where.memberName = { contains: memberName };

    const mappings = await prisma.tapdMemberRoleMapping.findMany({
      where,
      orderBy: [{ role: 'asc' }, { memberName: 'asc' }],
    });

    return NextResponse.json({
      success: true,
      data: mappings,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '查询角色人员映射失败';
    console.error('[RoleMappings GET]', error);
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

/**
 * POST /api/v1/tapd/role-mappings
 * 批量保存角色人员映射（增量upsert模式）
 * - 已存在的 (workspaceId + memberName + role) → 更新
 * - 不存在的 → 新增
 * - 不删除任何已有映射
 *
 * Body: { workspaceId, mappings: [{ memberName, role, roleId? }] }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { workspaceId, mappings } = body;

    if (!workspaceId) {
      return NextResponse.json(
        { success: false, message: '缺少 workspaceId' },
        { status: 400 },
      );
    }

    if (!Array.isArray(mappings)) {
      return NextResponse.json(
        { success: false, message: 'mappings 必须是数组' },
        { status: 400 },
      );
    }

    type MappingItem = { memberName?: string; role?: string; roleId?: string; remark?: string };
    const validMappings = mappings.filter(
      (m: MappingItem) => m.memberName && m.role,
    );

    if (validMappings.length === 0) {
      return NextResponse.json({
        success: true,
        message: '无有效映射需要保存',
        data: { count: 0, updated: 0, created: 0 },
      });
    }

    let created = 0;
    let updated = 0;

    // 逐条 upsert：不删除已有数据，只做增量更新
    for (const m of validMappings) {
      const memberName = m.memberName!.trim();
      const role = m.role!;

      const result = await prisma.tapdMemberRoleMapping.upsert({
        where: {
          workspaceId_memberName_role: {
            workspaceId,
            memberName,
            role,
          },
        },
        update: {
          roleId: m.roleId || null,
          isActive: true,
          remark: m.remark || null,
          updatedAt: new Date(),
        },
        create: {
          workspaceId,
          memberName,
          role,
          roleId: m.roleId || null,
          isActive: true,
          remark: m.remark || null,
        },
      });

      if (result.createdAt.getTime() === result.updatedAt.getTime()) {
        created++;
      } else {
        updated++;
      }
    }

    return NextResponse.json({
      success: true,
      message: `已保存 ${validMappings.length} 条映射（新增${created}条，更新${updated}条）`,
      data: { count: validMappings.length, created, updated },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '保存角色人员映射失败';
    console.error('[RoleMappings POST]', error);
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

/**
 * DELETE /api/v1/tapd/role-mappings
 * 删除某条映射
 * Query: id
 */
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, message: '缺少 id 参数' },
        { status: 400 },
      );
    }

    await prisma.tapdMemberRoleMapping.delete({
      where: { id: parseInt(id, 10) },
    });

    return NextResponse.json({
      success: true,
      message: '已删除',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '删除失败';
    console.error('[RoleMappings DELETE]', error);
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
