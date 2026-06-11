/**
 * GET /api/v1/workload/cleanup-test-data
 * 清理测试数据接口
 * 删除seed脚本创建的测试团队，只保留真实业务团队
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const report = {
      timestamp: new Date().toISOString(),
      before: {},
      after: {},
      deletedTeams: [] as string[],
      keptTeams: [] as string[],
      message: '',
    };

    // 1. 查看当前所有团队
    const allTeams = await prisma.teamConfig.findMany({
      select: { id: true, name: true, tapdProjectIds: true },
      orderBy: { name: 'asc' },
    });

    report.before = {
      totalTeams: allTeams.length,
      teams: allTeams.map(t => ({
        id: t.id,
        name: t.name,
        projectCount: JSON.parse(t.tapdProjectIds || '[]').length,
      })),
    };

    // 2. 识别测试团队（包含"开发"、"测试"、"前端"、"后端"等关键词的）
    const testTeamKeywords = ['开发', '测试', '前端', '后端', '移动', 'test', 'dev'];
    const testTeamIds: string[] = [];
    const realTeamIds: string[] = [];

    for (const team of allTeams) {
      const isTestTeam = testTeamKeywords.some(keyword =>
        team.name.toLowerCase().includes(keyword.toLowerCase())
      );

      if (isTestTeam) {
        testTeamIds.push(team.id);
        report.deletedTeams.push(team.name);
      } else {
        realTeamIds.push(team.id);
        report.keptTeams.push(team.name);
      }
    }

    // 3. 删除测试团队
    if (testTeamIds.length > 0) {
      await prisma.teamConfig.deleteMany({
        where: { id: { in: testTeamIds } },
      });
    }

    // 4. 查看清理后的团队
    const remainingTeams = await prisma.teamConfig.findMany({
      select: { id: true, name: true, tapdProjectIds: true },
      orderBy: { name: 'asc' },
    });

    report.after = {
      totalTeams: remainingTeams.length,
      teams: remainingTeams.map(t => ({
        id: t.id,
        name: t.name,
        projectCount: JSON.parse(t.tapdProjectIds || '[]').length,
      })),
    };

    // 5. 统计任务中的owner样本，用于验证去重效果
    const ownerStats = await prisma.tapdTask.groupBy({
      by: ['owner'],
      _count: { id: true },
      where: { owner: { not: null } },
      take: 20,
      orderBy: { _count: { id: 'desc' } },
    });

    report.message =
      `清理完成：删除 ${testTeamIds.length} 个测试团队，保留 ${remainingTeams.length} 个真实团队。\n` +
      `保留的团队：${report.keptTeams.join(', ') || '无'}\n` +
      `Top 20 负责人任务数分布：${ownerStats.map(o => `${o.owner}:${o._count.id}`).join(', ')}`;

    return NextResponse.json({ success: true, data: report });
  } catch (error) {
    console.error('[cleanup-test-data] Error:', error);
    return NextResponse.json(
      { success: false, message: (error as Error).message },
      { status: 500 }
    );
  }
}
