/**
 * GET /api/v1/workload/debug-workspace-overlap
 * 检查role mapping和tasks的workspace重叠情况
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    // 1. 获取role mapping中所有唯一的workspaceId
    const roleWorkspaces = await prisma.tapdMemberRoleMapping.findMany({
      select: { workspaceId: true },
      distinct: ['workspaceId'],
    });
    
    const roleWsSet = new Set(roleWorkspaces.map(r => r.workspaceId));

    // 2. 获取任务表中所有唯一的workspaceId
    const taskWorkspaces = await prisma.tapdTask.findMany({
      where: { owner: { not: null } },
      select: { workspaceId: true },
      distinct: ['workspaceId'],
    });

    const taskWsSet = new Set(taskWorkspaces.map(t => t.workspaceId));

    // 3. 计算重叠
    const overlap = [...roleWsSet].filter(ws => taskWsSet.has(ws));
    const onlyInRole = [...roleWsSet].filter(ws => !taskWsSet.has(ws));
    const onlyInTask = [...taskWsSet].filter(ws => !roleWsSet.has(ws));

    // 4. 如果有重叠，测试一个样本
    let sampleTest = null;
    if (overlap.length > 0) {
      const testWs = overlap[0];
      
      // 从role mapping取该workspace的一个人员
      const rolePerson = await prisma.tapdMemberRoleMapping.findFirst({
        where: { workspaceId: testWs },
        select: { memberName: true, role: true },
      });

      if (rolePerson) {
        // 在任务表中查找该人员
        const taskCount = await prisma.tapdTask.count({
          where: {
            workspaceId: testWs,
            owner: rolePerson.memberName,
          },
        });

        sampleTest = {
          workspaceId: testWs,
          personFromRole: rolePerson.memberName,
          roleFromDB: rolePerson.role,
          taskCountForThisPerson: taskCount,
        };
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        summary: {
          totalRoleWorkspaces: roleWsSet.size,
          totalTaskWorkspaces: taskWsSet.size,
          overlapCount: overlap.length,
          onlyInRoleCount: onlyInRole.length,
          onlyInTaskCount: onlyInTask.length,
          overlapRate: `${Math.round((overlap.length / Math.max(roleWsSet.size, 1)) * 100)}%`,
        },
        overlapWorkspaces: overlap.slice(0, 10),
        onlyInRoleWorkspaces: onlyInRole.slice(0, 10),
        onlyInTaskWorkspaces: onlyInTask.slice(0, 10),
        sampleTest,
        conclusion: overlap.length === 0 
          ? '❌ 致命：role mapping和tasks的workspace完全不重叠！这就是为什么99%的人默认为frontend'
          : `✅ 有${overlap.length}个workspace重叠`,
      }
    });
  } catch (error) {
    console.error('[debug-workspace-overlap] Error:', error);
    return NextResponse.json(
      { success: false, message: (error as Error).message },
      { status: 500 }
    );
  }
}
