import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/v1/tapd/debug/iteration - 诊断迭代名称为空的问题
 */
export async function GET() {
  try {
    // 1. 检查迭代表数据
    const iterations = await prisma.tapdIteration.findMany({
      take: 10,
      select: {
        id: true,
        name: true,
        workspaceId: true,
        workspaceName: true,
      },
    });

    // 2. 获取所有需求样本（用于分析）
    const allStories = await prisma.tapdStory.findMany({
      take: 300,
      select: {
        id: true,
        name: true,
        iterationId: true,
        iterationName: true,
        workspaceId: true,
        rawJson: true,
      },
    });

    // 3. 过滤出有 iterationId 的需求
    const storiesWithIterationId = allStories.filter(
      (s) => s.iterationId && s.iterationId !== ''
    );

    // 4. 过滤出有 iterationName 的需求
    const storiesWithIterationName = storiesWithIterationId.filter(
      (s) => s.iterationName && s.iterationName !== ''
    );

    // 5. 缺少迭代名称的样本
    const storiesWithEmptyName = storiesWithIterationId
      .filter((s) => !s.iterationName || s.iterationName === '')
      .slice(0, 5);

    // 6. 原始 JSON 样本（用于分析 TAPD API 返回值）
    const rawJsonSamples = storiesWithIterationId.slice(0, 3).map((s) => ({
      id: s.id,
      name: s.name,
      iterationId: s.iterationId,
      iterationName: s.iterationName,
      rawIterationData: s.rawJson ? {
        iteration_id: (s.rawJson as Record<string, unknown>)?.iteration_id,
        iteration_name: (s.rawJson as Record<string, unknown>)?.iteration_name,
        Iteration: (s.rawJson as Record<string, unknown>)?.Iteration,
      } : null,
    }));

    return NextResponse.json({
      success: true,
      data: {
        timestamp: new Date().toISOString(),
        
        // 迭代表统计
        iterationTable: {
          totalIterations: await prisma.tapdIteration.count(),
          sampleIterations: iterations,
        },

        // 需求表统计
        storyStats: {
          totalStories: await prisma.tapdStory.count(),
          totalWithIterationId: storiesWithIterationId.length,
          totalWithIterationName: storiesWithIterationName.length,
          missingIterationNameCount: storiesWithIterationId.length - storiesWithIterationName.length,
          missingRate: storiesWithIterationId.length > 0 
            ? ((storiesWithIterationId.length - storiesWithIterationName.length) / storiesWithIterationId.length * 100).toFixed(2) + '%'
            : '0%',
        },

        // 缺少迭代名称的样本
        samplesWithEmptyName: storiesWithEmptyName,

        // 原始 JSON 样本
        rawJsonSamples,
        
        diagnosis: getDiagnosis(
          storiesWithIterationId.length, 
          storiesWithIterationName.length, 
          iterations.length
        ),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '诊断失败';
    console.error('Iteration Debug error:', error);
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

function getDiagnosis(
  withId: number, 
  withName: number, 
  iterationCount: number
): string[] {
  const recommendations: string[] = [];
  
  if (withId === 0) {
    recommendations.push('ℹ️ 所有需求都没有关联迭代');
  } else if (withName === 0 && withId > 0) {
    recommendations.push('❌ 严重问题：所有关联了迭代的需求都没有迭代名称');
    recommendations.push('🔍 可能原因：TAPD API 未返回 iteration_name 字段');
    recommendations.push('💡 建议：检查 TAPD API 响应中是否包含 iteration_name');
  } else if (withName < withId) {
    const missingRate = ((withId - withName) / withId * 100).toFixed(1);
    recommendations.push(`⚠️ 部分需求缺少迭代名称：${withId - withName} 条 (${missingRate}%)`);
    
    if (iterationCount > 0) {
      recommendations.push('💡 可以通过 iterationId 关联迭代表补充名称');
    }
  } else {
    recommendations.push('✅ 迭代名称数据正常');
  }

  return recommendations;
}
