/**
 * GET /api/v1/workload/debug-char-compare
 * 终极诊断：逐字符比较两个表中的同一姓名
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    // 从角色映射表中取一个样本
    const roleSample = await prisma.tapdMemberRoleMapping.findFirst({
      select: {
        workspaceId: true,
        memberName: true,
        role: true,
      },
    });

    if (!roleSample) {
      return NextResponse.json({ success: false, message: 'No role data' });
    }

    const nameFromRole = roleSample.memberName;

    // 在任务表中查找包含类似名字的记录（使用LIKE模糊查询）
    const taskMatches = await prisma.tapdTask.findMany({
      where: {
        owner: { contains: nameFromRole.slice(0, 2) },  // 取前2个字模糊搜索
      },
      take: 5,
      select: {
        owner: true,
        workspaceId: true,
      },
      distinct: ['owner'],
    });

    // 详细字符分析
    const analysis = {
      nameFromRole,
      roleWorkspaceId: roleSample.workspaceId,
      charDetails: [] as any[],
      taskMatches: [] as any[],
    };

    // 分析role中姓名的每个字符
    for (let i = 0; i < nameFromRole.length; i++) {
      analysis.charDetails.push({
        index: i,
        char: nameFromRole[i],
        codePoint: nameFromRole.charCodeAt(i),
        hexCode: nameFromRole.charCodeAt(i).toString(16),
      });
    }

    // 对比task中的每个匹配项
    for (const tm of taskMatches) {
      if (!tm.owner) continue;

      const ownerAnalysis = {
        nameFromTask: tm.owner,
        length: tm.owner.length,
        charByCharCompare: [] as any[],
        isExactMatch: tm.owner === nameFromRole,
      };

      // 逐字符对比
      const maxLen = Math.max(nameFromRole.length, tm.owner.length);
      for (let i = 0; i < maxLen; i++) {
        const roleChar = nameFromRole[i] || '(end)';
        const taskChar = tm.owner[i] || '(end)';
        const roleCode = nameFromRole.charCodeAt(i);
        const taskCode = tm.owner.charCodeAt(i);

        ownerAnalysis.charByCharCompare.push({
          index: i,
          roleChar,
          taskChar,
          same: roleChar === taskChar,
          roleCode,
          taskCode,
          diff: roleCode !== taskCode ? `DIFF: ${roleCode} vs ${taskCode}` : null,
        });
      }

      analysis.taskMatches.push(ownerAnalysis);
    }

    return NextResponse.json({ success: true, data: analysis });
  } catch (error) {
    console.error('[debug-char-compare] Error:', error);
    return NextResponse.json(
      { success: false, message: (error as Error).message },
      { status: 500 }
    );
  }
}
