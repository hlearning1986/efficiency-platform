/**
 * GET /api/v1/workload/debug-role-matching
 * 角色匹配诊断接口
 * 用于排查为什么1328人被默认为frontend角色
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const report = {
      timestamp: new Date().toISOString(),
      dbData: {},
      matchingTest: [],
      samplePersons: [],
      conclusion: '',
    };

    // 1. 获取数据库中的角色映射样本
    const roleMappings = await prisma.tapdMemberRoleMapping.findMany({
      take: 20,
      orderBy: { updatedAt: 'desc' },
      select: {
        workspaceId: true,
        memberName: true,
        role: true,
      },
    });

    report.dbData = {
      totalRecords: await prisma.tapdMemberRoleMapping.count(),
      sampleMappings: roleMappings.map(m => ({
        key: `${m.workspaceId}:${m.memberName}`,
        workspaceId: m.workspaceId,
        memberName: m.memberName,
        role: m.role,
      })),
    };

    // 2. 模拟构建mrCache的过程
    const mrCache = new Map<string, string>();
    for (const rm of roleMappings) {
      const key = `${rm.workspaceId}:${rm.memberName}`;
      mrCache.set(key, rm.role);
    }

    // 3. 测试几个人员的角色匹配
    const testPersons = ['胡古月', '计思多', '刘晓冬', '曹建巍', '钱升', '徐梦雨'];
    
    for (const name of testPersons) {
      // 查找该人员在所有工作区的角色映射
      const personRoles = await prisma.tapdMemberRoleMapping.findMany({
        where: { memberName: name },
        take: 5,
        select: {
          workspaceId: true,
          memberName: true,
          role: true,
        },
      });

      // 尝试匹配
      let matchedRole = null;
      let matchedKey = null;
      
      for (const pr of personRoles) {
        const key = `${pr.workspaceId}:${pr.memberName}`;
        if (mrCache.has(key)) {
          matchedRole = mrCache.get(key);
          matchedKey = key;
          break;
        }
      }

      report.matchingTest.push({
        personName: name,
        dbRecordCount: personRoles.length,
        dbRecords: personRoles.map(pr => ({
          key: `${pr.workspaceId}:${pr.memberName}`,
          role: pr.role,
        })),
        matchedRole,
        matchedKey,
        willDefaultToFrontend: !matchedRole,
      });
    }

    // 4. 统计：有多少人能匹配到角色，多少人会默认frontend
    const allUniqueMembers = await prisma.tapdMemberRoleMapping.groupBy({
      by: ['memberName'],
      _count: { id: true },
    });

    const sampleTasks = await prisma.tapdTask.findMany({
      where: { owner: { not: null } },
      take: 100,
      select: { owner: true, workspaceId: true },
      distinct: ['owner'],
    });

    let matchedCount = 0;
    let defaultCount = 0;
    const defaultPersons = [];

    for (const task of sampleTasks) {
      if (!task.owner) continue;
      
      const key = `${task.workspaceId}:${task.owner}`;
      if (mrCache.has(key)) {
        matchedCount++;
      } else {
        defaultCount++;
        if (defaultPersons.length < 10) {
          defaultPersons.push(task.owner);
        }
      }
    }

    report.samplePersons = {
      totalTested: sampleTasks.length,
      matchedToRealRole: matchedCount,
      willDefaultToFrontend: defaultCount,
      defaultRate: `${Math.round((defaultCount / sampleTasks.length) * 100)}%`,
      sampleDefaultPersons: defaultPersons,
    };

    // 结论
    if (defaultCount > matchedCount) {
      report.conclusion = `❌ 严重问题：${defaultCount}/${sampleTasks.length} (${report.samplePersons.defaultRate}) 的人员无法匹配到角色配置，将默认为frontend。原因可能是：\n` +
        `1. 任务表中的owner与角色映射表中的memberName不一致\n` +
        `2. workspaceId不匹配\n` +
        `3. 角色映射数据不完整`;
    } else {
      report.conclusion = `✅ 角色匹配正常：${matchedCount}人匹配到真实角色，${defaultCount}人使用默认角色`;
    }

    return NextResponse.json({ success: true, data: report });
  } catch (error) {
    console.error('[debug-role-matching] Error:', error);
    return NextResponse.json(
      { success: false, message: (error as Error).message },
      { status: 500 }
    );
  }
}
