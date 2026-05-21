import { PrismaClient } from './src/generated/prisma/client';

async function main() {
  process.env.DATABASE_URL = 'file:./prisma/dev.db';
  const prisma = new PrismaClient();

  try {
    console.log('Checking for existing admin user...');
    
    const existingUser = await prisma.userAccount.findUnique({
      where: { email: 'admin@company.com' },
    });

    if (existingUser) {
      console.log('Admin user already exists:', existingUser.email);
      return;
    }

    console.log('Creating organization...');
    const org = await prisma.organization.create({
      data: {
        name: '研发中心',
        level: 'DEPARTMENT',
      },
    });
    console.log(`Created organization: ${org.name}`);

    console.log('Creating team...');
    const team = await prisma.team.create({
      data: {
        name: '平台研发组',
        orgId: org.id,
        techStack: JSON.stringify(['TypeScript', 'React', 'Next.js']),
      },
    });
    console.log(`Created team: ${team.name}`);

    console.log('Creating admin member...');
    const adminMember = await prisma.member.create({
      data: {
        name: '系统管理员',
        employeeNo: 'ADMIN001',
        teamId: team.id,
        role: 'MANAGER',
        level: 'P8',
        skills: JSON.stringify({ languages: ['TypeScript'] }),
        status: 'ACTIVE',
      },
    });
    console.log(`Created member: ${adminMember.name}`);

    console.log('Creating admin user...');
    const userAccount = await prisma.userAccount.create({
      data: {
        memberId: adminMember.id,
        email: 'admin@company.com',
        role: 'ADMIN',
        status: 'ACTIVE',
      },
    });
    console.log(`Created user: ${userAccount.email}`);

    console.log('\n✅ Initialization complete!');
    console.log('Login credentials:');
    console.log('  Email: admin@company.com');
    console.log('  Password: initial_password');

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();