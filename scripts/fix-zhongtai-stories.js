const Database = require('better-sqlite3');
const db = new Database('./prisma/dev.db');

console.log('\n╔══════════════════════════════════════════════════╗');
console.log('║  🔧 修复中台项目2个需求状态                     ║');
console.log('╚══════════════════════════════════════════════════╝\n');

// 修复这2条特定需求
const targetStories = [
  { id: '1148254671001374194', name: '【商品】保研商品属性字典清洗' },
  { id: '1148254671001371806', name: '【商品】保研商品属性字典清洗' }
];

let fixedCount = 0;

targetStories.forEach(story => {
  console.log('═'.repeat(60));
  
  // 查询当前状态
  const current = db.prepare(`
    SELECT status, modified 
    FROM tapd_story 
    WHERE id = ?
  `).get(story.id);
  
  if (!current) {
    console.log('❌ 未找到需求: ' + story.id);
    return;
  }
  
  console.log('📋 需求信息:');
  console.log('   ID: ' + story.id);
  console.log('   标题: ' + story.name);
  console.log('   当前状态: [' + current.status + ']');
  console.log('   最后修改: ' + current.modified);
  
  if (current.status === '待发布') {
    console.log('   ✅ 状态已经正确，无需修复\n');
    return;
  }
  
  // 执行修复
  try {
    const result = db.prepare(`
      UPDATE tapd_story 
      SET status = ?, 
          modified = datetime('now')
      WHERE id = ?
    `).run('待发布', story.id);
    
    if (result.changes > 0) {
      console.log('\n✅ 修复成功!');
      console.log('   状态变更: "' + current.status + '" → "待发布"');
      console.log('   影响行数: ' + result.changes);
      fixedCount++;
      
      // 验证修复结果
      const verify = db.prepare(`
        SELECT status, modified 
        FROM tapd_story 
        WHERE id = ?
      `).get(story.id);
      
      console.log('   验证结果: [' + verify.status + '] ✓');
      console.log('   更新时间: ' + verify.modified);
    } else {
      console.log('\n⚠️ 更新失败，未影响任何行');
    }
  } catch (error) {
    console.error('\n❌ 修复失败: ' + error.message);
  }
  
  console.log('');
});

// 汇总
console.log('═'.repeat(60));
console.log('📊 修复汇总:\n');
console.log('   目标需求数: ' + targetStories.length);
console.log('   成功修复数: ' + fixedCount);
console.log('   失败数量: ' + (targetStories.length - fixedCount));

if (fixedCount === targetStories.length) {
  console.log('\n🎉 全部修复完成！');
} else if (fixedCount > 0) {
  console.log('\n⚠️ 部分修复完成，请检查失败的项');
} else {
  console.log('\n❌ 所有修复均失败，请检查日志');
}

// 额外检查：是否还有其他类似的问题
console.log('\n' + '═'.repeat(60));
console.log('🔍 扫描中台项目中可能存在的类似问题...\n');

const similarIssues = db.prepare(`
  SELECT COUNT(*) as count
  FROM tapd_story 
  WHERE workspace_id = '48254671'
    AND status = '新建'
`).get();

if (similarIssues.count > 0) {
  console.log('⚠️ 发现 ' + similarIssues.count + ' 条状态为"新建"的需求');
  console.log('   可能需要进一步检查是否都需要修正为"待发布"\n');
  
  // 显示前5条作为示例
  const examples = db.prepare(`
    SELECT id, name, status
    FROM tapd_story 
    WHERE workspace_id = '48254671'
      AND status = '新建'
    LIMIT 5
  `).all();
  
  console.log('示例:');
  examples.forEach((e, idx) => {
    console.log('   ' + (idx+1) + '. ' + e.name.substring(0, 30) + '... (' + e.status + ')');
  });
} else {
  console.log('✅ 未发现其他类似问题');
}

db.close();
