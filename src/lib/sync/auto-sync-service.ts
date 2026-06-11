import { prisma } from '@/lib/prisma';
import { incrementalSync, fullSync } from '@/lib/sync/tapd-sync';
import dayjs from 'dayjs';
import { logger } from '@/lib/utils/logger';

export interface AutoSyncConfigData {
  id?: string;
  isEnabled: boolean;
  name: string;
  syncTimes: string[];
  timezone: string;
  defaultDaysBack: number;
  dataTypes: string[];
  workspaceIds: string[] | null;
  syncStrategy: 'incremental' | 'full' | 'smart';
  retryOnFailure: boolean;
  maxRetries: number;
  notifyOnComplete: boolean;
  notifyOnError: boolean;
  notifyChannels: string[] | null;
  lastExecutedAt?: Date;
  lastStatus?: string;
  nextExecuteAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
  createdBy?: string;
}

export class AutoSyncService {
  
  static async getAllConfigs(): Promise<AutoSyncConfigData[]> {
    const configs = await prisma.autoSyncConfig.findMany({
      orderBy: { createdAt: 'desc' },
    });
    
    return configs.map(this.transformToPlainObject);
  }
  
  static async getConfig(id: string): Promise<AutoSyncConfigData | null> {
    const config = await prisma.autoSyncConfig.findUnique({
      where: { id },
    });
    
    return config ? this.transformToPlainObject(config) : null;
  }
  
  static async createConfig(data: Partial<AutoSyncConfigData>): Promise<AutoSyncConfigData> {
    const config = await prisma.autoSyncConfig.create({
      data: {
        isEnabled: data.isEnabled ?? true,
        name: data.name ?? '默认自动同步',
        syncTimes: JSON.stringify(data.syncTimes ?? ['02:00']),
        timezone: data.timezone ?? 'Asia/Shanghai',
        defaultDaysBack: data.defaultDaysBack ?? 90,
        dataTypes: JSON.stringify(data.dataTypes ?? ['story', 'task', 'iteration']),
        workspaceIds: data.workspaceIds ? JSON.stringify(data.workspaceIds) : null,
        syncStrategy: data.syncStrategy ?? 'incremental',
        retryOnFailure: data.retryOnFailure ?? true,
        maxRetries: data.maxRetries ?? 3,
        notifyOnComplete: data.notifyOnComplete ?? false,
        notifyOnError: data.notifyOnError ?? true,
        notifyChannels: data.notifyChannels ? JSON.stringify(data.notifyChannels) : null,
        createdBy: data.createdBy,
      },
    });
    
    logger.info(`AutoSyncConfig created: ${config.id}`);
    return this.transformToPlainObject(config);
  }
  
  static async updateConfig(id: string, data: Partial<AutoSyncConfigData>): Promise<AutoSyncConfigData> {
    const updateData: Record<string, unknown> = { ...data };
    
    if (data.syncTimes) updateData.syncTimes = JSON.stringify(data.syncTimes);
    if (data.dataTypes) updateData.dataTypes = JSON.stringify(data.dataTypes);
    if (data.workspaceIds !== undefined) {
      updateData.workspaceIds = data.workspaceIds ? JSON.stringify(data.workspaceIds) : null;
    }
    if (data.notifyChannels !== undefined) {
      updateData.notifyChannels = data.notifyChannels ? JSON.stringify(data.notifyChannels) : null;
    }
    
    const config = await prisma.autoSyncConfig.update({
      where: { id },
      data: updateData,
    });
    
    logger.info(`AutoSyncConfig updated: ${config.id}`);
    return this.transformToPlainObject(config);
  }
  
  static async deleteConfig(id: string): Promise<void> {
    await prisma.autoSyncConfig.delete({
      where: { id },
    });
    
    logger.info(`AutoSyncConfig deleted: ${id}`);
  }
  
  static async toggleConfig(id: string): Promise<AutoSyncConfigData> {
    const config = await prisma.autoSyncConfig.findUnique({
      where: { id },
    });
    
    if (!config) {
      throw new Error('Configuration not found');
    }
    
    const updated = await prisma.autoSyncConfig.update({
      where: { id },
      data: { isEnabled: !config.isEnabled },
    });
    
    logger.info(`AutoSyncConfig toggled: ${id} -> ${updated.isEnabled}`);
    return this.transformToPlainObject(updated);
  }
  
  static async getActiveConfig(): Promise<AutoSyncConfigData | null> {
    const config = await prisma.autoSyncConfig.findFirst({
      where: { isEnabled: true },
      orderBy: { updatedAt: 'desc' },
    });
    
    return config ? this.transformToPlainObject(config) : null;
  }
  
  static async executeAutoSync(configId: string): Promise<{ success: boolean; stats?: Record<string, number>; error?: string }> {
    const config = await this.getConfig(configId);
    
    if (!config || !config.isEnabled) {
      return { success: false, error: 'Configuration not found or disabled' };
    }
    
    try {
      let stats: Record<string, number> = {};
      
      switch (config.syncStrategy) {
        case 'full':
          const fullResult = await fullSync();
          stats = { recordsCount: fullResult.recordsCount };
          break;
        case 'incremental':
          const incrResult = await incrementalSync();
          stats = { recordsCount: incrResult.recordsCount };
          break;
        case 'smart':
          if (!config.lastExecutedAt) {
            const smartFullResult = await fullSync();
            stats = { recordsCount: smartFullResult.recordsCount };
          } else {
            const smartIncrResult = await incrementalSync();
            stats = { recordsCount: smartIncrResult.recordsCount };
          }
          break;
        default:
          const defaultResult = await incrementalSync();
          stats = { recordsCount: defaultResult.recordsCount };
      }
      
      await prisma.autoSyncConfig.update({
        where: { id: configId },
        data: {
          lastExecutedAt: new Date(),
          lastStatus: 'success',
          nextExecuteAt: this.calculateNextExecuteTime(config.syncTimes[0]),
        },
      });
      
      logger.info(`AutoSync completed successfully for config ${configId}`, stats);
      return { success: true, stats };
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      await prisma.autoSyncConfig.update({
        where: { id: configId },
        data: {
          lastExecutedAt: new Date(),
          lastStatus: 'failed',
        },
      });
      
      logger.error(`AutoSync failed for config ${configId}:`, { error: errorMessage });
      return { success: false, error: errorMessage };
    }
  }
  
  private static calculateNextExecuteTime(timeStr: string): Date {
    const [hours, minutes] = timeStr.split(':').map(Number);
    const now = dayjs();
    let next = now.hour(hours).minute(minutes).second(0).millisecond(0);
    
    if (next.isBefore(now) || next.isSame(now)) {
      next = next.add(1, 'day');
    }
    
    return next.toDate();
  }
  
  private static transformToPlainObject(config: any): AutoSyncConfigData {
    return {
      id: config.id,
      isEnabled: config.isEnabled,
      name: config.name,
      syncTimes: JSON.parse(config.syncTimes),
      timezone: config.timezone,
      defaultDaysBack: config.defaultDaysBack,
      dataTypes: JSON.parse(config.dataTypes),
      workspaceIds: config.workspaceIds ? JSON.parse(config.workspaceIds) : null,
      syncStrategy: config.syncStrategy as AutoSyncConfigData['syncStrategy'],
      retryOnFailure: config.retryOnFailure,
      maxRetries: config.maxRetries,
      notifyOnComplete: config.notifyOnComplete,
      notifyOnError: config.notifyOnError,
      notifyChannels: config.notifyChannels ? JSON.parse(config.notifyChannels) : null,
      lastExecutedAt: config.lastExecutedAt,
      lastStatus: config.lastStatus,
      nextExecuteAt: config.nextExecuteAt,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt,
      createdBy: config.createdBy,
    };
  }
}
