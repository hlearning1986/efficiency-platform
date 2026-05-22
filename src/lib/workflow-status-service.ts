/**
 * TAPD 工作流状态管理服务
 * 
 * 核心功能：
 * 1. 从TAPD API获取项目工作流配置
 * 2. 缓存到本地数据库
 * 3. 提供状态转换功能
 * 4. 支持自动刷新和手动刷新
 */

import { prisma } from '@/lib/prisma';

// ============================================================
// 类型定义
// ============================================================

export interface WorkflowStatusItem {
  id: number;
  workspaceId: string;
  workspaceName: string | null;
  system: 'story' | 'bug';
  statusKey: string;      // 原始值：resolved, status_6...
  statusValue: string;    // 中文显示值：已实现, 待发布...
  sortOrder: number;
  isActive: boolean;
  version: string | null;
  syncedAt: Date;
}

export interface WorkflowSyncLog {
  id: number;
  workspaceId: string;
  action: 'init' | 'refresh' | 'force_refresh';
  status: 'success' | 'failed' | 'skipped';
  recordsCount: number;
  errorMessage: string | null;
  durationMs: number | null;
  createdAt: Date;
}

export interface WorkflowMapResult {
  [key: string]: string;  // { resolved: "已实现", planning: "规划中" }
}

// ============================================================
// 常量配置
// ============================================================

const CACHE_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24小时缓存过期
const MAX_RETRY_COUNT = 3;                   // 最大重试次数
const RETRY_DELAY_MS = 1000;                 // 重试间隔（毫秒）

const VALID_SYSTEMS = ['story', 'bug'] as const;

// ============================================================
// 核心功能：从TAPD API获取工作流状态映射
// ============================================================

/**
 * 调用TAPD官方API获取指定项目的工作流状态映射
 */
async function fetchWorkflowStatusFromAPI(
  workspaceId: string,
  system: 'story' | 'bug' = 'story'
): Promise<WorkflowMapResult> {
  
  // 1. 获取TAPD API凭据
  const config = await prisma.systemSetting.findUnique({
    where: { key: 'tapd_api_config' },
  });

  if (!config?.value) {
    throw new Error('未配置TAPD API凭据');
  }

  let tapdConfig: { apiUser?: string; apiPassword?: string };
  try {
    tapdConfig = JSON.parse(config.value);
  } catch {
    throw new Error('TAPD配置格式错误');
  }

  const { apiUser, apiPassword } = tapdConfig;
  if (!apiUser || !apiPassword) {
    throw new Error('TAPD API凭据不完整');
  }

  // 2. 构造Basic Auth
  const credentials = Buffer.from(`${apiUser.trim()}:${apiPassword.trim()}`).toString('base64');

  // 3. 调用TAPD工作流状态映射API
  const url = `https://api.tapd.cn/workflows/status_map?workspace_id=${workspaceId}&system=${system}`;
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/json',
    },
    signal: AbortSignal.timeout(10000), // 10秒超时
  });

  if (!response.ok) {
    throw new Error(`TAPD API返回错误: HTTP ${response.status}`);
  }

  const data = await response.json();

  if (data.status !== 1) {
    throw new Error(data.info || '获取工作流状态映射失败');
  }

  // 4. 解析返回数据
  // TAPD API返回格式: { "planning": "规划中", "developing": "开发中", ... }
  return data.data || {};
}

// ============================================================
// 数据库操作：保存工作流配置
// ============================================================

/**
 * 将从API获取的工作流配置保存到数据库
 */
async function saveWorkflowStatusToDB(
  workspaceId: string,
  workspaceName: string | null,
  system: 'story' | 'bug',
  workflowMap: WorkflowMapResult,
  version?: string
): Promise<number> {
  let savedCount = 0;

  const entries = Object.entries(workflowMap);
  
  for (let i = 0; i < entries.length; i++) {
    const [statusKey, statusValue] = entries[i];
    
    await prisma.tapdWorkflowStatus.upsert({
      where: {
        workspaceId_system_statusKey: {
          workspaceId,
          system,
          statusKey,
        },
      },
      update: {
        workspaceName,
        statusValue,
        sortOrder: i + 1,
        isActive: true,
        version: version || null,
        syncedAt: new Date(),
        updatedAt: new Date(),
      },
      create: {
        workspaceId,
        workspaceName,
        system,
        statusKey,
        statusValue,
        sortOrder: i + 1,
        isActive: true,
        version: version || null,
      },
    });
    
    savedCount++;
  }

  return savedCount;
}

/**
 * 记录同步日志
 */
async function logSyncOperation(
  workspaceId: string,
  action: 'init' | 'refresh' | 'force_refresh',
  status: 'success' | 'failed' | 'skipped',
  recordsCount: number = 0,
  errorMessage?: string,
  durationMs?: number
): Promise<void> {
  await prisma.tapdWorkflowSyncLog.create({
    data: {
      workspaceId,
      action,
      status,
      recordsCount,
      errorMessage: errorMessage || null,
      durationMs: durationMs || null,
    },
  });
}

// ============================================================
// 公开API：初始化/刷新工作流配置
// ============================================================

/**
 * 初始化或刷新单个项目的工作流配置
 * 
 * @param workspaceId - TAPD项目ID
 * @param options - 配置选项
 * @returns 同步结果
 */
export async function syncWorkspaceWorkflow(
  workspaceId: string,
  options: {
    forceRefresh?: boolean;       // 是否强制刷新（忽略缓存）
    systems?: ('story' | 'bug')[]; // 要同步的系统类型，默认全部
    workspaceName?: string;       // 项目名称（可选）
  } = {}
): Promise<{
  success: boolean;
  message: string;
  storyCount?: number;
  bugCount?: number;
  durationMs?: number;
}> {
  
  const startTime = Date.now();
  let { forceRefresh = false, systems = ['story', 'bug'], workspaceName } = options;
  const action = forceRefresh ? 'force_refresh' : 'init';

  console.log(`🔄 开始同步工作流配置: ${workspaceId} (${action})`);

  // 如果没有提供项目名称，自动从 tapd_workspace 表查询
  if (!workspaceName) {
    try {
      const wsRecord = await prisma.tapdWorkspace.findUnique({
        where: { id: workspaceId },
        select: { name: true },
      });
      
      if (wsRecord?.name) {
        workspaceName = wsRecord.name;
        console.log(`  📝 从数据库获取到项目名称: ${workspaceName}`);
      }
    } catch (error) {
      console.warn(`  ⚠️ 无法查询项目名称: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  try {
    let totalStoryCount = 0;
    let totalBugCount = 0;

    for (const system of systems) {
      // 检查是否需要刷新（非强制模式下）
      if (!forceRefresh) {
        const existingRecord = await prisma.tapdWorkflowStatus.findFirst({
          where: {
            workspaceId,
            system,
            isActive: true,
            syncedAt: {
              gte: new Date(Date.now() - CACHE_EXPIRY_MS),
            },
          },
          orderBy: { syncedAt: 'desc' },
        });

        if (existingRecord) {
          console.log(`  ⏭️ ${system} 工作流未过期，跳过`);
          await logSyncOperation(workspaceId, action, 'skipped', 0);
          continue;
        }
      }

      // 从API获取最新配置
      console.log(`  📡 正在从TAPD API获取 ${system} 工作流...`);
      const workflowMap = await fetchWorkflowStatusFromAPI(workspaceId, system);

      if (Object.keys(workflowMap).length === 0) {
        console.log(`  ⚠️ ${system} 工作流数据为空`);
        await logSyncOperation(
          workspaceId, 
          action, 
          'failed', 
          0, 
          `${system}工作流数据为空`
        );
        continue;
      }

      // 保存到数据库
      const savedCount = await saveWorkflowStatusToDB(
        workspaceId,
        workspaceName || null,
        system,
        workflowMap
      );

      console.log(`  ✅ ${system} 工作流同步成功: ${savedCount} 种状态`);
      
      if (system === 'story') totalStoryCount = savedCount;
      if (system === 'bug') totalBugCount = savedCount;

      // 记录成功日志
      await logSyncOperation(
        workspaceId,
        action,
        'success',
        savedCount
      );
    }

    const durationMs = Date.now() - startTime;
    
    return {
      success: true,
      message: `工作流配置同步成功 (需求:${totalStoryCount}, 缺陷:${totalBugCount})`,
      storyCount: totalStoryCount,
      bugCount: totalBugCount,
      durationMs,
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    const durationMs = Date.now() - startTime;
    
    console.error(`  ❌ 工作流同步失败:`, errorMessage);
    
    await logSyncOperation(
      workspaceId,
      action,
      'failed',
      0,
      errorMessage,
      durationMs
    );
    
    return {
      success: false,
      message: `工作流配置同步失败: ${errorMessage}`,
      durationMs,
    };
  }
}

/**
 * 批量初始化多个项目的工作流配置
 * 
 * @param workspaceIds - 项目ID列表
 * @returns 各项目的同步结果汇总
 */
export async function initMultipleWorkflows(
  workspaceIds: string[],
  options?: {
    forceRefresh?: boolean;
  }
): Promise<{
  total: number;
  success: number;
  failed: number;
  results: Array<{
    workspaceId: string;
    success: boolean;
    message: string;
  }>;
}> {
  
  const results = [];
  let successCount = 0;
  let failedCount = 0;

  console.log(`\n🚀 开始批量初始化 ${workspaceIds.length} 个项目的工作流配置\n`);

  for (let i = 0; i < workspaceIds.length; i++) {
    const wsId = workspaceIds[i];
    console.log(`\n[${i + 1}/${workspaceIds.length}] 处理项目: ${wsId}`);

    // 添加延迟避免触发API限流
    if (i > 0) {
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    const result = await syncWorkspaceWorkflow(wsId, options);
    
    results.push({
      workspaceId: wsId,
      ...result,
    });

    if (result.success) {
      successCount++;
    } else {
      failedCount++;
    }
  }

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`✅ 批量初始化完成:`);
  console.log(`   总计: ${workspaceIds.length} 个项目`);
  console.log(`   成功: ${successCount} 个`);
  console.log(`   失败: ${failedCount} 个`);
  console.log(`${'═'.repeat(60)}\n`);

  return {
    total: workspaceIds.length,
    success: successCount,
    failed: failedCount,
    results,
  };
}

// ============================================================
// 公开API：查询工作流配置
// ============================================================

/**
 * 获取指定项目的工作流状态映射
 * 
 * @param workspaceId - 项目ID
 * @param system - 系统类型
 * @returns 状态映射对象 { key: value }
 */
export async function getWorkflowStatusMap(
  workspaceId: string,
  system: 'story' | 'bug' = 'story'
): Promise<WorkflowMapResult> {
  
  const records = await prisma.tapdWorkflowStatus.findMany({
    where: {
      workspaceId,
      system,
      isActive: true,
    },
    orderBy: { sortOrder: 'asc' },
  });

  const map: WorkflowMapResult = {};
  
  records.forEach(record => {
    map[record.statusKey] = record.statusValue;
  });

  return map;
}

/**
 * 获取所有项目的工作流配置概览
 */
export async function getAllWorkflowsOverview(): Promise<Array<{
  workspaceId: string;
  workspaceName: string | null;
  storyStatusCount: number;
  bugStatusCount: number;
  lastSyncedAt: Date | null;
  isExpired: boolean;
}>> {

  const workspaces = await prisma.tapdWorkflowStatus.groupBy({
    by: ['workspaceId'],
    _count: { id: true },
    _max: { syncedAt: true },
  });

  const overview = [];

  for (const ws of workspaces) {
    const nameRecord = await prisma.tapdWorkflowStatus.findFirst({
      where: { workspaceId: ws.workspaceId },
      select: { workspaceName: true },
    });

    const storyCount = await prisma.tapdWorkflowStatus.count({
      where: {
        workspaceId: ws.workspaceId,
        system: 'story',
        isActive: true,
      },
    });

    const bugCount = await prisma.tapdWorkflowStatus.count({
      where: {
        workspaceId: ws.workspaceId,
        system: 'bug',
        isActive: true,
      },
    });

    const lastSynced = ws._max.syncedAt;
    const isExpired = !lastSynced || 
      (Date.now() - lastSynced.getTime()) > CACHE_EXPIRY_MS;

    overview.push({
      workspaceId: ws.workspaceId,
      workspaceName: nameRecord?.workspaceName,
      storyStatusCount: storyCount,
      bugStatusCount: bugCount,
      lastSyncedAt: lastSynced,
      isExpired,
    });
  }

  return overview;
}

/**
 * 获取指定项目的完整工作流配置详情
 */
export async function getWorkspaceWorkflowDetails(
  workspaceId: string,
  system: 'story' | 'bug' = 'story'
): Promise<WorkflowStatusItem[]> {
  
  return prisma.tapdWorkflowStatus.findMany({
    where: {
      workspaceId,
      system,
    },
    orderBy: [
      { sortOrder: 'asc' },
      { id: 'asc' },
    ],
  });
}

// ============================================================
// 公开API：状态转换
// ============================================================

/**
 * 将TAPD原始状态转换为中文标准状态
 * 
 * @param workspaceId - 项目ID
 * @param rawStatus - TAPD原始状态值
 * @param system - 系统类型
 * @returns 转换后的中文状态，如果未找到则返回原始值
 */
export async function convertStatus(
  workspaceId: string,
  rawStatus: string,
  system: 'story' | 'bug' = 'story'
): Promise<string> {
  
  if (!rawStatus) return rawStatus;

  // 1. 尝试从数据库映射表查找
  const mappedRecord = await prisma.tapdWorkflowStatus.findFirst({
    where: {
      workspaceId,
      system,
      statusKey: rawStatus,
      isActive: true,
    },
  });

  if (mappedRecord) {
    console.log(`🎯 状态转换 [${workspaceId}]: "${rawStatus}" → "${mappedRecord.statusValue}"`);
    return mappedRecord.statusValue;
  }

  // 2. 未找到映射，返回原始值并记录警告
  console.warn(`⚠️ 未找到状态映射 [${workspaceId}/${system}]: "${rawStatus}"`);
  
  return rawStatus;
}

/**
 * 批量转换状态（用于同步时使用）
 * 
 * @param workspaceId - 项目ID
 * @param rawStates - 原始状态值数组
 * @param system - 系统类型
 * @returns 转换后的状态数组
 */
export async function batchConvertStatuses(
  workspaceId: string,
  rawStates: string[],
  system: 'story' | 'bug' = 'story'
): Promise<Map<string, string>> {
  
  // 批量查询该项目的所有映射
  const allMappings = await prisma.tapdWorkflowStatus.findMany({
    where: {
      workspaceId,
      system,
      isActive: true,
    },
  });

  // 构建查找映射表
  const mappingMap = new Map<string, string>();
  allMappings.forEach(m => {
    mappingMap.set(m.statusKey, m.statusValue);
  });

  // 转换结果
  const resultMap = new Map<string, string>();
  
  rawStates.forEach(raw => {
    const converted = mappingMap.get(raw) || raw;
    resultMap.set(raw, converted);
  });

  return resultMap;
}

// ============================================================
// 公开API：编辑/删除操作
// ============================================================

/**
 * 更新单条工作流状态映射
 */
export async function updateWorkflowStatus(
  id: number,
  data: {
    statusValue?: string;
    sortOrder?: number;
    isActive?: boolean;
  }
): Promise<WorkflowStatusItem | null> {
  
  return prisma.tapdWorkflowStatus.update({
    where: { id },
    data: {
      ...data,
      updatedAt: new Date(),
    },
  });
}

/**
 * 删除单条工作流状态映射
 */
export async function deleteWorkflowStatus(id: number): Promise<boolean> {
  
  try {
    await prisma.tapdWorkflowStatus.delete({
      where: { id },
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * 清除指定项目的所有工作流缓存
 */
export async function clearWorkspaceWorkflow(
  workspaceId: string,
  system?: 'story' | 'bug'
): Promise<number> {
  
  const where: any = { workspaceId };
  if (system) {
    where.system = system;
  }

  const result = await prisma.tapdWorkflowStatus.deleteMany({ where });
  return result.count;
}

// ============================================================
// 辅助功能
// ============================================================

/**
 * 获取同步日志
 */
export async function getSyncLogs(
  workspaceId?: string,
  limit: number = 50
): Promise<WorkflowSyncLog[]> {
  
  const where = workspaceId ? { workspaceId } : {};
  
  return prisma.tapdWorkflowSyncLog.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}

/**
 * 检查项目是否需要刷新
 */
export async function isWorkspaceWorkflowExpired(
  workspaceId: string,
  system: 'story' | 'bug' = 'story'
): Promise<boolean> {
  
  const latestRecord = await prisma.tapdWorkflowStatus.findFirst({
    where: {
      workspaceId,
      system,
      isActive: true,
    },
    orderBy: { syncedAt: 'desc' },
  });

  if (!latestRecord) return true; // 无记录，需要初始化

  const age = Date.now() - latestRecord.syncedAt.getTime();
  return age > CACHE_EXPIRY_MS;
}

/**
 * 导出工作流配置为JSON
 */
export async function exportWorkflowConfig(
  workspaceId?: string
): Promise<any> {
  
  const where = workspaceId ? { workspaceId } : {};
  
  const records = await prisma.tapdWorkflowStatus.findMany({
    where,
    orderBy: [
      { workspaceId: 'asc' },
      { system: 'asc' },
      { sortOrder: 'asc' },
    ],
  });

  // 按项目和系统分组
  const config: any = {};
  
  records.forEach(record => {
    if (!config[record.workspaceId]) {
      config[record.workspaceId] = {
        workspaceName: record.workspaceName,
        story: {},
        bug: {},
      };
    }
    
    config[record.workspaceId][record.system][record.statusKey] = {
      value: record.statusValue,
      order: record.sortOrder,
      active: record.isActive,
    };
  });

  return {
    exportedAt: new Date().toISOString(),
    version: '1.0',
    workspaces: config,
  };
}
