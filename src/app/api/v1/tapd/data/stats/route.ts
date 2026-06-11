import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/v1/tapd/data/stats - 获取数据概览统计
 */

// 🛠️ 辅助函数：解析逗号分隔的多选值为数组
function parseMultiValue(value: string | null): string[] | null {
  if (!value) return null;
  const values = value.split(',').map(v => v.trim()).filter(v => v);
  return values.length > 0 ? values : null;
}

// 🛠️ 辅助函数：构建 IN 查询条件
function addInCondition(
  where: Record<string, unknown>,
  field: string,
  value: string | null
) {
  if (!value) return;
  const values = parseMultiValue(value);
  if (values && values.length === 1) {
    // 单个值，使用等于
    (where as any)[field] = values[0];
  } else if (values && values.length > 1) {
    // 多个值，使用 IN 查询
    (where as any)[field] = { in: values };
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const workspaceId = searchParams.get('workspaceId');
    const status = searchParams.get('status');
    const iterationId = searchParams.get('iterationId');
    const owner = searchParams.get('owner');

    console.log('\n📊 [Stats API] 开始获取数据统计...');
    
    // ========== 🎯 新增：从工作流表加载状态映射（中文化） ==========
    console.log('[Stats API] 正在加载工作流状态映射...');
    
    const workflowStatusRecords = await prisma.tapdWorkflowStatus.findMany({
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

    // 构建多层映射表
    const statusKeyToChineseMap = new Map<string, string>();  // 英文 -> 中文
    const chineseToKeysMap = new Map<string, Set<string>>();   // 中文 -> 英文集合
    const knownChineseValues = new Set<string>();              // 已知的中文值
    
    // 🎯 临时存储：收集每个英文键的所有候选中文值（用于冲突解决）
    const keyCandidatesMap = new Map<string, string[]>();

    workflowStatusRecords.forEach(record => {
      // 正向映射：英文键 -> 中文值（🆕 改为收集所有候选值）
      if (!keyCandidatesMap.has(record.statusKey)) {
        keyCandidatesMap.set(record.statusKey, []);
      }
      keyCandidatesMap.get(record.statusKey)!.push(record.statusValue);
      
      // 反向映射：中文值 -> 英文键集合
      if (!chineseToKeysMap.has(record.statusValue)) {
        chineseToKeysMap.set(record.statusValue, new Set());
      }
      chineseToKeysMap.get(record.statusValue)!.add(record.statusKey);
      
      // 记录所有中文值
      knownChineseValues.add(record.statusValue);
    });
    
    // 🎯 标准状态映射表（用于解决冲突时作为基准）
    const standardStatusMapping: Record<string, string> = {
      'new': '新建',
      'planning': '规划中',
      'developing': '开发中',
      'testing': '测试中',
      'released': '已发布',
      'resolved': '已实现',
      'closed': '已关闭',
      'accepted': '已验收',
      'rejected': '已拒绝',
      'postponed': '需求暂停',
    };
    
    // 🛠️ 冲突解决：从多个候选值中选择最佳映射
    keyCandidatesMap.forEach((candidates, englishKey) => {
      let bestMatch = candidates[0]; // 默认使用第一个
      
      // 策略1：优先使用标准映射
      if (standardStatusMapping[englishKey] && candidates.includes(standardStatusMapping[englishKey])) {
        bestMatch = standardStatusMapping[englishKey];
        console.log(`[Stats API] 🔧 使用标准映射: "${englishKey}" → "${bestMatch}" (替代 "${candidates[0]}")`);
      }
      // 策略2：如果没有标准映射，选择最长的候选值（更完整）
      else if (candidates.length > 1) {
        bestMatch = candidates.reduce((longest, current) => 
          current.length > longest.length ? current : longest
        );
        console.log(`[Stats API] 🔧 使用最长匹配: "${englishKey}" → "${bestMatch}" (从 ${candidates.join(', ')})`);
      }
      
      statusKeyToChineseMap.set(englishKey, bestMatch);
    });

    console.log(`[Stats API] ✅ 加载 ${workflowStatusRecords.length} 条工作流配置`);
    console.log(`[Stats API] ✅ 构建 ${statusKeyToChineseMap.size} 个英文→中文映射`);
    console.log(`[Stats API] ✅ 发现 ${knownChineseValues.size} 个不同的中文状态值`);

    // 构建筛选条件 - 🛠️ 支持多选（IN查询）
    const storyWhere: Record<string, unknown> = {};
    addInCondition(storyWhere, 'workspaceId', workspaceId);
    
    // 🎯 中文状态精确匹配（与 Query API 逻辑一致）
    if (status && status !== 'null') {
      const chineseLabels = parseMultiValue(status);
      const hasChinese = chineseLabels.some(s => /[\u4e00-\u9fa5]/.test(s));
      
      if (hasChinese) {
        console.log(`[Stats API] 🎯 中文状态筛选（统计）: [${chineseLabels.join(', ')}]`);
        
        const targetProjectIds = workspaceId ? parseMultiValue(workspaceId) : null;
        const allOrConditions: any[] = [];
        
        for (const label of chineseLabels) {
          const workflowWhere: any = {
            system: 'story',
            isActive: true,
            statusValue: label,
          };
          if (targetProjectIds && targetProjectIds.length > 0) {
            workflowWhere.workspaceId = { in: targetProjectIds };
          }
          
          const mappings = await prisma.tapdWorkflowStatus.findMany({
            where: workflowWhere,
            select: { workspaceId: true, statusKey: true },
          });
          
          mappings.forEach(m => {
            allOrConditions.push({
              workspaceId: m.workspaceId,
              status: m.statusKey,
            });
          });
        }
        
        if (allOrConditions.length > 0) {
          (storyWhere as any).AND = [{ OR: allOrConditions }];
          console.log(`[Stats API] ✅ 统计精确匹配: ${allOrConditions.length} 个组合`);
        } else {
          (storyWhere as any).id = '__no_match__';
        }
      } else {
        addInCondition(storyWhere, 'status', status);
      }
    }
    
    addInCondition(storyWhere, 'iterationId', iterationId);
    addInCondition(storyWhere, 'owner', owner);

    // 🛠️ 为其他实体也构建支持IN查询的where条件
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const taskWhere: Record<string, unknown> = {};
    addInCondition(taskWhere, 'workspaceId', workspaceId);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const iterationWhere: Record<string, unknown> = {};
    addInCondition(iterationWhere, 'workspaceId', workspaceId);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const bugWhere: Record<string, unknown> = {};
    addInCondition(bugWhere, 'workspaceId', workspaceId);

    // 数据统计（根据筛选条件动态计算）
    const [
      storyCount,
      taskCount,
      iterationCount,
      bugCount,
      timesheetCount,
      effortStats,
      projectList,
      lastSync,
    ] = await Promise.all([
      prisma.tapdStory.count({ where: storyWhere }),
      prisma.tapdTask.count({ where: taskWhere }),
      prisma.tapdIteration.count({ where: iterationWhere }),
      prisma.tapdBug.count({ where: bugWhere }),
      prisma.tapdTimesheet.count(),
      // 工时统计：预估工时（effort）和 实际工时（effortCompleted）累加
      prisma.tapdStory.aggregate({
        _sum: {
          effort: true,
          effortCompleted: true,
        },
        where: storyWhere,
      }),
      // 获取项目列表（用于筛选下拉）
      prisma.tapdStory.findMany({
        where: {},
        select: {
          workspaceId: true,
          workspaceName: true,
        },
        distinct: ['workspaceId'],
      }),
      // 最后同步记录
      prisma.tapdSyncRecord.findFirst({
        orderBy: { startedAt: 'desc' },
      }),
    ]);

    // 项目数：取需求中不重复的 workspaceId 数量
    const workspaceCount = projectList.length;

    // 🛠️ 迭代列表也支持多项目筛选
    const iterationList = await prisma.tapdIteration.findMany({
      where: iterationWhere,
      select: {
        id: true,
        name: true,
        workspaceId: true,
      },
      distinct: ['id'],
      orderBy: { startDate: 'desc' },
    });

    // 获取处理人列表（用于筛选下拉）
    const ownerListRaw = await prisma.tapdStory.findMany({
      where: {},
      select: {
        owner: true,
      },
      distinct: ['owner'],
    });
    const ownerList = ownerListRaw.filter((o) => o.owner !== null && o.owner !== '');

    // 从数据库动态获取实际的状态值
    const statusListRaw = await prisma.tapdStory.findMany({
      select: {
        status: true,
      },
      distinct: ['status'],
    });
    const statusList = statusListRaw.filter((s) => s.status !== null && s.status !== '');

    console.log(`[Stats API] 📋 数据库中找到 ${statusList.length} 个不同的状态值`);

    // ========== ✅ 正确方案：从工作流表聚合中文状态 + 跨项目原始值 ==========
    
    // 1️⃣ 构建映射表：(workspaceId, statusKey) → statusValue（中文）
    const workflowMap = new Map<string, string>();
    workflowStatusRecords.forEach(r => {
      workflowMap.set(`${r.workspaceId}|${r.statusKey}`, r.statusValue);
    });
    
    // 2️⃣ 反向映射：中文 → 所有对应的原始值（跨项目聚合）
    const chineseToRawValues = new Map<string, Set<string>>();
    
    // 先用工作流表的映射
    workflowStatusRecords.forEach(r => {
      if (!chineseToRawValues.has(r.statusValue)) {
        chineseToRawValues.set(r.statusValue, new Set());
      }
      chineseToRawValues.get(r.statusValue)!.add(r.statusKey);
    });
    
    // 3️⃣ 对于没有工作流映射的原始值，直接使用
    statusList.forEach(s => {
      const raw = s.status!;
      let hasMapping = false;
      
      for (const [, values] of chineseToRawValues) {
        if (values.has(raw)) {
          hasMapping = true;
          break;
        }
      }
      
      if (!hasMapping) {
        if (!chineseToRawValues.has(raw)) {
          chineseToRawValues.set(raw, new Set());
        }
        chineseToRawValues.get(raw)!.add(raw);
      }
    });
    
    // 4️⃣ 生成最终列表
    const finalStatuses = Array.from(chineseToRawValues.entries())
      .filter(([label]) => label && label.trim() !== '')
      .map(([label, values]) => ({
        value: label,                    // 中文标签用于选择和显示
        label: label,                    // 下拉框显示中文
        allValues: Array.from(values),   // 所有对应的数据库原始值
      }))
      .sort((a, b) => a.label.localeCompare(b.label, 'zh-CN'));

    console.log(`[Stats API] ✅ 状态列表：${statusList.length}个原始值 → ${finalStatuses.length}个中文标签`);

    return NextResponse.json({
      success: true,
      data: {
        storyCount,
        taskCount,
        iterationCount,
        bugCount,
        timesheetCount,
        workspaceCount,
        // 工时统计
        estimatedEffort: Math.round((effortStats._sum.effort || 0) * 100) / 100, // 预估工时
        actualEffort: Math.round((effortStats._sum.effortCompleted || 0) * 100) / 100, // 实际工时
        lastSyncAt: lastSync?.finishedAt || lastSync?.startedAt,
        lastSyncStatus: lastSync?.status,
        // 筛选选项
        filters: {
          // 项目列表：确保都显示名称，名称为空时使用ID
          projects: projectList.map((p) => ({
            value: p.workspaceId,
            label: p.workspaceName && p.workspaceName.trim() !== '' 
              ? p.workspaceName 
              : `项目 ${p.workspaceId}`,
          })),
          iterations: iterationList.map((i) => ({
            value: i.id,
            label: i.name || i.id,
            workspaceId: i.workspaceId,
          })),
          owners: ownerList
            .map((o) => o.owner)
            .filter(Boolean)
            .map((o) => ({ value: o!, label: o! })),
          
          // ========== 🎯 状态列表：纯中文状态名称（已去重） ==========
          statuses: finalStatuses,
          
          // 额外信息：工作流映射关系（供前端使用）
          workflowMapping: {
            keyToChinese: Object.fromEntries(statusKeyToChineseMap),
            knownChineseValues: Array.from(knownChineseValues),
            totalMappings: statusKeyToChineseMap.size,
            hasWorkflowConfig: workflowStatusRecords.length > 0,
          },
        },
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '获取数据统计失败';
    console.error('GET /api/v1/tapd/data/stats error:', error);
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

/**
 * TAPD 状态值到中文的智能映射
 * 
 * 支持多种格式：
 * - 英文状态：new, developing, testing, closed 等
 * - TAPD 状态码：status_1 ~ status_9
 * - 中文状态：新建, 开发中, 测试中, 待发布 等
 * - 自定义状态：待测试, T测试完成 等
 */
function getStatusLabel(status: string): string {
  if (!status) return '未知';
  
  const statusLower = status.toLowerCase().trim();
  
  // ===== 完整状态映射表 =====
  const statusMap: Record<string, string> = {
    // ---- 新建阶段 ----
    'new': '新建',
    'status_1': '新建',
    '新建': '新建',
    
    // ---- 规划/计划阶段 ----
    'planning': '规划中',
    'planned': '计划中',
    'status_2': '规划中',
    '规划中': '规划中',
    '计划中': '计划中',
    
    // ---- 开发阶段 ----
    'developing': '开发中',
    'in_progress': '进行中',
    'status_3': '开发中',
    '开发中': '开发中',
    '进行中': '进行中',
    
    // ---- 测试阶段（拆分为多个子状态）----
    'testing': '测试中',
    'status_4': '测试中',
    'test_ready': '待测试',
    'ready_for_test': '待测试',
    '待测试': '待测试',
    'test_in_progress': '测试中',
    '测试中': '测试中',
    't_test_complete': 'T测试完成',
    't_test_completed': 'T测试完成',
    'test_completed': '测试完成',
    'test_passed': '测试通过',
    'qa_testing': 'QA测试中',
    'uat_testing': 'UAT测试中',
    
    // ---- 验收阶段 ----
    'accepted': '已验收',
    'verified': '已验证',
    'status_5': '已验收',
    '已验收': '已验收',
    '已验证': '已验证',
    
    // ---- 发布阶段（修正：closed → 待发布）----
    'closed': '待发布',           // ← 关键修正！
    'status_6': '待发布',         // ← 关键修正！
    'ready_to_release': '待发布',
    '待发布': '待发布',
    'release_pending': '待发布',
    'pending_release': '待发布',
    
    // ---- 已完成/已实现 ----
    'resolved': '已实现',
    'done': '已完成',
    'status_9': '已实现',
    'completed': '已完成',
    '已实现': '已实现',
    '已完成': '已完成',
    'finished': '已完成',
    
    // ---- 重新打开/返工 ----
    'reopened': '重新打开',
    'status_7': '重新打开',
    'rework': '返工中',
    '重新打开': '重新打开',
    '返工中': '返工中',
    
    // ---- 暂停/挂起 ----
    'on_hold': '暂停',
    'status_8': '挂起',
    'paused': '暂停',
    'suspended': '挂起',
    '暂停': '暂停',
    '挂起': '挂起',
    
    // ---- 其他状态 ----
    'pending': '待处理',
    'active': '活跃',
    'inactive': '非活跃',
    'archived': '已归档',
    'deleted': '已删除',
    'cancelled': '已取消',
    'rejected': '已拒绝',
    'blocked': '阻塞',
    'waiting': '等待中',
    'reviewing': '评审中',
    'designing': '设计中',
    'analyzing': '分析中',
  };
  
  // 1. 精确匹配（包括大小写不敏感）
  if (statusMap[statusLower]) {
    return statusMap[statusLower];
  }
  
  // 2. 精确匹配原始值（保留大小写）
  if (statusMap[status]) {
    return statusMap[status];
  }
  
  // 3. 模糊匹配（处理带空格、下划线、连字符的变体）
  const normalizedStatus = statusLower.replace(/[\s_-]/g, '');
  for (const [key, value] of Object.entries(statusMap)) {
    if (key.replace(/[\s_-]/g, '') === normalizedStatus) {
      return value;
    }
  }
  
  // 4. 如果本身就是中文且不在映射表中，直接返回（可能是自定义状态）
  if (/[\u4e00-\u9fa5]/.test(status)) {
    return status;  // 中文状态直接返回
  }
  
  // 5. 尝试智能解析 TAPD 状态码（status_N 格式）
  const tapdStatusMatch = status.match(/^status_(\d+)$/);
  if (tapdStatusMatch) {
    const code = parseInt(tapdStatusMatch[1], 10);
    const tapdCodeMap: Record<number, string> = {
      1: '新建',
      2: '规划中',
      3: '开发中',
      4: '测试中',
      5: '已验收',
      6: '待发布',     // ← 修正！
      7: '重新打开',
      8: '挂起',
      9: '已实现',
    };
    return tapdCodeMap[code] || status;
  }
  
  // 6. 最终回退：返回原始值（可能是未知的自定义状态）
  return status;
}
