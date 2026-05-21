// 强制同步并捕获日志
const fs = require('fs');

console.log('🔄 开始同步测试...\n');

// 1. 清理旧数据
console.log('步骤1: 清理旧数据...');
const http = require('http');

function makeRequest(options, postData) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, data: JSON.parse(data) }));
    });
    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function main() {
  try {
    // 2. 触发同步
    console.log('\n步骤2: 触发同步...');
    const syncResult = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/v1/tapd/sync/jobs',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, JSON.stringify({
      workspaceIds: ['37198579'],
      dataTypes: ['story'],
      timeRange: { begin: '2026-01-01', end: '2026-12-31' },
    }));
    
    console.log(`同步响应: ${syncResult.status}`);
    console.log(`Job ID: ${syncResult.data.jobId}\n`);
    
    // 3. 等待同步完成
    console.log('步骤3: 等待同步完成...');
    await new Promise(resolve => setTimeout(resolve, 8000));
    
    // 4. 检查数据库
    console.log('\n步骤4: 检查数据库...');
    const Database = require('better-sqlite3');
    const db = new Database('./prisma/dev.db');
    
    const count = db.prepare('SELECT COUNT(*) as count FROM tapd_story').get();
    console.log(`总记录数: ${count.count}`);
    
    // 检查created字段
    const stats = db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN created IS NOT NULL THEN 1 ELSE 0 END) as has_created,
        SUM(CASE WHEN completed IS NOT NULL THEN 1 ELSE 0 END) as has_completed
      FROM tapd_story
    `).get();
    
    console.log(`\n字段统计:`);
    console.log(`  有 created: ${stats.has_created}/${stats.total}`);
    console.log(`  有 completed: ${stats.has_completed}/${stats.total}`);
    
    if (stats.has_created === 0 && count.count > 0) {
      console.log(`\n❌ 问题确认: created 字段全部为空！`);
      
      // 查看一条样本的raw_json
      const sample = db.prepare('SELECT raw_json FROM tapd_story LIMIT 1').get();
      if (sample?.raw_json) {
        try {
          const raw = JSON.parse(sample.raw_json);
          const story = raw.Story || raw;
          console.log(`\n📦 RawJSON中的created:`);
          console.log(`   值: ${story.created}`);
          console.log(`   类型: ${typeof story.created}`);
        } catch(e) {
          console.log('解析失败');
        }
      }
    }
    
    db.close();
    
  } catch (error) {
    console.error('❌ 错误:', error.message);
  }
}

main();
