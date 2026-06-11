import { NextRequest, NextResponse } from 'next/server';

// ==================== 类型定义 ====================

/** 需求规则：按工时区间计算需求数 */
interface RequirementRule {
  maxHours: number;
  value: number;
}

interface RequirementRules {
  ranges: RequirementRule[];
}

/** 字段映射配置 */
interface FieldMapping {
  costField: string;     // 成本归属字段名
  projectField: string;  // 项目归属字段名
  okrField: string;      // OKR 字段名
}

interface ProcessDataRequest {
  stories: Record<string, unknown>[];
  tasks: Record<string, unknown>[];
  rules: RequirementRules;
  fieldMapping: FieldMapping;
  apiUser?: string;
  apiPassword?: string;
  /** 每个项目的自定义字段映射：{ workspaceId: { "成本归属": "custom_field_eight", ... } } */
  customFieldMapping?: Record<string, Record<string, string>>;
}

interface PersonStat {
  name: string;
  count: number;
  ratio: number;
}

interface ProcessDataResponse {
  success: boolean;
  message?: string;
  processedData: Record<string, unknown>[];
  processedTasks: Record<string, unknown>[];
  statistics: {
    totalStories: number;
    totalTasks: number;
    totalRequirement: number;
    personCount: number;
  };
  personStats: PersonStat[];
}

// ==================== 辅助函数 ====================

/**
 * 根据规则计算需求数
 */
function calculateRequirement(hours: number, rules: RequirementRules): number {
  if (!rules?.ranges || rules.ranges.length === 0) {
    return 0;
  }

  // 按 maxHours 升序排列
  const sortedRanges = [...rules.ranges].sort((a, b) => a.maxHours - b.maxHours);

  for (const range of sortedRanges) {
    if (hours <= range.maxHours) {
      return range.value;
    }
  }

  // 超出所有区间，取最后一个区间的值
  return sortedRanges[sortedRanges.length - 1].value;
}

/**
 * 安全获取字段值
 */
function getFieldValue(
  item: Record<string, unknown>,
  fieldName: string,
): string {
  if (!fieldName || !item) return '';
  const value = item[fieldName];
  return value != null ? String(value) : '';
}

/**
 * 安全获取数值字段
 */
function getNumberField(
  item: Record<string, unknown>,
  fieldName: string,
): number {
  if (!fieldName || !item) return 0;
  const value = item[fieldName];
  if (typeof value === 'number') return value;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

// ==================== 主处理逻辑 ====================

/**
 * POST /api/v1/resources/tapd/process-data
 * 执行5步数据处理逻辑
 */
export async function POST(req: NextRequest) {
  try {
    const body: ProcessDataRequest = await req.json();
    const { stories, tasks, rules, fieldMapping } = body;

    if (!stories || !tasks || !rules || !fieldMapping) {
      const errorResponse: ProcessDataResponse = {
        success: false,
        message: '缺少必要参数: stories, tasks, rules, fieldMapping',
        processedData: [],
        processedTasks: [],
        statistics: {
          totalStories: 0,
          totalTasks: 0,
          totalRequirement: 0,
          personCount: 0,
        },
        personStats: [],
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    const { costField: defaultCostField, projectField: defaultProjectField } = fieldMapping;
    const cfMapping = body.customFieldMapping || {};

    // 动态查找字段名的辅助函数
    const resolveFieldName = (wsId: string, fieldName: string, fallback: string) => {
      const wsMap = cfMapping[wsId];
      if (wsMap && wsMap[fieldName]) return wsMap[fieldName];
      return fallback;
    };

    // ============================================================
    // 步骤 -1: 获取迭代名称映射
    // ============================================================
    const iterationNameMap = new Map<string, string>();
    const allIterationIds = new Set<string>();
    for (const story of stories) {
      const iid = String(story['iterationId'] ?? '');
      if (iid && iid !== '0') allIterationIds.add(iid);
    }
    for (const task of tasks) {
      const iid = String(task['iterationId'] ?? '');
      if (iid && iid !== '0') allIterationIds.add(iid);
    }
    // 批量查询迭代名称（按 workspace_id 分组查询）
    const wsIdSet = new Set<string>();
    for (const story of stories) {
      const wsId = String(story['workspaceId'] ?? '');
      if (wsId) wsIdSet.add(wsId);
    }
    for (const task of tasks) {
      const wsId = String(task['workspaceId'] ?? '');
      if (wsId) wsIdSet.add(wsId);
    }
    // 从请求中获取 API 凭据（前端传入）
    const apiUser = body.apiUser as string | undefined;
    const apiPassword = body.apiPassword as string | undefined;
    if (apiUser && apiPassword && allIterationIds.size > 0) {
      for (const wsId of Array.from(wsIdSet)) {
        try {
          const auth = Buffer.from(`${apiUser}:${apiPassword}`).toString('base64');
          const resp = await fetch(
            `https://api.tapd.cn/iterations?workspace_id=${wsId}&limit=200&fields=id,name`,
            { headers: { Authorization: `Basic ${auth}` } },
          );
          if (resp.ok) {
            const data = await resp.json();
            const items = Array.isArray(data.data) ? data.data : [];
            for (const item of items) {
              const keys = Object.keys(item);
              const it = (keys.length === 1 ? item[keys[0]] : item) as Record<string, unknown>;
              const id = String(it['id'] ?? '');
              const name = String(it['name'] ?? '');
              if (id && name) iterationNameMap.set(id, name);
            }
          }
        } catch {
          // 获取迭代名称失败不影响主流程
        }
      }
    }
    // 将迭代名称写入 story 和 task（只填充缺失的，不覆盖已有值）
    for (const story of stories) {
      const iid = String(story['iterationId'] ?? '');
      // 优先保留数据库已有的 iterationName，只在为空时从映射表补充
      if (!story['iterationName'] || String(story['iterationName']).trim() === '') {
        const mapped = iterationNameMap.get(iid);
        if (mapped) story['iterationName'] = mapped;
        else if (iid && iid !== '0') story['iterationName'] = iid; // 无映射时用ID兜底
      }
    }
    for (const task of tasks) {
      const iid = String(task['iterationId'] ?? '');
      if (!task['iterationName'] || String(task['iterationName']).trim() === '') {
        const mapped = iterationNameMap.get(iid);
        if (mapped) task['iterationName'] = mapped;
        else if (iid && iid !== '0') task['iterationName'] = iid;
      }
    }

    // ============================================================
    // 步骤 0: 建立 Story -> Task 映射
    // ============================================================
    const storyTaskMap = new Map<string, Record<string, unknown>[]>();
    for (const task of tasks) {
      const parentStoryId = String(task['storyId'] ?? task['parentId'] ?? '');
      if (parentStoryId) {
        if (!storyTaskMap.has(parentStoryId)) {
          storyTaskMap.set(parentStoryId, []);
        }
        storyTaskMap.get(parentStoryId)!.push(task);
      }
    }

    // ============================================================
    // 步骤 1: Task 处理人合并到 Story
    // ============================================================
    // PRD 规则：子任务处理人"完全替换"主任务原有处理人（不是追加）
    // 如果有子任务，用子任务的处理人集合替换 Story 的 owner
    // 如果没有子任务，保留 Story 原有 owner
    // 注意：TAPD 的 owner 字段可能包含分号分隔的多人，需要拆分、去空、去重
    const storyMergedOwners = new Map<string, string[]>();

    // 辅助函数：将 owner 字符串拆分为干净的处理人数组
    const parseOwners = (raw: string): string[] => {
      if (!raw) return [];
      return raw.split(';').map((s) => s.trim()).filter(Boolean);
    };

    for (const story of stories) {
      const storyId = String(story['id'] ?? '');
      const relatedTasks = storyTaskMap.get(storyId) ?? [];

      if (relatedTasks.length > 0) {
        // 有子任务：收集所有 Task 的 owner，去重后替换 Story 的 owner
        const ownerSet = new Set<string>();
        for (const task of relatedTasks) {
          const taskOwner = getFieldValue(task, 'owner');
          const owners = parseOwners(taskOwner);
          for (const o of owners) {
            ownerSet.add(o);
          }
        }
        const mergedOwners = Array.from(ownerSet);
        storyMergedOwners.set(storyId, mergedOwners);
        // 写回 Story 的 owner 字段（单个分号分隔）
        story['owner'] = mergedOwners.join(';');
      } else {
        // 无子任务：保留原有 owner
        const storyOwner = getFieldValue(story, 'owner');
        const owners = parseOwners(storyOwner);
        storyMergedOwners.set(storyId, owners);
        story['owner'] = owners.join(';');
      }
    }

    // ============================================================
    // 步骤 2: 成本归属继承（Story -> Task）
    // ============================================================
    // 读取 Story 的成本归属字段，将该值向下填充到所有关联的 Task
    for (const story of stories) {
      const storyId = String(story['id'] ?? '');
      const wsId = String(story['workspaceId'] ?? '');
      const costFieldKey = resolveFieldName(wsId, '成本归属', defaultCostField);
      const storyCost = getFieldValue(story, costFieldKey);
      if (!storyCost) continue;

      const relatedTasks = storyTaskMap.get(storyId) ?? [];
      for (const task of relatedTasks) {
        const taskCost = getFieldValue(task, costFieldKey);
        if (!taskCost) {
          task[costFieldKey] = storyCost;
        }
      }
    }

    // ============================================================
    // 步骤 3: 项目归属继承（Story -> Task）
    // ============================================================
    // 读取 Story 的项目归属字段，将该值向下填充到所有关联的 Task
    for (const story of stories) {
      const storyId = String(story['id'] ?? '');
      const wsId = String(story['workspaceId'] ?? '');
      const projectFieldKey = resolveFieldName(wsId, '项目归属', defaultProjectField);
      const storyProject = getFieldValue(story, projectFieldKey);
      if (!storyProject) continue;

      const relatedTasks = storyTaskMap.get(storyId) ?? [];
      for (const task of relatedTasks) {
        const taskProject = getFieldValue(task, projectFieldKey);
        if (!taskProject) {
          task[projectFieldKey] = storyProject;
        }
      }
    }

    // ============================================================
    // 步骤 4: 工时汇总（Task -> Story）
    // ============================================================
    // 将每个 Story 下所有 Task 的工时汇总到 Story
    for (const story of stories) {
      const storyId = String(story['id'] ?? '');
      const relatedTasks = storyTaskMap.get(storyId) ?? [];

      let totalEstimated = 0;
      let totalCompleted = 0;
      let totalRemaining = 0;

      for (const task of relatedTasks) {
        totalEstimated += getNumberField(task, 'effort');
        totalCompleted += getNumberField(task, 'effortCompleted');
        totalRemaining += getNumberField(task, 'remain');
      }

      // 将汇总工时写入 Story
      story['taskEstimated'] = totalEstimated;
      story['taskCompleted'] = totalCompleted;
      story['taskRemaining'] = totalRemaining;
      story['taskCount'] = relatedTasks.length;
    }

    // ============================================================
    // 步骤 5: 需求数计算
    // ============================================================
    let totalRequirement = 0;

    for (const story of stories) {
      // 优先用 Story 自身的 effort，如果没有则用 Task 汇总
      const storyEffort = getNumberField(story, 'effort');
      const taskTotal = getNumberField(story, 'taskEstimated');
      const totalHours = storyEffort > 0 ? storyEffort : taskTotal;
      const reqCount = calculateRequirement(totalHours, rules);
      story['requirementCount'] = reqCount;
      totalRequirement += reqCount;
    }

    // ============================================================
    // 统计处理
    // ============================================================

    // 人员统计：按处理人汇总需求数
    // 1. Story 有多个处理人（分号分隔），先拆分出单独的处理人
    // 2. 以处理人为主键，求和该人的所有 Story 需求数
    const personReqMap = new Map<string, number>();
    for (const story of stories) {
      const storyId = String(story['id'] ?? '');
      const owners = storyMergedOwners.get(storyId);
      if (!owners) continue;

      const reqCount = getNumberField(story, 'requirementCount');
      for (const owner of owners) {
        personReqMap.set(owner, (personReqMap.get(owner) ?? 0) + reqCount);
      }
    }

    const totalStories = stories.length;
    const totalTasks = tasks.length;
    const personCount = personReqMap.size;

    // 生成人员统计列表
    const personStats: PersonStat[] = [];
    personReqMap.forEach((count, name) => {
      personStats.push({
        name,
        count: Math.round(count * 10) / 10,
        ratio: totalRequirement > 0 ? Math.round((count / totalRequirement) * 10000) / 100 : 0,
      });
    });

    // 按数量降序排列
    personStats.sort((a, b) => b.count - a.count);

    const response: ProcessDataResponse = {
      success: true,
      processedData: stories,
      processedTasks: tasks,
      statistics: {
        totalStories,
        totalTasks,
        totalRequirement,
        personCount,
      },
      personStats,
    };

    return NextResponse.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : '未知错误';
    const errorResponse: ProcessDataResponse = {
      success: false,
      message: `处理异常: ${message}`,
      processedData: [],
      processedTasks: [],
      statistics: {
        totalStories: 0,
        totalTasks: 0,
        totalRequirement: 0,
        personCount: 0,
      },
      personStats: [],
    };
    return NextResponse.json(errorResponse, { status: 500 });
  }
}
