import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/v1/tapd/debug/minimal-sync
 * 最小化同步测试 - 完全复制同步代码逻辑
 */
export async function POST(req: NextRequest) {
  const log = [];
  
  try {
    const body = await req.json();
    const workspaceId = body.workspaceId || '37198579';
    
    log.push('🧪 开始最小化同步测试...\n');
    
    // 1. 获取 TAPD 配置
    const config = await prisma.systemSetting.findUnique({
      where: { key: 'tapd_api_config' },
    });
    
    if (!config?.value) {
      return NextResponse.json({ error: '未配置' }, { status: 400 });
    }
    
    const { apiUser, apiPassword } = JSON.parse(config.value);
    const credentials = Buffer.from(`${apiUser}:${apiPassword}`).toString('base64');
    
    // 2. 通过 skill-proxy 调用 TAPD API（与同步代码完全一致）
    log.push('步骤1: 通过 skill-proxy 调用 TAPD API...');
    
    const proxyResp = await fetch('http://localhost:3000/api/v1/tapd/skill-proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        service: 'stories',
        action: 'list',
        workspaceIds: [workspaceId],
        params: {
          limit: 3,
          page: 1,
          created: '2026-01-01~2026-12-31',
        },
      }),
    });
    
    const proxyResult = await proxyResp.json();
    
    if (!proxyResult.success || !proxyResult.data?.[0]?.data?.data) {
      log.push(`❌ Proxy 调用失败: ${proxyResult.message || proxyResult.errors}`);
      return NextResponse.json({ success: false, error: 'Proxy调用失败', logs: log }, { status: 500 });
    }
    
    const stories = (proxyResult.data[0].data.data || []).map(item => item.Story || item);
    
    log.push(`✅ 获取到 ${stories.length} 条需求`);
    
    // 3. 复制同步代码中的日期解析函数
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
    
    // 4. 对每条数据执行 upsert（与同步代码完全一致）
    log.push('\n步骤2: 执行 upsert...');
    const results = [];
    
    for (const s of stories) {
      const id = `MIN_TEST_${s.id}_${Date.now()}`;
      
      log.push(`\n处理需求 #${s.id}: ${s.name}`);
      log.push(`  输入 created: ${s.created} (${typeof s.created})`);
      
      // 解析日期（与同步代码完全一致）
      const parsedCreated = parseSafeDate(s.created);
      const safeCreated = safeDateForPrisma(parsedCreated);
      const parsedCompleted = parseSafeDate(s.completed);
      const safeCompleted = safeDateForPrisma(parsedCompleted);
      
      log.push(`  解析后 created: ${safeCreated?.toISOString() || 'null'}`);
      log.push(`  解析后 completed: ${safeCompleted?.toISOString() || 'null'}`);
      
      try {
        // 执行 upsert（使用 create，因为测试ID不存在）
        const upsertResult = await prisma.tapdStory.create({
          data: {
            id,
            name: String(s.name || ''),
            status: String(s.status || ''),
            workspaceId: String(s.workspace_id || ''),
            workspaceName: String(s.workspace_name || ''),
            owner: String(s.owner || ''),
            creator: String(s.creator || ''),
            created: safeCreated,
            completed: safeCompleted,
            customField10: String(s.custom_field_10 || ''),
            customField11: String(s.custom_field_11 || ''),
            customField13: String(s.custom_field_13 || ''),
            syncedAt: new Date(),
            rawJson: s,
          },
        });
        
        log.push(`  ✅ Upsert 成功!`);
        log.push(`     返回的 created: ${upsertResult.created}`);
        log.push(`     返回的 completed: ${upsertResult.completed}`);
        
        // 立即查询验证
        const verified = await prisma.tapdStory.findUnique({
          where: { id },
          select: { created: true, completed: true },
        });
        
        log.push(`  📊 DB验证:`);
        log.push(`     DB created: ${verified?.created}`);
        log.push(`     DB completed: ${verified?.completed}`);
        
        results.push({
          inputId: s.id,
          testId: id,
          inputCreated: s.created,
          parsedCreated: safeCreated?.toISOString(),
          dbCreated: verified?.created?.toISOString(),
          dbCompleted: verified?.completed?.toISOString(),
          dbCreatedType: typeof verified?.created,
          dbCompletedType: typeof verified?.completed,
          upsertResultCreated: upsertResult.created?.toISOString(),
          success: verified?.created !== null && verified?.created !== undefined,
        });
        
        // 清理测试数据
        await prisma.tapdStory.delete({ where: { id } });
        log.push(`  🗑️  已清理`);
        
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        const errStack = error instanceof Error ? error.stack : '';
        log.push(`  ❌ Upsert 错误: ${errMsg}`);
        if (errStack) {
          log.push(`     Stack: ${errStack.substring(0, 500)}`);
        }
        results.push({
          inputId: s.id,
          error: errMsg,
          stack: errStack?.substring(0, 1000),
          success: false,
        });
      }
    }
    
    // 统计结果
    const successCount = results.filter(r => r.success).length;
    const failCount = results.length - successCount;
    
    log.push(`\n\n📈 测试结果:`);
    log.push(`   成功: ${successCount}/${results.length}`);
    log.push(`   失败: ${failCount}/${results.length}`);
    
    if (failCount === 0 && results.length > 0) {
      log.push(`\n🎉 所有测试通过! 日期保存正常!`);
      log.push(`\n⚠️  这说明问题不在日期解析或Prisma写入，而在其他地方...`);
    } else {
      log.push(`\n❌ 存在失败案例，需要进一步排查`);
    }
    
    return NextResponse.json({
      success: true,
      summary: { total: results.length, success: successCount, failed: failCount },
      logs: log,
      details: results,
    });
    
  } catch (error) {
    log.push(`❌ 致命错误: ${error.message}`);
    return NextResponse.json({ 
      success: false, 
      error: error.message, 
      logs: log 
    }, { status: 500 });
  }
}
