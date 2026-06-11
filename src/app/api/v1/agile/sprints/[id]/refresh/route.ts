import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * 调用项目内置的 TAPD Skill Proxy
 * 自动使用系统配置的 TAPD 凭据（Basic Auth）
 */
async function callTapdSkill(
  service: string,
  action: string,
  workspaceIds: string[],
  params: Record<string, unknown> = {},
  fields?: string[],
) {
  const resp = await fetch('http://localhost:3000/api/v1/tapd/skill-proxy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ service, action, workspaceIds, params, fields }),
  });

  if (!resp.ok) {
    throw new Error(`Skill proxy HTTP ${resp.status}`);
  }

  const result = await resp.json();
  if (!result.success) {
    throw new Error(result.message || 'Skill proxy 调用失败');
  }

  const allData: any[] = [];
  for (const item of result.data || []) {
    const wsData = item.data?.data || [];
    if (Array.isArray(wsData)) allData.push(...wsData);
  }
  return allData;
}

function flattenTapdItem(item: any): any {
  const keys = Object.keys(item);
  if (keys.length === 1 && keys[0] !== 'id') return item[keys[0]];
  return item;
}

const STORY_FIELDS = [
  'id', 'name', 'description', 'status', 'priority', 'priority_label',
  'owner', 'cc', 'creator', 'developer', 'created', 'modified', 'completed',
  'begin', 'due', 'effort', 'effort_completed', 'remain', 'exceed',
  'workspace_id', 'iteration_id',
  'version', 'module', 'feature', 'test_focus', 'size', 'business_value',
  'category_id', 'release_id', 'source', 'type', 'label', 'workitem_type_id',
  'parent_id', 'children_id', 'ancestor_id', 'is_archived', 'confidential',
  'level', 'bug_id', 'templated_id', 'created_from',
  'custom_field_one', 'custom_field_two', 'custom_field_three', 'custom_field_four',
  'custom_field_five', 'custom_field_six', 'custom_field_seven', 'custom_field_eight',
  'custom_field_9', 'custom_field_10', 'custom_field_11', 'custom_field_12',
];

const ITERATION_FIELDS = [
  'id', 'name', 'description', 'status', 'creator', 'created', 'modified',
  'completed', 'startdate', 'enddate', 'locker', 'workitem_type_id',
  'plan_app_id', 'release_id', 'custom_field_1', 'custom_field_2', 'custom_field_3',
];

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: sprintId } = await params;
    const body = await request.json();
    const workspaceId = body.workspaceId;

    console.log(`[Refresh API] 开始刷新迭代数据。sprintId=${sprintId}, workspaceId=${workspaceId}`);

    if (!sprintId) {
      return NextResponse.json(
        { success: false, message: '缺少迭代ID' },
        { status: 400 },
      );
    }

    if (!workspaceId) {
      return NextResponse.json(
        { success: false, message: '缺少项目ID (workspaceId)' },
        { status: 400 },
      );
    }

    let totalFetched = 0;
    let totalUpdated = 0;
    let totalNew = 0;
    let page = 1;
    const pageSize = 200;
    let hasMore = true;

    while (hasMore) {
      try {
        const items = await callTapdSkill(
          'stories',
          'list',
          [workspaceId],
          {
            iteration_id: sprintId,
            with_v_status: '1',
            limit: pageSize,
            page,
            order: 'created desc',
          },
          STORY_FIELDS,
        );

        console.log(`[Refresh API] 第${page}页获取到 ${items.length} 条需求`);

        if (items.length === 0) {
          hasMore = false;
          break;
        }

        totalFetched += items.length;

        for (const rawItem of items) {
          const story = flattenTapdItem(rawItem);
          if (!story.id) continue;

          // ════════════════════════════════════════
          // 优先级解析（三层策略 - 与其他API保持一致）
          // ════════════════════════════════════════
          let priorityValue = String(story.priority_label || story.priority || '');

          try {
            const projectConfig = await prisma.tapdProjectConfig.findUnique({
              where: { workspaceId: workspaceId },
            });

            if (projectConfig?.priorityField) {
              const configuredField = projectConfig.priorityField;
              const fieldValue = story[configuredField];

              if (fieldValue !== undefined && fieldValue !== null && String(fieldValue).trim() !== '') {
                priorityValue = String(fieldValue).trim();
                console.log(`[Refresh] ✅ 使用项目配置字段 ${configuredField}: "${priorityValue}"`);
              }
            }
          } catch (configErr) {
            console.warn('[Refresh] 项目配置查询失败:', configErr);
          }

          const storyData = {
            tapdId: String(story.id),
            name: String(story.name || ''),
            description: String(story.description || ''),
            status: String(story.status || ''),
            priority: priorityValue,
            owner: String(story.owner || ''),
            categoryId: String(story.category_id || ''),
            iterationId: String(sprintId),
            iterationName: null as string | null,
            workspaceId: String(workspaceId),
            workspaceName: '',
            effort: parseFloat(String(story.effort)) || 0,
            effortCompleted: parseFloat(String(story.effort_completed)) || 0,
            remain: parseFloat(String(story.remain)) || 0,
            rawJson: story,
            syncedAt: new Date(),
          };

          const existing = await prisma.tapdStory.findUnique({
            where: { id: storyData.tapdId },
          });

          if (existing) {
            await prisma.tapdStory.update({
              where: { id: storyData.tapdId },
              data: storyData,
            });
            totalUpdated++;
          } else {
            await prisma.tapdStory.create({
              data: {
                id: storyData.tapdId,
                ...storyData,
              },
            });
            totalNew++;
          }
        }

        if (items.length < pageSize) {
          hasMore = false;
        }
        page++;
      } catch (error) {
        console.error(`[Refresh API] 第${page}页获取失败:`, error);
        hasMore = false;
      }
    }

    try {
      const iterItems = await callTapdSkill(
        'iterations',
        'list',
        [workspaceId],
        { id: sprintId, limit: 1 },
        ITERATION_FIELDS,
      );

      const iterations = iterItems.map(flattenTapdItem);
      if (iterations.length > 0) {
        const iter = iterations[0];
        const parseDateSafe = (val: unknown): Date | null => {
          if (!val) return null;
          const str = String(val).trim();
          if (str === '0000-00-00' || str === '0000-00-00 00:00:00') return null;
          const d = new Date(str);
          return isNaN(d.getTime()) ? null : d;
        };

        await prisma.tapdIteration.upsert({
          where: { id: sprintId },
          update: {
            name: String(iter.name || ''),
            startDate: parseDateSafe(iter.startdate),
            endDate: parseDateSafe(iter.enddate),
            status: String(iter.status || ''),
            rawJson: iter,
            syncedAt: new Date(),
          },
          create: {
            id: sprintId,
            name: String(iter.name || ''),
            workspaceId: String(workspaceId),
            startDate: parseDateSafe(iter.startdate) || new Date(),
            endDate: parseDateSafe(iter.enddate) || new Date(),
            status: String(iter.status || ''),
            created: new Date(),
            rawJson: iter,
            syncedAt: new Date(),
          },
        });

        await prisma.tapdStory.updateMany({
          where: {
            iterationId: sprintId,
            workspaceId: String(workspaceId),
          },
          data: {
            iterationName: String(iter.name || ''),
          },
        });
      }
    } catch (err) {
      console.warn('[Refresh API] 同步迭代信息失败（非致命）:', err);
    }

    console.log(
      `[Refresh API] 刷新完成。总计: ${totalFetched}, 新增: ${totalNew}, 更新: ${totalUpdated}`,
    );

    return NextResponse.json({
      success: true,
      data: {
        fetchedCount: totalFetched,
        updatedCount: totalUpdated,
        newCount: totalNew,
        message: `成功从 TAPD 同步 ${totalFetched} 条需求（新增 ${totalNew} 条，更新 ${totalUpdated} 条）`,
      },
    });
  } catch (error) {
    console.error('[Refresh API] 刷新失败:', error);

    const errorMessage = error instanceof Error ? error.message : '刷新TAPD数据失败';

    return NextResponse.json(
      {
        success: false,
        message: errorMessage,
        hint: '请检查系统设置中是否配置了 TAPD API 凭据（apiUser + apiPassword）',
      },
      { status: 500 },
    );
  }
}
