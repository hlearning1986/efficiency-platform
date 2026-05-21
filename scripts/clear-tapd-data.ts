import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import Database from 'better-sqlite3';

const database = new Database('./prisma/dev.db');
const adapter = new PrismaBetterSqlite3(database);
const prisma = new PrismaClient({ adapter });

async function clearTapdData() {
  console.log('🗑️  开始清理 TAPD 同步数据...\n');

  try {
    // 统计删除前的数据量
    const countsBefore = {
      stories: await prisma.tapdStory.count(),
      tasks: await prisma.tapdTask.count(),
      iterations: await prisma.tapdIteration.count(),
      workspaces: await prisma.tapdWorkspace.count(),
      syncRecords: await prisma.tapdSyncRecord.count(),
      bugs: await prisma.tapdBug.count(),
      timesheets: await prisma.tapdTimesheet.count(),
    };

    console.log('📊 删除前的数据统计:');
    console.log(`   - 需求 (TapdStory): ${countsBefore.stories} 条`);
    console.log(`   - 任务 (TapdTask): ${countsBefore.tasks} 条`);
    console.log(`   - 迭代 (TapdIteration): ${countsBefore.iterations} 条`);
    console.log(`   - 工作空间 (TapdWorkspace): ${countsBefore.workspaces} 条`);
    console.log(`   - 同步记录 (TapdSyncRecord): ${countsBefore.syncRecords} 条`);
    console.log(`   - 缺陷 (TapdBug): ${countsBefore.bugs} 条`);
    console.log(`   - 工时 (TapdTimesheet): ${countsBefore.timesheets} 条`);
    console.log('');

    // 按依赖关系顺序删除（先删子表，再删父表）
    console.log('⏳ 正在删除数据...');

    // 1. 删除工时记录
    const deletedTimesheets = await prisma.tapdTimesheet.deleteMany();
    console.log(`   ✅ 已删除工时记录: ${deletedTimesheets.count} 条`);

    // 2. 删除缺陷
    const deletedBugs = await prisma.tapdBug.deleteMany();
    console.log(`   ✅ 已删除缺陷: ${deletedBugs.count} 条`);

    // 3. 删除任务
    const deletedTasks = await prisma.tapdTask.deleteMany();
    console.log(`   ✅ 已删除任务: ${deletedTasks.count} 条`);

    // 4. 删除需求
    const deletedStories = await prisma.tapdStory.deleteMany();
    console.log(`   ✅ 已删除需求: ${deletedStories.count} 条`);

    // 5. 删除迭代
    const deletedIterations = await prisma.tapdIteration.deleteMany();
    console.log(`   ✅ 已删除迭代: ${deletedIterations.count} 条`);

    // 6. 删除同步记录
    const deletedSyncRecords = await prisma.tapdSyncRecord.deleteMany();
    console.log(`   ✅ 已删除同步记录: ${deletedSyncRecords.count} 条`);

    // 7. 删除工作空间
    const deletedWorkspaces = await prisma.tapdWorkspace.deleteMany();
    console.log(`   ✅ 已删除工作空间: ${deletedWorkspaces.count} 条`);

    console.log('\n✨ 数据清理完成！\n');

    // 验证删除后的数据量
    const countsAfter = {
      stories: await prisma.tapdStory.count(),
      tasks: await prisma.tapdTask.count(),
      iterations: await prisma.tapdIteration.count(),
      workspaces: await prisma.tapdWorkspace.count(),
      syncRecords: await prisma.tapdSyncRecord.count(),
      bugs: await prisma.tapdBug.count(),
      timesheets: await prisma.tapdTimesheet.count(),
    };

    console.log('📊 删除后的数据统计:');
    console.log(`   - 需求 (TapdStory): ${countsAfter.stories} 条`);
    console.log(`   - 任务 (TapdTask): ${countsAfter.tasks} 条`);
    console.log(`   - 迭代 (TapdIteration): ${countsAfter.iterations} 条`);
    console.log(`   - 工作空间 (TapdWorkspace): ${countsAfter.workspaces} 条`);
    console.log(`   - 同步记录 (TapdSyncRecord): ${countsAfter.syncRecords} 条`);
    console.log(`   - 缺陷 (TapdBug): ${countsAfter.bugs} 条`);
    console.log(`   - 工时 (TapdTimesheet): ${countsAfter.timesheets} 条`);

    const totalDeleted = 
      deletedTimesheets.count + 
      deletedBugs.count + 
      deletedTasks.count + 
      deletedStories.count + 
      deletedIterations.count + 
      deletedSyncRecords.count + 
      deletedWorkspaces.count;

    console.log(`\n🎉 总共删除了 ${totalDeleted} 条记录！`);

  } catch (error) {
    console.error('❌ 清理过程中出现错误:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

clearTapdData()
  .then(() => {
    console.log('\n✅ 脚本执行成功！');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ 脚本执行失败:', error);
    process.exit(1);
  });
