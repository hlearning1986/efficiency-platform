/**
 * GET /api/v1/workload/debug-simple-match
 * 简化版匹配测试
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    // 1. 从role mapping取一个样本
    const roleSample = await prisma.tapdMemberRoleMapping.findFirst({
      select: {
        workspaceId: true,
        memberName: true,
        role: true,
      },
    });

    if (!roleSample) {
      return NextResponse.json({ success: false, message: 'No role mapping data' });
    }

    // 2. 用完全相同的条件查任务表
    const taskMatch = await prisma.tapdTask.findMany({
      where: {
        workspaceId: roleSample.workspaceId,
        owner: roleSample.memberName,
      },
      take: 3,
      select: {
        id: true,
        owner: true,
        workspaceId: true,
        name: true,
      },
    });

    // 3. 统计信息
    const totalRoles = await prisma.tapdMemberRoleMapping.count();
    const totalTasks = await prisma.tapdTask.count({
      where: { owner: { not: null } }
    });

    // 4. 检查workspaceId格式
    const sampleWorkspaceIds = await prisma.tapdMemberRoleMapping.findMany({
      take: 10,
      select: { workspaceId: true },
      distinct: ['workspaceId'],
    });

    const taskWorkspaceIds = await prisma.tapdTask.findMany({
      take: 10,
      where: { owner: { not: null } },
      select: { workspaceId: true },
      distinct: ['workspaceId'],
    });

    return NextResponse.json({
      success: true,
      data: {
        roleSample: {
          workspaceId: roleSample.workspaceId,
          memberName: roleSample.memberName,
          role: roleSample.role,
          constructedKey: `${roleSample.workspaceId}:${roleSample.memberName}`,
        },
        taskMatchResult: {
          foundCount: taskMatch.length,
          tasks: taskMatch.map(t => ({
            taskId: t.id,
            owner: t.owner,
            workspaceId: t.workspaceId,
            taskKey: `${t.workspaceId}:${t.owner}`,
            ownerType: typeof t.owner,
            ownerIdLength: t.owner?.length,
          })),
        },
        statistics: {
          totalRoleMappings: totalRoles,
          totalTasksWithOwner: totalTasks,
        },
        workspaceIdFormats: {
          fromRoleMapping: sampleWorkspaceIds.map(w => ({
            value: w.workspaceId,
            type: typeof w.workspaceId,
            length: w.workspaceId?.length,
          })),
          fromTasks: taskWorkspaceIds.map(w => ({
            value: w.workspaceId,
            type: typeof w.workspaceId,
            length: w.workspaceId?.length,
          })),
        },
      }
    });
  } catch (error) {
    console.error('[debug-simple-match] Error:', error);
    return NextResponse.json(
      { success: false, message: (error as Error).message, stack: (error as Error).stack },
      { status: 500 }
    );
  }
}
