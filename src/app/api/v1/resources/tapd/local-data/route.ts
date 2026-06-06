import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * 从本地数据库查询已同步的 TAPD 数据
 * 替代实时调用 TAPD API，提升性能并节省 API 调用次数
 */

// ============================================================
// 自定义字段自动映射：根据数据特征识别各业务字段的实际存储位置
// 不同TAPD项目的自定义字段编号可能不同，需要按项目动态映射
// ============================================================

/** 所有可能的自定义字段名（camelCase） */
const CUSTOM_FIELD_KEYS = [
  'customFieldOne', 'customFieldTwo', 'customFieldThree', 'customFieldFour',
  'customFieldFive', 'customFieldSix', 'customFieldSeven', 'customFieldEight',
  'customField9', 'customField10', 'customField11', 'customField12',
  'customField13', 'customField14', 'customField15', 'customField16',
  'customField17', 'customField18', 'customField19', 'customField20',
];

/**
 * 分析单个项目的Story数据，识别自定义字段的业务含义
 * 优先使用 rawJson 中的原始数据，结合数据特征精确判断
 */
function analyzeWorkspaceFields(stories: Record<string, unknown>[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  if (stories.length === 0) return mapping;

  // 收集每个自定义字段的所有唯一值（用于特征分析）
  const fieldValues: Record<string, Set<string>> = {};
  for (const key of CUSTOM_FIELD_KEYS) {
    fieldValues[key] = new Set();
  }

  for (const story of stories) {
    // 优先从 rawJson 读取原始值（保留原始格式）
    const rawJson = story['rawJson'] as Record<string, unknown> | null | undefined;
    
    for (const key of CUSTOM_FIELD_KEYS) {
      let val: unknown;
      if (rawJson) {
        // rawJson 中是 snake_case: custom_field_one → customFieldOne
        const snakeKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
        val = rawJson[snakeKey];
        if (val === undefined || val === null || val === '') {
          val = story[key]; // fallback 到 camelCase
        }
      } else {
        val = story[key];
      }
      
      if (val !== null && val !== undefined && val !== '') {
        fieldValues[key].add(String(val).trim());
      }
    }
  }

  // 按数据特征分类所有非空字段
  const classified: { key: string; values: Set<string>; type: string; score: number }[] = [];
  
  for (const key of CUSTOM_FIELD_KEYS) {
    const vals = fieldValues[key];
    if (vals.size === 0) continue;
    
    const arr = Array.from(vals);
    const total = stories.length;
    const nonEmptyCount = stories.filter(s => {
      const v = s[key]; return v !== null && v !== undefined && v !== '';
    }).length;

    // 精确分类
    let type = 'unknown';
    let score = 0;

    // 类型1: 布尔值（是/否）→ 冒烟通过 或 按时提测
    const boolVals = arr.filter(v => /^(是|否|yes|no)$/i.test(v));
    if (boolVals.length >= Math.min(2, arr.length * 0.5) && nonEmptyCount >= total * 0.3) {
      type = 'boolean';
      score = boolVals.length + nonEmptyCount;
    }

    // 类型2: 路径格式（包含 / 的层级文本）→ 成本归属 或 项目归属
    const pathVals = arr.filter(v => /^[\u4e00-\u9fa5a-zA-Z]+\/[\u4e00-\u9fa5a-zA-Z]/.test(v));
    if (pathVals.length >= Math.min(2, arr.length * 0.5) && nonEmptyCount >= total * 0.5) {
      type = 'path';
      score = pathVals.length * 10 + nonEmptyCount; // 路径权重更高
    }

    // 类型3: 日期格式 YYYY-MM-DD
    const dateVals = arr.filter(v => /^\d{4}-\d{2}-\d{2}$/.test(v));
    if (dateVals.length >= nonEmptyCount * 0.7 && nonEmptyCount >= total * 0.3) {
      type = 'date';
      score = dateVals.length;
    }

    // 类型4: 纯人名（2-4个中文字符，不含特殊词）
    const stopWords = ['业务需求', '技术支持', '线上支持', '功能优化', '性能优化', 
                        '代码重构', 'Bug修复', '测试用例', '文档', '设计', '前端', '后端'];
    const personVals = arr.filter(v => 
      /^[\u4e00-\u9fa5]{2,4}$/.test(v) && !stopWords.includes(v)
    );
    if (personVals.length >= nonEmptyCount * 0.6 && nonEmptyCount >= total * 0.2) {
      type = 'person';
      score = personVals.length;
    }

    // 类型5: 数字
    const numVals = arr.filter(v => /^\d+$/.test(v));
    if (numVals.length >= nonEmptyCount * 0.8 && nonEmptyCount >= total * 0.2) {
      type = 'number';
      score = numVals.length;
    }

    if (type !== 'unknown') {
      classified.push({ key, values: vals, type, score });
    }
  }

  // 按 score 排序
  classified.sort((a, b) => b.score - a.score);

  console.log('[LocalDB] 字段分类结果:', JSON.stringify(classified.map(c => ({
    key: c.key,
    type: c.type,
    score: c.score,
    samples: Array.from(c.values).slice(0, 3),
  }))));

  // 分配映射：按类型和优先级
  const pathFields = classified.filter(c => c.type === 'path');
  const boolFields = classified.filter(c => c.type === 'boolean');
  const personFields = classified.filter(c => c.type === 'person');

  // 🎯 路径字段智能区分：成本归属 vs 项目归属
  // 成本归属关键词：组织/部门名称（研发中心、事业群、职能部门等）
  // 项目归属关键词：项目分类（常规项目、战略项目、技术项目、专项等）
  const COST_CENTER_KEYWORDS = ['研发中心', '事业群', '职能部门', '运营', '产品', '设计', '测试', '财务', '人事', '行政', '法务', '市场'];
  const PROJECT_CATEGORY_KEYWORDS = ['常规项目', '战略项目', '技术项目', '专项', '迭代', '版本', 'Sprint'];

  if (pathFields.length >= 2) {
    // 有2个以上路径字段时，用关键词区分
    let costFieldIdx = -1;
    let projectFieldIdx = -1;

    // 分析每个路径字段的样本值
    for (let i = 0; i < pathFields.length; i++) {
      const samples = Array.from(pathFields[i].values);
      const sampleText = samples.join(' ');

      const costScore = COST_CENTER_KEYWORDS.filter(k => sampleText.includes(k)).length;
      const projectScore = PROJECT_CATEGORY_KEYWORDS.filter(k => sampleText.includes(k)).length;

      console.log(`[LocalDB]   路径字段 ${pathFields[i].key}: 成本分=${costScore} 项目分=${projectScore} 样本="${samples.slice(0,2).join('|')}"`);

      if (costScore > projectScore && costFieldIdx === -1) {
        costFieldIdx = i;
      } else if (projectScore > costScore && projectFieldIdx === -1) {
        projectFieldIdx = i;
      }
    }

    // 如果关键词无法完全区分，用 fallback 规则
    if (costFieldIdx === -1 && projectFieldIdx === -1) {
      // 兜底：通常较短的路径是项目归属（如"常规项目/SCRM"），较长的是成本归属
      const sortedByLength = [...pathFields].sort((a, b) => {
        const lenA = Array.from(a.values).reduce((s, v) => s + v.length, 0) / a.values.size;
        const lenB = Array.from(b.values).reduce((s, v) => s + v.length, 0) / b.values.size;
        return lenA - lenB;  // 短的在前
      });
      mapping['项目归属'] = sortedByLength[0].key;
      mapping['成本归属'] = sortedByLength[sortedByLength.length - 1]?.key || sortedByLength[0].key;
      console.log(`[LocalDB]   ⚠️ 关键词无法区分，按路径长度: 项目归属=${mapping['项目归属']} 成本归属=${mapping['成本归属']}`);
    } else {
      // 确保两个都有值
      if (projectFieldIdx === -1) projectFieldIdx = costFieldIdx === 0 ? 1 : 0;
      if (costFieldIdx === -1) costFieldIdx = projectFieldIdx === 0 ? 1 : 0;

      mapping['成本归属'] = pathFields[costFieldIdx].key;
      mapping['项目归属'] = pathFields[projectFieldIdx].key;
      console.log(`[LocalDB]   ✅ 关键词匹配: 成本归属=${mapping['成本归属']} 项目归属=${mapping['项目归属']}`);
    }
  } else if (pathFields.length === 1) {
    // 只有1个路径字段，同时作为两者
    mapping['项目归属'] = pathFields[0].key;
    mapping['成本归属'] = pathFields[0].key;
  }

  // 布尔字段：第一个=冒烟通过，第二个=按时提测
  if (boolFields.length >= 1) mapping['冒烟通过'] = boolFields[0].key;
  if (boolFields.length >= 2) mapping['按时提测'] = boolFields[1].key;

  // 人名字段：按时提测（如果布尔不够）
  if (!mapping['按时提测'] && personFields.length >= 1) {
    mapping['按时提测'] = personFields[0].key;
  }

  console.log('[LocalDB] 最终字段映射:', JSON.stringify(mapping));

  return mapping;
}

/**
 * 构建所有项目的自定义字段映射
 */
function buildCustomFieldMapping(
  allStories: Record<string, unknown>[],
  workspaceIds: string[]
): Record<string, Record<string, string>> {
  const result: Record<string, Record<string, string>> = {};

  // 按 workspaceId 分组
  const grouped = new Map<string, Record<string, unknown>[]>();
  for (const wsId of workspaceIds) {
    grouped.set(wsId, []);
  }
  for (const story of allStories) {
    const wsId = String(story['workspaceId'] ?? '');
    if (grouped.has(wsId)) {
      grouped.get(wsId)!.push(story);
    }
  }

  for (const [wsId, wsStories] of grouped) {
    if (wsStories.length > 0) {
      result[wsId] = analyzeWorkspaceFields(wsStories);
    }
  }

  return result;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      workspaceIds = [],      // 项目ID列表
      createdBegin,           // 创建时间开始
      createdEnd,             // 创建时间结束
      completedBegin,         // 完成时间开始
      completedEnd,           // 完成时间结束
      statuses = [],          // 状态筛选
      debugMode = false,      // 调试模式：忽略所有过滤条件
    } = body;

    // 调试模式：如果启用，查询所有数据
    if (debugMode) {
      console.log(`[LocalDB] 🔧 调试模式已启用，忽略所有过滤条件`);
    }

    if (!workspaceIds.length && !debugMode) {
      return NextResponse.json({
        success: false,
        message: '请选择至少一个项目',
        stories: [],
        tasks: [],
        customFieldMapping: {},
      }, { status: 400 });
    }

    console.log(`[LocalDB] 查询本地数据:`);
    console.log(`  - 项目数: ${workspaceIds.length}`);
    console.log(`  - 项目ID列表: ${JSON.stringify(workspaceIds)}`);
    console.log(`  - 时间范围: ${createdBegin} ~ ${createdEnd}`);
    console.log(`  - 完成时间: ${completedBegin} ~ ${completedEnd}`);
    console.log(`  - 状态筛选（原始）: ${statuses.join(', ') || '全部'}`);

    // ========== 状态转换：中文 → 英文 ==========
    // TAPD 不同项目可能使用不同状态码：
    //   - 标准项目: resolved, developing, planning...
    //   - 自定义工作流: status_1, status_2, ... status_13
    // 需要通过 tapd_workflow_status 表做完整映射
    let resolvedStatuses: string[] = [];

    if (statuses.length > 0 && !debugMode) {
      console.log(`[LocalDB] 🔄 开始状态转换，输入: ${statuses.join(', ')}`);

      // 策略：查询所有活跃的工作流配置，构建完整映射表
      // 不只查匹配的，而是查出全部，确保能找到所有可能的 statusKey
      const allWorkflowMappings = await prisma.tapdWorkflowStatus.findMany({
        where: {
          system: 'story',
          isActive: true,
        },
        select: {
          statusKey: true,
          statusValue: true,
          workspaceId: true,
        },
      });

      console.log(`[LocalDB] 📋 工作流表共 ${allWorkflowMappings.length} 条记录`);

      // 构建中文值 → 所有对应 statusKey 的映射（跨项目合并）
      const chineseToAllKeys = new Map<string, Set<string>>();
      const keyToChinese = new Map<string, string>();

      allWorkflowMappings.forEach(m => {
        if (!chineseToAllKeys.has(m.statusValue)) {
          chineseToAllKeys.set(m.statusValue, new Set());
        }
        chineseToAllKeys.get(m.statusValue)!.add(m.statusKey);
        keyToChinese.set(m.statusKey, m.statusValue);
      });

      // 同时构建：对于每个输入状态，收集所有可能的数据库值
      const dbStatusSet = new Set<string>();

      statuses.forEach(status => {
        let matched = false;

        // 情况1：输入是中文（如"已发布"）→ 查找所有对应的 statusKey
        if (chineseToAllKeys.has(status)) {
          const keys = Array.from(chineseToAllKeys.get(status)!);
          keys.forEach(k => dbStatusSet.add(k));
          console.log(`[LocalDB] ✓ 中文→英文: "${status}" → [${keys.join(', ')}]`);
          matched = true;
        }

        // 情况2：输入是英文键（如"resolved"）→ 保留 + 查找同中文的其他键
        if (keyToChinese.has(status)) {
          dbStatusSet.add(status);
          const chineseVal = keyToChinese.get(status)!;
          if (chineseToAllKeys.has(chineseVal)) {
            chineseToAllKeys.get(chineseVal)!.forEach(k => dbStatusSet.add(k));
          }
          console.log(`[LocalDB] ✓ 英文键扩展: "${status}" → 通过"${chineseVal}"添加关联键`);
          matched = true;
        }

        // 情况3：未匹配 → 直接作为原始值保留（可能是 status_8 这类原始码）
        if (!matched) {
          dbStatusSet.add(status);
          console.log(`[LocalDB] ⚠️ 未匹配，保留原值: "${status}"`);
        }
      });

      // 额外安全措施：如果某个中文值在数据库 Story 中存在但不在工作流表中，
      // 直接用该值本身也加入筛选（兜底）
      if (statuses.some(s => /[\u4e00-\u9fa5]/.test(s))) {
        // 查询数据库中实际存在的所有状态值（限制在选中的项目中）
        const existingStatuses = await prisma.tapdStory.groupBy({
          by: ['status'],
          where: { workspaceId: { in: workspaceIds } },
          _count: { id: true },
        });

        const allDbStatuses = new Set(existingStatuses.map(e => e.status));

        // 对于每个中文输入，如果数据库中有直接匹配的值，也加入
        statuses.forEach(s => {
          if (allDbStatuses.has(s)) {
            dbStatusSet.add(s);
            console.log(`[LocalDB] ✓ 数据库直配: "${s}" 存在于数据库中`);
          }
        });
      }

      resolvedStatuses = Array.from(dbStatusSet);

      console.log(`[LocalDB] ✅ 最终状态筛选列表 (${resolvedStatuses.length}个): ${resolvedStatuses.join(', ')}`);
    }

    // 先检查数据库中是否有数据
    const totalStories = await prisma.tapdStory.count();
    const totalTasks = await prisma.tapdTask.count();

    console.log(`[LocalDB] ========== 查询参数诊断 ==========`);
    console.log(`[LocalDB] workspaceIds:`, workspaceIds);
    console.log(`[LocalDB] statuses (原始):`, statuses);
    console.log(`[LocalDB] resolvedStatuses (转换后):`, resolvedStatuses);
    console.log(`[LocalDB] dateRange:`, { createdBegin, createdEnd });
    console.log(`[LocalDB] completeRange:`, { completedBegin, completedEnd });

    // 快速验证：用 workspaceId 直接查数据库
    if (workspaceIds.length > 0) {
      const directCount = await prisma.tapdStory.count({
        where: { workspaceId: { in: workspaceIds } }
      });
      const wsSample = await prisma.tapdStory.findFirst({
        where: { workspaceId: { in: workspaceIds } },
        select: { id: true, name: true, workspaceId: true, workspaceName: true, status: true }
      });
      console.log(`[LocalDB] 直接用 workspaceId IN (${workspaceIds.join(',')}) 查询:`);
      console.log(`  - Story 数量: ${directCount}`);
      if (wsSample) {
        console.log(`  - 样本: id=${wsSample.id}, workspaceId=${wsSample.workspaceId}, name=${wsSample.name?.substring(0,30)}, status=${wsSample.status}`);
      } else {
        console.log(`  - ⚠️ 无数据！检查 workspaceId 是否匹配`);
        // 列出数据库中实际存在的 workspaceId 样本
        const allWs = await prisma.tapdStory.groupBy({
          by: ['workspaceId', 'workspaceName'],
          _count: { id: true },
          take: 10
        });
        console.log(`  - 数据库中的 workspaceId 样本:`);
        allWs.forEach(ws => {
          console.log(`    ${ws.workspaceId} (${ws.workspaceName}): ${ws._count.id} 条`);
        });
      }
    }

    console.log(`[LocalDB] 数据库总数据量:`);
    console.log(`  - Story 总数: ${totalStories}`);
    console.log(`  - Task 总数: ${totalTasks}`);

    // 构建查询条件
    const storyWhere: any = debugMode ? {} : {
      workspaceId: { in: workspaceIds },
    };

    // 时间范围过滤（非调试模式下生效）
    if (!debugMode) {
      if (createdBegin && createdEnd) {
        storyWhere.created = {
          gte: new Date(createdBegin),
          lte: new Date(createdEnd),
        };
      }

      if (completedBegin && completedEnd) {
        storyWhere.completed = {
          gte: new Date(completedBegin),
          lte: new Date(completedEnd),
        };
      }
    }

    // 状态过滤（非调试模式下生效，使用转换后的状态列表）
    if (!debugMode && resolvedStatuses.length > 0) {
      storyWhere.status = { in: resolvedStatuses };
    }

    // 查询 Stories
    const stories = await prisma.tapdStory.findMany({
      where: storyWhere,
      select: {
        id: true,
        name: true,
        description: true,
        status: true,
        priority: true,
        priorityLabel: true,
        owner: true,
        cc: true,
        creator: true,
        developer: true,
        created: true,
        modified: true,
        completed: true,
        begin: true,
        due: true,
        effort: true,
        effortCompleted: true,
        remain: true,
        exceed: true,
        size: true,
        businessValue: true,
        workspaceId: true,
        workspaceName: true,
        iterationId: true,
        iterationName: true,
        version: true,
        module: true,
        feature: true,
        testFocus: true,
        categoryId: true,
        releaseId: true,
        source: true,
        type: true,
        label: true,
        workitemTypeId: true,
        parentId: true,
        childrenId: true,
        ancestorId: true,
        isArchived: true,
        confidential: true,
        level: true,
        bugId: true,
        customFieldOne: true,
        customFieldTwo: true,
        customFieldThree: true,
        customFieldFour: true,
        customFieldFive: true,
        customFieldSix: true,
        customFieldSeven: true,
        customFieldEight: true,
        customField9: true,
        customField10: true,
        customField11: true,
        customField12: true,
        customField13: true,
        customField14: true,
        customField15: true,
        customField16: true,
        customField17: true,
        customField18: true,
        customField19: true,
        customField20: true,
        extraData: true,
        rawJson: true,  // 用于提取正确的自定义字段映射
        syncedAt: true,
      },
      orderBy: { created: 'desc' },
    });

    // 查询 Tasks（关联查询的项目）
    const taskWhere: any = debugMode ? {} : {
      workspaceId: { in: workspaceIds },
    };

    if (!debugMode) {
      if (completedBegin && completedEnd) {
        taskWhere.completed = {
          gte: new Date(completedBegin),
          lte: new Date(completedEnd),
        };
      }

      // 🎯 注意：Task 和 Story 使用不同的状态系统，不能用 Story 的状态过滤 Task
      // Task 状态如: planning, in_progress, done
      // Story 状态如: 新建, 开发中, 已发布
      // 所以这里不做状态过滤，只按项目和时间范围查询
    }

    const tasks = await prisma.tapdTask.findMany({
      where: taskWhere,
      select: {
        id: true,
        name: true,
        description: true,
        status: true,
        priority: true,
        priorityLabel: true,
        owner: true,
        cc: true,
        creator: true,
        created: true,
        modified: true,
        completed: true,
        begin: true,
        due: true,
        effort: true,
        effortCompleted: true,
        remain: true,
        exceed: true,
        progress: true,
        storyId: true,
        workspaceId: true,
        iterationId: true,
        releaseId: true,
        label: true,
        hasAttachment: true,
        customFieldOne: true,
        customFieldTwo: true,
        customFieldThree: true,
        customFieldFour: true,
        customFieldFive: true,
        customFieldSix: true,
        customFieldSeven: true,
        customFieldEight: true,
        customField9: true,
        customField10: true,
        extraData: true,
        syncedAt: true,
      },
      orderBy: { created: 'desc' },
    });

    // 获取自定义字段映射：按项目分析数据特征，自动识别各业务字段的实际存储位置
    const customFieldMapping = buildCustomFieldMapping(stories, workspaceIds);

    // 统计人员数量
    const personSet = new Set<string>();
    stories.forEach(s => { if (s.owner) personSet.add(s.owner); });
    tasks.forEach(t => { if (t.owner) personSet.add(t.owner); });

    console.log(`[LocalDB] 查询完成:`);
    console.log(`  - Stories: ${stories.length} 条`);
    console.log(`  - Tasks: ${tasks.length} 条`);
    console.log(`  - 人员数: ${personSet.size} 人`);

    // 如果查询结果为空，提供详细的诊断信息
    if (stories.length === 0 && tasks.length === 0) {
      console.warn(`[LocalDB] ⚠️ 查询结果为空！可能原因：`);
      console.warn(`  1. 数据库中无数据（总数: Story=${totalStories}, Task=${totalTasks}）`);
      console.warn(`  2. 项目ID不匹配: ${JSON.stringify(workspaceIds)}`);
      console.warn(`  3. 时间范围过滤: ${createdBegin || '无'} ~ ${createdEnd || '无'}`);
      console.warn(`  4. 状态过滤: ${statuses.join(', ') || '无'}`);
      
      // 返回警告信息
      return NextResponse.json({
        success: true,
        stories: [],
        tasks: [],
        customFieldMapping: {},
        statistics: {
          storyCount: 0,
          taskCount: 0,
          personCount: 0,
        },
        warning: totalStories === 0 && totalTasks === 0 
          ? '数据库中暂无数据，请先在"TAPD数据管理"页面执行数据同步'
          : `查询条件未匹配到数据。数据库中共有 ${totalStories} 个Story和${totalTasks}个Task，请检查项目ID、时间范围或状态筛选`,
      });
    }

    return NextResponse.json({
      success: true,
      stories,
      tasks,
      customFieldMapping,
      statistics: {
        storyCount: stories.length,
        taskCount: tasks.length,
        personCount: personSet.size,
      },
    });

  } catch (error) {
    console.error('[LocalDB] 查询失败:', error);
    const message = error instanceof Error ? error.message : '查询本地数据失败';
    
    return NextResponse.json({
      success: false,
      message,
      stories: [],
      tasks: [],
      customFieldMapping: {},
    }, { status: 500 });
  }
}
