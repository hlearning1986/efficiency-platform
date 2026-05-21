import { PrismaClient } from '@/generated/prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';

const adapter = new PrismaBetterSqlite3({
  url: 'file:./prisma/dev.db',
});
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('=== 创建TAPD同步任务 ===\n');
  
  // 创建同步任务
  const job = await prisma.tapdSyncRecord.create({
    data: {
      syncType: 'full',
      workspaceIds: ['48763054'], // 高顿直播间
      dataTypes: ['story', 'task', 'iteration'],
      status: 'running',
      progress: 0,
    },
  });
  
  console.log(`✅ 同步任务已创建: ${job.id}`);
  console.log(`   - 项目ID: 48763054 (高顿直播间)`);
  console.log(`   - 数据类型: story, task, iteration`);
  
  await prisma.$disconnect();
}

main().catch(console.error);