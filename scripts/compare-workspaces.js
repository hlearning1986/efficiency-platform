const Database = require('better-sqlite3');
const db = new Database('./prisma/dev.db');

console.log('🔍 对比 3 个项目的项目归属字段情况\n');

// 1. 获取所有项目的 workspace_id 和名称
const workspaces = db.prepare(`
  SELECT DISTINCT workspace_id, workspace_name
  FROM tapd_story 
  WHERE workspace_name IS NOT NULL AND workspace_name != ''
`).all();

console.log(`📋 找到 ${workspaces.length} 个项目:\n`);
workspaces.forEach((ws, i) => {
  console.log(`${i + 1}. ${ws.workspace_name} (ID: ${ws.workspace_id})`);
});

// 2. 统计每个项目的 custom_field_11 填充情况
console.log('\n\n📊 各项目 custom_field_11 (项目归属) 填充率:\n');

const workspaceStats = db.prepare(`
  SELECT 
    workspace_id,
    workspace_name,
    COUNT(*) as total,
    SUM(CASE WHEN custom_field_11 IS NOT NULL AND custom_field_11 != '' THEN 1 ELSE 0 END) as filled,
    SUM(CASE WHEN custom_field_10 IS NOT NULL AND custom_field_10 != '' THEN 1 ELSE 0 END) as cf10_filled
  FROM tapd_story 
  GROUP BY workspace_id, workspace_name
  ORDER BY total DESC
`).all();

workspaceStats.forEach(ws => {
  const pct = ((ws.filled / ws.total) * 100).toFixed(1);
  const status = ws.filled > 0 ? '✅' : '❌';
  console.log(`${status} ${ws.workspace_name || ws.workspace_id}`);
  console.log(`   ID: ${ws.workspace_id} | 总数: ${ws.total} | 项目归属: ${ws.filled}/${ws.total} (${pct}%)`);
  
  // 显示样本数据
  const sample = db.prepare(`
    SELECT name, custom_field_11, custom_field_10
    FROM tapd_story 
    WHERE workspace_id = ? AND custom_field_11 IS NOT NULL AND custom_field_11 != ''
    LIMIT 1
  `).get(ws.workspace_id);
  
  if (sample) {
    console.log(`   样本: "${sample.name}" → cf_11="${sample.custom_field_11}"`);
  } else {
    // 查看空值样本
    const emptySample = db.prepare(`
      SELECT name, custom_field_11, raw_json
      FROM tapd_story 
      WHERE workspace_id = ?
      LIMIT 1
    `).get(ws.workspace_id);
    
    if (emptySample) {
      const cf11Raw = JSON.parse(emptySample.raw_json || '{}').custom_field_11;
      console.log(`   ⚠️ 样本: "${emptySample.name}" → cf_11="${cf11Raw || '(空)'}"`);
    }
  }
  console.log('');
});

// 3. 调用 TAPD API 检查每个项目的自定义字段配置
console.log('\n\n🔧 准备调用 TAPD API 检查配置...\n');

// 获取系统配置
const config = db.prepare("SELECT value FROM system_setting WHERE key = 'tapd_api_config'").get();
if (!config) {
  console.log('❌ 未找到 TAPD API 配置');
  process.exit(1);
}

let tapdConfig;
try {
  tapdConfig = JSON.parse(config.value);
} catch (e) {
  console.log('❌ 配置解析失败:', e.message);
  process.exit(1);
}

const { apiUser, apiPassword } = tapdConfig;

async function checkWorkspaceCustomFields(workspaceId, workspaceName) {
  const url = `https://api.tapd.cn/stories/custom_fields_settings?workspace_id=${workspaceId}`;
  const credentials = Buffer.from(`${apiUser}:${apiPassword}`).toString('base64');
  
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      console.log(`❌ ${workspaceName}: HTTP ${response.status}`);
      return;
    }
    
    const result = await response.json();
    
    if (result.status !== 1) {
      console.log(`❌ ${workspaceName}: ${result.info}`);
      return;
    }
    
    const fields = result.data || [];
    
    // 查找 custom_field_10 ~ custom_field_15 的配置
    const targetFields = fields.filter(f => 
      ['custom_field_10', 'custom_field_11', 'custom_field_12', 'custom_field_13', 'custom_field_14', 'custom_field_15']
        .includes(f.CustomFieldConfig.custom_field)
    );
    
    console.log(`\n📦 ${workspaceName} (ID: ${workspaceId}) 自定义字段配置:`);
    
    if (targetFields.length > 0) {
      targetFields.forEach(f => {
        const cfg = f.CustomFieldConfig;
        console.log(`   ✅ ${cfg.custom_field} = "${cfg.name}" (类型: ${cfg.type}, 启用: ${cfg.enabled})`);
      });
    } else {
      console.log('   ⚠️ 未找到 custom_field_10~15 的配置！');
      
      // 显示所有自定义字段
      console.log('\n   所有配置的自定义字段:');
      fields.slice(0, 8).forEach(f => {
        const cfg = f.CustomFieldConfig;
        console.log(`   - ${cfg.custom_field} = "${cfg.name}" (${cfg.type})`);
      });
      if (fields.length > 8) {
        console.log(`   ... 还有 ${fields.length - 8} 个`);
      }
    }
    
  } catch (error) {
    console.log(`❌ ${workspaceName} 请求失败:`, error.message);
  }
}

// 执行检查
async function main() {
  for (const ws of workspaceStats) {
    await checkWorkspaceCustomFields(ws.workspace_id, ws.workspace_name || ws.workspace_id);
  }
  
  db.close();
}

main().catch(console.error);
