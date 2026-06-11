/**
 * GET /api/v1/workload/debug-task-api-params
 * 测试不同参数的TAPD Task API调用
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const report = {
      timestamp: new Date().toISOString(),
      tests: [] as any[],
    };

    // 获取TAPD配置
    const config = await prisma.systemSetting.findUnique({
      where: { key: 'tapd_api_config' },
    });

    const tapdConfig = JSON.parse(config?.value || '{}');
    const credentials = Buffer.from(`${tapdConfig.apiUser}:${tapdConfig.apiPassword}`).toString('base64');

    const workspaceId = '35153283';

    // 测试1：不带时间参数（获取所有Task）
    console.log(`Test 1: 获取所有Task...`);
    try {
      const resp1 = await fetch(`https://api.tapd.cn/tasks?workspace_id=${workspaceId}&limit=10&page=1`, {
        headers: { Authorization: `Basic ${credentials}` }
      });
      const result1 = await resp1.json();
      report.tests.push({
        name: '无时间限制',
        url: `tasks?workspace_id=${workspaceId}&limit=10`,
        status: resp1.status,
        count: result1.data?.length || 0,
        sample: result1.data?.[0]?.Task ? Object.keys(result1.data[0].Task) : [],
      });
    } catch (e) {
      report.tests.push({ name: '无时间限制', error: (e as Error).message });
    }

    // 测试2：使用modified_time参数
    console.log(`Test 2: 使用modified_time...`);
    try {
      const resp2 = await fetch(`https://api.tapd.cn/tasks?workspace_id=${workspaceId}&modified_time_start=2026-06-01&limit=10&page=1`, {
        headers: { Authorization: `Basic ${credentials}` }
      });
      const result2 = await resp2.json();
      report.tests.push({
        name: '按修改时间',
        url: `tasks?modified_time_start=2026-06-01`,
        status: resp2.status,
        count: result2.data?.length || 0,
      });
    } catch (e) {
      report.tests.push({ name: '按修改时间', error: (e as Error).message });
    }

    // 测试3：检查API文档中的字段名
    console.log(`Test 3: 检查字段...`);
    try {
      const resp3 = await fetch(`https://api.tapd.cn/tasks?workspace_id=${workspaceId}&limit=5&page=1&fields=id,name,owner,effort,begin,due`, {
        headers: { Authorization: `Basic ${credentials}` }
      });
      const result3 = await resp3.json();
      
      if (result3.data?.[0]) {
        const task = result3.data[0].Task;
        report.tests.push({
          name: '检查字段',
          count: result3.data.length,
          fields: task ? Object.keys(task) : [],
          hasEffort: 'effort' in (task || {}),
          hasBegin: 'begin' in (task || {}),
          hasDue: 'due' in (task || {}),
          sample: task,
        });
      } else {
        report.tests.push({ name: '检查字段', count: 0, message: '无数据' });
      }
    } catch (e) {
      report.tests.push({ name: '检查字段', error: (e as Error).message });
    }

    return NextResponse.json({ success: true, data: report });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: (error as Error).message },
      { status: 500 }
    );
  }
}
