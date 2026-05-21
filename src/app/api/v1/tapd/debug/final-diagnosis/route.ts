import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/v1/tapd/debug/final-diagnosis
 * 最终诊断：完整模拟同步流程
 */
export async function GET() {
  const log = [];
  
  try {
    log.push('🔬 开始最终诊断...\n');
    
    // 1. 从 TAPD API 获取真实数据
    const config = await prisma.systemSetting.findUnique({
      where: { key: 'tapd_api_config' },
    });
    
    if (!config?.value) {
      return NextResponse.json({ error: '未配置' }, { status: 400 });
    }
    
    const { apiUser, apiPassword } = JSON.parse(config.value);
    const credentials = Buffer.from(`${apiUser}:${apiPassword}`).toString('base64');
    
    log.push('步骤1: 调用 TAPD API...');
    const resp = await fetch(
      'https://api.tapd.cn/stories?workspace_id=37198579&limit=1&page=1',
      { headers: { Authorization: `Basic ${credentials}` } }
    );
    const data = await resp.json();
    const rawStory = data.data?.data?.[0];
    const story = rawStory?.Story || rawStory;
    
    if (!story) {
      return NextResponse.json({ error: '无数据' }, { status: 404 });
    }
    
    log.push(`✅ 获取到需求: ${story.id} - ${story.name}`);
    log.push(`   raw created: ${story.created} (typeof: ${typeof story.created})`);
    
    // 2. 复制同步代码中的解析逻辑
    function parseSafeDate(dateValue) {
      if (!dateValue) return null;
      
      const dateStr = String(dateValue).trim();
      if (!dateStr) return null;
      
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
    
    // 3. 测试解析
    log.push('\n步骤2: 执行日期解析...');
    const parsedCreated = parseSafeDate(story.created);
    const safeCreated = safeDateForPrisma(parsedCreated);
    
    log.push(`   parseSafeDate result: ${parsedCreated?.toISOString() || 'null'}`);
    log.push(`   safeDateForPrisma result: ${safeCreated?.toISOString() || 'null'}`);
    
    // 4. 使用完全相同的 upsert 逻辑插入
    log.push('\n步骤3: 执行 Prisma upsert...');
    const testId = `DIAG_${story.id}_${Date.now()}`;
    
    const upsertResult = await prisma.tapdStory.upsert({
      where: { id: testId },
      update: {},
      create: {
        id: testId,
        name: story.name,
        status: String(story.status || ''),
        workspaceId: String(story.workspace_id || ''),
        workspaceName: String(story.workspace_name || ''),
        owner: String(story.owner || ''),
        creator: String(story.creator || ''),
        created: safeCreated,  // 使用解析后的日期
        completed: safeDateForPrisma(parseSafeDate(story.completed)),
        syncedAt: new Date(),
        rawJson: story,
      },
    });
    
    log.push(`✅ Upsert 成功!`);
    log.push(`   返回的 created: ${upsertResult.created}`);
    log.push(`   返回的 completed: ${upsertResult.completed}`);
    
    // 5. 立即查询验证
    log.push('\n步骤4: 查询验证...');
    const verified = await prisma.tapdStory.findUnique({
      where: { id: testId },
      select: { id: true, created: true, completed: true },
    });
    
    if (verified) {
      log.push(`✅ 查询成功:`);
      log.push(`   DB created: ${verified.created}`);
      log.push(`   DB completed: ${verified.completed}`);
      
      // 判断结果
      const success = verified.created !== null && verified.created !== undefined;
      log.push(`\n${success ? '🎉 成功! 日期已正确保存!' : '❌ 失败! 日期仍为空!'}`);
    }
    
    // 清理
    await prisma.tapdStory.delete({ where: { id: testId } });
    log.push('\n🗑️  已清理测试数据');
    
    return NextResponse.json({
      success: true,
      logs: log,
      diagnosis: {
        input: { created: story.created, type: typeof story.created },
        parsed: parsedCreated?.toISOString(),
        safe: safeCreated?.toISOString(),
        upsertResult: {
          created: upsertResult.created?.toISOString(),
          completed: upsertResult.completed?.toISOString(),
        },
        dbResult: {
          created: verified?.created?.toISOString(),
          completed: verified?.completed?.toISOString(),
        },
      },
    });
    
  } catch (error) {
    log.push(`❌ 错误: ${error.message}`);
    return NextResponse.json({ success: false, error: error.message, logs: log }, { status: 500 });
  }
}
