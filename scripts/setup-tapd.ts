import { PrismaClient } from '@/generated/prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';

const adapter = new PrismaBetterSqlite3({
  url: 'file:./prisma/dev.db',
});
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('正在配置 TAPD API 凭据...');
  
  const config = await prisma.systemSetting.upsert({
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
  
  console.log('✅ TAPD API 配置成功!');
  console.log('   - apiUser:', (JSON.parse(config.value)).apiUser);
  console.log('   - 配置ID:', config.id);
  
  await prisma.$disconnect();
}

main().catch(console.error);