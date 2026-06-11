/**
 * GET /api/v1/workload/role-mapping-debug
 * 角色映射数据诊断接口
 * 用于排查tapdMemberRoleMapping表的数据来源和内容
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const report = {
      timestamp: new Date().toISOString(),
      tableInfo: {},
      dataSamples: [],
      roleDistribution: {},
      workspaceCoverage: {},
      loanStatus: { hasLoanData: false, count: 0, samples: [] },
      conclusion: '',
    };

    // 1. 表基本信息
    const totalCount = await prisma.tapdMemberRoleMapping.count();
    const activeCount = await prisma.tapdMemberRoleMapping.count({
      where: { isActive: true },
    });
    const uniqueMembers = await prisma.tapdMemberRoleMapping.groupBy({
      by: ['memberName'],
      _count: { id: true },
    });
    const uniqueWorkspaces = await prisma.tapdMemberRoleMapping.groupBy({
      by: ['workspaceId'],
      _count: { id: true },
    });

    report.tableInfo = {
      totalRecords: totalCount,
      activeRecords: activeCount,
      uniqueMembers: uniqueMembers.length,
      uniqueWorkspaces: uniqueWorkspaces.length,
    };

    // 2. 数据样本（前20条）
    const samples = await prisma.tapdMemberRoleMapping.findMany({
      take: 20,
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        workspaceId: true,
        memberName: true,
        role: true,
        roleId: true,
        isActive: true,
        remark: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    report.dataSamples = samples.map((s) => ({
      ...s,
      createdAt: s.createdAt?.toISOString().split('T')[0],
      updatedAt: s.updatedAt?.toISOString().split('T')[0],
    }));

    // 3. 角色分布统计
    const roleStats = await prisma.tapdMemberRoleMapping.groupBy({
      by: ['role'],
      _count: { id: true },
      where: { isActive: true },
    });

    report.roleDistribution = Object.fromEntries(
      roleStats.map((r) => [r.role, r._count.id])
    );

    // 4. 工作区覆盖
    report.workspaceCoverage = {
      workspaces: uniqueWorkspaces.length,
      details: uniqueWorkspaces.slice(0, 10).map((w) => ({
        workspaceId: w.workspaceId,
        memberCount: w._count.id,
      })),
    };

    // 5. 借调人员检查
    const loanMappings = await prisma.tapdMemberRoleMapping.findMany({
      where: {
        OR: [
          { role: { contains: '借调' } },
          { role: { contains: 'loan' } },
          { remark: { contains: '借调' } },
        ],
        isActive: true,
      },
      take: 20,
      select: {
        workspaceId: true,
        memberName: true,
        role: true,
        remark: true,
      },
    });

    report.loanStatus = {
      hasLoanData: loanMappings.length > 0,
      count: loanMappings.length,
      samples: loanMappings,
    };

    // 结论
    if (totalCount > 0 && uniqueMembers.length > 0) {
      report.conclusion = `✅ tapdMemberRoleMapping表有数据：共${totalCount}条记录，涉及${uniqueMembers.length}个成员、${uniqueWorkspaces.length}个工作区。此表存储的是"迭代管理-角色配置"中用户手动配置的角色信息。`;
    } else {
      report.conclusion = '⚠️ tapdMemberRoleMapping表为空，需要从TAPD同步角色配置数据';
    }

    if (report.loanStatus.hasLoanData) {
      report.conclusion += `\n✅ 发现${loanMappings.length}条借调人员记录，可用于调整容量计算`;
    }

    return NextResponse.json({ success: true, data: report });
  } catch (error) {
    console.error('[role-mapping-debug] Error:', error);
    return NextResponse.json(
      { success: false, message: (error as Error).message },
      { status: 500 }
    );
  }
}
