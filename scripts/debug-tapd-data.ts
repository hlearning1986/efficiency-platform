import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import Database from 'better-sqlite3';

const database = new Database('./prisma/dev.db');
const adapter = new PrismaBetterSqlite3(database);
const prisma = new PrismaClient({ adapter });

async function debugData() {
  console.log('🔍 检查 TAPD 数据...\n');

  try {
    // 获取最新的一条需求数据
    const story = await prisma.tapdStory.findFirst({
      orderBy: { syncedAt: 'desc' },
    });

    if (!story) {
      console.log('❌ 数据库中没有数据！请先同步数据。');
      return;
    }

    console.log('📋 最新需求记录:');
    console.log(`   ID: ${story.id}`);
    console.log(`   名称: ${story.name}`);
    console.log(`   状态: ${story.status}`);
    console.log('');

    console.log('🔎 关键字段检查:');
    console.log(`   workspaceName (项目归属源): ${story.workspaceName || '❌ 空'}`);
    console.log(`   created (创建时间): ${story.created || '❌ 空'}`);
    console.log(`   completed (完成时间): ${story.completed || '❌ 空'}`);
    console.log('');

    console.log('🏷️  自定义字段检查:');
    console.log(`   customField10 (按时提测): ${story.customField10 || '❌ 空'}`);
    console.log(`   customField11 (成本归属): ${story.customField11 || '❌ 空'}`);
    console.log(`   customField13 (项目归属): ${story.customField13 || '❌ 空'}`);
    console.log('');

    // 检查 rawJson 中的原始数据
    if (story.rawJson) {
      const raw = story.rawJson as Record<string, unknown>;
      console.log('📦 RawJSON 中的关键字段:');
      
      const fieldsToCheck = [
        'workspace_name', 'created', 'completed',
        'custom_field_10', 'custom_field_11', 'custom_field_13',
        'custom_field_ten', 'custom_field_eleven', 'custom_field_thirteen'
      ];
      
      for (const field of fieldsToCheck) {
        const value = raw[field];
        console.log(`   ${field}: ${value !== undefined ? JSON.stringify(value) : '❌ 不存在'}`);
      }
      
      // 列出 rawJson 的所有顶层键
      console.log('\n📑 RawJSON 所有字段:');
      console.log(Object.keys(raw).join(', '));
    }

  } catch (error) {
    console.error('❌ 错误:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debugData();
