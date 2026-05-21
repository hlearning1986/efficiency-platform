import { PrismaClient } from '@/generated/prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';

const adapter = new PrismaBetterSqlite3({
  url: 'file:./prisma/dev.db',
});
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('=== 更新自定义字段映射 ===\n');
  
  const stories = await prisma.tapdStory.findMany({
    where: { rawJson: { not: null } },
    select: { id: true, rawJson: true },
  });
  
  console.log(`找到 ${stories.length} 条需求记录\n`);
  
  let updatedCount = 0;
  
  for (const story of stories) {
    if (!story.rawJson) continue;
    
    const rawData = story.rawJson as Record<string, unknown>;
    
    // 获取自定义字段值
    const customField11 = String(rawData['custom_field_11'] || '');
    const customField13 = String(rawData['custom_field_13'] || '');
    const customField10 = String(rawData['custom_field_10'] || '');
    const customFieldSix = String(rawData['custom_field_six'] || '');
    
    // 只有当有值时才更新
    const hasUpdates = customField11 || customField13 || customField10 || customFieldSix;
    
    if (hasUpdates) {
      await prisma.tapdStory.update({
        where: { id: story.id },
        data: {
          ...(customField11 ? { customField11 } : {}),
          ...(customField13 ? { customField13 } : {}),
          ...(customField10 ? { customField10 } : {}),
          ...(customFieldSix ? { customFieldSix } : {}),
        }
      });
      updatedCount++;
    }
  }
  
  console.log(`✅ 已更新 ${updatedCount} 条记录`);
  
  // 统计结果
  console.log('\n=== 更新后统计 ===');
  
  const totalStories = await prisma.tapdStory.count();
  const withCostAttribution = await prisma.tapdStory.count({ 
    where: { customField11: { not: '' } } 
  });
  const withProjectAttribution = await prisma.tapdStory.count({ 
    where: { customField13: { not: '' } } 
  });
  const withOnTimeTesting = await prisma.tapdStory.count({ 
    where: { customField10: { not: '' } } 
  });
  const withInsertedRequirement = await prisma.tapdStory.count({ 
    where: { customFieldSix: { not: '' } } 
  });
  
  console.log(`总需求数: ${totalStories}`);
  console.log(`有成本归属(customField11): ${withCostAttribution} (${(withCostAttribution/totalStories*100).toFixed(1)}%)`);
  console.log(`有项目归属(customField13): ${withProjectAttribution} (${(withProjectAttribution/totalStories*100).toFixed(1)}%)`);
  console.log(`有按时提测(customField10): ${withOnTimeTesting} (${(withOnTimeTesting/totalStories*100).toFixed(1)}%)`);
  console.log(`有是否插入需求(customFieldSix): ${withInsertedRequirement} (${(withInsertedRequirement/totalStories*100).toFixed(1)}%)`);
  
  // 显示示例数据
  console.log('\n=== 示例数据 ===');
  const sample = await prisma.tapdStory.findFirst({
    where: {
      OR: [
        { customField11: { not: '' } },
        { customField13: { not: '' } }
      ]
    },
    orderBy: { created: 'desc' },
    select: {
      id: true,
      name: true,
      workspaceName: true,
      status: true,
      customField11: true,
      customField13: true,
      customField10: true,
      customFieldSix: true,
      iterationName: true,
      owner: true,
      creator: true,
    },
  });
  
  if (sample) {
    console.log(`\n【${sample.id}】${sample.name?.substring(0, 50)}...`);
    console.log(`   所属项目: ${sample.workspaceName}`);
    console.log(`   状态: ${sample.status}`);
    console.log(`   成本归属: '${sample.customField11 || '(空)'}'`);
    console.log(`   项目归属: '${sample.customField13 || '(空)'}'`);
    console.log(`   迭代: '${sample.iterationName || '(空)'}'`);
    console.log(`   按时提测: '${sample.customField10 || '(空)'}'`);
    console.log(`   是否插入需求: '${sample.customFieldSix || '(空)'}'`);
    console.log(`   处理人: ${sample.owner || '(空)'}`);
    console.log(`   创建人: ${sample.creator || '(空)'}`);
  }
  
  await prisma.$disconnect();
}

main().catch(console.error);