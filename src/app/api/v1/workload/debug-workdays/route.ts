/**
 * GET /api/v1/workload/debug-workdays
 * 工作日计算调试接口
 * 用于诊断为什么workDayCount=0的问题
 */

import { NextResponse } from 'next/server';
import { calcWorkDays } from '../_lib/workday.calc';

export async function GET() {
  try {
    const testCases = [
      {
        name: '测试用例1: 2026-06-07 到 2026-06-13 (本周)',
        start: new Date('2026-06-07'),
        end: new Date('2026-06-13'),
      },
      {
        name: '测试用例2: 2026-06-01 到 2026-06-30 (本月)',
        start: new Date('2026-06-01'),
        end: new Date('2026-06-30'),
      },
      {
        name: '测试用例3: 2026-05-09 到 2026-06-07 (近30天)',
        start: new Date('2026-05-09'),
        end: new Date('2026-06-07'),
      },
    ];

    const results = testCases.map((tc) => {
      const days = calcWorkDays({
        startDate: tc.start,
        endDate: tc.end,
        holidays: new Set(),
        extraWorkdays: new Set(),
      });

      return {
        name: tc.name,
        input: {
          start: tc.start.toISOString(),
          end: tc.end.toISOString(),
          startLocal: tc.start.toLocaleDateString('zh-CN'),
          endLocal: tc.end.toLocaleDateString('zh-CN'),
        },
        output: {
          workDayCount: days.length,
          workDays: days.map((d) => d.toLocaleDateString('zh-CN', { weekday: 'short' })),
        },
      };
    });

    // 额外测试：手动创建Date对象
    const manualTest = {
      name: '手动构建Date对象',
      tests: [
        {
          desc: 'new Date("2026-06-07")',
          value: new Date('2026-06-07').toISOString(),
          valid: !isNaN(new Date('2026-06-07').getTime()),
        },
        {
          desc: 'new Date(2026, 5, 7)',
          value: new Date(2026, 5, 7).toISOString(),
          valid: !isNaN(new Date(2026, 5, 7).getTime()),
        },
        {
          desc: '当前时间',
          value: new Date().toISOString(),
          valid: true,
        },
      ],
    };

    return NextResponse.json({
      success: true,
      data: {
        timestamp: new Date().toISOString(),
        testResults: results,
        manualTest,
        diagnosis: results.every((r) => r.output.workDayCount > 0)
          ? '✅ 工作日计算正常'
          : '❌ 工作日计算异常，所有测试用例都返回0',
      },
    });
  } catch (error) {
    console.error('[debug-workdays] Error:', error);
    return NextResponse.json(
      { success: false, message: (error as Error).message },
      { status: 500 }
    );
  }
}
