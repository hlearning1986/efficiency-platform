/**
 * 验证：对比数据库状态 vs TAPD 实际状态
 * 
 * 问题：
 * 1. ID: 1137198579001375517 - 数据库 status="status_2"(规划中)，用户说实际是"测试中"
 * 2. ID: 1137198579001376049 - 数据库 status="developing"(开发中)，用户说实际是"待测试"
 */

const Database = require('better-sqlite3');
const db = new Database('./prisma/dev.db');

console.log('🔍 状态不一致问题深度分析\n');
console.log('='.repeat(100));

// 查询这两个记录的详细信息
const problemIds = ['1137198579001375517', '1137198579001376049'];

problemIds.forEach((id, idx) => {
  console.log(`\n${'─'.repeat(80)}`);
  console.log(`📌 问题记录 ${idx + 1}: ID ${id}\n`);
  
  const record = db.prepare(`
    SELECT id, name, status, workspace_id,
           created, modified, completed,
           raw_json
    FROM tapd_story 
    WHERE id = ?
  `).get(id);
  
  if (record) {
    console.log('基本信息:');
    console.log(`   标题: ${record.name}`);
    console.log(`   数据库 status: "${record.status}"`);
    console.log(`   创建时间: ${record.created}`);
    console.log(`   最后修改(数据库): ${record.modified}`);
    
    // 解析 raw_json
    if (record.raw_json) {
      const raw = JSON.parse(record.raw_json);
      
      console.log('\nRaw JSON 关键字段:');
      console.log(`   • status: "${raw.status}"`);
      console.log(`   • priority: "${raw.priority || '(空)'}"`);
      console.log(`   • owner: "${raw.owner || '(空)'}"`);
      console.log(`   • iteration_id: "${raw.iteration_id || '(空)'}"`);
      
      // 查找所有时间戳字段
      const timeFields = {};
      Object.entries(raw).forEach(([key, value]) => {
        if (/time|date|modified|created|updated/i.test(key) && value) {
          timeFields[key] = value;
        }
      });
      
      if (Object.keys(timeFields).length > 0) {
        console.log('\n   🕐 时间相关字段:');
        Object.entries(timeFields).forEach(([k, v]) => {
          console.log(`      • ${k}: ${v}`);
        });
      }
    }
    
    // 根据当前映射显示什么
    const statusMap = {
      'status_2': '规划中',
      'status_3': '开发中',
      'status_4': '测试中',
      'status_5': '已验收',
      'status_6': '待发布',
      'status_7': '重新打开',
      'status_8': '挂起',
      'status_9': '已实现',
      'planning': '规划中',
      'developing': '开发中',
      'testing': '测试中',
      'resolved': '已实现'
    };
    
    const displayText = statusMap[record.status] || record.status || '未知';
    
    console.log('\n📊 状态分析:');
    console.log(`   数据库值: "${record.status}"`);
    console.log(`   前端显示: "${displayText}"`);
    console.log(`   用户反馈: "${idx === 0 ? '测试中' : '待测试'}"`);
    console.log(`   是否一致: ${displayText === (idx === 0 ? '测试中' : '待测试') ? '✅ 是' : '❌ 否'}`);
    
  } else {
    console.log('❌ 未找到该记录');
  }
});

// 统计：最近24小时内修改过的记录
console.log(`\n${'='.repeat(100)}\n`);
console.log('📈 最近修改的记录（可能存在同步延迟）:\n');

const recentModified = db.prepare(`
  SELECT id, name, status, modified
  FROM tapd_story 
  WHERE workspace_id = '37198579'
    AND modified >= datetime('now', '-3 days')
  ORDER BY modified DESC
  LIMIT 10
`).all();

if (recentModified.length > 0) {
  recentModified.forEach((r, idx) => {
    const timeAgo = getTimeAgo(r.modified);
    console.log(`${idx + 1}. [${timeAgo}] ID: ${r.id.substring(0, 15)}...`);
    console.log(`   标题: ${(r.name || '').substring(0, 40)}`);
    console.log(`   状态: "${r.status}" | 修改: ${r.modified}\n`);
  });
} else {
  console.log('最近3天无修改记录');
}

// 辅助函数：计算相对时间
function getTimeAgo(dateStr) {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now - date;
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffDays > 0) return `${diffDays}天前`;
  if (diffHours > 0) return `${diffHours}小时前`;
  return '刚刚';
}

db.close();

console.log('\n' + '='.repeat(100));
console.log('\n💡 可能的原因和解决方案:\n');
console.log('1️⃣ TAPD 状态已更新，但数据库还是旧值（最常见）');
console.log('   → 解决方案：重新运行数据同步任务\n');
console.log('2️⃣ 不同项目的 status_2 含义不同');
console.log('   → 解决方案：需要从 TAPD 工作流配置获取真实状态名称\n');
console.log('3️⃣ TAPD API 返回的是快照而非实时状态');
console.log('   → 解决方案：检查 API 调用参数，确保获取最新数据\n');
