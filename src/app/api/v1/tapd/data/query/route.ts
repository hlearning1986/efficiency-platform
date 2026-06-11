import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/v1/tapd/data/query - 查询落库的 TAPD 数据
 */

// 🎯 TAPD 状态值到中文的智能映射（与 stats API 保持一致）
function getStatusLabel(status: string): string {
  if (!status) return '未知';
  
  const statusLower = status.toLowerCase().trim();
  
  const statusMap: Record<string, string> = {
    // ---- 新建阶段 ----
    'new': '新建',
    'planning': '规划中',
    '待研发': '待研发',
    
    // ---- 开发阶段 ----
    'developing': '开发中',
    'developed': '开发完成',
    'in_progress': '进行中',
    
    // ---- 测试阶段 ----
    'testing': '测试中',
    'tested': '测试完成',
    'for_test': '待测试',
    't测试完成': 'T测试完成',
    
    // ---- 发布阶段 ----
    'released': '已发布',
    'resolved': '已实现',
    'closed': '已关闭',
    'accepted': '已验收',
    'verified': '已验证',
    
    // ---- 其他状态 ----
    'rejected': '已拒绝',
    'reopened': '重新打开',
    'postponed': '需求暂停',
    '需求暂停': '需求暂停',
    '待评审': '待评审',
    '待PRE': '待PRE',
    '前端联调中': '前端联调中',
    '新': '新建',
  };
  
  return statusMap[statusLower] || statusMap[status] || status;
}

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
    (where as any)[field] = values[0];
  } else if (values && values.length > 1) {
    (where as any)[field] = { in: values };
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type') || 'story';
    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = parseInt(searchParams.get('pageSize') || '20', 10);
    const workspaceId = searchParams.get('workspaceId');
    const status = searchParams.get('status');
    const iterationId = searchParams.get('iterationId');
    const owner = searchParams.get('owner');
    const createdStart = searchParams.get('createdStart');
    const createdEnd = searchParams.get('createdEnd');
    const completedStart = searchParams.get('completedStart');
    const completedEnd = searchParams.get('completedEnd');
    const searchKeyword = searchParams.get('search');

    const skip = (page - 1) * pageSize;
    const take = pageSize;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let data: any[] = [];
    let total = 0;

    switch (type) {
      case 'story': {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const where: Record<string, unknown> = {};
        
        addInCondition(where, 'workspaceId', workspaceId);
        addInCondition(where, 'iterationId', iterationId);
        addInCondition(where, 'owner', owner);
        
        // 🎯 核心修复：中文状态精确匹配（支持多选）
        if (status && status !== 'null') {
          const chineseLabels = parseMultiValue(status);
          const hasChinese = chineseLabels.some(s => /[\u4e00-\u9fa5]/.test(s));
          
          if (hasChinese) {
            console.log(`[Query API] 🎯 中文状态多选筛选: [${chineseLabels.join(', ')}]`);
            
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
              
              console.log(`[Query API]   "${label}" → ${mappings.length} 个映射`);
            }
            
            if (allOrConditions.length > 0) {
              (where as any).AND = [{ OR: allOrConditions }];
              console.log(`[Query API] ✅ 精确匹配: 共 ${allOrConditions.length} 个组合`);
            } else {
              console.log(`[Query API] ⚠️ 工作流表无映射，返回空结果`);
              (where as any).id = '__no_match__';
            }
          } else {
            addInCondition(where, 'status', status);
          }
        }
        
        if (searchKeyword) {
          (where as any).OR = [
            { name: { contains: searchKeyword, mode: 'insensitive' } },
            { id: { contains: searchKeyword, mode: 'insensitive' } },
          ];
        }
        
        if (createdStart || createdEnd) {
          (where as any).created = {};
          if (createdStart) (where as any).created.gte = new Date(createdStart);
          if (createdEnd) (where as any).created.lte = new Date(createdEnd + 'T23:59:59.999Z');
        }
        
        if (completedStart || completedEnd) {
          (where as any).completed = {};
          if (completedStart) (where as any).completed.gte = new Date(completedStart);
          if (completedEnd) (where as any).completed.lte = new Date(completedEnd + 'T23:59:59.999Z');
        }

        [data, total] = await Promise.all([
          prisma.tapdStory.findMany({
            where,
            skip,
            take,
            orderBy: { created: 'desc' },
          }),
          prisma.tapdStory.count({ where }),
        ]);
        
        // 补充缺失的迭代名称：如果 iterationName 为空但有 iterationId，则从迭代表查找
        if (data.length > 0) {
          const storiesNeedingIterationName = data.filter(
            (s: Record<string, unknown>) => 
              s.iterationId && (!s.iterationName || s.iterationName === '')
          );
          
          if (storiesNeedingIterationName.length > 0) {
            const iterationIds = [...new Set(
              storiesNeedingIterationName.map((s: Record<string, unknown>) => String(s.iterationId))
            )];
            
            const iterations = await prisma.tapdIteration.findMany({
              where: {
                id: { in: iterationIds },
              },
              select: {
                id: true,
                name: true,
              },
            });
            
            const iterationMap = new Map(iterations.map((i) => [i.id, i.name]));
            
            data = data.map((story: Record<string, unknown>) => {
              if (!story.iterationName && story.iterationId && iterationMap.has(String(story.iterationId))) {
                return {
                  ...story,
                  iterationName: iterationMap.get(String(story.iterationId)),
                };
              }
              return story;
            });
          }
          
          // 🔄 动态转换：根据每条记录的项目ID，将原始状态转成中文显示
          if (data.length > 0) {
            const projectIds = [...new Set(data.map((d: any) => d.workspaceId).filter(Boolean))];
            const statusValues = [...new Set(data.map((d: any) => d.status).filter(Boolean))];

            if (projectIds.length > 0 && statusValues.length > 0) {
              const mappings = await prisma.tapdWorkflowStatus.findMany({
                where: {
                  system: 'story',
                  isActive: true,
                  workspaceId: { in: projectIds },
                  statusKey: { in: statusValues },
                },
                select: { workspaceId: true, statusKey: true, statusValue: true },
              });

              const map = new Map<string, string>();
              mappings.forEach(m => map.set(`${m.workspaceId}|${m.statusKey}`, m.statusValue));

              data = data.map((story: any) => {
                const key = `${story.workspaceId}|${story.status}`;
                const chinese = map.get(key);
                return chinese && chinese !== story.status
                  ? { ...story, status: chinese }
                  : story;
              });
            }
          }
        }
        break;
      }

      case 'task': {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const where: Record<string, unknown> = {};
        // 🛠️ 支持多项目：workspaceId 也支持 IN 查询
        addInCondition(where, 'workspaceId', workspaceId);
        // 🎯 使用转换后的状态值（支持中文输入）
        addInCondition(where, 'status', resolvedStatus);
        addInCondition(where, 'owner', owner);
        if (searchKeyword) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (where as any).OR = [
            { name: { contains: searchKeyword, mode: 'insensitive' } },
            { id: { contains: searchKeyword, mode: 'insensitive' } },
          ];
        }
        
        if (createdStart || createdEnd) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (where as any).created = {};
          if (createdStart) (where as any).created.gte = new Date(createdStart);
          if (createdEnd) (where as any).created.lte = new Date(createdEnd + 'T23:59:59.999Z');
        }

        // 🛠️ 先获取基础Task数据（不使用include，因为schema缺少relation定义）
        const rawTasks = await prisma.tapdTask.findMany({
          where,
          skip,
          take,
          orderBy: { created: 'desc' },
        });

        // 🛠️ 手动关联查询：提取所有storyId和workspaceId
        const storyIds = [...new Set(rawTasks.map(t => t.storyId).filter(Boolean))] as string[];
        const workspaceIds = [...new Set(rawTasks.map(t => t.workspaceId).filter(Boolean))] as string[];

        // 批量查询Story和Workspace
        const [storiesMap, workspacesMap] = await Promise.all([
          storyIds.length > 0
            ? prisma.tapdStory.findMany({
                where: { id: { in: storyIds } },
                select: { id: true, name: true, workspaceId: true },
              }).then(items => new Map(items.map(s => [s.id, s])))
            : Promise.resolve(new Map()),
          workspaceIds.length > 0
            ? prisma.tapdWorkspace.findMany({
                where: { id: { in: workspaceIds } },
                select: { id: true, name: true },
              }).then(items => new Map(items.map(w => [w.id, w])))
            : Promise.resolve(new Map()),
        ]);

        // 合并关联数据到Task结果中
        data = rawTasks.map(task => ({
          ...task,
          story: task.storyId ? (storiesMap.get(task.storyId) || null) : null,
          workspace: workspacesMap.get(task.workspaceId) || null,
        }));

        total = await prisma.tapdTask.count({ where });
        break;
      }

      case 'iteration': {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const where: Record<string, unknown> = {};
        // 🛠️ 支持多项目：workspaceId 也支持 IN 查询
        addInCondition(where, 'workspaceId', workspaceId);
        // 🛠️ 支持多选：使用 IN 查询
        addInCondition(where, 'status', status);

        [data, total] = await Promise.all([
          prisma.tapdIteration.findMany({
            where,
            skip,
            take,
            orderBy: { startDate: 'desc' },
          }),
          prisma.tapdIteration.count({ where }),
        ]);
        break;
      }

      case 'bug': {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const where: Record<string, unknown> = {};
        // 🛠️ 支持多项目：workspaceId 也支持 IN 查询
        addInCondition(where, 'workspaceId', workspaceId);
        // 🛠️ 支持多选：使用 IN 查询
        addInCondition(where, 'status', status);
        addInCondition(where, 'currentOwner', owner);
        if (search) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (where as any).OR = [
            { title: { contains: search, mode: 'insensitive' } },
            { id: { contains: search, mode: 'insensitive' } },
          ];
        }
        
        if (createdStart || createdEnd) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (where as any).created = {};
          if (createdStart) (where as any).created.gte = new Date(createdStart);
          if (createdEnd) (where as any).created.lte = new Date(createdEnd + 'T23:59:59.999Z');
        }

        [data, total] = await Promise.all([
          prisma.tapdBug.findMany({
            where,
            skip,
            take,
            orderBy: { created: 'desc' },
          }),
          prisma.tapdBug.count({ where }),
        ]);
        break;
      }

      case 'timesheet': {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const where: Record<string, unknown> = {};
        // 🛠️ 支持多项目：workspaceId 也支持 IN 查询
        addInCondition(where, 'workspaceId', workspaceId);
        // 🛠️ 支持多选：使用 IN 查询
        addInCondition(where, 'owner', owner);

        [data, total] = await Promise.all([
          prisma.tapdTimesheet.findMany({
            where,
            skip,
            take,
            orderBy: { spentdate: 'desc' },
          }),
          prisma.tapdTimesheet.count({ where }),
        ]);
        break;
      }

      default:
        return NextResponse.json({ success: false, message: '不支持的数据类型' }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      data,
      total,
      page,
      pageSize,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '查询数据失败';
    console.error('GET /api/v1/tapd/data/query error:', error);
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
