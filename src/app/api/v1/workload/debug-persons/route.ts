/**
 * GET /api/v1/workload/debug-persons
 * 人员列表调试接口 - 用于诊断persons API失败原因
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const debug = {
      timestamp: new Date().toISOString(),
      steps: [] as Array<{ step: string; status: string; data?: any; error?: string }>,
    };

    // Step 1: 快速数据库连接测试
    try {
      await prisma.$queryRaw`SELECT 1 as ok`;
      debug.steps.push({ step: '1. 数据库连接', status: '✅ 正常' });
    } catch (error) {
      debug.steps.push({ step: '1. 数据库连接', status: '❌ 失败', error: (error as Error).message });
      return NextResponse.json({ success: true, data: debug });
    }

    // Step 2: 团队配置数量（不返回详细数据）
    try {
      const count = await prisma.teamConfig.count();
      debug.steps.push({ step: '2. 团队配置', status: `✅ ${count} 个团队` });
    } catch (error) {
      debug.steps.push({ step: '2. 团队配置', status: '❌ 失败', error: (error as Error).message });
    }

    // Step 3: 需求总数
    try {
      const count = await prisma.tapdStory.count();
      debug.steps.push({ step: '3. 需求(Stories)', status: `✅ ${count} 条` });
    } catch (error) {
      debug.steps.push({ step: '3. 需求(Stories)', status: '❌ 失败', error: (error as Error).message });
    }

    // Step 4: 任务总数
    try {
      const count = await prisma.tapdTask.count();
      debug.steps.push({ step: '4. 任务(Tasks)', status: `✅ ${count} 条` });
    } catch (error) {
      debug.steps.push({ step: '4. 任务(Tasks)', status: '❌ 失败', error: (error as Error).message });
    }

    // Step 5: 有负责人的任务数（限制查询）
    try {
      const count = await prisma.tapdTask.count({
        where: { owner: { not: null } },
      });
      debug.steps.push({ step: '5. 有负责人任务', status: `✅ ${count} 条` });
    } catch (error) {
      debug.steps.push({ step: '5. 有负责人任务', status: '❌ 失败', error: (error as Error).message });
    }

    // 总结
    const failedSteps = debug.steps.filter((s) => s.status.includes('❌'));
    if (failedSteps.length > 0) {
      debug.steps.push({
        step: '总结',
        status: `⚠️ ${failedSteps.length} 个问题`,
      });
    } else {
      debug.steps.push({ step: '总结', status: '✅ 基础数据正常' });
    }

    return NextResponse.json({ success: true, data: debug });
  } catch (error) {
    console.error('[debug-persons] Error:', error);
    return NextResponse.json(
      { success: false, message: (error as Error).message },
      { status: 500 }
    );
  }
}
