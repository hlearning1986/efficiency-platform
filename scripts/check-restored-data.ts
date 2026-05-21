import { PrismaClient } from '@/generated/prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';

const adapter = new PrismaBetterSqlite3({
  url: 'file:./prisma/dev.db',
});
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('=== 检查恢复的数据库内容 ===\n');
  
  // 检查用户
  const users = await prisma.userAccount.findMany();
  console.log(`📧 用户数量: ${users.length}`);
  for (const u of users) {
    console.log(`   - ${u.email} (${u.role})`);
  }
  
  // 检查项目
  const projects = await prisma.project.findMany({
    select: {
      id: true,
      name: true,
      code: true,
      status: true,
      progress: true,
      category: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });
  
  console.log(`\n📊 项目数量: ${projects.length}`);
  for (const p of projects) {
    console.log(`   - [${p.code}] ${p.name} | ${p.status} | ${p.progress}% | ${p.category}`);
  }
  
  // 检查 TAPD 配置
  const tapdConfig = await prisma.systemSetting.findUnique({
    where: { key: 'tapd_api_config' },
  });
  
  if (tapdConfig?.value) {
    const config = JSON.parse(tapdConfig.value);
    console.log(`\n🔑 TAPD API 配置: ✅ 已配置`);
    console.log(`   - apiUser: ${config.apiUser}`);
  } else {
    console.log(`\n⚠️  TAPD API 配置: ❌ 未配置`);
  }
  
  await prisma.$disconnect();
}

main().catch(console.error);