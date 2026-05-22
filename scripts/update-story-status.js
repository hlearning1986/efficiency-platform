const Database = require('better-sqlite3');
const db = new Database('./prisma/dev.db');

console.log('\n╔══════════════════════════════════════════════════╗');
console.log('║   📊 TAPD 需求数据状态分析与批量更新工具        ║');
console.log('╚══════════════════════════════════════════════════╝\n');

// 1. 查询所有不同的状态值
const statusStats = db.prepare(`
  SELECT 
    workspace_id,
    workspace_name,
    status,
    COUNT(*) as count
  FROM tapd_story 
  GROUP BY workspace_id, status
  ORDER BY workspace_name, count DESC
`).all();

// 2. 获取工作流映射
const mappings = db.prepare('SELECT workspace_id, status_key, status_value FROM tapd_workflow_status WHERE is_active = 1').all();
const mappingMap = {};
mappings.forEach(m => {
  if (!mappingMap[m.workspace_id]) mappingMap[m.workspace_id] = {};
  mappingMap[m.workspace_id][m.status_key] = m.status_value;
});

// 3. 分析每个项目
const projects = {};
statusStats.forEach(s => {
  if (!projects[s.workspace_id]) {
    projects[s.workspace_id] = { name: s.workspace_name, total: 0, statuses: [], needsFix: [] };
  }
  const p = projects[s.workspace_id];
  p.total += s.count;
  p.statuses.push({ status: s.status, count: s.count });
  
  // 检查是否需要修正
  const correctValue = mappingMap[s.workspace_id]?.[s.status];
  if (correctValue && correctValue !== s.status) {
    p.needsFix.push({ current: s.status, correct: correctValue, count: s.count });
  }
});

let totalNeedsFix = 0;
let totalRecords = 0;

console.log('═'.repeat(60));
console.log('📋 当前状态分析结果\n');

Object.keys(projects).forEach(wsId => {
  const p = projects[wsId];
  totalRecords += p.total;
  
  console.log('📁 ' + (p.name || wsId) + ' (' + wsId + ')');
  console.log('   总记录: ' + p.total + ' | 状态种类: ' + p.statuses.length);
  
  if (p.needsFix.length > 0) {
    console.log('   ⚠️  需要修正 (' + p.needsFix.length + ' 种):');
    p.needsFix.forEach(f => {
      console.log('      "' + f.current + '" → "' + f.correct + '" (' + f.count + '条)');
      totalNeedsFix += f.count;
    });
  } else {
    console.log('   ✅ 全部正确');
  }
  console.log('');
});

console.log('─'.repeat(60));
console.log('📈 汇总统计:');
console.log('   总记录数: ' + totalRecords);
console.log('   需要修正: ' + totalNeedsFix + ' 条');
console.log('   正确率: ' + ((totalRecords - totalNeedsFix) / totalRecords * 100).toFixed(2) + '%');
console.log('─'.repeat(60));

// 4. 执行修复（如果需要）
if (totalNeedsFix > 0) {
  console.log('\n🔧 开始批量修复...\n');
  
  let fixedCount = 0;
  
  Object.keys(projects).forEach(wsId => {
    const p = projects[wsId];
    
    if (p.needsFix.length === 0) return;
    
    console.log('🔄 修复项目: ' + (p.name || wsId));
    
    p.needsFix.forEach(fix => {
      try {
        const result = db.prepare(`
          UPDATE tapd_story 
          SET status = ?, modified = datetime('now')
          WHERE workspace_id = ? AND status = ?
        `).run(fix.correct, wsId, fix.current);
        
        console.log('   ✅ "' + fix.current + '" → "' + fix.correct + '" (' + result.changes + '条)');
        fixedCount += result.changes;
      } catch (error) {
        console.error('   ❌ 修复失败: ' + error.message);
      }
    });
    
    console.log('');
  });
  
  console.log('═'.repeat(60));
  console.log('🎉 修复完成！');
  console.log('   成功修正: ' + fixedCount + ' 条记录');
  console.log('   涉及项目: ' + Object.keys(projects).filter(k => projects[k].needsFix.length > 0).length + ' 个');
  console.log('═'.repeat(60));
} else {
  console.log('\n✨ 完美！所有需求数据的状态已经全部正确！\n');
}

db.close();
