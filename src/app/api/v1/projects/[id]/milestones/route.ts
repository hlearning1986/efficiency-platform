import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/middleware/auth';
import { checkPermission } from '@/lib/middleware/rbac';
import { success, error, notFound } from '@/lib/utils/api-response';

// GET /api/v1/projects/[id]/milestones - 获取项目季度里程碑列表
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

    const milestones = await prisma.projectMilestone.findMany({
      where: { projectId: id },
      orderBy: { sortOrder: 'asc' },
    });

    return success(milestones);
  } catch (e) {
    if (e && typeof e === 'object' && 'status' in e && 'body' in e) throw e;
    console.error('GET /api/v1/projects/[id]/milestones error:', e);
    return error(50001, '服务器内部错误', 500);
  }
}

// PUT /api/v1/projects/[id]/milestones - 批量更新里程碑（按quarter匹配upsert）
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
    const milestones: Array<{
      quarter: string;
      target?: string;
      achievement?: string;
      progress?: number;
      sortOrder?: number;
    }> = body;

    if (!Array.isArray(milestones)) {
      return error(42201, '请求体必须是里程碑数组', 422);
    }

    // 使用事务批量upsert
    const results = await prisma.$transaction(
      milestones.map((m) =>
        prisma.projectMilestone.upsert({
          where: {
            projectId_quarter: {
              projectId: id,
              quarter: m.quarter,
            },
          },
          create: {
            projectId: id,
            quarter: m.quarter,
            target: m.target || '',
            achievement: m.achievement || '',
            progress: m.progress || 0,
            sortOrder: m.sortOrder || 0,
          },
          update: {
            ...(m.target !== undefined && { target: m.target }),
            ...(m.achievement !== undefined && { achievement: m.achievement }),
            ...(m.progress !== undefined && { progress: m.progress }),
            ...(m.sortOrder !== undefined && { sortOrder: m.sortOrder }),
          },
        }),
      ),
    );

    return success(results);
  } catch (e) {
    if (e && typeof e === 'object' && 'status' in e && 'body' in e) throw e;
    console.error('PUT /api/v1/projects/[id]/milestones error:', e);
    return error(50001, '服务器内部错误', 500);
  }
}
