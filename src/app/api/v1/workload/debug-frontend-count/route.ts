/**
 * GET /api/v1/workload/debug-frontend-count
 * 分析前端人数偏高的原因
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getMemberRoleMappings } from '../_lib/data.provider';

export async function GET() {
  try {
    const report = {
      timestamp: new Date().toISOString(),
      analysis: {},
      conclusion: '',
    };

    // 1. 获取角色映射表中的真实角色分布
    const roleMappings = await getMemberRoleMappings();
    const roleDistribution = {
      frontend: 0,
      backend: 0,
      mobile: 0,
      test: 0,
      po: 0,       // PO不参与统计
      ued: 0,      // UED不参与统计
      other: 0,
    };

    const uniqueMembers = new Set<string>();
    
    for (const rm of roleMappings) {
      uniqueMembers.add(rm.memberName);
      
      const role = rm.role.toLowerCase();
      if (role.includes('前端') || role.includes('frontend')) roleDistribution.frontend++;
      else if (role.includes('后端') || role.includes('backend')) roleDistribution.backend++;
      else if (role.includes('移动') || role.includes('mobile')) roleDistribution.mobile++;
      else if (role.includes('测试') || role.includes('test')) roleDistribution.test++;
      else if (role.includes('po') || role.includes('产品')) roleDistribution.po++;
      else if (role.includes('ued') || role.includes('设计')) roleDistribution.ued++;
      else roleDistribution.other++;
    }

    report.analysis.roleMappingStats = {
      totalRecords: roleMappings.length,
      uniqueMembers: uniqueMembers.size,
      distribution: roleDistribution,
    };

    // 2. 获取任务表中的总人数
    const totalTaskOwners = await prisma.tapdTask.groupBy({
      by: ['owner'],
      where: { owner: { not: null, not: '' } },
      _count: { id: true },
    });

    // 清理owner
    const cleanOwner = (name: string) => name.replace(/[\s;,，；、。.]+$/, '').trim();
    const cleanedOwners = totalTaskOwners
      .map(o => ({ owner: cleanOwner(o.owner), count: o._count.id }))
      .filter(o => o.owner && o.owner.length >= 2);

    report.analysis.taskOwnerStats = {
      totalRawOwners: totalTaskOwners.length,
      totalCleanedOwners: cleanedOwners.length,
    };

    // 3. 模拟匹配过程，统计各级匹配结果
    let level1Matched = 0;
    let level2Matched = 0;
    let level3Matched = 0;
    let defaultToFrontend = 0;

    const mrCache = new Map<string, string>();
    for (const rm of roleMappings) {
      mrCache.set(`${rm.workspaceId}:${rm.memberName}`, rm.role);
    }

    for (const co of cleanedOwners.slice(0, 200)) {  // 只测试前200人
      const pname = co.owner;
      
      // 模拟获取workspaceId
      // 这里简化处理，直接尝试所有可能的匹配
      
      let matched = false;
      
      // Level 2: 姓名匹配
      for (const [key, value] of mrCache.entries()) {
        const [, mappedName] = key.split(':');
        if (mappedName === pname) {
          matched = true;
          level2Matched++;
          
          // 统计这个人的实际角色
          const role = value.toLowerCase();
          break;
        }
      }
      
      if (!matched) {
        defaultToFrontend++;
      }
    }

    report.analysis.matchingSimulation = {
      testedSample: Math.min(200, cleanedOwners.length),
      level2Matched,
      defaultToFrontend,
      defaultRate: `${Math.round((defaultToFrontend / Math.min(200, cleanedOwners.length)) * 100)}%`,
    };

    // 4. 关键问题：多少人在角色映射表中根本没有配置？
    const ownersNotInMapping = [];
    for (const co of cleanedOwners.slice(0, 50)) {
      let found = false;
      for (const [key] of mrCache.entries()) {
        const [, mappedName] = key.split(':');
        if (mappedName === co.owner) {
          found = true;
          break;
        }
      }
      if (!found && ownersNotInMapping.length < 10) {
        ownersNotInMapping.push({
          name: co.owner,
          taskCount: co.count,
        });
      }
    }

    report.analysis.ownersNotInConfigured = {
      sampleCount: ownersNotInMapping.length,
      samples: ownersNotInMapping,
    };

    // 结论
    const coreRolesTotal = roleDistribution.frontend + roleDistribution.backend + 
                           roleDistribution.mobile + roleDistribution.test;
    
    if (defaultToFrontend > level2Matched) {
      report.conclusion = `❌ 核心问题：${defaultToFrontend}/${report.analysis.matchingSimulation.testedSample} (${report.analysis.matchingSimulation.defaultRate})的人员在角色映射表中未配置！\n` +
        `这些人员全部默认为frontend。\n\n` +
        `📊 角色映射表中的真实分布（${uniqueMembers.size}个唯一成员）：\n` +
        `- 前端: ${roleDistribution.frontend}人\n` +
        `- 后端: ${roleDistribution.backend}人\n` +
        `- 移动端: ${roleDistribution.mobile}人\n` +
        `- 测试: ${roleDistribution.test}人\n` +
        `- PO: ${roleDistribution.po}人 (辅助角色)\n` +
        `- 其他: ${roleDistribution.other}人\n\n` +
        `💡 建议：\n` +
        `1. 在TAPD迭代管理的角色配置中补充缺失人员的角色\n` +
        `2. 或修改逻辑：未配置角色的人员不应计入任何核心角色`;
    } else {
      report.conclusion = `✅ 角色分配合理`;
    }

    return NextResponse.json({ success: true, data: report });
  } catch (error) {
    console.error('[debug-frontend-count] Error:', error);
    return NextResponse.json(
      { success: false, message: (error as Error).message },
      { status: 500 }
    );
  }
}
