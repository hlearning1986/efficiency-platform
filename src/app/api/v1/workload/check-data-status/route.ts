/**
 * GET /api/v1/workload/check-data-status
 * 检查TAPD数据同步状态
 * 用于诊断为什么人力负荷页面没有数据
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const status = {
      // 1. 团队配置
      teamConfigs: {
        count: 0,
        items: [] as Array<{ id: string; name: string; projectIds: string[] }>,
      },

      // 2. TAPD工作区（本地数据库）
      workspaces: {
        count: 0,
        items: [] as Array<{ id: string; name: string }>,
      },

      // 3. 需求数据（Stories）
      stories: {
        count: 0,
        byWorkspace: {} as Record<string, number>,
        sampleItems: [] as Array<{ id: string; name: string; workspaceId: string; owner: string | null }>,
      },

      // 4. 任务数据（Tasks）
      tasks: {
        count: 0,
        byWorkspace: {} as Record<string, number>,
        sampleItems: [] as Array<{ id: string; name: string; workspaceId: string; owner: string | null }>,
      },

      // 5. 系统配置
      tapdConfigured: false,
    };

    // ---- 1. 获取团队配置 ----
    const teamConfigs = await prisma.teamConfig.findMany({
      select: { id: true, name: true, tapdProjectIds: true },
    });

    status.teamConfigs.count = teamConfigs.length;
    status.teamConfigs.items = teamConfigs.map((tc) => ({
      id: tc.id,
      name: tc.name,
      projectIds: JSON.parse(tc.tapdProjectIds || '[]'),
    }));

    // 收集所有workspace ID
    const allWorkspaceIds = new Set<string>();
    for (const tc of teamConfigs) {
      const pids = JSON.parse(tc.tapdProjectIds || '[]') as string[];
      pids.forEach((pid) => allWorkspaceIds.add(pid));
    }

    // ---- 2. 获取工作区信息 ----
    const workspaces = await prisma.tapdWorkspace.findMany({
      where: { id: { in: [...allWorkspaceIds] } },
      select: { id: true, name: true },
    });

    status.workspaces.count = workspaces.length;
    status.workspaces.items = workspaces;

    // ---- 3. 获取需求数据 ----
    const stories = await prisma.tapdStory.findMany({
      where: {
        workspaceId: { in: [...allWorkspaceIds] },
      },
      select: { id: true, name: true, workspaceId: true, owner: true },
      take: 10, // 只取前10条作为样本
    });

    status.stories.count = await prisma.tapdStory.count({
      where: { workspaceId: { in: [...allWorkspaceIds] } },
    });

    // 按工作区分组统计
    const storyCountByWs = await prisma.tapdStory.groupBy({
      by: ['workspaceId'],
      where: { workspaceId: { in: [...allWorkspaceIds] } },
      _count: { id: true },
    });
    storyCountByWs.forEach((item) => {
      status.stories.byWorkspace[item.workspaceId] = item._count.id;
    });

    status.stories.sampleItems = stories.slice(0, 5);

    // ---- 4. 获取任务数据 ----
    const tasks = await prisma.tapdTask.findMany({
      where: {
        workspaceId: { in: [...allWorkspaceIds] } as any,
      },
      select: { id: true, name: true, workspaceId: true, owner: true },
      take: 10,
    });

    status.tasks.count = await prisma.tapdTask.count({
      where: { workspaceId: { in: [...allWorkspaceIds] } } as any,
    });

    // 按工作区分组统计
    const taskCountByWs = await prisma.tapdTask.groupBy({
      by: ['workspaceId'],
      where: { workspaceId: { in: [...allWorkspaceIds] } } as any,
      _count: { id: true },
    });
    taskCountByWs.forEach((item) => {
      status.tasks.byWorkspace[item.workspaceId] = item._count.id;
    });

    status.tasks.sampleItems = tasks.slice(0, 5);

    // ---- 5. 检查TAPD配置 ----
    try {
      const tapdConfig = await prisma.systemSetting.findUnique({
        where: { key: 'tapd_api_config' },
      });
      if (tapdConfig?.value) {
        const config = JSON.parse(tapdConfig.value);
        status.tapdConfigured = !!(config.apiUser && config.apiPassword && config.apiUser !== 'your_api_user');
      }
    } catch {
      status.tapdConfigured = false;
    }

    // ---- 6. 诊断结果 ----
    let diagnosis = '';
    let suggestion = '';

    if (status.teamConfigs.count === 0) {
      diagnosis = '❌ 没有团队配置';
      suggestion = '请在"系统设置-团队配置"中创建团队';
    } else if (!status.tapdConfigured) {
      diagnosis = '⚠️ TAPD API未配置';
      suggestion = '请在系统设置中配置TAPD API凭据，然后执行数据同步';
    } else if (status.workspaces.count === 0) {
      diagnosis = '⚠️ 本地数据库没有工作区数据';
      suggestion = `团队配置引用了 ${allWorkspaceIds.size} 个工作区ID，但本地数据库中未找到。需要先从TAPD同步工作区和任务数据`;
    } else if (status.stories.count === 0 && status.tasks.count === 0) {
      diagnosis = '⚠️ 没有任务数据';
      suggestion = `已找到 ${status.workspaces.count} 个工作区，但没有需求/任务数据。请执行TAPD数据同步`;
    } else {
      diagnosis = '✅ 数据正常';
      suggestion = `共 ${status.teamConfigs.count} 个团队、${status.workspaces.count} 个工作区、${status.stories.count} 条需求、${status.tasks.count} 个任务`;
    }

    return NextResponse.json({
      success: true,
      data: {
        ...status,
        allWorkspaceIds: [...allWorkspaceIds],
        diagnosis,
        suggestion,
      },
    });
  } catch (error) {
    console.error('[check-data-status] Error:', error);
    const message = error instanceof Error ? error.message : '未知错误';
    return NextResponse.json(
      { success: false, message: `检查失败: ${message}` },
      { status: 500 }
    );
  }
}
