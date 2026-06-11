/**
 * GET /api/v1/workload/debug-data-source
 * 简化版：诊断数据来源 - Story vs Task vs 角色配置
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const report = {
      timestamp: new Date().toISOString(),
      dataSource: {} as any,
      comparison: {} as any,
    };

    // 1. 获取角色配置表的人员
    const roleMembers = await prisma.tapdMemberRoleMapping.findMany({
      select: { memberName: true },
      distinct: ['memberName'],
    });
    
    const roleMemberSet = new Set(roleMembers.map(r => r.memberName));

    // 2. 获取Story表的owner（简化查询）
    let storyOwners: any[] = [];
    let taskOwners: any[] = [];

    try {
      const stories = await prisma.tapdStory.findMany({
        where: { owner: { not: null } },
        select: { owner: true },
        take: 1000,
      });
      
      // 手动统计
      const storyMap = new Map<string, number>();
      for (const s of stories) {
        if (s.owner) {
          storyMap.set(s.owner, (storyMap.get(s.owner) || 0) + 1);
        }
      }
      storyOwners = Array.from(storyMap.entries()).map(([owner, count]) => ({ owner, _count: { id: count } }));
    } catch (e) {
      report.dataSource.storyError = (e as Error).message;
    }

    try {
      const tasks = await prisma.tapdTask.findMany({
        where: { owner: { not: null } },
        select: { owner: true },
        take: 1000,
      });
      
      // 手动统计
      const taskMap = new Map<string, number>();
      for (const t of tasks) {
        if (t.owner) {
          taskMap.set(t.owner, (taskMap.get(t.owner) || 0) + 1);
        }
      }
      taskOwners = Array.from(taskMap.entries()).map(([owner, count]) => ({ owner, _count: { id: count } }));
    } catch (e) {
      report.dataSource.taskError = (e as Error).message;
    }

    // 清理函数
    const clean = (name: string | null) => (name || '').replace(/[\s;,，；、。.]+$/, '').trim();

    // 统计各数据源的唯一人员数
    const storyOwnerSet = new Set(storyOwners.map(s => clean(s.owner)).filter(Boolean));
    const taskOwnerSet = new Set(taskOwners.map(t => clean(t.owner)).filter(Boolean));

    report.dataSource = {
      ...report.dataSource,
      roleConfig: {
        uniqueMembers: roleMemberSet.size,
      },
      stories: {
        uniqueOwners: storyOwnerSet.size,
        totalRecords: storyOwners.reduce((sum, o) => sum + o._count.id, 0),
      },
      tasks: {
        uniqueOwners: taskOwnerSet.size,
        totalRecords: taskOwners.reduce((sum, o) => sum + o._count.id, 0),
      },
    };

    // 对比分析
    const storyInRole = [...storyOwnerSet].filter(name => roleMemberSet.has(name));
    const taskInRole = [...taskOwnerSet].filter(name => roleMemberSet.has(name));

    report.comparison = {
      storyVsRole: {
        total: storyOwnerSet.size,
        matched: storyInRole.length,
        rate: `${Math.round((storyInRole.length / Math.max(storyOwnerSet.size, 1)) * 100)}%`,
      },
      taskVsRole: {
        total: taskOwnerSet.size,
        matched: taskInRole.length,
        rate: `${Math.round((taskInRole.length / Math.max(taskOwnerSet.size, 1)) * 100)}%`,
      },
    };

    return NextResponse.json({ success: true, data: report });
  } catch (error) {
    console.error('[debug-data-source] Error:', error);
    return NextResponse.json(
      { success: false, message: (error as Error).message, stack: (error as Error).stack?.split('\n').slice(0, 5) },
      { status: 500 }
    );
  }
}
