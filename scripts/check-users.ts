import { PrismaClient } from '@/generated/prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';

const adapter = new PrismaBetterSqlite3({
  url: 'file:./prisma/dev.db',
});
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('=== 检查用户数据 ===');
  
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      password: true,
      role: true,
    }
  });
  
  console.log('用户数量:', users.length);
  console.log('用户列表:');
  for (const user of users) {
    console.log(`- ${user.email} | 密码: ${user.password} | 角色: ${user.role}`);
  }
  
  await prisma.$disconnect();
}

main().catch(console.error);