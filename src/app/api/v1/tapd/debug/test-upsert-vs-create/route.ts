import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/v1/tapd/debug/test-upsert-vs-create
 * 对比 upsert (update) 和 create 的行为
 */
export async function GET() {
  const log = [];
  
  try {
    log.push('🔬 测试 upsert vs create...\n');
    
    // 1. 从数据库获取一条已存在的记录
    log.push('步骤1: 查找已存在的记录...');
    const existingRecord = await prisma.tapdStory.findFirst({
      select: { id: true, name: true, created: true },
    });
    
    if (!existingRecord) {
      return NextResponse.json({ error: '无已存在记录' }, { status: 404 });
    }
    
    log.push(`✅ 找到记录: ${existingRecord.id} - ${existingRecord.name}`);
    log.push(`   当前 created: ${existingRecord.created}`);
    
    // 2. 使用 create 创建新记录（测试ID）
    const testDate = new Date('2026-05-20 17:27:57');
    const createTestId = `CREATE_TEST_${Date.now()}`;
    
    log.push('\n步骤2: 使用 CREATE 插入新记录...');
    const created = await prisma.tapdStory.create({
      data: {
        id: createTestId,
        name: 'Create测试',
        status: 'test',
        workspaceId: '00000000',
        workspaceName: '测试项目',
        owner: 'test',
        creator: 'test',
        created: testDate,
        syncedAt: new Date(),
      },
    });
    
    log.push(`✅ Create 成功!`);
    log.push(`   返回的 created: ${created.created}`);
    
    // 3. 验证 create 结果
    const verifyCreated = await prisma.tapdStory.findUnique({
      where: { id: createTestId },
      select: { created: true },
    });
    
    log.push(`   DB验证: ${verifyCreated?.created}`);
    
    // 4. 使用 upsert 更新已存在的记录
    log.push('\n步骤3: 使用 UPSERT 更新已存在的记录...');
    
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
    
    // 模拟 TAPD 返回的数据
    const tapdCreated = '2026-05-21 10:00:00';
    const parsedCreated = parseSafeDate(tapdCreated);
    const safeCreated = safeDateForPrisma(parsedCreated);
    
    log.push(`   输入值: ${tapdCreated}`);
    log.push(`   解析后: ${safeCreated?.toISOString()}`);
    
    // 执行 upsert（会走 update 路径，因为记录已存在）
    const upserted = await prisma.tapdStory.upsert({
      where: { id: existingRecord.id },
      update: {
        name: String(existingRecord.name + '_updated'),
        created: safeCreated,  // 与同步代码完全一致
      },
      create: {
        id: existingRecord.id,
        name: '不应该走这里',
        status: 'test',
        workspaceId: '00000000',
        workspaceName: '测试项目',
        owner: 'test',
        creator: 'test',
        created: safeCreated,
        syncedAt: new Date(),
      },
    });
    
    log.push(`✅ Upsert 成功!`);
    log.push(`   返回的 created: ${upserted.created}`);
    
    // 5. 验证 upsert 结果
    const verifyUpserted = await prisma.tapdStory.findUnique({
      where: { id: existingRecord.id },
      select: { created: true },
    });
    
    log.push(`   DB验证: ${verifyUpserted?.created}`);
    
    // 6. 清理测试数据
    await prisma.tapdStory.delete({ where: { id: createTestId } });
    
    // 恢复原始名称
    await prisma.tapdStory.update({
      where: { id: existingRecord.id },
      data: { name: existingRecord.name.replace('_updated', '') },
    });
    
    log.push('\n📊 结论:');
    if (verifyUpserted?.created && verifyCreated?.created) {
      log.push('   ✅ Create 和 Upsert 都能正常保存日期');
      log.push('   ⚠️  问题可能在其他地方...');
    } else if (!verifyUpserted?.created && verifyCreated?.created) {
      log.push('   ❌ Upsert (update路径) 无法保存日期!');
      log.push('   🎯 这就是问题所在！');
    } else {
      log.push('   ❌ 两者都无法保存日期');
    }
    
    return NextResponse.json({
      success: true,
      logs: log,
      results: {
        create: {
          input: testDate.toISOString(),
          dbResult: verifyCreated?.created?.toISOString(),
          success: !!verifyCreated?.created,
        },
        upsert: {
          input: tapdCreated,
          parsed: safeCreated?.toISOString(),
          dbResult: verifyUpserted?.created?.toISOString(),
          success: !!verifyUpserted?.created,
        },
      },
    });
    
  } catch (error) {
    log.push(`❌ 错误: ${error.message}`);
    return NextResponse.json({ success: false, error: error.message, logs: log }, { status: 500 });
  }
}
