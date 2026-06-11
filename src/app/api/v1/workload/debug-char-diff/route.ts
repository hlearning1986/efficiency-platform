/**
 * GET /api/v1/workload/debug-char-diff
 * 字符级诊断：精确比较mrCache key和task owner的差异
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const report = {
      timestamp: new Date().toISOString(),
      charLevelAnalysis: [],
    };

    // 获取一个在两个表中都存在的样本人员
    // 先从role mapping中取几个
    const roleSamples = await prisma.tapdMemberRoleMapping.findMany({
      take: 5,
      select: {
        workspaceId: true,
        memberName: true,
        role: true,
      },
    });

    for (const rs of roleSamples) {
      // 查找该人员在任务表中的记录
      const taskRecord = await prisma.tapdTask.findFirst({
        where: {
          owner: rs.memberName,
          workspaceId: rs.workspaceId,
        },
        select: {
          owner: true,
          workspaceId: true,
        },
      });

      if (!taskRecord) {
        report.charLevelAnalysis.push({
          person: rs.memberName,
          workspaceId: rs.workspaceId,
          roleFromDB: rs.role,
          foundInTasks: false,
          message: '该人员在当前workspace的任务表中未找到',
        });
        continue;
      }

      // 构建两个key并逐字符比较
      const cacheKey = `${rs.workspaceId}:${rs.memberName}`;
      const taskKey = `${taskRecord.workspaceId}:${taskRecord.owner}`;

      // 详细分析
      const analysis = {
        person: rs.memberName,
        workspaceId: rs.workspaceId,
        roleFromDB: rs.role,
        foundInTasks: true,
        cacheKey,
        taskKey,
        keysMatch: cacheKey === taskKey,
        cacheKeyLength: cacheKey.length,
        taskKeyLength: taskKey.length,
        charDiff: [] as Array<{
          index: number;
          cacheChar: string;
          taskChar: string;
          cacheCode: number;
          taskCode: number;
          isSame: boolean;
        }>,
      };

      // 逐字符比较（只比较前50个字符）
      const maxLen = Math.max(cacheKey.length, taskKey.length);
      for (let i = 0; i < Math.min(maxLen, 50); i++) {
        const cacheChar = cacheKey[i] || '(missing)';
        const taskChar = taskKey[i] || '(missing)';
        const cacheCode = cacheKey.charCodeAt(i);
        const taskCode = taskKey.charCodeAt(i);

        if (cacheChar !== taskChar || cacheCode !== taskCode) {
          analysis.charDiff.push({
            index: i,
            cacheChar,
            taskChar,
            cacheCode,
            taskCode,
            isSame: false,
          });
        }
      }

      report.charLevelAnalysis.push(analysis);
    }

    // 额外检查：查看所有唯一的memberName和owner值
    const allRoleNames = await prisma.tapdMemberRoleMapping.groupBy({
      by: ['memberName'],
      _count: { id: true },
      take: 10,
    });

    const allTaskOwners = await prisma.tapdTask.groupBy({
      by: ['owner'],
      _count: { id: true },
      where: { owner: { not: null } },
      take: 10,
      orderBy: { _count: { id: 'desc' } },
    });

    return NextResponse.json({
      success: true,
      data: {
        ...report,
        sampleRoleNames: allRoleNames.map(r => ({ name: r.memberName, count: r._count.id })),
        sampleTaskOwners: allTaskOwners.map(o => ({ name: o.owner, count: o._count.id })),
      }
    });
  } catch (error) {
    console.error('[debug-char-diff] Error:', error);
    return NextResponse.json(
      { success: false, message: (error as Error).message },
      { status: 500 }
    );
  }
}
