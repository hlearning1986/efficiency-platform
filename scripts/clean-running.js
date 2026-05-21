const Database = require('better-sqlite3');
const db = new Database('./prisma/dev.db');

console.log('🧹 清理正在运行的同步任务...\n');

const runningJobs = db.prepare("SELECT * FROM tapd_sync_record WHERE status = 'running'").all();

console.log(`找到 ${runningJobs.length} 个正在运行的任务`);

for (const job of runningJobs) {
  console.log(`  - 清理任务: ${job.id}`);
  db.prepare("UPDATE tapd_sync_record SET status = 'failed', error_msg = '手动清理' WHERE id = ?").run(job.id);
}

console.log('\n✅ 清理完成！');
db.close();
