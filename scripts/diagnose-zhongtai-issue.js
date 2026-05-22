const Database = require('better-sqlite3');
const db = new Database('./prisma/dev.db');

console.log('\n╔══════════════════════════════════════════════════╗');
console.log('║  🔍 排查中台项目2个需求状态问题               ║');
console.log('╚══════════════════════════════════════════════════╝\n');

// 1. 查询这2条需求的具体信息
console.log('═'.repeat(60));
console.log('📋 需求详细信息:\n');

const stories = db.prepare(`
  SELECT id, name, workspace_id, workspace_name, status, 
         created, modified, raw_json
  FROM tapd_story 
  WHERE id LIKE '114825467100%'
    AND workspace_id = '48254671'
`).all();

if (stories.length === 0) {
  console.log('⚠️ 未找到匹配的需求，尝试模糊查询...');
  
  const fallback = db.prepare(`
    SELECT id, name, workspace_id, workspace_name, status
    FROM tapd_story 
    WHERE name LIKE '%保研商品属性字典清洗%'
      AND workspace_id = '48254671'
  `).all();
  
  fallback.forEach((s, idx) => {
    console.log((idx+1) + '. ID: ' + s.id);
    console.log('   标题: ' + s.name);
    console.log('   项目: ' + s.workspace_name);
    console.log('   当前状态: ' + s.status);
    console.log('');
  });
} else {
  stories.forEach((s, idx) => {
    console.log((idx+1) + '. ID: ' + s.id);
    console.log('   标题: ' + s.name);
    console.log('   项目: ' + s.workspace_name + ' (' + s.workspace_id + ')');
    console.log('   当前数据库状态值: [' + s.status + ']');
    
    // 解析raw_json看原始API返回的状态
    if (s.raw_json) {
      try {
        const rawData = typeof s.raw_json === 'string' ? JSON.parse(s.raw_json) : s.raw_json;
        const originalStatus = rawData.Status || rawData.status || '未知';
        console.log('   原始API返回状态: [' + originalStatus + ']');
        
        if (originalStatus !== s.status) {
          console.log('   ⚠️ 状态已被转换过!');
        }
      } catch(e) {
        console.log('   原始数据解析失败: ' + e.message);
      }
    }
    
    console.log('   创建时间: ' + s.created);
    console.log('   修改时间: ' + s.modified);
    console.log('');
  });
}

// 2. 查询中台项目的工作流配置 - 找到"待发布"对应的原始值
console.log('═'.repeat(60));
console.log('📚 中台项目(48254671)的工作流配置:\n');

const workflow = db.prepare(`
  SELECT status_key, status_value 
  FROM tapd_workflow_status 
  WHERE workspace_id = '48254671' 
    AND system = 'story'
    AND is_active = 1
  ORDER BY sort_order
`).all();

workflow.forEach(w => {
  const marker = w.status_value === '待发布' ? ' ⭐ (目标状态)' : '';
  console.log('   ' + w.status_key.padEnd(20) + ' → ' + w.status_value + marker);
});

// 3. 分析问题原因
console.log('\n' + '═'.repeat(60));
console.log('🔍 问题分析:\n');

if (stories.length > 0) {
  const currentStatus = stories[0].status;
  const targetMapping = workflow.find(w => w.status_value === '待发布');
  
  console.log('当前显示状态: ' + currentStatus);
  console.log('期望显示状态: 待发布');
  
  if (targetMapping) {
    console.log('"待发布" 对应的原始值应该是: ' + targetMapping.status_key);
    
    if (currentStatus === targetMapping.status_key) {
      console.log('\n❌ 问题发现:');
      console.log('   数据库中存储的是原始值 [' + currentStatus + ']，没有被转换！');
      console.log('   应该转换为: [' + targetMapping.status_value + ']');
      
      console.log('\n💡 解决方案:');
      console.log('   需要手动修正这2条记录的状态');
    } else if (currentStatus === '新建') {
      console.log('\n❌ 问题发现:');
      console.log('   状态被错误地设置为 "新建"，但实际应该是 "待发布"');
      console.log('   可能原因:');
      console.log('     1. TAPD API返回的原始状态就是 "new" 或类似值');
      console.log('     2. 工作流配置映射不完整或未生效');
      
      // 检查是否有 "new" 或 "新建" 的映射
      const newMapping = workflow.find(w => 
        w.status_key.toLowerCase() === 'new' || 
        w.status_key.toLowerCase() === 'closed' ||
        w.status_key.toLowerCase() === 'status_6'
      );
      
      if (newMapping) {
        console.log('   找到可能的原始值映射: ' + newMapping.status_key + ' → ' + newMapping.status_value);
      }
    } else {
      console.log('\n✅ 状态看起来是正确的');
    }
  } else {
    console.log('\n⚠️ 警告: 工作流配置中没有找到 "待发布" 的映射！');
  }
}

db.close();

console.log('\n' + '═'.repeat(60));
