import cron from 'node-cron';
import { AutoSyncService } from '@/lib/sync/auto-sync-service';
import { DataQualityService } from '@/lib/sync/data-quality';
import { logger } from '@/lib/utils/logger';

let isInitialized = false;
let scheduledTasks: cron.ScheduledTask[] = [];

function convertTimeToCron(timeStr: string): string {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return `${minutes} ${hours} * * *`;
}

function destroyAllSyncTasks() {
  scheduledTasks.forEach(task => task.stop());
  scheduledTasks = [];
  logger.info('All scheduled sync tasks destroyed');
}

export async function initScheduler() {
  if (isInitialized) {
    logger.warn('Scheduler reinitializing...');
    destroyAllSyncTasks();
  }

  try {
    const config = await AutoSyncService.getActiveConfig();
    
    if (!config) {
      logger.info('No active auto-sync configuration found, skipping sync tasks');
      isInitialized = true;
      initQualityCheckTask();
      return;
    }
    
    logger.info(`Loading auto-sync config: "${config.name}" (${config.id})`);
    logger.info(`  - Enabled: ${config.isEnabled}`);
    logger.info(`  - Sync times: ${config.syncTimes.join(', ')}`);
    logger.info(`  - Strategy: ${config.syncStrategy}`);
    logger.info(`  - Days back: ${config.defaultDaysBack}`);
    
    config.syncTimes.forEach((time) => {
      const cronExpression = convertTimeToCron(time);
      
      const task = cron.schedule(cronExpression, async () => {
        logger.info(`[${time}] Starting scheduled auto-sync...`);
        
        try {
          const result = await AutoSyncService.executeAutoSync(config.id!);
          
          if (result.success) {
            logger.info(`[${time}] Auto-sync completed successfully`, result.stats);
          } else {
            logger.error(`[${time}] Auto-sync failed:`, { error: result.error });
          }
        } catch (error) {
          logger.error(`[${time}] Auto-sync task threw error:`, { error });
        }
      }, {
        scheduled: true,
        timezone: config.timezone,
      });
      
      scheduledTasks.push(task);
      logger.info(`  ✓ Registered sync task: cron="${cronExpression}" (time=${time})`);
    });

    initQualityCheckTask();
    
    isInitialized = true;
    logger.info(`Scheduler initialized with ${scheduledTasks.length} sync tasks + quality check`);
    
  } catch (error) {
    logger.error('Failed to initialize scheduler:', { error });
    isInitialized = true;
    initQualityCheckTask();
  }
}

function initQualityCheckTask() {
  const dataQuality = new DataQualityService();

  const qualityTask = cron.schedule('0 * * * *', async () => {
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
  }, {
    scheduled: true,
    timezone: 'Asia/Shanghai',
  });
  
  scheduledTasks.push(qualityTask);
}

export async function reloadScheduler() {
  logger.info('Manual scheduler reload requested');
  isInitialized = false;
  await initScheduler();
}

export function getSchedulerStatus(): {
  isInitialized: boolean;
  activeTasksCount: number;
} {
  return {
    isInitialized,
    activeTasksCount: scheduledTasks.filter(task => task.getStatus() === 'running').length,
  };
}
