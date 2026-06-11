const Database = require('better-sqlite3');
const db = new Database('./prisma/dev.db');

console.log('=== tapd_story 关键字段分布 ===');

// 查看workspace_id分布
const workspaceDist = db.prepare("SELECT workspace_id, COUNT(*) as cnt FROM tapd_story GROUP BY workspace_id").all();
console.log('\n1. workspace_id 分布:');
workspaceDist.forEach(w => console.log(`   ${w.workspace_id}: ${w.cnt} 条`));

// 查看status分布
const statusDist = db.prepare("SELECT status, COUNT(*) as cnt FROM tapd_story GROUP BY status ORDER BY cnt DESC").all();
console.log('\n2. status 分布:');
statusDist.forEach(s => console.log(`   ${s.status}: ${s.cnt} 条`));

// 查看completed字段情况
const completedStats = db.prepare("SELECT COUNT(*) as total, SUM(CASE WHEN completed IS NOT NULL THEN 1 ELSE 0 END) as has_completed, SUM(CASE WHEN completed IS NULL THEN 1 ELSE 0 END) as no_completed FROM tapd_story").get();
console.log('\n3. completed 字段统计:');
console.log(`   总数: ${completedStats.total}`);
console.log(`   有完成时间: ${completedStats.has_completed}`);
console.log(`   无完成时间: ${completedStats.no_completed}`);

// 查看tapd_workspace表
const workspaces = db.prepare("SELECT id, name FROM tapd_workspace LIMIT 10").all();
console.log('\n4. tapd_workspace 表（前10条）:');
workspaces.forEach(w => console.log(`   ${w.id}: ${w.name}`));

// 检查是否有已发布/已实现的数据
const releasedData = db.prepare("SELECT COUNT(*) as cnt FROM tapd_story WHERE status IN ('released', '已发布', 'implemented', '已实现')").get();
console.log(`\n5. 已发布/已实现的需求数量: ${releasedData.cnt}`);

// 查看所有不同的状态值
const allStatuses = db.prepare("SELECT DISTINCT status FROM tapd_story").all();
console.log('\n6. 所有状态值:');
allStatuses.forEach(s => console.log(`   ${s.status}`));

db.close();
