const Database = require('better-sqlite3');
const db = new Database('./prisma/dev.db');

console.log('🔍 终极排查：完整数据流验证\n');
console.log('='.repeat(100));

// ============================================
// 第一步：直接查询 Prisma 会返回的数据格式
// ============================================
console.log('\n📌 步骤 1: 模拟 Prisma 查询返回的数据\n');

const workspaceId = '37198579'; // 高顿数据

// Prisma 返回的是 camelCase 格式
const prismaStyleData = db.prepare(`
  SELECT 
    id,
    name,
    workspace_id as "workspaceId",
    workspace_name as "workspaceName",
    custom_field_11 as "customField11",
    custom_field_13 as "customField13",
    custom_field_one as "customFieldOne",
    custom_field_two as "customFieldTwo"
  FROM tapd_story 
  WHERE workspace_id = ?
  LIMIT 2
`).all(workspaceId);

console.log('Prisma 风格的返回数据（camelCase）:\n');

prismaStyleData.forEach((record, i) => {
  console.log(`--- 记录 ${i + 1}: ${record.name} ---`);
  console.log('   完整字段键:', Object.keys(record));
  console.log('   customField11:', `"${record.customField11 || '(空)'}"`);
  console.log('   customField13:', `"${record.customField13 || '(空)'}"`);
  console.log('');
});

// ============================================
// 第二步：模拟 Custom-Fields API 的完整响应
// ============================================
console.log('\n' + '='.repeat(100));
console.log('\n📌 步骤 2: 模拟 Custom-Fields API 完整响应\n');

// 调用 TAPD API 获取配置（模拟）
let fieldMapping = {};

// 模拟 TAPD API 返回（高顿数据项目）
const tapdApiResult = {
  'custom_field_11': '项目归属'
};
fieldMapping = { ...tapdApiResult };

console.log('① TAPD API 返回:');
console.log('   ', tapdApiResult);

// 数据库补充逻辑
const sampleStories = db.prepare(`
  SELECT custom_field_10, custom_field_11, custom_field_12, custom_field_13,
         custom_field_one, custom_field_two
  FROM tapd_story 
  WHERE workspace_id = ?
  LIMIT 5
`).all(workspaceId);

const dbFields = {};
sampleStories.forEach(story => {
  for (const [key, value] of Object.entries(story)) {
    if (key.startsWith('custom_field') && value && String(value).trim() !== '') {
      if (!dbFields[key]) dbFields[key] = new Set();
      dbFields[key].add(String(value));
    }
  }
});

console.log('\n② 数据库中发现的有值字段:');
Object.entries(dbFields).forEach(([key, values]) => {
  const sampleValue = Array.from(values)[0];
  const inferredName = inferFieldName(key, values);
  
  if (!fieldMapping[key]) {
    fieldMapping[key] = inferredName;
    console.log(`   🆕 ${key} → "${inferredName}" (值: "${sampleValue.substring(0, 40)}...")`);
  } else {
    console.log(`   ✅ ${key} → "${fieldMapping[key]}" (已有配置)`);
  }
});

console.log('\n③ 最终完整的 fieldMapping:');
console.log('   ', JSON.stringify(fieldMapping, null, 2));

// ============================================
// 第三步：完整模拟前端的 getFieldValue 函数
// ============================================
console.log('\n' + '='.repeat(100));
console.log('\n📌 步骤 3: 模拟前端完整渲染逻辑\n');

function getFieldKeyByBusinessName(mapping, businessName) {
  for (const [key, name] of Object.entries(mapping)) {
    if (name === businessName) return key;
  }
  console.log(`   ⚠️ 未找到业务名称: "${businessName}"`);
  console.log(`      可用的映射:`, Object.entries(mapping));
  return '';
}

function getFieldValue(record, mapping, businessName) {
  const fieldKey = getFieldKeyByBusinessName(mapping, businessName);
  if (!fieldKey) return '-';
  
  // 转换为 camelCase（关键步骤！）
  const camelCaseKey = fieldKey.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
  
  console.log(`   🔍 查找 "${businessName}":`);
  console.log(`      字段键: ${fieldKey}`);
  console.log(`      camelCase: ${camelCaseKey}`);
  console.log(`      record[${camelCaseKey}] =`, record[camelCaseKey]);
  
  return record[camelCaseKey] || '-';
}

console.log('测试字段提取:\n');

prismaStyleData.forEach((record, i) => {
  console.log(`\n=== 记录 ${i + 1}: ${record.name} ===\n`);
  
  const costValue = getFieldValue(record, fieldMapping, '成本归属');
  console.log(`   → 成本归属: "${costValue}"\n`);
  
  const projectValue = getFieldValue(record, fieldMapping, '项目归属');
  console.log(`   → 项目归属: "${projectValue}"\n`);
});

// ============================================
// 第四步：诊断结论
// ============================================
console.log('\n' + '='.repeat(100));
console.log('\n📋 诊断结论\n');

const testRecord = prismaStyleData[0];
const projectKey = getFieldKeyByBusinessName(fieldMapping, '项目归属');
const projectValue = getFieldValue(testRecord, fieldMapping, '项目归属');

if (projectValue && projectValue !== '-') {
  console.log('✅ SUCCESS: 数据流完全正常！');
  console.log(`   项目归属正确显示: "${projectValue}"`);
  console.log('\n⚠️ 如果前端仍显示为空，可能原因:');
  console.log('   1. 浏览器缓存了旧代码 → 请 Ctrl+F5 强制刷新');
  console.log('   2. Next.js 开发服务器未热更新 → 重启 dev server');
  console.log('   3. Custom-Fields API 在实际运行时返回了不同的数据');
} else {
  console.log('❌ FAIL: 数据流存在问题');
  console.log('\n请检查以下环节:');
  console.log('   1. Custom-Fields API 是否真的返回了正确的 fieldMapping?');
  console.log('   2. Prisma 查询是否返回了 customField11 字段?');
  console.log('   3. 前端的 getFieldValue 函数是否被正确调用?');
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
