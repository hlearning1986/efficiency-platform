/**
 * TAPD 数据同步服务
 * 将 TAPD API 数据拉取并落库到 PostgreSQL
 */

import { prisma } from '@/lib/prisma';
import { batchConvertStatuses, syncWorkspaceWorkflow } from '@/lib/workflow-status-service';

// ============================================================
// 类型定义
// ============================================================

interface SyncOptions {
  apiUser: string;
  apiPassword: string;
  workspaceIds: string[];
  createdBegin?: string;
  createdEnd?: string;
  onProgress?: (msg: string, percent: number) => void;
}

interface SyncResult {
  success: boolean;
  storyCount: number;
  taskCount: number;
  iterationCount: number;
  error?: string;
}

// ============================================================
// TAPD API 请求封装
// ============================================================

function createHeaders(apiUser: string, apiPassword: string) {
  const cleanUser = apiUser.trim();
  const cleanPass = apiPassword.trim();
  const credentials = Buffer.from(`${cleanUser}:${cleanPass}`).toString('base64');
  return { Authorization: `Basic ${credentials}` };
}

async function tapdGet(
  url: string,
  headers: Record<string, string>,
  retries = 3,
): Promise<Record<string, unknown>> {
  for (let i = 0; i < retries; i++) {
    const res = await fetch(url, { method: 'GET', headers });

    if (res.status === 429) {
      const backoff = 1000 * Math.pow(2, i);
      await new Promise((r) => setTimeout(r, backoff));
      continue;
    }

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`TAPD API ${res.status}: ${text || res.statusText}`);
    }

    return res.json();
  }
  throw new Error('TAPD API 请求超过最大重试次数');
}

/** 展平 TAPD 返回的嵌套对象 */
function flattenTapdItem(item: Record<string, unknown>): Record<string, unknown> {
  const keys = Object.keys(item);
  if (keys.length === 1 && keys[0] !== 'id') {
    return item[keys[0]] as Record<string, unknown>;
  }
  return item;
}

/** 请求间延迟，避免触发 TAPD 速率限制 */
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ============================================================
// 数据拉取
// ============================================================

const STORY_FIELDS = [
  'id', 'name', 'description', 'status', 'priority', 'priority_label',
  'business_value', 'owner', 'cc', 'creator', 'developer',
  'created', 'modified', 'completed',
  'begin', 'due',
  'effort', 'effort_completed', 'remain', 'exceed',
  'size', 'type', 'source', 'module', 'feature', 'version',
  'workspace_id', 'iteration_id', 'category_id', 'release_id',
  'workitem_type_id', 'parent_id', 'children_id', 'ancestor_id',
  'label', 'test_focus', 'is_archived', 'level',
  'custom_field_one', 'custom_field_two', 'custom_field_three',
  'custom_field_four', 'custom_field_five',
  'custom_field_six', 'custom_field_seven', 'custom_field_eight',
  'custom_field_9', 'custom_field_10', 'custom_field_11',
  'custom_field_12', 'custom_field_13', 'custom_field_14',
  'custom_field_15', 'custom_field_16', 'custom_field_17',
  'custom_field_18', 'custom_field_19', 'custom_field_20',
  'custom_field_21', 'custom_field_22', 'custom_field_23',
  'custom_field_24', 'custom_field_25', 'custom_field_26',
  'custom_field_27', 'custom_field_28', 'custom_field_29', 'custom_field_30',
].join(',');

const TASK_FIELDS = [
  'id', 'name', 'description', 'status', 'priority', 'priority_label',
  'owner', 'cc', 'creator',
  'created', 'modified', 'completed',
  'begin', 'due',
  'effort', 'effort_completed', 'remain', 'exceed',
  'progress', 'type',
  'story_id', 'iteration_id', 'release_id',
  'workspace_id',
  'label', 'has_attachment',
  'custom_field_one', 'custom_field_two', 'custom_field_three',
  'custom_field_four', 'custom_field_five',
  'custom_field_six', 'custom_field_seven', 'custom_field_eight',
  'custom_field_9', 'custom_field_10', 'custom_field_11',
  'custom_field_12', 'custom_field_13', 'custom_field_14',
  'custom_field_15', 'custom_field_16', 'custom_field_17',
  'custom_field_18', 'custom_field_19', 'custom_field_20',
].join(',');

/**
 * 拉取单个项目的所有 Stories（分页）
 */
async function fetchStories(
  wsId: string,
  headers: Record<string, string>,
  options?: { createdBegin?: string; createdEnd?: string },
): Promise<Record<string, unknown>[]> {
  const allItems: Record<string, unknown>[] = [];
  let page = 1;
  const limit = 200;

  while (true) {
    const params = new URLSearchParams({
      workspace_id: wsId,
      limit: String(limit),
      page: String(page),
      fields: STORY_FIELDS,
    });

    if (options?.createdBegin && options?.createdEnd) {
      params.set('created', `${options.createdBegin}~${options.createdEnd}`);
    }

    const data = await tapdGet(
      `https://api.tapd.cn/stories?${params.toString()}`,
      headers,
    );
    const items = (Array.isArray(data.data) ? data.data : []) as Record<string, unknown>[];
    if (items.length === 0) break;

    allItems.push(...items.map(flattenTapdItem));
    page++;
    if (items.length < limit) break;

    // 🛡️ 添加请求间隔，避免触发限流
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  return allItems;
}

/**
 * 拉取单个项目的所有 Tasks（分页）
 */
async function fetchTasks(
  wsId: string,
  headers: Record<string, string>,
): Promise<Record<string, unknown>[]> {
  const allItems: Record<string, unknown>[] = [];
  let page = 1;
  const limit = 200;

  while (true) {
    const params = new URLSearchParams({
      workspace_id: wsId,
      limit: String(limit),
      page: String(page),
      fields: TASK_FIELDS,
    });

    const data = await tapdGet(
      `https://api.tapd.cn/tasks?${params.toString()}`,
      headers,
    );
    const items = (Array.isArray(data.data) ? data.data : []) as Record<string, unknown>[];
    if (items.length === 0) break;

    allItems.push(...items.map(flattenTapdItem));
    page++;
    if (items.length < limit) break;

    // 🛡️ 添加请求间隔，避免触发限流
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  return allItems;
}

/**
 * 拉取单个项目的迭代列表
 */
async function fetchIterations(
  wsId: string,
  headers: Record<string, string>,
): Promise<Record<string, unknown>[]> {
  const allItems: Record<string, unknown>[] = [];
  let page = 1;

  while (true) {
    const data = await tapdGet(
      `https://api.tapd.cn/iterations?workspace_id=${wsId}&limit=200&page=${page}`,
      headers,
    );
    const items = (Array.isArray(data.data) ? data.data : []) as Record<string, unknown>[];
    if (items.length === 0) break;

    allItems.push(...items.map(flattenTapdItem));
    page++;
    if (items.length < 200) break;

    // 🛡️ 添加请求间隔，避免触发限流
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  return allItems;
}

/**
 * 获取项目名称
 */
async function fetchWorkspaceName(
  wsId: string,
  headers: Record<string, string>,
): Promise<string> {
  try {
    const wsData = await tapdGet(
      `https://api.tapd.cn/workspaces/get_workspace_info?workspace_id=${wsId}`,
      headers,
    );
    const wsInfo = wsData.data as Record<string, unknown> | undefined;
    if (wsInfo) {
      const wsObj = flattenTapdItem(wsInfo);
      return String(wsObj['name'] ?? wsId);
    }
  } catch {
    // 忽略
  }
  return wsId;
}

// ============================================================
// 数据落库
// ============================================================

function parseDate(val: unknown): Date | null {
  if (val === null || val === undefined || val === '') return null;

  const str = String(val).trim();

  // 处理常见的无效值
  if (str === '0000-00-00' ||
      str === '0000-00-00 00:00:00' ||
      str === '1970-01-01 00:00:00' && !str.includes('1970')) {
    return null;
  }

  const d = new Date(str);

  // 双重验证：确保是有效日期且在合理范围内（1900-2100年）
  if (isNaN(d.getTime()) ||
      d.getFullYear() < 1900 ||
      d.getFullYear() > 2100) {
    return null;
  }

  return d;
}

function parseFloat2(val: unknown): number | null {
  if (val === null || val === undefined || val === '') return null;
  const n = parseFloat(String(val));
  return isNaN(n) ? null : n;
}

/**
 * 转换TAPD原始状态为中文标准状态
 * 使用工作流配置表进行映射，如果未找到映射则保留原始值
 */
async function convertStoryStatus(
  workspaceId: string,
  rawStatus: string,
  workflowMappings?: Map<string, Map<string, string>>
): Promise<string> {
  if (!rawStatus) return rawStatus;

  try {
    // 1. 优先从预加载的工作流配置获取映射
    if (workflowMappings?.has(workspaceId)) {
      const projectMapping = workflowMappings.get(workspaceId);
      const mappedValue = projectMapping?.get(rawStatus);
      
      if (mappedValue && mappedValue !== rawStatus) {
        console.log(`🔄 [${workspaceId}] 状态转换: "${rawStatus}" → "${mappedValue}"`);
        return mappedValue;
      }
    }

    // 2. 如果预加载的映射中没有，尝试直接查询数据库
    const mapping = await batchConvertStatuses(workspaceId, [rawStatus], 'story');
    const converted = mapping.get(rawStatus);
    
    if (converted && converted !== rawStatus) {
      console.log(`🔄 [${workspaceId}] 数据库查询状态转换: "${rawStatus}" → "${converted}"`);
      return converted;
    }

    // 3. 使用通用状态映射作为最终回退
    const genericMapping: Record<string, string> = {
      'new': '新建',
      'status_1': '新建',
      'planning': '规划中',
      'status_2': '规划中',
      'planned': '计划中',
      'developing': '开发中',
      'status_3': '开发中',
      'testing': '测试中',
      'status_4': '测试中',
      'resolved': '已发布',
      'released': '已发布',
      'status_5': '待发布',
      'status_6': '待发布',
      'status_7': '已完成',
      'status_8': '已完成',
      'rejected': '已拒绝',
      'closed': '已关闭',
      'done': '已完成',
    };

    const fallbackConverted = genericMapping[rawStatus];
    if (fallbackConverted) {
      console.log(`⚠️ [${workspaceId}] 使用通用映射: "${rawStatus}" → "${fallbackConverted}"`);
      return fallbackConverted;
    }

    // 4. 都没有找到，记录警告并返回原始值
    console.warn(`⚠️ [${workspaceId}] 无法转换状态: "${rawStatus}", 使用原始值`);
    return rawStatus;
  } catch (error) {
    console.warn(`⚠️ 状态转换失败 [${workspaceId}]: ${rawStatus}, 使用原始值`, error);
    return rawStatus;
  }
}

/**
 * 批量预加载工作流映射（优化性能）
 * 在同步开始前调用，避免逐条查询
 */
async function preloadWorkflowMappings(
  workspaceIds: string[]
): Promise<Map<string, Map<string, string>>> {
  
  const allMappings = new Map<string, Map<string, string>>();

  for (const wsId of workspaceIds) {
    try {
      const mapping = await batchConvertStatuses(wsId, [], 'story');
      allMappings.set(wsId, mapping);
    } catch {
      console.warn(`⚠️ 无法加载项目 ${wsId} 的工作流映射`);
      allMappings.set(wsId, new Map());
    }
  }

  return allMappings;
}

/**
 * 批量保存 Stories 到数据库（upsert）
 */
async function saveStories(
  stories: Record<string, unknown>[],
  workspaceNameMap: Map<string, string>,
  iterationNameMap: Map<string, string>,
  workflowMappings?: Map<string, Map<string, string>>,
) {
  const batchSize = 500;
  for (let i = 0; i < stories.length; i += batchSize) {
    const batch = stories.slice(i, i + batchSize);
    await prisma.$transaction(
      batch.map((s) => {
        const wsId = String(s['workspace_id'] ?? '');
        const iterId = String(s['iteration_id'] ?? '');
        
        // 状态转换：使用工作流配置映射（增强版：支持多级回退）
        const rawStatus = String(s['status'] ?? '');
        const convertedStatus = await convertStoryStatus(wsId, rawStatus, workflowMappings);
        
        return prisma.tapdStory.upsert({
          where: { id: String(s['id']) },
          update: {
            name: String(s['name'] ?? ''),
            description: s['description'] ? String(s['description']) : null,
            status: convertedStatus,
            priority: s['priority'] ? String(s['priority']) : null,
            owner: s['owner'] ? String(s['owner']) : null,
            cc: s['cc'] ? String(s['cc']) : null,
            creator: s['creator'] ? String(s['creator']) : null,
            created: parseDate(s['created']) ?? new Date(),
            modified: parseDate(s['modified']),
            completed: parseDate(s['completed']),
            begin: parseDate(s['begin']),
            due: parseDate(s['due']),
            effort: parseFloat2(s['effort']),
            effortCompleted: parseFloat2(s['effort_completed']),
            workspaceId: wsId,
            workspaceName: workspaceNameMap.get(wsId) ?? null,
            iterationId: iterId || null,
            iterationName: iterId ? (iterationNameMap.get(`${wsId}:${iterId}`) ?? null) : null,
            customFieldOne: s['custom_field_one'] ? String(s['custom_field_one']) : null,
            customFieldTwo: s['custom_field_two'] ? String(s['custom_field_two']) : null,
            customFieldThree: s['custom_field_three'] ? String(s['custom_field_three']) : null,
            customFieldFour: s['custom_field_four'] ? String(s['custom_field_four']) : null,
            customFieldFive: s['custom_field_five'] ? String(s['custom_field_five']) : null,
            customFieldSix: s['custom_field_six'] ? String(s['custom_field_six']) : null,
            customFieldSeven: s['custom_field_seven'] ? String(s['custom_field_seven']) : null,
            customFieldEight: s['custom_field_eight'] ? String(s['custom_field_eight']) : null,
            customField9: s['custom_field_9'] ? String(s['custom_field_9']) : null,
            customField10: s['custom_field_10'] ? String(s['custom_field_10']) : null,
            customField11: s['custom_field_11'] ? String(s['custom_field_11']) : null,
            customField12: s['custom_field_12'] ? String(s['custom_field_12']) : null,
            customField13: s['custom_field_13'] ? String(s['custom_field_13']) : null,
            customField14: s['custom_field_14'] ? String(s['custom_field_14']) : null,
            customField15: s['custom_field_15'] ? String(s['custom_field_15']) : null,
            syncedAt: new Date(),
          },
          create: {
            id: String(s['id']),
            name: String(s['name'] ?? ''),
            description: s['description'] ? String(s['description']) : null,
            status: convertedStatus,
            priority: s['priority'] ? String(s['priority']) : null,
            owner: s['owner'] ? String(s['owner']) : null,
            cc: s['cc'] ? String(s['cc']) : null,
            creator: s['creator'] ? String(s['creator']) : null,
            created: parseDate(s['created']) ?? new Date(),
            modified: parseDate(s['modified']),
            completed: parseDate(s['completed']),
            begin: parseDate(s['begin']),
            due: parseDate(s['due']),
            effort: parseFloat2(s['effort']),
            effortCompleted: parseFloat2(s['effort_completed']),
            workspaceId: wsId,
            workspaceName: workspaceNameMap.get(wsId) ?? null,
            iterationId: iterId || null,
            iterationName: iterId ? (iterationNameMap.get(`${wsId}:${iterId}`) ?? null) : null,
            customFieldOne: s['custom_field_one'] ? String(s['custom_field_one']) : null,
            customFieldTwo: s['custom_field_two'] ? String(s['custom_field_two']) : null,
            customFieldThree: s['custom_field_three'] ? String(s['custom_field_three']) : null,
            customFieldFour: s['custom_field_four'] ? String(s['custom_field_four']) : null,
            customFieldFive: s['custom_field_five'] ? String(s['custom_field_five']) : null,
            customFieldSix: s['custom_field_six'] ? String(s['custom_field_six']) : null,
            customFieldSeven: s['custom_field_seven'] ? String(s['custom_field_seven']) : null,
            customFieldEight: s['custom_field_eight'] ? String(s['custom_field_eight']) : null,
            customField9: s['custom_field_9'] ? String(s['custom_field_9']) : null,
            customField10: s['custom_field_10'] ? String(s['custom_field_10']) : null,
            customField11: s['custom_field_11'] ? String(s['custom_field_11']) : null,
            customField12: s['custom_field_12'] ? String(s['custom_field_12']) : null,
            customField13: s['custom_field_13'] ? String(s['custom_field_13']) : null,
            customField14: s['custom_field_14'] ? String(s['custom_field_14']) : null,
            customField15: s['custom_field_15'] ? String(s['custom_field_15']) : null,
          },
        });
      }),
      { timeout: 60000 },
    );
  }
}

/**
 * 批量保存 Tasks 到数据库（upsert）
 * 🛡️ 增强版：单条错误不影响整体
 */
async function saveTasks(tasks: Record<string, unknown>[], workspaceNameMap: Map<string, string>) {
  console.log('🚀 [NEW CODE] saveTasks函数已加载 - 新版本代码正在运行');
  console.log(`📦 [NEW CODE] 待处理任务数: ${tasks.length}`);

  // 🛡️ 第一层防护：在源头清理所有无效日期值（双重保险）
  const INVALID_DATE_VALUES = ['0000-00-00', '0000-00-00 00:00:00', '', null, undefined];
  const DATE_FIELDS = ['completed', 'created', 'modified', 'begin', 'due'];

  let cleanedCount = 0;
  const cleanedTasks = tasks.map(task => {
    const cleaned = { ...task };
    DATE_FIELDS.forEach(field => {
      const val = task[field];
      if (val === null || val === undefined || val === '' ||
          String(val).trim() === '0000-00-00' ||
          String(val).trim() === '0000-00-00 00:00:00') {
        delete cleaned[field];  // 删除无效字段，让Prisma使用默认值null
        cleanedCount++;
      }
    });
    return cleaned;
  });

  if (cleanedCount > 0) {
    console.log(`🧹 [NEW CODE] 已清理 ${cleanedCount} 个无效日期字段`);
  }

  const batchSize = 100;  // 减小批次大小，提高稳定性
  let successCount = 0;
  let errorCount = 0;
  let lastError: string | null = null;

  for (let i = 0; i < cleanedTasks.length; i += batchSize) {
    const batch = cleanedTasks.slice(i, i + batchSize);

    // 逐条处理，避免单条错误导致整个批次失败
    for (const t of batch) {
      try {
        const wsId = String(t['workspace_id'] ?? '');
        const taskId = String(t['id']);

        await prisma.tapdTask.upsert({
          where: { id: taskId },
          update: {
            name: String(t['name'] ?? ''),
            description: t['description'] ? String(t['description']) : null,
            status: String(t['status'] ?? ''),
            priority: t['priority'] ? String(t['priority']) : null,
            owner: t['owner'] ? String(t['owner']) : null,
            creator: t['creator'] ? String(t['creator']) : null,
            created: parseDate(t['created']) ?? new Date(),
            modified: parseDate(t['modified']),
            completed: parseDate(t['completed']),
            effort: parseFloat2(t['effort']),
            effortCompleted: parseFloat2(t['effort_completed']),
            storyId: t['story_id'] ? String(t['story_id']) : null,
            workspaceId: wsId,
            workspaceName: workspaceNameMap.get(wsId) ?? null,
            iterationId: t['iteration_id'] ? String(t['iteration_id']) : null,
            customFieldOne: t['custom_field_one'] ? String(t['custom_field_one']) : null,
            customFieldTwo: t['custom_field_two'] ? String(t['custom_field_two']) : null,
            customFieldThree: t['custom_field_three'] ? String(t['custom_field_three']) : null,
            customFieldFour: t['custom_field_four'] ? String(t['custom_field_four']) : null,
            customFieldFive: t['custom_field_five'] ? String(t['custom_field_five']) : null,
            customFieldSix: t['custom_field_six'] ? String(t['custom_field_six']) : null,
            customFieldSeven: t['custom_field_seven'] ? String(t['custom_field_seven']) : null,
            customFieldEight: t['custom_field_eight'] ? String(t['custom_field_eight']) : null,
            customField9: t['custom_field_9'] ? String(t['custom_field_9']) : null,
            customField10: t['custom_field_10'] ? String(t['custom_field_10']) : null,
            customField11: t['custom_field_11'] ? String(t['custom_field_11']) : null,
            customField12: t['custom_field_12'] ? String(t['custom_field_12']) : null,
            customField13: t['custom_field_13'] ? String(t['custom_field_13']) : null,
            syncedAt: new Date(),
          },
          create: {
            id: taskId,
            name: String(t['name'] ?? ''),
            description: t['description'] ? String(t['description']) : null,
            status: String(t['status'] ?? ''),
            priority: t['priority'] ? String(t['priority']) : null,
            owner: t['owner'] ? String(t['owner']) : null,
            creator: t['creator'] ? String(t['creator']) : null,
            created: parseDate(t['created']) ?? new Date(),
            modified: parseDate(t['modified']),
            completed: parseDate(t['completed']),
            effort: parseFloat2(t['effort']),
            effortCompleted: parseFloat2(t['effort_completed']),
            storyId: t['story_id'] ? String(t['story_id']) : null,
            workspaceId: wsId,
            workspaceName: workspaceNameMap.get(wsId) ?? null,
            iterationId: t['iteration_id'] ? String(t['iteration_id']) : null,
            priority: t['priority'] ? String(t['priority']) : null,
            owner: t['owner'] ? String(t['owner']) : null,
            creator: t['creator'] ? String(t['creator']) : null,
            created: parseDate(t['created']) ?? new Date(),
            modified: parseDate(t['modified']),
            completed: parseDate(t['completed']),
            effort: parseFloat2(t['effort']),
            effortCompleted: parseFloat2(t['effort_completed']),
            storyId: t['story_id'] ? String(t['story_id']) : null,
            workspaceId: wsId,
            workspaceName: workspaceNameMap.get(wsId) ?? null,
            iterationId: t['iteration_id'] ? String(t['iteration_id']) : null,
            customFieldOne: t['custom_field_one'] ? String(t['custom_field_one']) : null,
            customFieldTwo: t['custom_field_two'] ? String(t['custom_field_two']) : null,
            customFieldThree: t['custom_field_three'] ? String(t['custom_field_three']) : null,
            customFieldFour: t['custom_field_four'] ? String(t['custom_field_four']) : null,
            customFieldFive: t['custom_field_five'] ? String(t['custom_field_five']) : null,
            customFieldSix: t['custom_field_six'] ? String(t['custom_field_six']) : null,
            customFieldSeven: t['custom_field_seven'] ? String(t['custom_field_seven']) : null,
            customFieldEight: t['custom_field_eight'] ? String(t['custom_field_eight']) : null,
            customField9: t['custom_field_9'] ? String(t['custom_field_9']) : null,
            customField10: t['custom_field_10'] ? String(t['custom_field_10']) : null,
            customField11: t['custom_field_11'] ? String(t['custom_field_11']) : null,
            customField12: t['custom_field_12'] ? String(t['custom_field_12']) : null,
            customField13: t['custom_field_13'] ? String(t['custom_field_13']) : null,
          },
        });

        successCount++;
      } catch (error) {
        errorCount++;
        lastError = error instanceof Error ? error.message : '未知错误';

        // 只记录前5个错误详情，避免日志过多
        if (errorCount <= 5) {
          console.warn(`⚠️ 任务 ${t['id']} (${t['name']}) 保存失败:`, lastError);
        }
      }
    }

    // 每个批次之间添加小延迟，避免数据库压力过大
    if (i + batchSize < tasks.length) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }

  // 输出统计信息
  console.log(`📊 任务保存完成: 成功 ${successCount} 条, 失败 ${errorCount} 条`);
  if (errorCount > 0 && lastError) {
    console.warn(`⚠️ 最后一个错误: ${lastError}`);
  }
}

/**
 * 保存迭代数据到数据库
 */
async function saveIterations(
  iterations: Record<string, unknown>[],
  wsId: string,
) {
  for (const iter of iterations) {
    await prisma.tapdIteration.upsert({
      where: { id: String(iter['id']) },
      update: {
        name: String(iter['name'] ?? ''),
        workspaceId: wsId,
        startDate: parseDate(iter['startdate']),
        endDate: parseDate(iter['enddate']),
        status: iter['status'] ? String(iter['status']) : null,
        syncedAt: new Date(),
      },
      create: {
        id: String(iter['id']),
        name: String(iter['name'] ?? ''),
        workspaceId: wsId,
        startDate: parseDate(iter['startdate']),
        endDate: parseDate(iter['enddate']),
        status: iter['status'] ? String(iter['status']) : null,
      },
    });
  }
}

// ============================================================
// 同步主流程
// ============================================================

/**
 * 全量同步：拉取所有项目数据并落库
 */
export async function fullSync(options: SyncOptions): Promise<SyncResult> {
  const { apiUser, apiPassword, workspaceIds, createdBegin, createdEnd, onProgress } = options;
  const headers = createHeaders(apiUser, apiPassword);

  // 1. 创建同步记录
  const record = await prisma.tapdSyncRecord.create({
    data: {
      syncType: 'full',
      workspaceIds,
      status: 'running',
    },
  });

  let totalStories = 0;
  let totalTasks = 0;
  let totalIterations = 0;

  try {
    // 2. 获取项目名称
    onProgress?.('正在获取项目信息...', 5);
    const workspaceNameMap = new Map<string, string>();
    for (const wsId of workspaceIds) {
      const name = await fetchWorkspaceName(wsId, headers);
      workspaceNameMap.set(wsId, name);
      // 保存 workspace 信息
      await prisma.tapdWorkspace.upsert({
        where: { id: wsId },
        update: { name, syncedAt: new Date() },
        create: { id: wsId, name },
      });
      await delay(300);
    }

    // 2.5 同步工作流状态配置（从 TAPD API 获取最新配置）
    onProgress?.('正在同步工作流配置...', 8);
    
    console.log('🔄 开始同步工作流状态配置...');
    for (const wsId of workspaceIds) {
      try {
        const wsName = workspaceNameMap.get(wsId) || wsId;
        onProgress?.(`[${wsName}] 正在同步工作流配置...`, 8);
        
        const workflowResult = await syncWorkspaceWorkflow(wsId, {
          forceRefresh: true, // 强制刷新，确保获取最新配置
          systems: ['story', 'bug'],
          workspaceName: wsName,
        });
        
        if (workflowResult.success) {
          console.log(`✅ [${wsName}] 工作流配置同步成功 (Story: ${workflowResult.storyCount || 0}, Bug: ${workflowResult.bugCount || 0})`);
        } else {
          console.warn(`⚠️ [${wsName}] 工作流配置同步失败: ${workflowResult.message}`);
        }
      } catch (error) {
        console.error(`❌ [${wsId}] 工作流配置同步异常:`, error);
      }
      
      await delay(200); // 避免请求过快
    }

    // 2.6 预加载工作流状态映射（用于状态转换）
    onProgress?.('正在加载工作流映射...', 10);
    let workflowMappings: Map<string, Map<string, string>>;
    
    try {
      workflowMappings = await preloadWorkflowMappings(workspaceIds);
      console.log(`✅ 已加载 ${workflowMappings.size} 个项目的工作流配置`);
    } catch (error) {
      console.warn('⚠️ 工作流配置加载失败，将使用原始状态值');
      workflowMappings = new Map();
    }

    // 3. 逐项目拉取并保存数据
    for (let i = 0; i < workspaceIds.length; i++) {
      const wsId = workspaceIds[i];
      const wsName = workspaceNameMap.get(wsId) ?? wsId;
      const basePercent = 10 + Math.round((i / workspaceIds.length) * 70);

      // 3.1 拉取迭代
      onProgress?.(`[${wsName}] 正在拉取迭代...`, basePercent);
      const iterations = await fetchIterations(wsId, headers);
      await saveIterations(iterations, wsId);
      totalIterations += iterations.length;

      // 构建迭代名称映射
      const iterNameMap = new Map<string, string>();
      for (const iter of iterations) {
        iterNameMap.set(`${wsId}:${iter['id']}`, String(iter['name'] ?? ''));
      }

      await delay(500);

      // 3.2 拉取 Stories
      onProgress?.(`[${wsName}] 正在拉取需求...`, basePercent + 10);
      const stories = await fetchStories(wsId, headers, { createdBegin, createdEnd });
      await saveStories(stories, workspaceNameMap, iterNameMap, workflowMappings);
      totalStories += stories.length;

      await delay(500);

      // 3.3 拉取 Tasks
      onProgress?.(`[${wsName}] 正在拉取任务...`, basePercent + 25);
      const tasks = await fetchTasks(wsId, headers);
      await saveTasks(tasks, workspaceNameMap);
      totalTasks += tasks.length;

      await delay(500);
    }

    // 4. 更新同步记录为成功
    await prisma.tapdSyncRecord.update({
      where: { id: record.id },
      data: {
        status: 'success',
        storyCount: totalStories,
        taskCount: totalTasks,
        finishedAt: new Date(),
      },
    });

    onProgress?.('同步完成!', 100);

    return {
      success: true,
      storyCount: totalStories,
      taskCount: totalTasks,
      iterationCount: totalIterations,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : '同步失败';

    await prisma.tapdSyncRecord.update({
      where: { id: record.id },
      data: {
        status: 'failed',
        storyCount: totalStories,
        taskCount: totalTasks,
        errorMsg,
        finishedAt: new Date(),
      },
    });

    return {
      success: false,
      storyCount: totalStories,
      taskCount: totalTasks,
      iterationCount: totalIterations,
      error: errorMsg,
    };
  }
}

/**
 * 查询最近一次同步记录
 */
export async function getLatestSyncRecord() {
  return prisma.tapdSyncRecord.findFirst({
    orderBy: { startedAt: 'desc' },
  });
}

/**
 * 查询同步历史
 */
export async function getSyncHistory(limit = 20) {
  return prisma.tapdSyncRecord.findMany({
    orderBy: { startedAt: 'desc' },
    take: limit,
  });
}
