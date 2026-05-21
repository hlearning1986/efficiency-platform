import { PrismaClient } from '@/generated/prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';

const adapter = new PrismaBetterSqlite3({
  url: 'file:./prisma/dev.db',
});
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('=== 检查TAPD原始JSON数据 ===\n');
  
  // 查询一条有完整数据的记录
  const story = await prisma.tapdStory.findFirst({
    where: {
      rawJson: { not: null },
    },
    orderBy: { created: 'desc' },
  });
  
  if (story?.rawJson) {
    const rawData = story.rawJson as Record<string, unknown>;
    
    console.log(`需求ID: ${story.id}`);
    console.log(`需求名称: ${story.name}`);
    console.log('\n=== 原始JSON中的关键字段 ===');
    
    const fieldsToCheck = [
      'custom_field_one', 'custom_field_two', 
      'module', 'Module', 'MODULE',
      'iteration_id', 'iteration_name', 'Iteration', 
      'workspace_name', 'Workspace'
    ];
    
    for (const field of fieldsToCheck) {
      if (rawData[field] !== undefined && rawData[field] !== null && rawData[field] !== '') {
        console.log(`✅ ${field}: ${rawData[field]}`);
      } else {
        console.log(`❌ ${field}: (不存在或为空)`);
      }
    }
    
    console.log('\n=== 原始JSON所有字段 ===');
    console.log(Object.keys(rawData).join(', '));
  }
  
  await prisma.$disconnect();
}

main().catch(console.error);