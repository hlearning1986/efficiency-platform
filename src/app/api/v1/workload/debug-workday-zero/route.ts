/**
 * GET /api/v1/workload/debug-workday-zero
 * 专门诊断workDayCount=0的问题
 */

import { NextResponse } from 'next/server';
import { calcWorkDays } from '../_lib/workday.calc';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const report = {
      timestamp: new Date().toISOString(),
      tests: [] as Array<{
        name: string;
        input: any;
        output: any;
        status: string;
      }>,
      conclusion: '',
    };

    // Test 1: 直接调用calcWorkDays
    const test1Input = {
      start: new Date('2026-06-07'),
      end: new Date('2026-06-13'),
    };

    const test1Output = calcWorkDays({
      ...test1Input,
      holidays: new Set(),
      extraWorkdays: new Set(),
    });

    report.tests.push({
      name: 'Test 1: 直接调用 calcWorkDays',
      input: test1Input,
      output: { count: test1Output.length, days: test1Output.map(d => d.toISOString().split('T')[0]) },
      status: test1Output.length > 0 ? '✅ PASS' : '❌ FAIL',
    });

    // Test 2: 模拟overview/route.ts的完整流程
    const sd = '2026-06-07';
    const ed = '2026-06-13';
    const start = new Date(sd);
    const end = new Date(ed);

    const workDays = calcWorkDays({
      start,
      end,
      holidays: new Set(),
      extraWorkdays: new Set(),
    });

    report.tests.push({
      name: 'Test 2: 模拟overview流程 (new Date from string)',
      input: { sd, ed, startType: typeof start, endType: typeof end },
      output: { count: workDays.length, days: workDays.map(d => d.toISOString().split('T')[0]) },
      status: workDays.length > 0 ? '✅ PASS' : '❌ FAIL',
    });

    // Test 3: 检查当前时间
    const now = new Date();
    const thisWeekStart = new Date(now);
    thisWeekStart.setDate(now.getDate() - now.getDay() + 1); // 周一
    const thisWeekEnd = new Date(thisWeekStart);
    thisWeekEnd.setDate(thisWeekStart.getDate() + 6); // 周日

    const thisWeekDays = calcWorkDays({
      start: thisWeekStart,
      end: thisWeekEnd,
      holidays: new Set(),
      extraWorkdays: new Set(),
    });

    report.tests.push({
      name: 'Test 3: 使用动态计算的本周日期',
      input: {
        now: now.toISOString(),
        weekStart: thisWeekStart.toISOString(),
        weekEnd: thisWeekEnd.toISOString(),
      },
      output: { count: thisWeekDays.length },
      status: thisWeekDays.length > 0 ? '✅ PASS' : '❌ FAIL',
    });

    // Test 4: 检查数据库中的团队配置
    try {
      const teamConfigs = await prisma.teamConfig.findMany({
        take: 5,
        select: { id: true, name: true, tapdProjectIds: true },
      });

      report.tests.push({
        name: 'Test 4: 数据库团队配置样本',
        input: null,
        output: { count: teamConfigs.length, samples: teamConfigs.map(tc => ({ id: tc.id, name: tc.name, projectCount: JSON.parse(tc.tapdProjectIds || '[]').length })) },
        status: teamConfigs.length > 0 ? '✅ PASS' : '⚠️ NO DATA',
      });
    } catch (e) {
      report.tests.push({
        name: 'Test 4: 数据库查询失败',
        input: null,
        output: { error: (e as Error).message },
        status: '❌ ERROR',
      });
    }

    // 结论
    const allPass = report.tests.every(t => t.status.includes('PASS'));
    const hasFail = report.tests.some(t => t.status.includes('FAIL'));

    if (allPass) {
      report.conclusion = '✅ 所有测试通过，calcWorkDays函数正常工作。如果实际API仍返回workDayCount=0，问题可能在数据传递环节或前端参数。';
    } else if (hasFail) {
      report.conclusion = '❌ 发现workDayCount=0的原因，需要修复。';
    } else {
      report.conclusion = '⚠️ 部分测试未通过，需要进一步排查。';
    }

    return NextResponse.json({ success: true, data: report });
  } catch (error) {
    console.error('[debug-workday-zero] Error:', error);
    return NextResponse.json(
      { success: false, message: (error as Error).message },
      { status: 500 }
    );
  }
}
