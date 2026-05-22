const Database = require('better-sqlite3');
const db = new Database('./prisma/dev.db');

console.log('\n╔══════════════════════════════════════════════════╗');
console.log('║  🔍 精确排查：保研商品属性字典清洗 需求          ║');
console.log('╚══════════════════════════════════════════════════╝\n');

// 1. 模糊匹配这个标题
console.log('═'.repeat(60));
console.log('📋 查找包含 "保研商品" 的需求:\n');

const stories = db.prepare(`
  SELECT id, name, workspace_id, workspace_name, status, 
         created, modified, raw_json
  FROM tapd_story 
  WHERE name LIKE '%保研商品%'
    AND workspace_id = '48254671'
`).all();

if (stories.length === 0) {
  console.log('❌ 未找到包含 "保研商品" 的需求');
  console.log('\n尝试搜索所有中台项目中状态为 "新建" 的需求...\n');
  
  const newStatusStories = db.prepare(`
    SELECT id, name, status, raw_json
    FROM tapd_story 
    WHERE workspace_id = '48254671'
      AND status = '新建'
    LIMIT 20
  `).all();
  
  console.log('找到 ' + newStatusStories.length + ' 条状态为"新建"的需求:\n');
  newStatusStories.forEach((s, idx) => {
    console.log((idx+1) + '. ID: ' + s.id);
    console.log('   标题: ' + s.name);
    console.log('   状态: ' + s.status);
    
    if (s.raw_json) {
      try {
        const rawData = typeof s.raw_json === 'string' ? JSON.parse(s.raw_json) : s.raw_json;
        console.log('   原始API状态: ' + (rawData.Status || rawData.status));
      } catch(e) {}
    }
    console.log('');
  });
} else {
  stories.forEach((s, idx) => {
    console.log((idx+1) + '. ID: ' + s.id);
    console.log('   标题: ' + s.name);
    console.log('   项目: ' + s.workspace_name);
    console.log('   当前数据库状态: [' + s.status + ']');
    
    if (s.raw_json) {
      try {
        const rawData = typeof s.raw_json === 'string' ? JSON.parse(s.raw_json) : s.raw_json;
        const originalStatus = rawData.Status || rawData.status || '';
        console.log('   原始API返回: [' + originalStatus + ']');
        
        if (originalStatus && originalStatus !== s.status) {
          console.log('   ✅ 已转换');
        } else if (originalStatus === s.status) {
          console.log('   ❌ 未转换（存储的就是原始值）');
        }
      } catch(e) {
        console.log('   原始数据解析失败');
      }
    }
    
    console.log('   创建时间: ' + s.created);
    console.log('   最后修改: ' + s.modified);
    console.log('');
  });
}

// 2. 显示完整的工作流映射
console.log('═'.repeat(60));
console.log('📚 中台项目完整工作流映射:\n');

const workflow = db.prepare(`
  SELECT status_key, status_value 
  FROM tapd_workflow_status 
  WHERE workspace_id = '48254671' 
    AND system = 'story'
    AND is_active = 1
  ORDER BY sort_order
`).all();

workflow.forEach(w => {
  console.log('   ' + w.status_key.padEnd(25) + ' → ' + w.status_value);
});

// 3. 分析问题
console.log('\n' + '═'.repeat(60));
console.log('🔍 问题根因分析:\n');

if (stories.length > 0) {
  const storyStatus = stories[0].status;
  console.log('当前数据库中的状态值: "' + storyStatus + '"');
  
  // 查找这个状态是否在映射表中
  const mapping = workflow.find(w => w.status_key === storyStatus || w.status_value === storyStatus);
  
  if (!mapping) {
    console.log('❌ 状态 "' + storyStatus + '" 不在工作流映射表中！');
    
    // 尝试找到可能的正确映射
    console.log('\n💡 可能的正确映射:');
    
    // 如果是"新建"，可能是new或status_1等
    if (storyStatus === '新建') {
      const possibleMappings = workflow.filter(w => 
        w.status_value === '待发布' ||
        w.status_key.toLowerCase() === 'new' ||
        w.status_key.toLowerCase() === 'status_1' ||
        w.status_key.toLowerCase() === 'closed'
      );
      
      possibleMappings.forEach(m => {
        console.log('   - 如果原始值是 "' + m.status_key + '" → 应该显示为 "' + m.status_value + '"');
      });
    }
    
    console.log('\n✅ 解决方案:');
    console.log('   需要手动修正这2条记录的状态为正确的值');
  }
}

db.close();
