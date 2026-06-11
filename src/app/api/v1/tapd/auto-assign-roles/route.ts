import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/v1/tapd/auto-assign-roles
 * 从 Task 名称前缀关键词自动推断人员角色（参考 WorkBuddy TAPD MCP 方式）
 *
 * 核心逻辑：
 * 1. 查询项目的所有 Task 数据
 * 2. 从 Task.name 提取 【xxx】 前缀关键词
 * 3. 按 owner 聚合，统计每人最常见的角色前缀
 * 4. 返回 { ownerName: suggestedRole } 映射建议
 *
 * Query: workspaceId (必填), iterationId (可选，限定某迭代)
 */

// 角色前缀映射表（参考 WorkBuddy 的推断规则）
const ROLE_PREFIX_MAP: Array<{ patterns: RegExp[]; role: string; priority: number }> = [
  {
    patterns: [/【前端】/g, /^前端/g, /\[前端\]/g],
    role: '前端',
    priority: 1,
  },
  {
    patterns: [/【后端】/g, /^后端/g, /\[后端\]/g],
    role: '后端',
    priority: 1,
  },
  {
    patterns: [/【QA】/g, /^QA/g, /【测试】/g, /^测试/g, /\[测试\]/g, /【回归】/g],
    role: '测试',
    priority: 1,
  },
  {
    patterns: [/【Flutter】/g, /^Flutter/g, /【移动端】/g, /\[移动\]/g],
    role: '移动端',
    priority: 2,
  },
  {
    patterns: [/【Android】/g, /^Android/g, /安卓/g],
    role: '移动端',
    priority: 3,
  },
  {
    patterns: [/【iOS】/g, /^iOS/g, /苹果/g, /iPhone/gi],
    role: '移动端',
    priority: 3,
  },
  {
    patterns: [/【PO】/g, /^PO/g, /【产品】/g, /^产品/g, /【PM】/g, /产品经理/g],
    role: 'PO',
    priority: 1,
  },
  {
    patterns: [/【UED】/g, /^UED/g, /【UI】/g, /^UI/g, /设计师/g, /设计/g],
    role: 'UED',
    priority: 1,
  },
  {
    patterns: [/【PM】/g, /项目经理/g, /项目管理/g],
    role: 'PM',
    priority: 2,
  },
  {
    patterns: [/【运维】/g, /^运维/g, /部署/g, /发布/g, /DevOps/gi],
    role: '运维',
    priority: 1,
  },
];

function extractRoleFromTaskName(taskName: string): string | null {
  if (!taskName) return null;
  let bestMatch: { role: string; priority: number } | null = null;

  for (const entry of ROLE_PREFIX_MAP) {
    for (const pattern of entry.patterns) {
      if (pattern.test(taskName)) {
        pattern.lastIndex = 0;
        if (!bestMatch || entry.priority < bestMatch.priority) {
          bestMatch = { role: entry.role, priority: entry.priority };
        }
        break;
      }
    }
  }

  return bestMatch?.role ?? null;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const workspaceId = searchParams.get('workspaceId');
    const iterationId = searchParams.get('iterationId');

    if (!workspaceId) {
      return NextResponse.json(
        { success: false, message: '缺少 workspaceId 参数' },
        { status: 400 },
      );
    }

    // 策略1：优先查本地 tapd_task 表
    const where: Record<string, unknown> = { workspaceId, owner: { not: '' } };
    if (iterationId) where.iterationId = iterationId;

    let tasks = await prisma.tapdTask.findMany({
      where,
      select: { name: true, owner: true },
      take: 2000,
    });

    // 策略2：本地无数据时，直连 TAPD tasks API
    let source = 'local' as const;
    if (tasks.length === 0) {
      try {
        const config = await prisma.systemSetting.findUnique({
          where: { key: 'tapd_api_config' },
        });
        if (config?.value) {
          let tapdConfig: { apiUser?: string; apiPassword?: string };
          try {
            tapdConfig = JSON.parse(config.value);
          } catch {
            // skip
          }
          if (tapdConfig?.apiUser && tapdConfig?.apiPassword) {
            const credentials = Buffer.from(
              `${tapdConfig.apiUser.trim()}:${tapdConfig.apiPassword.trim()}`,
            ).toString('base64');

            let url = `https://api.tapd.cn/tasks?workspace_id=${workspaceId}&limit=500&fields=name,owner`;
            if (iterationId) url += `&iteration_id=${iterationId}`;

            const resp = await fetch(url, {
              headers: { Authorization: `Basic ${credentials}` },
              signal: AbortSignal.timeout(20000),
            });

            if (resp.ok) {
              const json = await resp.json();
              const rawList = json?.data;
              const list = Array.isArray(rawList)
                ? rawList
                : Array.isArray(rawList?.data)
                  ? rawList.data
                  : [];
              if (list.length > 0) {
                tasks = list
                  .filter((item: Record<string, unknown>) => item.owner && item.name)
                  .map((item: Record<string, unknown>) => ({
                    name: String(item.name),
                    owner: String(item.owner),
                  }));
                source = 'tapd';
              }
            }
          }
        }
      } catch (e) {
        console.warn('[AutoAssignRoles] TAPD 直连失败:', e);
      }
    }

    if (tasks.length === 0) {
      return NextResponse.json({
        success: true,
        data: { suggestions: [], totalTasks: 0, message: '暂无 Task 数据' },
      });
    }

    // 按 owner 聚合 + 提取角色
    const ownerRoleMap = new Map<string, Map<string, number>>();
    const ownerTaskCount = new Map<string, number>();

    for (const task of tasks) {
      if (!task.owner) continue;

      const owners = task.owner.split(/[;,、]/).map((s: string) => s.trim()).filter(Boolean);
      const role = extractRoleFromTaskName(task.name);

      for (const name of owners) {
        ownerTaskCount.set(name, (ownerTaskCount.get(name) || 0) + 1);

        if (role) {
          if (!ownerRoleMap.has(name)) ownerRoleMap.set(name, new Map());
          const roleCount = ownerRoleMap.get(name)!;
          roleCount.set(role, (roleCount.get(role) || 0) + 1);
        }
      }
    }

    // 取每人出现次数最多的角色作为建议
    const suggestions: Array<{
      memberName: string;
      suggestedRole: string;
      confidence: number;
      taskCount: number;
      matchedTaskCount: number;
      sampleTasks: string[];
    }> = [];

    for (const [name, roleCount] of ownerRoleMap) {
      let topRole = '';
      let topCount = 0;
      let totalMatched = 0;
      for (const [role, count] of roleCount) {
        totalMatched += count;
        if (count > topCount) {
          topCount = count;
          topRole = role;
        }
      }

      const taskCount = ownerTaskCount.get(name) || 0;
      suggestions.push({
        memberName: name,
        suggestedRole: topRole,
        confidence: Math.round((topCount / totalMatched) * 100),
        taskCount,
        matchedTaskCount: totalMatched,
        sampleTasks: [],
      });
    }

    suggestions.sort((a, b) => b.confidence - a.confidence || b.taskCount - a.taskCount);

    return NextResponse.json({
      success: true,
      data: {
        suggestions,
        totalTasks: tasks.length,
        totalOwners: ownerTaskCount.size,
        matchedOwners: suggestions.length,
        unmatchedOwners: ownerTaskCount.size - suggestions.length,
        source,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '自动角色推断失败';
    console.error('[AutoAssignRoles GET]', error);
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
