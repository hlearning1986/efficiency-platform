import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/middleware/auth';
import { checkPermission } from '@/lib/middleware/rbac';
import { success, error, notFound } from '@/lib/utils/api-response';

// GET /api/v1/projects/[id]/roi - 获取项目季度ROI列表
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authCtx = await requireAuth();
    await checkPermission('GET', '/api/v1/projects/*/roi', authCtx);

    const { id } = await params;

    const project = await prisma.project.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!project) {
      return notFound('项目不存在');
    }

    const rois = await prisma.projectRoi.findMany({
      where: { projectId: id },
      orderBy: { quarter: 'asc' },
    });

    return success(rois);
  } catch (e) {
    if (e && typeof e === 'object' && 'status' in e && 'body' in e) throw e;
    console.error('GET /api/v1/projects/[id]/roi error:', e);
    return error(50001, '服务器内部错误', 500);
  }
}

// PUT /api/v1/projects/[id]/roi - 批量更新ROI（按quarter匹配upsert）
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authCtx = await requireAuth();
    await checkPermission('PUT', '/api/v1/projects', authCtx);

    const { id } = await params;

    const project = await prisma.project.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!project) {
      return notFound('项目不存在');
    }

    const body = await request.json();
    const rois: Array<{
      quarter: string;
      revenue?: number;
      costSaving?: number;
      efficiencyGain?: number;
      totalBenefit?: number;
      totalCost?: number;
      roiPercent?: number;
      targetRoi?: number;
    }> = body;

    if (!Array.isArray(rois)) {
      return error(42201, '请求体必须是ROI数组', 422);
    }

    // 查询现有ROI记录
    const existingRois = await prisma.projectRoi.findMany({
      where: { projectId: id },
    });
    const existingMap = new Map(existingRois.map((r) => [r.quarter, r.id]));

    // 使用事务批量upsert
    const results = await prisma.$transaction(
      rois.map((r) => {
        const existingId = existingMap.get(r.quarter);
        if (existingId) {
          return prisma.projectRoi.update({
            where: { id: existingId },
            data: {
              ...(r.revenue !== undefined && { revenue: r.revenue }),
              ...(r.costSaving !== undefined && { costSaving: r.costSaving }),
              ...(r.efficiencyGain !== undefined && { efficiencyGain: r.efficiencyGain }),
              ...(r.totalBenefit !== undefined && { totalBenefit: r.totalBenefit }),
              ...(r.totalCost !== undefined && { totalCost: r.totalCost }),
              ...(r.roiPercent !== undefined && { roiPercent: r.roiPercent }),
              ...(r.targetRoi !== undefined && { targetRoi: r.targetRoi }),
            },
          });
        }
        return prisma.projectRoi.create({
          data: {
            projectId: id,
            quarter: r.quarter,
            revenue: r.revenue || 0,
            costSaving: r.costSaving || 0,
            efficiencyGain: r.efficiencyGain || 0,
            totalBenefit: r.totalBenefit || 0,
            totalCost: r.totalCost || 0,
            roiPercent: r.roiPercent || 0,
            targetRoi: r.targetRoi || 0,
          },
        });
      }),
    );

    return success(results);
  } catch (e) {
    if (e && typeof e === 'object' && 'status' in e && 'body' in e) throw e;
    console.error('PUT /api/v1/projects/[id]/roi error:', e);
    return error(50001, '服务器内部错误', 500);
  }
}
