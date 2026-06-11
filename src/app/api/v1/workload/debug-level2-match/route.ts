/**
 * GET /api/v1/workload/debug-level2-match
 * 测试Level 2姓名匹配是否有效
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getMemberRoleMappings } from '../_lib/data.provider';

export async function GET() {
  try {
    // 1. 获取角色映射
    const roleMappings = await getMemberRoleMappings();
    
    // 2. 构建mrCache
    const mrCache = new Map<string, string>();
    for (const rm of roleMappings) {
      mrCache.set(`${rm.workspaceId}:${rm.memberName}`, rm.role);
    }

    // 3. 获取任务表中的样本owner
    const sampleOwners = await prisma.tapdTask.groupBy({
      by: ['owner'],
      where: { owner: { not: null, not: '' } },
      _count: { id: true },
      take: 20,
      orderBy: { _count: { id: 'desc' } },
    });

    // 4. 对每个owner测试三级匹配
    const results = [];
    
    for (const owner of sampleOwners) {
      const pname = owner.owner;
      if (!pname) continue;

      // 获取该人员的某个workspaceId
      const sampleTask = await prisma.tapdTask.findFirst({
        where: { owner: pname },
        select: { workspaceId: true },
      });

      const wsId = sampleTask?.workspaceId || 'unknown';

      // Level 1: 精确匹配
      let level1Match = mrCache.get(`${wsId}:${pname}`);

      // Level 2: 姓名匹配
      let level2Match = null;
      let level2Key = null;
      if (!level1Match) {
        for (const [key, value] of mrCache.entries()) {
          const [, mappedName] = key.split(':');
          if (mappedName === pname) {
            level2Match = value;
            level2Key = key;
            break;
          }
        }
      }

      // Level 3: 模糊匹配
      let level3Match = null;
      if (!level1Match && !level2Match) {
        const cleanName = pname.replace(/\s+/g, '');
        for (const [key, value] of mrCache.entries()) {
          const [, mappedName] = key.split(':');
          const cleanMapped = mappedName.replace(/\s+/g, '');
          if (cleanMapped === cleanName && cleanName.length > 0) {
            level3Match = value;
            break;
          }
        }
      }

      results.push({
        owner: pname,
        workspaceId: wsId,
        taskCount: owner._count.id,
        level1Result: level1Match || '❌ 未匹配',
        level2Result: level2Match || '❌ 未匹配',
        level2Key,
        level3Result: level3Match || '❌ 未匹配',
        finalRole: level1Match || level2Match || level3Match || '⚠️ 默认frontend',
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        cacheSize: mrCache.size,
        testResults: results,
        summary: {
          totalTested: results.length,
          level1Success: results.filter(r => r.level1Result !== '❌ 未匹配').length,
          level2Success: results.filter(r => r.level2Result !== '❌ 未匹配').length,
          level3Success: results.filter(r => r.level3Result !== '❌ 未匹配').length,
          allFailed: results.filter(r => r.finalRole === '⚠️ 默认frontend').length,
        },
      }
    });
  } catch (error) {
    console.error('[debug-level2-match] Error:', error);
    return NextResponse.json(
      { success: false, message: (error as Error).message },
      { status: 500 }
    );
  }
}
