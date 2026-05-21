const Database = require('better-sqlite3');
const db = new Database('./prisma/dev.db');

console.log('🔬 直接模拟 Custom-Fields API 逻辑\n');
console.log('='.repeat(100));

// 模拟高顿数据项目的处理流程
const workspaceId = '37198579';

// ============================================
// 第一步：检查 TAPD API 会返回什么（我们无法真正调用，但可以看数据库推断）
// ============================================
console.log('\n📌 步骤 1: 模拟 TAPD API 调用\n');

let fieldMapping = {};

// 假设 TAPD API 返回了配置（根据之前的测试）
const mockTapdApiResponse = {
  status: 1,
  data: [
    {
      CustomFieldConfig: {
        custom_field: 'custom_field_11',
        name: '项目归属',
        enabled: '1',
        type: '6'
      }
    }
  ]
};

console.log('假设 TAPD API 返回:');
console.log(JSON.stringify(mockTapdApiResponse, null, 2));

if (mockTapdApiResponse.status === 1) {
  const fields = mockTapdApiResponse.data || [];
  fields.forEach((item) => {
    const cfg = item.CustomFieldConfig;
    if (cfg.enabled === '1' && cfg.name && cfg.custom_field) {
      fieldMapping[cfg.custom_field] = cfg.name;
    }
  });
}

console.log('\nTAPD API 提供的 fieldMapping:');
console.log('   ', fieldMapping);

// ============================================
// 第二步：执行数据库补充逻辑（与 API 完全一致）
// ============================================
console.log('\n' + '='.repeat(100));
console.log('\n📌 步骤 2: 执行数据库补充逻辑\n');

try {
  // 查询该项目的样本数据（取前5条）
  const sampleStories = db.prepare(`
    SELECT raw_json 
    FROM tapd_story 
    WHERE workspace_id = ?
    LIMIT 5
  `).all(workspaceId);

  console.log(`找到 ${sampleStories.length} 条样本数据`);

  if (sampleStories.length > 0) {
    const dbFields = {};
    
    sampleStories.forEach((story, idx) => {
      console.log(`\n--- 处理样本 ${idx + 1} ---`);
      
      let raw = null;
      try {
        raw = JSON.parse(story.raw_json);
      } catch (e) {
        console.error('解析 raw_json 失败:', e.message);
        return;
      }
      
      if (raw) {
        for (const [key, value] of Object.entries(raw)) {
          if (
            (key.startsWith('custom_field_') || key.startsWith('custom_field')) &&
            value && String(value).trim() !== ''
          ) {
            if (!dbFields[key]) {
              dbFields[key] = new Set();
            }
            dbFields[key].add(String(value));
            console.log(`   ✅ 发现字段: ${key} = "${String(value).substring(0, 40)}"`);
          }
        }
      }
    });

    console.log('\n汇总 - 数据库中发现的自定义字段:');
    Object.entries(dbFields).forEach(([key, values]) => {
      console.log(`   📦 ${key}: ${values.size} 种不同值`);
      console.log(`      示例: "${Array.from(values)[0]}"`);
    });

    // 为数据库中有值但 API 未配置的字段添加推断映射
    for (const [fieldKey, values] of Object.entries(dbFields)) {
      if (!fieldMapping[fieldKey]) {
        const inferredName = inferFieldName(fieldKey, values);
        if (inferredName) {
          fieldMapping[fieldKey] = inferredName;
          console.log(`\n   🆕 推断映射: ${fieldKey} → "${inferredName}"`);
        }
      } else {
        console.log(`\n   ✅ 已有映射: ${fieldKey} → "${fieldMapping[fieldKey]}"`);
      }
    }
  }
} catch (error) {
  console.error('数据库查询失败:', error);
}

// ============================================
// 第三步：输出最终结果
// ============================================
console.log('\n' + '='.repeat(100));
console.log('\n📌 最终 API 返回的 fieldMapping:\n');
console.log(JSON.stringify(fieldMapping, null, 2));

console.log('\n' + '='.repeat(100));
console.log('\n🎯 关键验证:\n');

const hasProjectField = fieldMapping['custom_field_11'] === '项目归属';
const hasCostField = Object.values(fieldMapping).includes('成本归属');

console.log(`✅ custom_field_11 映射到 "项目归属": ${hasProjectField ? '是 ✓' : '否 ✗'}`);
console.log(`✅ 存在 "成本归属" 字段: ${hasCostField ? '是 ✓' : '否 ✗ (可选)'}`);

if (!hasProjectField) {
  console.log('\n❌ 问题确认：API 返回的 fieldMapping 中缺少正确的映射！');
  console.log('   这就是前端显示为空的根因！');
}

/**
 * 推断字段名称
 */
function inferFieldName(fieldKey, values) {
  const sampleValue = Array.from(values)[0];
  const valueLower = sampleValue.toLowerCase();
  
  const costKeywords = ['成本', '平摊', '科技研发中心', 'cost'];
  if (costKeywords.some(kw => valueLower.includes(kw))) return '成本归属';
  
  const projectKeywords = ['项目', '常规项目', '技术项目', '直播', '点播', 'app', '鸿蒙', 'bi', '数据'];
  if (projectKeywords.some(kw => valueLower.includes(kw))) return '项目归属';
  
  if (valueLower === '是' || valueLower === '否' || valueLower === 'yes' || valueLower === 'no') return '按时提测';
  if (/^\d{4}-\d{2}-\d{2}/.test(valueLower)) return '创建时间(自定义)';
  
  if (fieldKey.startsWith('custom_field_')) {
    const num = fieldKey.replace('custom_field_', '');
    return `CF-${num}`;
  }
  
  return `未知-${fieldKey}`;
}

db.close();
