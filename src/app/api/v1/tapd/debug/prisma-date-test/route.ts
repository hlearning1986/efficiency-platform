import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/v1/tapd/debug/prisma-date-test
 * 直接测试 Prisma 日期写入
 */
export async function GET() {
  try {
    const testId = 'PRISMA_TEST_' + Date.now();
    const testDate = new Date('2026-04-02 15:32:08');
    
    console.log('\n🧪 Prisma Date Write Test');
    console.log(`Test ID: ${testId}`);
    console.log(`Input date: ${testDate.toISOString()}\n`);
    
    // 方法1: 使用 create
    console.log('Method 1: prisma.tapdStory.create()...');
    const created = await prisma.tapdStory.create({
      data: {
        id: testId,
        name: 'Prisma日期测试',
        status: 'test',
        workspaceId: '00000000',
        workspaceName: '测试项目',
        created: testDate,
        completed: testDate,
        owner: 'test',
        creator: 'test',
        syncedAt: new Date(),
      },
    });
    
    console.log(`✅ Created! Result:`);
    console.log(`   id: ${created.id}`);
    console.log(`   created: ${created.created}`);
    console.log(`   completed: ${created.completed}`);
    console.log(`   typeof created: ${typeof created.created}`);
    console.log(`   instanceof Date: ${created.created instanceof Date}\n`);
    
    // 查询验证
    console.log('Method 2: Verify with findUnique()...');
    const found = await prisma.tapdStory.findUnique({
      where: { id: testId },
      select: { id: true, created: true, completed: true },
    });
    
    if (found) {
      console.log(`✅ Found in DB:`);
      console.log(`   created: ${found.created}`);
      console.log(`   completed: ${found.completed}\n`);
    }
    
    // 清理
    await prisma.tapdStory.delete({ where: { id: testId } });
    console.log('🗑️  Cleaned up test data\n');
    
    return NextResponse.json({
      success: true,
      input: { testDate: testDate.toISOString() },
      createdResult: {
        id: created.id,
        created: created.created?.toISOString(),
        completed: created.completed?.toISOString(),
      },
      foundResult: {
        created: found?.created?.toISOString(),
        completed: found?.completed?.toISOString(),
      },
    });
    
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('❌ Error:', msg);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
