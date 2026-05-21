import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import fs from 'fs';
import path from 'path';

/**
 * GET /api/v1/tapd/debug/test-date-parse
 * 测试日期解析逻辑
 */
export async function GET() {
  const logFile = path.join(process.cwd(), 'date-debug.log');
  
  try {
    // 获取 TAPD 配置
    const config = await prisma.systemSetting.findUnique({
      where: { key: 'tapd_api_config' },
    });

    if (!config?.value) {
      return NextResponse.json({ error: '未配置' }, { status: 400 });
    }

    const tapdConfig = JSON.parse(config.value);
    const { apiUser, apiPassword } = tapdConfig;
    const credentials = Buffer.from(`${apiUser}:${apiPassword}`).toString('base64');

    // 调用 TAPD API
    const resp = await fetch(
      'https://api.tapd.cn/stories?workspace_id=37198579&limit=1&page=1',
      {
        headers: { Authorization: `Basic ${credentials}` },
      }
    );
    
    const data = await resp.json();
    const rawStory = data.data?.data?.[0];
    
    if (!rawStory) {
      return NextResponse.json({ error: '无数据' }, { status: 404 });
    }

    const story = rawStory.Story || rawStory;
    
    // 测试日期解析
    const testResults = {
      input: {
        created: story.created,
        completed: story.completed,
        typeof_created: typeof story.created,
        typeof_completed: typeof story.completed,
      },
      tests: [],
    };

    // 导入解析函数（复制关键逻辑）
    function parseSafeDate(dateValue) {
      if (!dateValue) return null;
      
      const dateStr = String(dateValue).trim();
      if (!dateStr) return null;
      
      // 无效模式
      const invalidPatterns = [
        '0000-00-00', '0000/00/00', '0000-00-00 00:00:00', '0000/00/00 00:00:00',
        '1970-01-01', '1970-01-01 00:00:00', '', 'null', 'undefined', 'N/A', 'n/a', '-', '--'
      ];
      
      if (invalidPatterns.some(p => dateStr.toLowerCase().includes(p.toLowerCase()))) {
        return null;
      }
      
      let parsed;
      try {
        parsed = new Date(dateStr);
      } catch {
        return null;
      }
      
      if (isNaN(parsed.getTime())) return null;
      
      const year = parsed.getFullYear();
      if (year < 1990 || year > 2100) return null;
      
      return parsed;
    }

    function safeDateForPrisma(date) {
      if (!date) return null;
      try {
        if (isNaN(date.getTime())) return null;
        const year = date.getFullYear();
        if (year < 1990 || year > 2100) return null;
        return date;
      } catch {
        return null;
      }
    }

    // 测试created
    const parsedCreated = parseSafeDate(story.created);
    const safeCreated = safeDateForPrisma(parsedCreated);
    
    testResults.tests.push({
      field: 'created',
      raw: story.created,
      parsed: parsedCreated?.toISOString(),
      safe: safeCreated?.toISOString(),
      error: !safeCreated ? 'FAILED' : 'OK'
    });

    // 测试completed
    const parsedCompleted = parseSafeDate(story.completed);
    const safeCompleted = safeDateForPrisma(parsedCompleted);
    
    testResults.tests.push({
      field: 'completed',
      raw: story.completed,
      parsed: parsedCompleted?.toISOString(),
      safe: safeCompleted?.toISOString(),
      error: !safeCompleted ? 'FAILED' : 'OK'
    });

    // 写入日志文件
    const logContent = `[${new Date().toISOString()}] Date Parse Test Results:\n${JSON.stringify(testResults, null, 2)}\n\n`;
    fs.appendFileSync(logFile, logContent);

    return NextResponse.json({
      success: true,
      results: testResults,
      logFile,
    });

  } catch (error) {
    const msg = error instanceof Error ? error.message : '未知错误';
    fs.appendFileSync(logFile, `[${new Date().toISOString()}] ERROR: ${msg}\n`);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
