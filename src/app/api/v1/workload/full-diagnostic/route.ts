/**
 * GET /api/v1/workload/full-diagnostic
 * 完整的数据链路诊断接口
 * 用于系统性排查人力负荷功能的所有数据源和计算环节
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const report = {
    timestamp: new Date().toISOString(),
    phases: {} as Record<string, any>,
    summary: '',
    issues: [] as string[],
    score: 0, // 0-100分
  };

  try {
    // ============================================================
    // Phase 1: 数据源层测试
    // ============================================================
    report.phases.phase1 = {
      name: '📊 数据源层测试',
      tests: [],
      status: 'running',
    };

    // Test 1.1: 团队配置
    try {
      const teamConfigs = await prisma.teamConfig.findMany({
        select: { id: true, name: true, tapdProjectIds: true },
      });

      const test = {
        id: '1.1',
        name: '团队配置数据',
        status: '✅ PASS' as string,
        detail: `找到 ${teamConfigs.length} 个团队`,
        data: teamConfigs.map((tc) => ({
          name: tc.name,
          projectCount: JSON.parse(tc.tapdProjectIds || '[]').length,
          projects: JSON.parse(tc.tapdProjectIds || '[]'),
        })),
        issues: [] as string[],
      };

      if (teamConfigs.length === 0) {
        test.status = '❌ FAIL';
        test.issues.push('没有团队配置数据');
        report.issues.push('致命：无团队配置');
      }

      report.phases.phase1.tests.push(test);
    } catch (error) {
      report.phases.phase1.tests.push({
        id: '1.1',
        name: '团队配置数据',
        status: '❌ ERROR',
        error: (error as Error).message,
      });
      report.issues.push(`错误：团队配置查询失败 - ${(error as Error).message}`);
    }

    // Test 1.2: 工作区数据
    try {
      const allWsIds = new Set<string>();
      const teamConfigs = await prisma.teamConfig.findMany({
        select: { tapdProjectIds: true },
      });
      for (const tc of teamConfigs) {
        JSON.parse(tc.tapdProjectIds || '[]').forEach((id: string) => allWsIds.add(id));
      }

      const workspaces = await prisma.tapdWorkspace.findMany({
        where: { id: { in: [...allWsIds] } },
        select: { id: true, name: true },
      });

      const test = {
        id: '1.2',
        name: '工作区数据',
        status: workspaces.length > 0 ? '✅ PASS' : '❌ FAIL',
        detail: `引用 ${allWsIds.size} 个workspaceId，找到 ${workspaces.length} 个`,
        missingIds: [...allWsIds].filter(
          (id) => !workspaces.some((ws) => ws.id === id)
        ),
        data: workspaces.slice(0, 5),
        issues: [] as string[],
      };

      if (test.missingIds.length > 0) {
        test.issues.push(`${test.missingIds.length} 个workspaceId在数据库中未找到`);
        report.issues.push(`警告：${test.missingIds.length}个工作区未同步`);
      }

      report.phases.phase1.tests.push(test);
    } catch (error) {
      report.phases.phase1.tests.push({
        id: '1.2',
        name: '工作区数据',
        status: '❌ ERROR',
        error: (error as Error).message,
      });
    }

    // Test 1.3: 需求数据(Stories)
    try {
      const storyCount = await prisma.tapdStory.count();
      const storiesWithOwner = await prisma.tapdStory.count({
        where: { owner: { not: null } },
      });
      const storiesWithEffort = await prisma.tapdStory.count({
        where: { effort: { gt: 0 } },
      });

      const test = {
        id: '1.3',
        name: '需求数据(Stories)',
        status: storyCount > 0 ? '✅ PASS' : '⚠️ WARN',
        detail: `共 ${storyCount} 条，有负责人 ${storiesWithOwner} 条，有工时 ${storiesWithEffort} 条`,
        counts: { total: storyCount, withOwner: storiesWithOwner, withEffort: storiesWithEffort },
        issues: [] as string[],
      };

      if (storyCount === 0) {
        test.issues.push('没有需求数据，TAPD可能未同步');
        report.issues.push('警告：无需求数据');
      }
      if (storiesWithOwner === 0 && storyCount > 0) {
        test.issues.push('所有需求都没有负责人(owner为空)');
        report.issues.push('严重：需求缺少负责人信息');
      }
      if (storiesWithEffort === 0 && storyCount > 0) {
        test.issues.push('所有需求都没有预估工时(effort=0)');
        report.issues.push('严重：需求缺少工时数据');
      }

      report.phases.phase1.tests.push(test);
    } catch (error) {
      report.phases.phase1.tests.push({
        id: '1.3',
        name: '需求数据(Stories)',
        status: '❌ ERROR',
        error: (error as Error).message,
      });
    }

    // Test 1.4: 任务数据(Tasks)
    try {
      const taskCount = await prisma.tapdTask.count();
      const tasksWithOwner = await prisma.tapdTask.count({
        where: { owner: { not: null } },
      });
      const tasksWithEffort = await prisma.tapdTask.count({
        where: { effort: { gt: 0 } },
      });

      const test = {
        id: '1.4',
        name: '任务数据(Tasks)',
        status: taskCount > 0 ? '✅ PASS' : '⚠️ WARN',
        detail: `共 ${taskCount} 条，有负责人 ${tasksWithOwner} 条，有工时 ${tasksWithEffort} 条`,
        counts: { total: taskCount, withOwner: tasksWithOwner, withEffort: tasksWithEffort },
        issues: [] as string[],
      };

      if (taskCount === 0) {
        test.issues.push('没有任务数据，TAPD可能未同步');
        report.issues.push('警告：无任务数据');
      }
      if (tasksWithOwner === 0 && taskCount > 0) {
        test.issues.push('所有任务都没有负责人');
        report.issues.push('严重：任务缺少负责人信息');
      }
      if (tasksWithEffort === 0 && taskCount > 0) {
        test.issues.push('所有任务都没有预估工时');
        report.issues.push('严重：任务缺少工时数据');
      }

      report.phases.phase1.tests.push(test);
    } catch (error) {
      report.phases.phase1.tests.push({
        id: '1.4',
        name: '任务数据(Tasks)',
        status: '❌ ERROR',
        error: (error as Error).message,
      });
    }

    // Test 1.5: 角色映射数据
    try {
      const roleMappingCount = await prisma.tapdMemberRoleMapping.count();
      const uniqueMembers = await prisma.tapdMemberRoleMapping.groupBy({
        by: ['memberName'],
        _count: { id: true },
      });

      const test = {
        id: '1.5',
        name: '角色映射数据',
        status: roleMappingCount > 0 ? '✅ PASS' : '⚠️ WARN',
        detail: `共 ${roleMappingCount} 条映射，涉及 ${uniqueMembers.length} 个成员`,
        sampleData: roleMappingCount > 0 ? (
          await prisma.tapdMemberRoleMapping.findMany({
            take: 10,
            select: { workspaceId: true, memberName: true, role: true },
          })
        ) : [],
        issues: [] as string[],
      };

      if (roleMappingCount === 0) {
        test.issues.push('没有角色映射数据，所有人员将默认为frontend角色');
        report.issues.push('警告：无角色映射数据');
      }

      report.phases.phase1.tests.push(test);
    } catch (error) {
      report.phases.phase1.tests.push({
        id: '1.5',
        name: '角色映射数据',
        status: '❌ ERROR',
        error: (error as Error).message,
      });
    }

    // Test 1.6: 样本数据验证（取前5条有负责人的任务）
    try {
      const sampleTasks = await prisma.tapdTask.findMany({
        where: { owner: { not: null }, effort: { gt: 0 } },
        take: 5,
        select: {
          id: true,
          name: true,
          owner: true,
          effort: true,
          effortCompleted: true,
          begin: true,
          due: true,
          workspaceId: true,
          status: true,
        },
        orderBy: { created: 'desc' },
      });

      const test = {
        id: '1.6',
        name: '样本任务数据质量',
        status: sampleTasks.length > 0 ? '✅ PASS' : '❌ FAIL',
        detail: `样本数量: ${sampleTasks.length}`,
        samples: sampleTasks.map((t) => ({
          id: t.id.substring(0, 8),
          name: t.name?.substring(0, 30),
          owner: t.owner,
          effort: t.effort,
          effortCompleted: t.effortCompleted,
          begin: t.begin?.toISOString().split('T')[0],
          due: t.due?.toISOString().split('T')[0],
          workspaceId: t.workspaceId,
          status: t.status,
        })),
        issues: [] as string[],
      };

      // 检查数据质量问题
      for (const t of sampleTasks) {
        if (!t.begin || !t.due) {
          test.issues.push(`任务 ${t.id} 缺少起止时间`);
        }
        if (!t.effort || t.effort <= 0) {
          test.issues.push(`任务 ${t.id} 工时为0或空`);
        }
      }

      if (test.issues.length > 0) {
        report.issues.push(`数据质量问题：${test.issues.length}个问题`);
      }

      report.phases.phase1.tests.push(test);
    } catch (error) {
      report.phases.phase1.tests.push({
        id: '1.6',
        name: '样本任务数据质量',
        status: '❌ ERROR',
        error: (error as Error).message,
      });
    }

    // 计算Phase 1状态
    const p1Tests = report.phases.phase1.tests;
    const p1Failures = p1Tests.filter(
      (t: any) => t.status.includes('❌') || t.status.includes('ERROR')
    ).length;
    report.phases.phase1.status =
      p1Failures === 0 ? '✅ ALL PASS' :
      p1Failures <= 2 ? '⚠️ PARTIAL' : '❌ CRITICAL';

    // ============================================================
    // Phase 2: API接口测试（模拟调用）
    // ============================================================
    report.phases.phase2 = {
      name: '🔗 API接口测试',
      tests: [],
      status: 'pending',
    };

    // Test 2.1: Overview API参数验证
    report.phases.phase2.tests.push({
      id: '2.1',
      name: 'Overview API - 参数验证',
      status: 'ℹ️ SKIP',
      detail: '需要实际HTTP请求测试',
    });

    // Test 2.2: Persons API参数验证
    report.phases.phase2.tests.push({
      id: '2.2',
      name: 'Persons API - 参数验证',
      status: 'ℹ️ SKIP',
      detail: '需要实际HTTP请求测试',
    });

    // ============================================================
    // 总结
    // ============================================================
    const totalTests = p1Tests.length;
    const passedTests = p1Tests.filter((t: any) =>
      t.status.includes('✅')
    ).length;

    report.score = Math.round((passedTests / totalTests) * 100);
    report.summary =
      report.score >= 80 ? '✅ 系统状态良好' :
      report.score >= 60 ? '⚠️ 存在一些问题' :
      '❌ 存在严重问题，需要立即修复';

    return NextResponse.json({ success: true, data: report });
  } catch (error) {
    console.error('[full-diagnostic] Error:', error);
    return NextResponse.json(
      { success: false, message: (error as Error).message },
      { status: 500 }
    );
  }
}
