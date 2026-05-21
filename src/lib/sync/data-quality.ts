import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/utils/logger';

export interface QualityCheckResult {
  rule: string;
  passed: boolean;
  total: number;
  failed: number;
  details: string[];
}

export class DataQualityService {
  async runAllChecks(): Promise<QualityCheckResult[]> {
    const results = await Promise.all([
      this.checkRequirementCompleteness(),
      this.checkWorkHourAccuracy(),
      this.checkDataFreshness(),
    ]);

    for (const result of results) {
      if (!result.passed) {
        logger.warn(`Data quality check failed: ${result.rule}`, {
          failed: result.failed,
          total: result.total,
        });
      }
    }

    return results;
  }

  private async checkRequirementCompleteness(): Promise<QualityCheckResult> {
    const incompleteReqs = await prisma.requirement.findMany({
      where: {
        title: { equals: '' },
      },
      select: { id: true },
      take: 10,
    });

    return {
      rule: '需求完整性检查',
      passed: incompleteReqs.length === 0,
      total: await prisma.requirement.count(),
      failed: incompleteReqs.length,
      details: incompleteReqs.map((r) => `需求 ${r.id} 标题为空`),
    };
  }

  private async checkWorkHourAccuracy(): Promise<QualityCheckResult> {
    const abnormalHours = await prisma.workHour.findMany({
      where: {
        OR: [
          { hours: { lt: 0 } },
          { hours: { gt: 24 } },
        ],
      },
      select: { id: true, hours: true, date: true },
      take: 10,
    });

    return {
      rule: '工时准确性检查',
      passed: abnormalHours.length === 0,
      total: await prisma.workHour.count(),
      failed: abnormalHours.length,
      details: abnormalHours.map(
        (h) => `工时记录 ${h.id} 在 ${h.date} 记录了 ${h.hours} 小时，超出合理范围`,
      ),
    };
  }

  private async checkDataFreshness(): Promise<QualityCheckResult> {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const recentSync = await prisma.syncLog.findFirst({
      where: {
        source: 'TAPD',
        status: 'SUCCESS',
      },
      orderBy: { startedAt: 'desc' },
    });

    const isFresh = recentSync
      ? recentSync.startedAt >= twentyFourHoursAgo
      : false;

    return {
      rule: '数据时效性检查',
      passed: isFresh,
      total: await prisma.requirement.count(),
      failed: isFresh ? 0 : 1,
      details: isFresh
        ? []
        : [`最近一次成功同步: ${recentSync?.startedAt?.toISOString() || '从未同步'}`],
    };
  }
}
