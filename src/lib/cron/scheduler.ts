import cron from 'node-cron';
import { incrementalSync, fullSync } from '@/lib/sync/tapd-sync';
import { DataQualityService } from '@/lib/sync/data-quality';
import { logger } from '@/lib/utils/logger';

let isInitialized = false;

export function initScheduler() {
  if (isInitialized) {
    logger.warn('Scheduler already initialized, skipping');
    return;
  }

  const dataQuality = new DataQualityService();

  // 每15分钟：增量同步TAPD数据
  cron.schedule('*/15 * * * *', async () => {
    logger.info('Running incremental TAPD sync (scheduled)');
    try {
      await incrementalSync();
    } catch (error) {
      logger.error('Scheduled incremental sync failed', { error });
    }
  });

  // 每日凌晨2:00：全量同步TAPD数据
  cron.schedule('0 2 * * *', async () => {
    logger.info('Running full TAPD sync (scheduled)');
    try {
      await fullSync();
    } catch (error) {
      logger.error('Scheduled full sync failed', { error });
    }
  });

  // 每小时：数据质量检查
  cron.schedule('0 * * * *', async () => {
    logger.info('Running data quality check (scheduled)');
    try {
      const results = await dataQuality.runAllChecks();
      const failedChecks = results.filter((r) => !r.passed);
      if (failedChecks.length > 0) {
        logger.warn(`Data quality: ${failedChecks.length}/${results.length} checks failed`);
      } else {
        logger.info('Data quality: all checks passed');
      }
    } catch (error) {
      logger.error('Scheduled data quality check failed', { error });
    }
  });

  isInitialized = true;
  logger.info('Scheduler initialized with 3 cron jobs');
}
