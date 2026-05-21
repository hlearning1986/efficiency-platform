import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@/generated/prisma/client';

interface DeliveryQueryRequest {
  workspaceIds: string[];
  createdBegin?: string;
  createdEnd?: string;
  completedBegin?: string;
  completedEnd?: string;
  status?: string[];
}

interface TeamConfig {
  id: string;
  name: string;
  tapdProjectIds: string[];
}

// TAPD 状态中文到英文映射
const STATUS_MAP: Record<string, string> = {
  // 已发布/已实现 → resolved
  '已发布': 'resolved',
  '已实现': 'resolved',
  // 已关闭 → closed
  '已关闭': 'closed',
  // 开发中 → developing
  '开发中': 'developing',
  // 规划中 → planning
  '规划中': 'planning',
  // 测试中 → testing
  '测试中': 'testing',
  // 已拒绝 → rejected
  '已拒绝': 'rejected',
  // 设计中 → designing
  '设计中': 'designing',
};

// 将中文状态映射为英文状态
function mapStatusToTapd(chineseStatuses: string[]): string[] {
  const mapped: string[] = [];
  for (const s of chineseStatuses) {
    if (STATUS_MAP[s]) {
      mapped.push(STATUS_MAP[s]);
    } else {
      // 未知状态，尝试直接使用
      mapped.push(s);
    }
  }
  return mapped;
}

/**
 * POST /api/v1/dashboard/delivery
 * 获取需求交付大盘数据（从本地数据库查询，不再实时调用 TAPD API）
 */
export async function POST(req: NextRequest) {
  try {
    const body: DeliveryQueryRequest = await req.json();
    const {
      workspaceIds,
      createdBegin,
      createdEnd,
      completedBegin,
      completedEnd,
      status,
    } = body;

    if (!workspaceIds?.length) {
      return NextResponse.json(
        { success: false, message: '缺少必要参数' },
        { status: 400 },
      );
    }

    // 1. 获取团队配置
    const teamConfigs = await prisma.teamConfig.findMany();
    const teams: TeamConfig[] = teamConfigs.map((t: { id: string; name: string; tapdProjectIds: string }) => ({
      id: t.id,
      name: t.name,
      tapdProjectIds: JSON.parse(t.tapdProjectIds) as string[],
    }));

    // 2. 从本地数据库查询需求数据（毫秒级响应）
    const where: Prisma.TapdStoryWhereInput = {
      workspaceId: { in: workspaceIds },
    };

    // 创建时间范围
    if (createdBegin || createdEnd) {
      where.created = {};
      if (createdBegin) (where.created as Prisma.DateTimeNullableFilter).gte = new Date(createdBegin);
      if (createdEnd) (where.created as Prisma.DateTimeNullableFilter).lte = new Date(createdEnd);
    }

    // 状态筛选（支持中文状态，自动映射为 TAPD 英文状态）
    if (status?.length) {
      const mappedStatus = mapStatusToTapd(status);
      if (mappedStatus.length > 0) {
        where.status = { in: mappedStatus };
      }
    }

    const allStories = await prisma.tapdStory.findMany({
      where,
      orderBy: { created: 'desc' },
    });

    // 完成时间范围筛选（内存过滤）
    let filteredStories = allStories;
    if (completedBegin && completedEnd) {
      const beginTs = new Date(completedBegin).getTime();
      const endTs = new Date(completedEnd).getTime();
      filteredStories = allStories.filter((story: { completed: Date | null }) => {
        if (!story.completed) return false;
        const ts = story.completed.getTime();
        return ts >= beginTs && ts <= endTs;
      });
    }

    // 3. 获取项目名称映射（从本地 tapd_workspace 表）
    const workspaces = await prisma.tapdWorkspace.findMany({
      where: { id: { in: workspaceIds } },
    });
    const projectNameMap = new Map<string, string>();
    for (const ws of workspaces) {
      projectNameMap.set(ws.id, ws.name);
    }

    // 4. 获取迭代名称映射（从本地 tapd_iteration 表）
    const iterations = await prisma.tapdIteration.findMany({
      where: { workspaceId: { in: workspaceIds } },
    });
    const iterationNameMap = new Map<string, string>();
    for (const iter of iterations) {
      iterationNameMap.set(iter.id, iter.name);
    }

    // 5. 按团队聚合数据
    const teamStats: Record<string, { name: string; count: number; stories: typeof filteredStories }> = {};
    for (const team of teams) {
      teamStats[team.id] = { name: team.name, count: 0, stories: [] };
    }

    for (const story of filteredStories) {
      for (const team of teams) {
        if (team.tapdProjectIds.includes(story.workspaceId)) {
          teamStats[team.id].count++;
          teamStats[team.id].stories.push(story);
          break;
        }
      }
    }

    // 6. 计算子团队统计
    const subTeamStats: Record<string, { name: string; projectId: string; count: number }[]> = {};
    for (const team of teams) {
      const projectStats: Record<string, number> = {};
      for (const story of teamStats[team.id].stories) {
        projectStats[story.workspaceId] = (projectStats[story.workspaceId] || 0) + 1;
      }
      subTeamStats[team.id] = Object.entries(projectStats).map(([projectId, count]) => ({
        name: projectNameMap.get(projectId) || projectId,
        projectId,
        count,
      }));
    }

    // 7. 计算交付周期数据
    const cycleData = calculateCycleData(filteredStories, teams, teamStats);

    // 8. 汇总 KPI
    const totalStories = filteredStories.length;
    const uniqueOwners = new Set(filteredStories.map((s) => s.owner).filter(Boolean)).size;
    const avgPerPerson = uniqueOwners > 0 ? Number((totalStories / uniqueOwners).toFixed(1)) : 0;

    // 9. 组装响应数据
    const teamDeliveryData = Object.values(teamStats)
      .filter((t) => t.count > 0)
      .map((t) => ({
        name: t.name,
        value: t.count,
        cycle: cycleData.teamCycles[t.name]?.avgCycle || 0,
        devCycle: cycleData.teamCycles[t.name]?.avgDevCycle || 0,
      }));

    const subTeamDeliveryData: Record<string, { name: string; value: number }[]> = {};
    for (const teamId of Object.keys(subTeamStats)) {
      const teamName = teamStats[teamId]?.name || teamId;
      subTeamDeliveryData[teamName] = subTeamStats[teamId].map(s => ({ name: s.name, value: s.count }));
    }

    // 10. 组装原始需求数据
    const storiesData = filteredStories.map(story => ({
      id: story.id,
      name: story.name,
      status: story.status,
      owner: story.owner,
      creator: story.creator,
      created: story.created?.toISOString() || null,
      completed: story.completed?.toISOString() || null,
      workspace_id: story.workspaceId,
      workspace_name: story.workspaceName || projectNameMap.get(story.workspaceId) || story.workspaceId,
      iteration_id: story.iterationId,
      iteration_name: story.iterationName || iterationNameMap.get(story.iterationId || '') || '',
      effort: story.effort,
      effort_completed: story.effortCompleted,
      custom_field_11: story.customField11,
      custom_field_13: story.customField13,
    }));

    return NextResponse.json({
      success: true,
      data: {
        totalStories,
        projectCount: workspaceIds.length,
        personCount: uniqueOwners,
        avgPerPerson,
        avgCycle: cycleData.avgCycle,
        avgDevCycle: cycleData.avgDevCycle,
        teamDelivery: teamDeliveryData,
        subTeamDelivery: subTeamDeliveryData,
        teamCycles: cycleData.teamCycles,
        stories: storiesData,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '未知错误';
    return NextResponse.json(
      { success: false, message: `请求异常: ${message}` },
      { status: 500 },
    );
  }
}

// 计算交付周期数据
function calculateCycleData(
  stories: { created: Date | null; completed: Date | null; workspaceId: string }[],
  teams: TeamConfig[],
  teamStats: Record<string, { stories: { created: Date | null; completed: Date | null }[] }>,
): {
  avgCycle: number;
  avgDevCycle: number;
  teamCycles: Record<string, { avgCycle: number; avgDevCycle: number }>;
} {
  let totalCycle = 0;
  let validCycleCount = 0;

  for (const story of stories) {
    if (story.created && story.completed) {
      const days = (story.completed.getTime() - story.created.getTime()) / (1000 * 60 * 60 * 24);
      if (days > 0) {
        totalCycle += days;
        validCycleCount++;
      }
    }
  }

  const avgCycle = validCycleCount > 0 ? Number((totalCycle / validCycleCount).toFixed(1)) : 0;
  const avgDevCycle = Number((avgCycle * 0.35).toFixed(1));

  const teamCycles: Record<string, { avgCycle: number; avgDevCycle: number }> = {};

  for (const team of teams) {
    const teamStories = teamStats[team.id]?.stories || [];
    let teamTotalCycle = 0;
    let teamValidCount = 0;

    for (const story of teamStories) {
      if (story.created && story.completed) {
        const days = (story.completed.getTime() - story.created.getTime()) / (1000 * 60 * 60 * 24);
        if (days > 0) {
          teamTotalCycle += days;
          teamValidCount++;
        }
      }
    }

    const teamAvgCycle = teamValidCount > 0 ? Number((teamTotalCycle / teamValidCount).toFixed(1)) : 0;
    teamCycles[team.name] = {
      avgCycle: teamAvgCycle,
      avgDevCycle: Number((teamAvgCycle * 0.35).toFixed(1)),
    };
  }

  return { avgCycle, avgDevCycle, teamCycles };
}
