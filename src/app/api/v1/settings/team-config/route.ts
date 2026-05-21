import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/v1/settings/team-config
export async function GET() {
  try {
    const list = await prisma.teamConfig.findMany({
      orderBy: { createdAt: 'asc' },
    });
    const data = list.map((item) => ({
      id: item.id,
      name: item.name,
      tapdProjectIds: JSON.parse(item.tapdProjectIds) as string[],
      enableTeamRanking: item.enableTeamRanking,
      enableHrRanking: item.enableHrRanking,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    }));
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('[GET team-config]', error);
    return NextResponse.json({ success: false, message: '获取团队配置失败' }, { status: 500 });
  }
}

// POST /api/v1/settings/team-config — 新增团队
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, tapdProjectIds, enableTeamRanking, enableHrRanking } = body as {
      name: string;
      tapdProjectIds?: string[];
      enableTeamRanking?: boolean;
      enableHrRanking?: boolean;
    };

    if (!name?.trim()) {
      return NextResponse.json({ success: false, message: '团队名称不能为空' }, { status: 400 });
    }

    const team = await prisma.teamConfig.create({
      data: {
        name: name.trim(),
        tapdProjectIds: JSON.stringify(tapdProjectIds || []),
        enableTeamRanking: enableTeamRanking ?? true,
        enableHrRanking: enableHrRanking ?? true,
      },
    });

    return NextResponse.json({ success: true, data: { id: team.id } });
  } catch (error) {
    console.error('[POST team-config]', error);
    return NextResponse.json({ success: false, message: '新增失败' }, { status: 500 });
  }
}

// PUT /api/v1/settings/team-config — 更新团队
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, name, tapdProjectIds, enableTeamRanking, enableHrRanking } = body as {
      id: string;
      name?: string;
      tapdProjectIds?: string[];
      enableTeamRanking?: boolean;
      enableHrRanking?: boolean;
    };

    if (!id) {
      return NextResponse.json({ success: false, message: '缺少ID' }, { status: 400 });
    }

    await prisma.teamConfig.update({
      where: { id },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(tapdProjectIds !== undefined && { tapdProjectIds: JSON.stringify(tapdProjectIds) }),
        ...(enableTeamRanking !== undefined && { enableTeamRanking }),
        ...(enableHrRanking !== undefined && { enableHrRanking }),
      },
    });

    return NextResponse.json({ success: true, message: '更新成功' });
  } catch (error) {
    console.error('[PUT team-config]', error);
    return NextResponse.json({ success: false, message: '更新失败' }, { status: 500 });
  }
}

// DELETE /api/v1/settings/team-config?id=xxx — 删除团队
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ success: false, message: '缺少ID' }, { status: 400 });
    }

    await prisma.teamConfig.delete({ where: { id } });
    return NextResponse.json({ success: true, message: '删除成功' });
  } catch (error) {
    console.error('[DELETE team-config]', error);
    return NextResponse.json({ success: false, message: '删除失败' }, { status: 500 });
  }
}

// PATCH /api/v1/settings/team-config — 切换开关
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, field, value } = body as {
      id: string;
      field: 'enableTeamRanking' | 'enableHrRanking';
      value: boolean;
    };

    if (!id || !field) {
      return NextResponse.json({ success: false, message: '参数错误' }, { status: 400 });
    }

    await prisma.teamConfig.update({
      where: { id },
      data: { [field]: value },
    });

    return NextResponse.json({ success: true, message: '切换成功' });
  } catch (error) {
    console.error('[PATCH team-config]', error);
    return NextResponse.json({ success: false, message: '切换失败' }, { status: 500 });
  }
}
