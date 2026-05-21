import { PrismaClient } from '@/generated/prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';

const adapter = new PrismaBetterSqlite3({
  url: 'file:./prisma/dev.db',
});
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('=== 检查需求字段数据 ===\n');
  
  // 查询前5条需求，查看关键字段
  const stories = await prisma.tapdStory.findMany({
    take: 5,
    orderBy: { created: 'desc' },
    select: {
      id: true,
      name: true,
      workspaceName: true,
      status: true,
      customFieldOne: true,  // 成本归属
      module: true,           // 项目归属
      iterationName: true,    // 迭代
      owner: true,
      creator: true,
      effort: true,
      effortCompleted: true,
      due: true,
      completed: true,
      createdFrom: true,
    },
  });
  
  console.log('前5条需求的关键字段值:\n');
  
  for (const story of stories) {
    console.log(`【${story.id}】${story.name?.substring(0, 40)}...`);
    console.log(`   所属项目: ${story.workspaceName || '(空)'}`);
    console.log(`   状态: ${story.status}`);
    console.log(`   成本归属(customFieldOne): '${story.customFieldOne || '(空)'}'`);
    console.log(`   项目归属(module): '${story.module || '(空)'}'`);
    console.log(`   迭代(iterationName): '${story.iterationName || '(空)'}'`);
    console.log(`   处理人: ${story.owner || '(空)'}`);
    console.log(`   创建人: ${story.creator || '(空)'}`);
    console.log(`   预估工时: ${story.effort ?? '(空)'}`);
    console.log(`   完成工时: ${story.effortCompleted ?? '(空)'}`);
    console.log('');
  }
  
  // 统计各字段非空数量
  const totalStories = await prisma.tapdStory.count();
  const withCustomFieldOne = await prisma.tapdStory.count({ where: { customFieldOne: { not: '' } } });
  const withModule = await prisma.tapdStory.count({ where: { module: { not: '' } } });
  const withIteration = await prisma.tapdStory.count({ where: { iterationName: { not: '' } } });
  
  console.log('\n=== 字段填充率统计 ===');
  console.log(`总需求数: ${totalStories}`);
  console.log(`有成本归属: ${withCustomFieldOne} (${(withCustomFieldOne/totalStories*100).toFixed(1)}%)`);
  console.log(`有项目归属: ${withModule} (${(withModule/totalStories*100).toFixed(1)}%)`);
  console.log(`有迭代信息: ${withIteration} (${(withIteration/totalStories*100).toFixed(1)}%)`);
  
  await prisma.$disconnect();
}

main().catch(console.error);