import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/middleware/auth';
import { checkPermission } from '@/lib/middleware/rbac';
import { success, error, notFound } from '@/lib/utils/api-response';

// GET /api/v1/projects/[id]/costs - 获取项目季度成本列表
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authCtx = await requireAuth();
    await checkPermission('GET', '/api/v1/projects', authCtx);

    const { id } = await params;

    const project = await prisma.project.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!project) {
      return notFound('项目不存在');
    }

    const costs = await prisma.projectCost.findMany({
      where: { projectId: id },
      orderBy: { quarter: 'asc' },
    });

    return success(costs);
  } catch (e) {
    if (e && typeof e === 'object' && 'status' in e && 'body' in e) throw e;
    console.error('GET /api/v1/projects/[id]/costs error:', e);
    return error(50001, '服务器内部错误', 500);
  }
}

// PUT /api/v1/projects/[id]/costs - 批量更新成本（按quarter匹配upsert）
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authCtx = await requireAuth();
    await checkPermission('PUT', '/api/v1/projects/*/costs/*', authCtx);

    const { id } = await params;

    const project = await prisma.project.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!project) {
      return notFound('项目不存在');
    }

    const body = await request.json();
    const costs: Array<{
      quarter: string;
      laborCost?: number;
      infraCost?: number;
      externalCost?: number;
      totalCost?: number;
      target?: string;
      dataSource?: string;
    }> = body;

    if (!Array.isArray(costs)) {
      return error(42201, '请求体必须是成本数组', 422);
    }

    // 查询现有成本记录
    const existingCosts = await prisma.projectCost.findMany({
      where: { projectId: id },
    });
    const existingMap = new Map(existingCosts.map((c) => [c.quarter, c.id]));

    // 使用事务批量upsert
    const results = await prisma.$transaction(
      costs.map((c) => {
        const existingId = existingMap.get(c.quarter);
        if (existingId) {
          return prisma.projectCost.update({
            where: { id: existingId },
            data: {
              ...(c.laborCost !== undefined && { laborCost: c.laborCost }),
              ...(c.infraCost !== undefined && { infraCost: c.infraCost }),
              ...(c.externalCost !== undefined && { externalCost: c.externalCost }),
              ...(c.totalCost !== undefined && { totalCost: c.totalCost }),
              ...(c.target !== undefined && { target: c.target }),
              ...(c.dataSource !== undefined && { dataSource: c.dataSource }),
            },
          });
        }
        return prisma.projectCost.create({
          data: {
            projectId: id,
            quarter: c.quarter,
            laborCost: c.laborCost || 0,
            infraCost: c.infraCost || 0,
            externalCost: c.externalCost || 0,
            totalCost: c.totalCost || 0,
            target: c.target || '',
            dataSource: c.dataSource || 'manual',
          },
        });
      }),
    );

    return success(results);
  } catch (e) {
    if (e && typeof e === 'object' && 'status' in e && 'body' in e) throw e;
    console.error('PUT /api/v1/projects/[id]/costs error:', e);
    return error(50001, '服务器内部错误', 500);
  }
}
