import { PrismaClient } from '@/generated/prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';

const adapter = new PrismaBetterSqlite3({
  url: 'file:./prisma/dev.db',
});
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('=== 补充缺失的字段数据 ===\n');
  
  // 1. 从原始JSON中提取 module 字段
  console.log('1️⃣ 更新 module 字段...');
  const stories = await prisma.tapdStory.findMany({
    where: {
      rawJson: { not: null },
    },
    select: { id: true, rawJson: true, module: true },
  });
  
  let moduleUpdated = 0;
  for (const story of stories) {
    const rawData = story.rawJson as Record<string, unknown>;
    const moduleValue = String(rawData['module'] || '');
    
    if (moduleValue && story.module !== moduleValue) {
      await prisma.tapdStory.update({
        where: { id: story.id },
        data: { module: moduleValue },
      });
      moduleUpdated++;
    }
  }
  console.log(`   ✅ 已更新 ${moduleUpdated} 条记录的 module 字段`);
  
  // 2. 根据 iteration_id 填充 iterationName
  console.log('\n2️⃣ 更新迭代名称...');
  const iterations = await prisma.tapdIteration.findMany();
  const iterationMap = new Map(iterations.map(i => [i.id, i.name]));
  
  let iterationUpdated = 0;
  for (const story of stories) {
    if (!story.rawJson) continue;
    
    const rawData = story.rawJson as Record<string, unknown>;
    const iterationId = String(rawData['iteration_id'] || '');
    
    if (iterationId && iterationMap.has(iterationId)) {
      const iterationName = iterationMap.get(iterationId);
      
      // 检查当前数据库中的值
      const currentStory = await prisma.tapdStory.findUnique({
        where: { id: story.id },
        select: { iterationId: true, iterationName: true }
      });
      
      if (currentStory && !currentStory.iterationName && iterationName) {
        await prisma.tapdStory.update({
          where: { id: story.id },
          data: { 
            iterationId,
            iterationName 
          },
        });
        iterationUpdated++;
      }
    }
  }
  console.log(`   ✅ 已更新 ${iterationUpdated} 条记录的迭代名称`);
  
  // 3. 统计结果
  console.log('\n=== 更新后统计 ===');
  
  const totalStories = await prisma.tapdStory.count();
  const withModule = await prisma.tapdStory.count({ where: { module: { not: '' } } });
  const withIteration = await prisma.tapdStory.count({ where: { iterationName: { not: '' } } });
  const withCustomFieldOne = await prisma.tapdStory.count({ where: { customFieldOne: { not: '' } } });
  
  console.log(`总需求数: ${totalStories}`);
  console.log(`有项目归属(module): ${withModule} (${(withModule/totalStories*100).toFixed(1)}%)`);
  console.log(`有迭代信息: ${withIteration} (${(withIteration/totalStories*100).toFixed(1)}%)`);
  console.log(`有成本归属(customFieldOne): ${withCustomFieldOne} (${(withCustomFieldOne/totalStories*100).toFixed(1)}%)`);
  
  // 显示示例
  console.log('\n=== 示例数据 ===');
  const sample = await prisma.tapdStory.findFirst({
    where: { iterationName: { not: '' } },
    orderBy: { created: 'desc' },
    select: {
      id: true,
      name: true,
      workspaceName: true,
      status: true,
      customFieldOne: true,
      module: true,
      iterationName: true,
      owner: true,
      creator: true,
    },
  });
  
  if (sample) {
    console.log(`\n【${sample.id}】${sample.name?.substring(0, 50)}...`);
    console.log(`   所属项目: ${sample.workspaceName}`);
    console.log(`   状态: ${sample.status}`);
    console.log(`   成本归属: '${sample.customFieldOne || '(空)'}'`);
    console.log(`   项目归属: '${sample.module || '(空)'}'`);
    console.log(`   迭代: '${sample.iterationName || '(空)'}'`);
    console.log(`   处理人: ${sample.owner || '(空)'}`);
    console.log(`   创建人: ${sample.creator || '(空)'}`);
  }
  
  await prisma.$disconnect();
}

main().catch(console.error);