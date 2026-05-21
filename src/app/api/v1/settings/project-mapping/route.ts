import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/v1/settings/project-mapping
// 获取所有映射关系（含项目信息）
export async function GET() {
  try {
    const projects = await prisma.project.findMany({
      select: {
        id: true,
        name: true,
        category: true,
        okrName: true,
      },
      orderBy: { name: 'asc' },
    });

    const mappings = await prisma.projectMapping.findMany({
      select: {
        id: true,
        projectId: true,
        tapdBelonging: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    // 按 projectId 分组
    const mappingMap = new Map<string, string[]>();
    for (const m of mappings) {
      const list = mappingMap.get(m.projectId) || [];
      list.push(m.tapdBelonging);
      mappingMap.set(m.projectId, list);
    }

    const data = projects.map((p) => ({
      projectId: p.id,
      name: p.name,
      category: p.category,
      okrName: p.okrName,
      tapdBelongings: mappingMap.get(p.id) || [],
    }));

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('[GET project-mapping]', error);
    return NextResponse.json(
      { success: false, message: '获取映射数据失败' },
      { status: 500 },
    );
  }
}

// PUT /api/v1/settings/project-mapping
// 批量保存映射关系（全量替换）
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { mappings } = body as {
      mappings: { projectId: string; tapdBelongings: string[] }[];
    };

    if (!Array.isArray(mappings)) {
      return NextResponse.json(
        { success: false, message: '参数格式错误' },
        { status: 400 },
      );
    }

    // 删除所有旧映射
    await prisma.projectMapping.deleteMany({});

    // 批量创建新映射
    const createData: { projectId: string; tapdBelonging: string }[] = [];
    for (const m of mappings) {
      for (const tb of m.tapdBelongings) {
        if (tb.trim()) {
          createData.push({ projectId: m.projectId, tapdBelonging: tb.trim() });
        }
      }
    }

    if (createData.length > 0) {
      await prisma.projectMapping.createMany({ data: createData });
    }

    return NextResponse.json({
      success: true,
      message: `保存成功，共 ${createData.length} 条映射`,
    });
  } catch (error) {
    console.error('[PUT project-mapping]', error);
    return NextResponse.json(
      { success: false, message: '保存失败' },
      { status: 500 },
    );
  }
}
