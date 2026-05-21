import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/middleware/auth';
import { checkPermission } from '@/lib/middleware/rbac';
import { success, error, notFound } from '@/lib/utils/api-response';

// GET /api/v1/projects/[id] - 项目详情
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
      include: {
        owner: { select: { id: true, name: true } },
        team: { select: { id: true, name: true } },
        okrs: { orderBy: { quarter: 'asc' } },
        milestones: { orderBy: { sortOrder: 'asc' } },
        costs: { orderBy: { quarter: 'asc' } },
        rois: { orderBy: { quarter: 'asc' } },
      },
    });

    if (!project) {
      return notFound('项目不存在');
    }

    // 计算总成本
    const totalCost = project.costs.reduce((sum, c) => sum + c.totalCost, 0);

    return success({
      ...project,
      totalCost,
    });
  } catch (e) {
    if (e && typeof e === 'object' && 'status' in e && 'body' in e) throw e;
    console.error('GET /api/v1/projects/[id] error:', e);
    return error(50001, '服务器内部错误', 500);
  }
}

// PUT /api/v1/projects/[id] - 更新项目
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authCtx = await requireAuth();
    await checkPermission('PUT', '/api/v1/projects', authCtx);

    const { id } = await params;
    const body = await request.json();

    // 检查项目是否存在
    const existing = await prisma.project.findUnique({
      where: { id },
      include: { milestones: true, costs: true },
    });
    if (!existing) {
      return notFound('项目不存在');
    }

    // 如果更新了code，检查唯一性
    if (body.code && body.code !== existing.code) {
      const codeExists = await prisma.project.findUnique({ where: { code: body.code } });
      if (codeExists) {
        return error(40901, `项目编码 ${body.code} 已存在`, 409);
      }
    }

    const {
      name, code, type, priority, status, health,
      delayDays, resourceRate, startDate, endDate, ownerId, teamId,
      budget, description, category, okrName, partner, po,
      milestones, costs,
    } = body;

    // 处理 milestones upsert（按 quarter）
    let computedProgress = existing.progress;
    if (milestones && Array.isArray(milestones)) {
      // 先删除旧的 milestones
      await prisma.projectMilestone.deleteMany({ where: { projectId: id } });

      // 创建新的 milestones
      const quarterOrderMap: Record<string, number> = {
        Q1: 1, Q2: 2, Q3: 3, Q4: 4,
      };

      for (let i = 0; i < milestones.length; i++) {
        const m = milestones[i];
        await prisma.projectMilestone.create({
          data: {
            projectId: id,
            quarter: m.quarter,
            target: m.target || '',
            achievement: m.achievement || '',
            progress: m.progress ?? 0,
            sortOrder: quarterOrderMap[m.quarter] ?? (i + 1),
          },
        });
      }

      // 重新计算 progress = milestones 的平均 progress
      if (milestones.length > 0) {
        const totalProgress = milestones.reduce((sum: number, m: { progress?: number }) => sum + (m.progress ?? 0), 0);
        computedProgress = Math.round((totalProgress / milestones.length) * 10) / 10;
      } else {
        computedProgress = 0;
      }
    }

    // 处理 costs upsert（按 quarter）
    if (costs && Array.isArray(costs)) {
      // 先删除旧的 costs
      await prisma.projectCost.deleteMany({ where: { projectId: id } });

      // 创建新的 costs
      for (const c of costs) {
        await prisma.projectCost.create({
          data: {
            projectId: id,
            quarter: c.quarter,
            totalCost: c.totalCost ?? 0,
            target: c.target || '',
          },
        });
      }
    }

    // 更新项目基本字段
    const project = await prisma.project.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(code !== undefined && { code }),
        ...(type !== undefined && { type }),
        ...(priority !== undefined && { priority }),
        ...(status !== undefined && { status }),
        ...(health !== undefined && { health }),
        ...(milestones && { progress: computedProgress }),
        ...(delayDays !== undefined && { delayDays }),
        ...(resourceRate !== undefined && { resourceRate }),
        ...(startDate !== undefined && { startDate: startDate ? new Date(startDate) : null }),
        ...(endDate !== undefined && { endDate: endDate ? new Date(endDate) : null }),
        ...(ownerId !== undefined && { ownerId: ownerId || null }),
        ...(teamId !== undefined && { teamId }),
        ...(budget !== undefined && { budget }),
        ...(description !== undefined && { description }),
        ...(category !== undefined && { category }),
        ...(okrName !== undefined && { okrName }),
        ...(partner !== undefined && { partner }),
        ...(po !== undefined && { po }),
      },
      include: {
        owner: { select: { id: true, name: true } },
        team: { select: { id: true, name: true } },
        milestones: { orderBy: { sortOrder: 'asc' } },
        costs: { orderBy: { quarter: 'asc' } },
      },
    });

    // 计算总成本
    const totalCost = project.costs.reduce((sum, c) => sum + c.totalCost, 0);

    return success({
      ...project,
      totalCost,
    });
  } catch (e) {
    if (e && typeof e === 'object' && 'status' in e && 'body' in e) throw e;
    console.error('PUT /api/v1/projects/[id] error:', e);
    return error(50001, '服务器内部错误', 500);
  }
}

// DELETE /api/v1/projects/[id] - 删除项目
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authCtx = await requireAuth();
    await checkPermission('DELETE', '/api/v1/projects', authCtx);

    const { id } = await params;

    // 检查项目是否存在
    const existing = await prisma.project.findUnique({ where: { id } });
    if (!existing) {
      return notFound('项目不存在');
    }

    // 删除项目（cascade 会自动删除 milestones, costs, rois, okrs 等）
    await prisma.project.delete({ where: { id } });

    return success({ id, deleted: true });
  } catch (e) {
    if (e && typeof e === 'object' && 'status' in e && 'body' in e) throw e;
    console.error('DELETE /api/v1/projects/[id] error:', e);
    return error(50001, '服务器内部错误', 500);
  }
}
