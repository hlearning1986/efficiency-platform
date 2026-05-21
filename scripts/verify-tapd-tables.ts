import { PrismaClient } from '@/generated/prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';

const adapter = new PrismaBetterSqlite3({
  url: 'file:./prisma/dev.db',
});
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('=== 验证TAPD数据表创建 ===\n');
  
  // 检查 TAPD 表是否存在
  const tables = ['tapdStory', 'tapdTask', 'tapdBug', 'tapdIteration', 'tapdTimesheet', 'tapdSyncRecord', 'systemSetting'];
  
  for (const table of tables) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const model = (prisma as any)[table];
      if (model) {
        const count = await model.count();
        console.log(`✅ ${table}: ${count} 条记录`);
      }
    } catch (e: unknown) {
      const error = e as Error;
      console.log(`❌ ${table}: ${error.message}`);
    }
  }
  
  // 检查并配置 TAPD API
  console.log('\n=== 配置TAPD API凭据 ===');
  
  const existingConfig = await prisma.systemSetting.findUnique({
    where: { key: 'tapd_api_config' },
  });
  
  if (!existingConfig?.value || !JSON.parse(existingConfig.value).apiUser) {
    await prisma.systemSetting.upsert({
      where: { key: 'tapd_api_config' },
      update: {
        value: JSON.stringify({
          apiUser: 'wbWhrnNk',
          apiPassword: '7D951DCB-BD85-5785-1F61-2C60415DE04F'
        })
      },
      create: {
        key: 'tapd_api_config',
        value: JSON.stringify({
          apiUser: 'wbWhrnNk',
          apiPassword: '7D951DCB-BD85-5785-1F61-2C60415DE04F'
        })
      }
    });
    console.log('✅ TAPD API 凭据已配置');
  } else {
    const config = JSON.parse(existingConfig.value);
    console.log(`✅ TAPD API 已配置 (${config.apiUser})`);
  }
  
  // 检查项目数量
  const projectCount = await prisma.project.count();
  console.log(`\n📊 项目总数: ${projectCount}`);
  
  await prisma.$disconnect();
}

main().catch(console.error);