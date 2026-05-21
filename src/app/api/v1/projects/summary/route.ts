import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/middleware/auth';
import { checkPermission } from '@/lib/middleware/rbac';
import { success, error } from '@/lib/utils/api-response';

// GET /api/v1/projects/summary - 项目统计摘要
export async function GET() {
  try {
    const authCtx = await requireAuth();
    await checkPermission('GET', '/api/v1/projects', authCtx);

    // 获取所有项目及其关联数据
    const projects = await prisma.project.findMany({
      include: {
        milestones: true,
        costs: true,
        rois: true,
      },
    });

    // 统一计算每个项目的 avgProgress（基于 milestones）和 totalCost（基于 costs）
    const allProjectStats = projects.map((p) => {
      const quarterProgress: Record<string, number> = {};
      p.milestones.forEach((m) => {
        quarterProgress[m.quarter] = m.progress || 0;
      });
      return {
        id: p.id,
        name: p.name,
        category: p.category,
        totalCost: p.costs.reduce((s, c) => s + c.totalCost, 0),
        avgProgress: p.milestones.length > 0
          ? p.milestones.reduce((s, m) => s + (m.progress || 0), 0) / p.milestones.length / 100
          : 0,
        quarters: p.costs.map((c) => ({
          quarter: c.quarter,
          cost: c.totalCost,
        })),
        quarterProgress,
      };
    });

    // 按分类统计
    const categories = ['STRATEGIC', 'REGULAR', 'TECHNICAL'] as const;
    const categoryStats: Record<string, {
      count: number;
      totalCost: number;
      avgProgress: number;
      projectNames: string[];
    }> = {};

    for (const cat of categories) {
      const catProjects = allProjectStats.filter((p) => p.category === cat);
      const totalCost = catProjects.reduce((sum, p) => sum + p.totalCost, 0);
      const avgProgress = catProjects.length > 0
        ? catProjects.reduce((sum, p) => sum + p.avgProgress, 0) / catProjects.length
        : 0;

      categoryStats[cat] = {
        count: catProjects.length,
        totalCost: Math.round(totalCost),
        avgProgress: Math.round(avgProgress * 1000) / 1000,
        projectNames: catProjects.map((p) => p.name),
      };
    }

    // ===== 1. progressDistribution - 达成率分布 =====
    const highProgress = allProjectStats.filter((p) => p.avgProgress >= 0.9);
    const mediumProgress = allProjectStats.filter((p) => p.avgProgress >= 0.5 && p.avgProgress < 0.9);
    const lowProgress = allProjectStats.filter((p) => p.avgProgress > 0 && p.avgProgress < 0.5);

    const progressDistribution = {
      highProgress: highProgress.map((p) => ({
        id: p.id,
        name: p.name,
        category: p.category,
        avgProgress: Math.round(p.avgProgress * 1000) / 1000,
        totalCost: Math.round(p.totalCost),
      })),
      mediumProgress: mediumProgress.map((p) => ({
        id: p.id,
        name: p.name,
        category: p.category,
        avgProgress: Math.round(p.avgProgress * 1000) / 1000,
        totalCost: Math.round(p.totalCost),
      })),
      lowProgress: lowProgress.map((p) => ({
        id: p.id,
        name: p.name,
        category: p.category,
        avgProgress: Math.round(p.avgProgress * 1000) / 1000,
        totalCost: Math.round(p.totalCost),
      })),
    };

    // ===== 2. roiAnalysis - ROI效率分析 =====
    const efficientProjects = allProjectStats.filter(
      (p) => p.avgProgress >= 0.9 && p.totalCost < 200000,
    );
    const inefficientProjects = allProjectStats.filter(
      (p) => p.avgProgress < 0.5 && p.totalCost > 200000,
    );

    const roiAnalysis = {
      efficientProjects: efficientProjects.map((p) => ({
        id: p.id,
        name: p.name,
        category: p.category,
        avgProgress: Math.round(p.avgProgress * 1000) / 1000,
        totalCost: Math.round(p.totalCost),
      })),
      inefficientProjects: inefficientProjects.map((p) => ({
        id: p.id,
        name: p.name,
        category: p.category,
        avgProgress: Math.round(p.avgProgress * 1000) / 1000,
        totalCost: Math.round(p.totalCost),
      })),
    };

    // ===== 3. overallStats - 整体统计 =====
    const totalCost = allProjectStats.reduce((sum, p) => sum + p.totalCost, 0);
    const avgProgress = allProjectStats.length > 0
      ? allProjectStats.reduce((sum, p) => sum + p.avgProgress, 0) / allProjectStats.length
      : 0;

    const overallStats = {
      totalProjects: allProjectStats.length,
      totalCost: Math.round(totalCost),
      avgProgress: Math.round(avgProgress * 1000) / 1000,
    };

    // ===== 4. costRanking - 成本排行（按总成本降序） =====
    const costRanking = [...allProjectStats]
      .sort((a, b) => b.totalCost - a.totalCost)
      .map((p) => ({
        id: p.id,
        name: p.name,
        category: p.category,
        totalCost: Math.round(p.totalCost),
        avgProgress: Math.round(p.avgProgress * 1000) / 1000,
        quarters: p.quarters,
        quarterProgress: p.quarterProgress,
      }));

    // ===== 预警逻辑：成本 > 20万 且 达成率 < 70% =====
    const warningProjects = allProjectStats.filter(
      (p) => p.totalCost > 200000 && p.avgProgress < 0.7,
    ).map((p) => ({
      id: p.id,
      name: p.name,
      category: p.category,
      totalCost: Math.round(p.totalCost),
      avgProgress: Math.round(p.avgProgress * 1000) / 1000,
      quarterProgress: p.quarterProgress,
    }));

    // 生成决策建议
    const suggestions: string[] = [];

    if (warningProjects.length > 0) {
      suggestions.push(
        `发现 ${warningProjects.length} 个高成本低达成项目需要关注：${warningProjects.map((p) => p.name).join('、')}。建议评估资源投入是否合理，考虑优化方案或调整预期目标。`,
      );
    }

    for (const cat of categories) {
      const stats = categoryStats[cat];
      if (stats.avgProgress < 0.5 && stats.count > 0) {
        const catLabel = cat === 'STRATEGIC' ? '战略' : cat === 'REGULAR' ? '常规' : '技术';
        suggestions.push(
          `${catLabel}项目整体达成率偏低（${(stats.avgProgress * 100).toFixed(0)}%），建议加强进度跟踪和资源协调。`,
        );
      }
    }

    const strategicCost = categoryStats.STRATEGIC?.totalCost || 0;
    const regularCost = categoryStats.REGULAR?.totalCost || 0;
    const technicalCost = categoryStats.TECHNICAL?.totalCost || 0;
    const totalAllCost = strategicCost + regularCost + technicalCost;

    if (totalAllCost > 0) {
      if (strategicCost / totalAllCost > 0.5) {
        suggestions.push('战略项目成本占比超过50%，建议审视战略项目投资回报，确保资源聚焦于高价值方向。');
      }
      if (technicalCost / totalAllCost < 0.15) {
        suggestions.push('技术项目投入占比偏低，建议适当增加技术基建投入以支撑业务长期发展。');
      }
    }

    if (suggestions.length === 0) {
      suggestions.push('当前项目整体运行良好，各项指标均在正常范围内。建议持续关注高成本项目的ROI变化。');
    }

    return success({
      categoryStats,
      warningProjects,
      suggestions,
      progressDistribution,
      roiAnalysis,
      overallStats,
      costRanking,
    });
  } catch (e) {
    if (e && typeof e === 'object' && 'status' in e && 'body' in e) throw e;
    console.error('GET /api/v1/projects/summary error:', e);
    return error(50001, '服务器内部错误', 500);
  }
}
