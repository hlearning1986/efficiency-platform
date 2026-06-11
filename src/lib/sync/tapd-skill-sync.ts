// @ts-nocheck
/* eslint-disable */
/**
 * TAPD 数据同步服务 - 使用 TAPD OpenAPI Skill
 * 
 * 字段优化：使用 fields 参数请求完整字段（包括自定义字段）
 */

import { prisma } from '@/lib/prisma';

interface SyncOptions {
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

// 完整的字段列表 - 基于官方 API 文档
// ⚠️ 注意：stories API 不返回 workspace_name 和 iteration_name，需要单独获取

const STORY_FIELDS = [
  // 系统字段
  'id', 'name', 'description', 'status', 'priority', 'priority_label',
  'owner', 'cc', 'creator', 'developer', 'created', 'modified', 'completed',
  'begin', 'due', 'effort', 'effort_completed', 'remain', 'exceed',
  'workspace_id', 'iteration_id',
  'version', 'module', 'feature', 'test_focus', 'size', 'business_value',
  'category_id', 'release_id', 'source', 'type', 'label', 'workitem_type_id',
  'parent_id', 'children_id', 'ancestor_id', 'is_archived', 'confidential',
  'level', 'bug_id', 'templated_id', 'created_from',
  // 自定义字段 (one ~ eight)
  'custom_field_one', 'custom_field_two', 'custom_field_three', 'custom_field_four',
  'custom_field_five', 'custom_field_six', 'custom_field_seven', 'custom_field_eight',
  // 自定义字段 (9 ~ 100)
  'custom_field_9', 'custom_field_10', 'custom_field_11', 'custom_field_12',
  'custom_field_13', 'custom_field_14', 'custom_field_15', 'custom_field_16',
  'custom_field_17', 'custom_field_18', 'custom_field_19', 'custom_field_20',
  'custom_field_21', 'custom_field_22', 'custom_field_23', 'custom_field_24',
  'custom_field_25', 'custom_field_26', 'custom_field_27', 'custom_field_28',
  'custom_field_29', 'custom_field_30', 'custom_field_31', 'custom_field_32',
  'custom_field_33', 'custom_field_34', 'custom_field_35', 'custom_field_36',
  'custom_field_37', 'custom_field_38', 'custom_field_39', 'custom_field_40',
  'custom_field_41', 'custom_field_42', 'custom_field_43', 'custom_field_44',
  'custom_field_45', 'custom_field_46', 'custom_field_47', 'custom_field_48',
  'custom_field_49', 'custom_field_50', 'custom_field_51', 'custom_field_52',
  'custom_field_53', 'custom_field_54', 'custom_field_55', 'custom_field_56',
  'custom_field_57', 'custom_field_58', 'custom_field_59', 'custom_field_60',
  'custom_field_61', 'custom_field_62', 'custom_field_63', 'custom_field_64',
  'custom_field_65', 'custom_field_66', 'custom_field_67', 'custom_field_68',
  'custom_field_69', 'custom_field_70', 'custom_field_71', 'custom_field_72',
  'custom_field_73', 'custom_field_74', 'custom_field_75', 'custom_field_76',
  'custom_field_77', 'custom_field_78', 'custom_field_79', 'custom_field_80',
  'custom_field_81', 'custom_field_82', 'custom_field_83', 'custom_field_84',
  'custom_field_85', 'custom_field_86', 'custom_field_87', 'custom_field_88',
  'custom_field_89', 'custom_field_90', 'custom_field_91', 'custom_field_92',
  'custom_field_93', 'custom_field_94', 'custom_field_95', 'custom_field_96',
  'custom_field_97', 'custom_field_98', 'custom_field_99', 'custom_field_100',
];

const TASK_FIELDS = [
  'id', 'name', 'description', 'status', 'priority', 'priority_label',
  'owner', 'cc', 'creator', 'created', 'modified', 'completed',
  'begin', 'due', 'effort', 'effort_completed', 'remain', 'exceed', 'progress',
  'story_id', 'workspace_id', 'iteration_id', 'release_id', 'label', 'has_attachment',
  'custom_field_one', 'custom_field_two', 'custom_field_three', 'custom_field_four',
  'custom_field_five', 'custom_field_six', 'custom_field_seven', 'custom_field_eight',
  'custom_field_9', 'custom_field_10', 'custom_field_11', 'custom_field_12',
  'custom_field_13', 'custom_field_14', 'custom_field_15', 'custom_field_16',
  'custom_field_17', 'custom_field_18', 'custom_field_19', 'custom_field_20',
  'custom_field_21', 'custom_field_22', 'custom_field_23', 'custom_field_24',
  'custom_field_25', 'custom_field_26', 'custom_field_27', 'custom_field_28',
  'custom_field_29', 'custom_field_30', 'custom_field_31', 'custom_field_32',
  'custom_field_33', 'custom_field_34', 'custom_field_35', 'custom_field_36',
  'custom_field_37', 'custom_field_38', 'custom_field_39', 'custom_field_40',
  'custom_field_41', 'custom_field_42', 'custom_field_43', 'custom_field_44',
  'custom_field_45', 'custom_field_46', 'custom_field_47', 'custom_field_48',
  'custom_field_49', 'custom_field_50', 'custom_field_51', 'custom_field_52',
  'custom_field_53', 'custom_field_54', 'custom_field_55', 'custom_field_56',
  'custom_field_57', 'custom_field_58', 'custom_field_59', 'custom_field_60',
  'custom_field_61', 'custom_field_62', 'custom_field_63', 'custom_field_64',
  'custom_field_65', 'custom_field_66', 'custom_field_67', 'custom_field_68',
  'custom_field_69', 'custom_field_70', 'custom_field_71', 'custom_field_72',
  'custom_field_73', 'custom_field_74', 'custom_field_75', 'custom_field_76',
  'custom_field_77', 'custom_field_78', 'custom_field_79', 'custom_field_80',
  'custom_field_81', 'custom_field_82', 'custom_field_83', 'custom_field_84',
  'custom_field_85', 'custom_field_86', 'custom_field_87', 'custom_field_88',
  'custom_field_89', 'custom_field_90', 'custom_field_91', 'custom_field_92',
  'custom_field_93', 'custom_field_94', 'custom_field_95', 'custom_field_96',
  'custom_field_97', 'custom_field_98', 'custom_field_99', 'custom_field_100',
];

const ITERATION_FIELDS = [
  'id', 'name', 'description', 'status', 'creator', 'created', 'modified',
  'completed', 'startdate', 'enddate', 'locker', 'workitem_type_id',
  'plan_app_id', 'release_id',
  'custom_field_1', 'custom_field_2', 'custom_field_3', 'custom_field_4', 'custom_field_5',
  'custom_field_6', 'custom_field_7', 'custom_field_8', 'custom_field_9', 'custom_field_10',
  'custom_field_11', 'custom_field_12', 'custom_field_13', 'custom_field_14', 'custom_field_15',
  'custom_field_16', 'custom_field_17', 'custom_field_18', 'custom_field_19', 'custom_field_20',
];

async function callTapdSkill(service: string, action: string, workspaceIds: string[], params: any = {}, fields?: string[]): Promise<any[]> {
  const resp = await fetch('http://localhost:3000/api/v1/tapd/skill-proxy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ service, action, workspaceIds, params, fields }),
  });
  if (!resp.ok) throw new Error(`Skill proxy error: ${resp.status}`);
  const result = await resp.json();
  if (!result.success) throw new Error(result.message || 'Skill call failed');
  const allData: any[] = [];
  for (const item of result.data || []) {
    const wsData = item.data?.data || [];
    if (Array.isArray(wsData)) allData.push(...wsData);
  }
  return allData;
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

function flattenTapdItem(item: any): any {
  const keys = Object.keys(item);
  if (keys.length === 1 && keys[0] !== 'id') return item[keys[0]];
  return item;
}

async function fetchStoriesWithSkill(workspaceIds: string[], options?: any): Promise<any[]> {
  const params: any = { limit: 200 };
  if (options?.createdBegin && options?.createdEnd) params.created = `${options.createdBegin}~${options.createdEnd}`;
  const allItems: any[] = [];
  let page = 1;
  while (true) {
    params.page = page;
    const items = await callTapdSkill('stories', 'list', workspaceIds, params, STORY_FIELDS);
    if (items.length === 0) break;
    allItems.push(...items.map(flattenTapdItem));
    if (items.length < 200) break;
    page++;
    await delay(100);
  }
  return allItems;
}

async function fetchTasksWithSkill(workspaceIds: string[]): Promise<any[]> {
  const params: any = { limit: 200 };
  const allItems: any[] = [];
  let page = 1;
  while (true) {
    params.page = page;
    const items = await callTapdSkill('tasks', 'list', workspaceIds, params, TASK_FIELDS);
    if (items.length === 0) break;
    allItems.push(...items.map(flattenTapdItem));
    if (items.length < 200) break;
    page++;
    await delay(100);
  }
  return allItems;
}

async function fetchIterationsWithSkill(workspaceIds: string[]): Promise<any[]> {
  const items = await callTapdSkill('iterations', 'list', workspaceIds, { limit: 200 }, ITERATION_FIELDS);
  return items.map(flattenTapdItem);
}

async function batchUpsertStories(stories: any[]) {
  const batchSize = 100;
  for (let i = 0; i < stories.length; i += batchSize) {
    const batch = stories.slice(i, i + batchSize);
    await Promise.all(batch.map(async (story: any) => {
      const id = String(story.id);
      const existing = await prisma.tapdStory.findUnique({ where: { id } });
      const data: any = {
        name: String(story.name || ''), description: String(story.description || ''), status: String(story.status || ''),
        priority: String(story.priority || ''), owner: String(story.owner || ''), cc: String(story.cc || ''),
        creator: String(story.creator || ''), created: story.created, modified: story.modified, completed: story.completed,
        begin: story.begin, due: story.due, effort: Number(story.effort) || 0, effortCompleted: Number(story.effortCompleted) || 0,
        workspaceId: String(story.workspaceId || ''), workspaceName: String(story.workspaceName || ''),
        iterationId: String(story.iterationId || ''), iterationName: String(story.iterationName || ''),
        customFieldOne: String(story.customFieldOne || ''), customFieldTwo: String(story.customFieldTwo || ''),
        customFieldThree: String(story.customFieldThree || ''), customFieldFour: String(story.customFieldFour || ''),
        customFieldFive: String(story.customFieldFive || ''), customFieldSix: String(story.customFieldSix || ''),
        customFieldSeven: String(story.customFieldSeven || ''), customFieldEight: String(story.customFieldEight || ''),
        customField9: String(story.customField9 || ''), customField10: String(story.customField10 || ''),
        customField11: String(story.customField11 || ''), customField12: String(story.customField12 || ''),
        customField13: String(story.customField13 || ''), customField14: String(story.customField14 || ''),
        customField15: String(story.customField15 || ''), rawJson: story.rawJson, syncedAt: story.syncedAt,
      };
      if (existing) await prisma.tapdStory.update({ where: { id }, data });
      else await prisma.tapdStory.create({ data: { id, ...data } });
    }));
  }
}

async function batchUpsertTasks(tasks: any[]) {
  const batchSize = 100;
  for (let i = 0; i < tasks.length; i += batchSize) {
    const batch = tasks.slice(i, i + batchSize);
    await Promise.all(batch.map(async (task: any) => {
      const id = String(task.id);
      const existing = await prisma.tapdTask.findUnique({ where: { id } });
      const data: any = {
        name: String(task.name || ''), description: String(task.description || ''), status: String(task.status || ''),
        priority: String(task.priority || ''), owner: String(task.owner || ''), creator: String(task.creator || ''),
        created: task.created, modified: task.modified, completed: task.completed, effort: Number(task.effort) || 0,
        effortCompleted: Number(task.effortCompleted) || 0, storyId: String(task.storyId || ''),
        workspaceId: String(task.workspaceId || ''), iterationId: String(task.iterationId || ''),
        rawJson: task.rawJson, syncedAt: task.syncedAt,
      };
      if (existing) await prisma.tapdTask.update({ where: { id }, data });
      else await prisma.tapdTask.create({ data: { id, ...data } });
    }));
  }
}

async function batchUpsertIterations(iterations: any[]) {
  const batchSize = 100;
  for (let i = 0; i < iterations.length; i += batchSize) {
    const batch = iterations.slice(i, i + batchSize);
    await Promise.all(batch.map(async (iteration: any) => {
      const id = String(iteration.id);
      const existing = await prisma.tapdIteration.findUnique({ where: { id } });
      const data: any = {
        name: String(iteration.name || ''), workspaceId: String(iteration.workspaceId || ''), status: String(iteration.status || ''),
        startDate: iteration.startDate, endDate: iteration.endDate, creator: String(iteration.creator || ''),
        created: iteration.created, modified: iteration.modified, completed: iteration.completed,
        rawJson: iteration.rawJson, syncedAt: iteration.syncedAt,
      };
      if (existing) await prisma.tapdIteration.update({ where: { id }, data });
      else await prisma.tapdIteration.create({ data: { id, ...data } });
    }));
  }
}

// 🆕 批量同步Workspace数据
async function batchUpsertWorkspaces(workspaces: { id: string; name: string }[]) {
  const batchSize = 50;
  for (let i = 0; i < workspaces.length; i += batchSize) {
    const batch = workspaces.slice(i, i + batchSize);
    await Promise.all(batch.map(async (ws) => {
      const id = String(ws.id);
      const existing = await prisma.tapdWorkspace.findUnique({ where: { id } });
      const data = {
        name: String(ws.name || ''),
        syncedAt: new Date(),
      };
      if (existing) await prisma.tapdWorkspace.update({ where: { id }, data });
      else await prisma.tapdWorkspace.create({ data: { id, ...data } });
    }));
  }
}

function transformStory(item: any): any {
  // 🛡️ 安全日期解析：过滤无效日期值（如 "0000-00-00"）
  const parseDateSafe = (val: unknown): Date | null => {
    if (val === null || val === undefined || val === '') return null;
    const str = String(val).trim();
    if (str === '0000-00-00' || str === '0000-00-00 00:00:00') return null;
    const d = new Date(str);
    if (isNaN(d.getTime()) || d.getFullYear() < 1900 || d.getFullYear() > 2100) return null;
    return d;
  };

  return {
    id: String(item.id || ''), name: String(item.name || ''), description: String(item.description || ''),
    status: String(item.status || ''), priority: String(item.priority || ''), owner: String(item.owner || ''),
    cc: String(item.cc || ''), creator: String(item.creator || ''),
    created: parseDateSafe(item.created),
    modified: parseDateSafe(item.modified),
    completed: parseDateSafe(item.completed),
    begin: parseDateSafe(item.begin),
    due: parseDateSafe(item.due),
    effort: parseFloat(String(item.effort)) || 0,
    effortCompleted: parseFloat(String(item.effort_completed)) || 0,
    workspaceId: String(item.workspace_id || ''),
    workspaceName: String(item.workspace_name || ''),
    iterationId: String(item.iteration_id || ''),
    iterationName: String(item.iteration_name || ''),
    module: String(item.module || ''),
    customFieldOne: String(item.custom_field_one || ''),
    customFieldTwo: String(item.custom_field_two || ''),
    customFieldThree: String(item.custom_field_three || ''),
    customFieldFour: String(item.custom_field_four || ''),
    customFieldFive: String(item.custom_field_five || ''),
    customFieldSix: String(item.custom_field_six || ''),
    insertRequirement: String(item.custom_field_six || ''),
    customFieldSeven: String(item.custom_field_seven || ''),
    customFieldEight: String(item.custom_field_eight || ''),
    customField9: String(item.custom_field_9 || ''),
    customField10: String(item.custom_field_10 || ''),
    onTimeTesting: String(item.custom_field_10 || ''),
    customField11: String(item.custom_field_11 || ''),
    projectAttribution: String(item.custom_field_11 || ''),
    customField12: String(item.custom_field_12 || ''),
    customField13: String(item.custom_field_13 || ''),
    costAttribution: String(item.custom_field_13 || ''),
    customField14: String(item.custom_field_14 || ''),
    customField15: String(item.custom_field_15 || ''),
    rawJson: item,
    syncedAt: new Date(),
  };
}

function transformTask(item: any): any {
  // 🛡️ 安全日期解析：过滤无效日期值（如 "0000-00-00"）
  const parseDateSafe = (val: unknown): Date | null => {
    if (val === null || val === undefined || val === '') return null;
    const str = String(val).trim();
    if (str === '0000-00-00' || str === '0000-00-00 00:00:00') return null;
    const d = new Date(str);
    if (isNaN(d.getTime()) || d.getFullYear() < 1900 || d.getFullYear() > 2100) return null;
    return d;
  };

  return {
    id: String(item.id || ''), name: String(item.name || ''), description: String(item.description || ''),
    status: String(item.status || ''), priority: String(item.priority || ''), owner: String(item.owner || ''),
    creator: String(item.creator || ''),
    created: parseDateSafe(item.created),
    modified: parseDateSafe(item.modified),
    completed: parseDateSafe(item.completed),
    effort: parseFloat(String(item.effort)) || 0,
    effortCompleted: parseFloat(String(item.effort_completed)) || 0,
    storyId: String(item.story_id || ''),
    workspaceId: String(item.workspace_id || ''),
    iterationId: String(item.iteration_id || ''),
    rawJson: item,
    syncedAt: new Date(),
  };
}

function transformIteration(item: any): any {
  // 🛡️ 安全日期解析：过滤无效日期值（如 "0000-00-00"）
  const parseDateSafe = (val: unknown): Date | null => {
    if (val === null || val === undefined || val === '') return null;
    const str = String(val).trim();
    if (str === '0000-00-00' || str === '0000-00-00 00:00:00') return null;
    const d = new Date(str);
    if (isNaN(d.getTime()) || d.getFullYear() < 1900 || d.getFullYear() > 2100) return null;
    return d;
  };

  return {
    id: String(item.id || ''), name: String(item.name || ''), workspaceId: String(item.workspace_id || ''),
    status: String(item.status || ''),
    startDate: parseDateSafe(item.startdate),
    endDate: parseDateSafe(item.enddate),
    creator: String(item.creator || ''),
    created: parseDateSafe(item.created),
    modified: parseDateSafe(item.modified),
    completed: parseDateSafe(item.completed),
    rawJson: item,
    syncedAt: new Date(),
  };
}

export async function fullSyncWithSkill(options: SyncOptions): Promise<SyncResult> {
  const { workspaceIds, createdBegin, createdEnd, onProgress } = options;
  try {
    // 1. 预加载工作区信息（获取 workspace_name）
    onProgress?.('正在获取项目信息...', 5);
    const workspaceMap = await fetchWorkspaceMap(workspaceIds);
    onProgress?.(`已获取 ${workspaceMap.size} 个项目信息`, 10);

    // 🆕 1.5 同步Workspace数据到数据库
    if (workspaceMap.size > 0) {
      await batchUpsertWorkspaces(Array.from(workspaceMap.entries()).map(([id, name]) => ({ id, name })));
      onProgress?.(`已同步 ${workspaceMap.size} 个项目到数据库`, 15);
    }

    // 2. 同步迭代数据并构建迭代名称映射
    onProgress?.('开始同步迭代数据...', 20);
    const iterations = await fetchIterationsWithSkill(workspaceIds);
    
    // 构建 iteration_id -> iteration_name 映射
    const iterationMap = new Map<string, string>();
    for (const iter of iterations) {
      if (iter.id && iter.name) {
        iterationMap.set(String(iter.id), String(iter.name));
      }
    }
    
    await batchUpsertIterations(iterations.map(transformIteration));
    onProgress?.(`已同步 ${iterations.length} 个迭代`, 35);
    await delay(200);

    // 3. 同步需求数据（使用工作区和迭代名称映射）
    onProgress?.('开始同步需求数据...', 45);
    const stories = await fetchStoriesWithSkill(workspaceIds, { createdBegin, createdEnd });
    
    // 使用映射转换需求（填充 workspace_name 和 iteration_name）
    const storiesWithNames = stories.map(story => 
      transformStoryWithMaps(story, workspaceMap, iterationMap)
    );
    
    await batchUpsertStories(storiesWithNames);
    onProgress?.(`已同步 ${stories.length} 个需求`, 75);
    await delay(200);

    // 4. 同步任务数据
    onProgress?.('开始同步任务数据...', 85);
    const tasks = await fetchTasksWithSkill(workspaceIds);
    await batchUpsertTasks(tasks.map(transformTask));
    onProgress?.(`已同步 ${tasks.length} 个任务`, 100);

    return { success: true, storyCount: stories.length, taskCount: tasks.length, iterationCount: iterations.length };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    return { success: false, storyCount:0, taskCount: 0, iterationCount: 0, error: errorMsg };
  }
}

/**
 * 获取工作区信息，构建 workspace_id -> workspace_name 映射
 */
async function fetchWorkspaceMap(workspaceIds: string[]): Promise<Map<string, string>> {
  const workspaceMap = new Map<string, string>();
  
  try {
    const workspaces = await callTapdSkill('workspaces', 'list', workspaceIds, {}, ['id', 'name']);
    
    for (const ws of workspaces) {
      const flattened = flattenTapdItem(ws);
      if (flattened.id && flattened.name) {
        workspaceMap.set(String(flattened.id), String(flattened.name));
      }
    }
  } catch (error) {
    console.warn('[Sync] 获取工作区信息失败:', error);
  }
  
  return workspaceMap;
}

/**
 * 使用工作区和迭代名称映射转换需求数据
 */
function transformStoryWithMaps(
  item: any,
  workspaceMap: Map<string, string>,
  iterationMap: Map<string, string>
): any {
  const baseTransform = transformStory(item);
  
  // 填充 workspace_name
  const wsId = String(item.workspace_id || '');
  if (!baseTransform.workspaceName && workspaceMap.has(wsId)) {
    baseTransform.workspaceName = workspaceMap.get(wsId) || '';
  }
  
  // 填充 iteration_name
  const iterId = String(item.iteration_id || '');
  if (!baseTransform.iterationName && iterationMap.has(iterId)) {
    baseTransform.iterationName = iterationMap.get(iterId) || '';
  }
  
  return baseTransform;
}

export async function getLatestSyncRecord() {
  return prisma.tapdSyncRecord.findFirst({ orderBy: { startedAt: 'desc' } });
}

export async function getSyncHistory(limit = 20) {
  return prisma.tapdSyncRecord.findMany({ orderBy: { startedAt: 'desc' }, take: limit });
}
