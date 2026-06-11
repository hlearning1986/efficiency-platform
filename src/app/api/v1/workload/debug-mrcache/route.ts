/**
 * GET /api/v1/workload/debug-mrcache
 * 精确诊断mrCache构建和匹配过程
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getMemberRoleMappings } from '../_lib/data.provider';

export async function GET() {
  try {
    const report = {
      timestamp: new Date().toISOString(),
      step1_dbQuery: {},
      step2_apiCall: {},
      step3_cacheBuild: {},
      step4_matchTest: {},
      conclusion: '',
    };

    // Step 1: 直接查询数据库
    const allRecords = await prisma.tapdMemberRoleMapping.findMany({
      select: {
        id: true,
        workspaceId: true,
        memberName: true,
        role: true,
        isActive: true,
      },
    });

    const activeRecords = allRecords.filter(r => r.isActive);
    const inactiveRecords = allRecords.filter(r => !r.isActive);

    report.step1_dbQuery = {
      totalInDB: allRecords.length,
      activeCount: activeRecords.length,
      inactiveCount: inactiveRecords.length,
      sampleActive: activeRecords.slice(0, 5).map(r => ({
        workspaceId: r.workspaceId,
        memberName: r.memberName,
        role: r.role,
        key: `${r.workspaceId}:${r.memberName}`,
      })),
      sampleInactive: inactiveRecords.slice(0, 3).map(r => ({
        workspaceId: r.workspaceId,
        memberName: r.memberName,
        role: r.role,
      })),
    };

    // Step 2: 调用API函数（模拟真实调用）
    const apiResult = await getMemberRoleMappings();

    report.step2_apiCall = {
      returnedCount: apiResult.length,
      sampleData: apiResult.slice(0, 5),
    };

    // Step 3: 模拟mrCache构建
    const mrCache = new Map<string, string>();
    for (const rm of apiResult) {
      const key = `${rm.workspaceId}:${rm.memberName}`;
      mrCache.set(key, rm.role);
    }

    report.step3_cacheBuild = {
      cacheSize: mrCache.size,
      sampleKeys: Array.from(mrCache.keys()).slice(0, 10),
    };

    // Step 4: 获取真实的任务数据并测试匹配
    const tasks = await prisma.tapdTask.findMany({
      where: {
        owner: { not: null },
        workspaceId: { in: Array.from(mrCache.keys()).map(k => k.split(':')[0]).slice(0, 50) }
      },
      take: 50,
      select: {
        owner: true,
        workspaceId: true,
      },
      distinct: ['owner'],
    });

    let matched = 0;
    let notMatched = 0;
    const matchDetails = [];

    for (const task of tasks) {
      if (!task.owner) continue;

      const key = `${task.workspaceId}:${task.owner}`;
      const cachedRole = mrCache.get(key);

      if (cachedRole) {
        matched++;
        if (matchDetails.length < 5) {
          matchDetails.push({
            person: task.owner,
            workspaceId: task.workspaceId,
            key,
            cachedRole,
            status: '✅ MATCHED',
          });
        }
      } else {
        notMatched++;
        if (matchDetails.length < 10) {
          matchDetails.push({
            person: task.owner,
            workspaceId: task.workspaceId,
            key,
            cachedRole: null,
            status: '❌ NOT FOUND',
          });
        }
      }
    }

    report.step4_matchTest = {
      totalTested: tasks.length,
      matched,
      notMatched,
      matchRate: `${Math.round((matched / Math.max(tasks.length, 1)) * 100)}%`,
      details: matchDetails,
    };

    // 结论
    if (apiResult.length === 0) {
      report.conclusion = '❌ 致命错误：getMemberRoleMappings()返回空数组！所有人员将默认为frontend';
    } else if (notMatched > matched) {
      report.conclusion = `⚠️ 严重问题：${notMatched}/${tasks.length}人无法匹配。原因可能是workspaceId格式不一致`;
    } else if (matched > 0 && notMatched === 0) {
      report.conclusion = `✅ 完美匹配：所有${matched}人都找到了角色配置`;
    } else {
      report.conclusion = `📊 部分匹配：${matched}人成功，${notMatched}人失败`;
    }

    return NextResponse.json({ success: true, data: report });
  } catch (error) {
    console.error('[debug-mrcache] Error:', error);
    return NextResponse.json(
      { success: false, message: (error as Error).message },
      { status: 500 }
    );
  }
}
