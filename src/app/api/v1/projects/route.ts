import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/middleware/auth';
import { checkPermission } from '@/lib/middleware/rbac';
import { success, error, validationError } from '@/lib/utils/api-response';
import { apiCache, generateCacheKey } from '@/lib/utils/api-cache';

// GET /api/v1/projects - 项目列表（含筛选、分页、统计）
export async function GET(request: NextRequest) {
  try {
    const authCtx = await requireAuth();
    await checkPermission('GET', '/api/v1/projects', authCtx);

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') || '20', 10)));
    const category = searchParams.get('category') || undefined;
    const status = searchParams.get('status') || undefined;
    const okrName = searchParams.get('okrName') || undefined;
    const search = searchParams.get('search') || undefined;
    const quarter = searchParams.get('quarter') || undefined;
    const view = searchParams.get('view') || undefined;

    // ✅ 优化: 检查缓存（仅对第一页且无搜索条件时使用缓存）
    const useCache = page === 1 && !search && !quarter;
    
    if (useCache) {
      const cacheKey = generateCacheKey('/api/v1/projects', { category, status, okrName, pageSize });
      const cachedData = apiCache.get(cacheKey);
      
      if (cachedData) {
        return success(cachedData);
      }
    }

    // 构建查询条件
    const where: Record<string, unknown> = {};

    if (category) where.category = category;
    if (status) where.status = status;
    if (okrName) where.okrName = { contains: okrName };
    if (search) where.name = { contains: search };

    // 按季度筛选：需要有该季度里程碑数据的项目
    if (quarter) {
      where.milestones = {
        some: { quarter },
      };
    }

    // ✅ 优化1: 并行执行分页查询和统计聚合
    const [total, projects, statsAgg] = await Promise.all([
      prisma.project.count({ where }),
      
      prisma.project.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          owner: { select: { id: true, name: true } },
          team: { select: { id: true, name: true } },
          milestones: {
            orderBy: { sortOrder: 'asc' },
          },
          costs: true,
        },
      }),
      
      // ✅ 优化2: 使用SQL聚合替代全量查询
      Promise.all([
        prisma.project.aggregate({
          _avg: { progress: true },
          _count: true,
          where,
        }),
        
        prisma.projectCost.aggregate({
          _sum: { totalCost: true },
        }),
        
        prisma.project.groupBy({
          by: ['category'],
          _count: true,
          where,
        }),
        
        // 高成就项目数：使用 Prisma 查询替代原始SQL（兼容SQLite）
        prisma.projectMilestone.count({
          where: {
            progress: { gte: 80 },
            ...(category && { project: { category } }),
            ...(status && { project: { status } }),
          },
        }),
      ]),
    ]);

    // 计算每个项目的总成本
    const list = projects.map((p) => {
      const totalCost = p.costs.reduce((sum, c) => sum + c.totalCost, 0);
      const quarterCosts = p.costs.map((c) => ({ quarter: c.quarter, totalCost: c.totalCost }));
      return {
        id: p.id,
        name: p.name,
        code: p.code,
        type: p.type,
        category: p.category,
        status: p.status,
        health: p.health,
        progress: p.progress,
        okrName: p.okrName,
        partner: p.partner,
        po: p.po,
        ownerName: p.owner?.name,
        teamName: p.team?.name,
        milestones: p.milestones.map((m) => ({
          quarter: m.quarter,
          target: m.target,
          achievement: m.achievement,
          progress: m.progress,
        })),
        costs: quarterCosts,
        totalCost,
        avgProgress: p.progress,
        startDate: p.startDate?.toISOString(),
        endDate: p.endDate?.toISOString(),
        description: p.description,
      };
    });

    // 解析统计数据
    const [progressAgg, costAgg, categoryGroups, highAchievementRaw] = statsAgg;
    
    const totalProjects = progressAgg._count;
    const avgProgress = Math.round((progressAgg._avg.progress || 0) * 10) / 10;
    const totalCost = costAgg._sum.totalCost || 0;
    const highAchievementCount = highAchievementRaw as number;
    
    // 分类统计
    const categoryStats = categoryGroups.reduce((acc, group) => {
      acc[group.category] = group._count;
      return acc;
    }, {} as Record<string, number>);
    
    const strategicCount = categoryStats['STRATEGIC'] || 0;
    const regularCount = categoryStats['REGULAR'] || 0;
    const technicalCount = categoryStats['TECHNICAL'] || 0;

    // OKR分组视图
    let okrGroups: Record<string, typeof list> | undefined;
    if (view === 'okr-group') {
      okrGroups = {};
      for (const project of list) {
        const key = project.okrName || '未关联OKR';
        if (!okrGroups[key]) okrGroups[key] = [];
        okrGroups[key].push(project);
      }
    }

    const responseData = {
      list,
      total,
      page,
      pageSize,
      stats: {
        totalProjects,
        strategicCount,
        regularCount,
        technicalCount,
        avgProgress,
        totalCost,
        highAchievementCount,
      },
      ...(okrGroups ? { okrGroups } : {}),
    };
    
    // ✅ 优化: 设置缓存
    if (useCache) {
      const cacheKey = generateCacheKey('/api/v1/projects', { category, status, okrName, pageSize });
      apiCache.set(cacheKey, responseData, 10000); // 缓存10秒
    }
    
    return success(responseData);
  } catch (e) {
    if (e && typeof e === 'object' && 'status' in e && 'body' in e) throw e;
    console.error('GET /api/v1/projects error:', e);
    return error(50001, '服务器内部错误', 500);
  }
}

// POST /api/v1/projects - 创建项目
export async function POST(request: NextRequest) {
  try {
    const authCtx = await requireAuth();
    await checkPermission('POST', '/api/v1/projects', authCtx);

    const body = await request.json();
    const {
      name, type, priority, status, health,
      delayDays, resourceRate, startDate, endDate, ownerId, teamId: inputTeamId,
      budget, description, category, okrName, partner, po,
      milestones, costs,
    } = body;

    if (!name) {
      return validationError('缺少必填字段: name');
    }

    // 自动获取teamId（取第一个team）
    let teamId = inputTeamId || '';
    if (!teamId) {
      const firstTeam = await prisma.team.findFirst({ select: { id: true } });
      teamId = firstTeam?.id || '';
    }

    // 自动生成项目编码（格式 P-XXX，查询当前最大编号+1）
    const latestProject = await prisma.project.findFirst({
      where: { code: { startsWith: 'P-' } },
      orderBy: { code: 'desc' },
      select: { code: true },
    });

    let nextNum = 1;
    if (latestProject) {
      const match = latestProject.code.match(/^P-(\d+)$/);
      if (match) {
        nextNum = parseInt(match[1], 10) + 1;
      }
    }
    const code = `P-${String(nextNum).padStart(3, '0')}`;

    // 计算 milestones 的平均 progress
    let computedProgress = 0;
    if (milestones && Array.isArray(milestones) && milestones.length > 0) {
      const totalProgress = milestones.reduce(
        (sum: number, m: { progress?: number }) => sum + (m.progress ?? 0),
        0,
      );
      computedProgress = Math.round((totalProgress / milestones.length) * 10) / 10;
    }

    const projectId = crypto.randomUUID();

    const project = await prisma.project.create({
      data: {
        id: projectId,
        name,
        code,
        type: type || 'INTERNAL',
        priority: priority || 'MEDIUM',
        status: status || 'PLANNING',
        health: health || 'HEALTHY',
        progress: computedProgress,
        delayDays: delayDays || 0,
        resourceRate: resourceRate || 0,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        ownerId: ownerId || null,
        teamId,
        budget: budget || null,
        description: description || null,
        category: category || 'REGULAR',
        okrName: okrName || '',
        partner: partner || '',
        po: po || '',
        // 创建 milestones
        ...(milestones && Array.isArray(milestones) && {
          milestones: {
            create: milestones.map((m: { quarter: string; target?: string; achievement?: string; progress?: number }, i: number) => {
              const quarterOrderMap: Record<string, number> = {
                Q1: 1, Q2: 2, Q3: 3, Q4: 4,
              };
              return {
                quarter: m.quarter,
                target: m.target || '',
                achievement: m.achievement || '',
                progress: m.progress ?? 0,
                sortOrder: quarterOrderMap[m.quarter] ?? (i + 1),
              };
            }),
          },
        }),
        // 创建 costs
        ...(costs && Array.isArray(costs) && {
          costs: {
            create: costs.map((c: { quarter: string; totalCost?: number; target?: string }) => ({
              quarter: c.quarter,
              totalCost: c.totalCost ?? 0,
              target: c.target || '',
            })),
          },
        }),
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

    return success(
      {
        ...project,
        totalCost,
      },
      201,
    );
  } catch (e) {
    if (e && typeof e === 'object' && 'status' in e && 'body' in e) throw e;
    console.error('POST /api/v1/projects error:', e);
    return error(50001, '服务器内部错误', 500);
  }
}