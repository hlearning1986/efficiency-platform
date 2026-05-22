const Database = require('better-sqlite3');
const db = new Database('./prisma/dev.db');

console.log('\n╔══════════════════════════════════════════════════════════════╗');
console.log('║  📊 TAPD 数据全面检查报告                                ║');
console.log('║  第一部分：工作流配置（原始状态 → 中文显示）              ║');
console.log('║  第二部分：已同步数据的状态正确性验证                     ║');
console.log('╚══════════════════════════════════════════════════════════════╝\n');

// ══════════════════════════════════════════════════════════════════
// 第一部分：工作流配置检查
// ══════════════════════════════════════════════════════════════════

console.log('═'.repeat(80));
console.log('📋 第一部分：TAPD 工作流状态配置详情\n');

const allWorkspaces = db.prepare(`
  SELECT DISTINCT workspace_id, workspace_name 
  FROM tapd_workflow_status 
  WHERE is_active = 1 
  ORDER BY workspace_name
`).all();

let totalMappings = 0;
const projectReports = [];

allWorkspaces.forEach(ws => {
  const mappings = db.prepare(`
    SELECT system, status_key, status_value, sort_order
    FROM tapd_workflow_status 
    WHERE workspace_id = ? AND is_active = 1
    ORDER BY system, sort_order
  `).all(ws.workspace_id);
  
  // 按系统分组
  const storyMappings = mappings.filter(m => m.system === 'story');
  const bugMappings = mappings.filter(m => m.system === 'bug');
  
  console.log('─'.repeat(80));
  console.log('📁 项目: ' + (ws.workspace_name || ws.workspace_id) + ' (' + ws.workspace_id + ')');
  console.log('   需求状态映射: ' + storyMappings.length + ' 种 | 缺陷状态映射: ' + bugMappings.length + ' 种\n');
  
  if (storyMappings.length > 0) {
    console.log('   【需求工作流】');
    storyMappings.forEach((m, idx) => {
      const marker = m.status_value === '待发布' ? ' ⭐' : '';
      console.log('     ' + String(idx+1).padStart(2) + '. ' + 
                 m.status_key.padEnd(25) + ' → ' + m.status_value + marker);
    });
    console.log('');
  }
  
  if (bugMappings.length > 0) {
    console.log('   【缺陷工作流】');
    bugMappings.forEach((m, idx) => {
      console.log('     ' + String(idx+1).padStart(2) + '. ' + 
                 m.status_key.padEnd(25) + ' → ' + m.status_value);
    });
    console.log('');
  }
  
  totalMappings += mappings.length;
  
  projectReports.push({
    workspaceId: ws.workspace_id,
    workspaceName: ws.workspace_name,
    storyCount: storyMappings.length,
    bugCount: bugMappings.length,
    storyMapping: Object.fromEntries(storyMappings.map(m => [m.status_key, m.status_value])),
    bugMapping: Object.fromEntries(bugMappings.map(m => [m.status_key, m.status_value]))
  });
});

console.log('─'.repeat(80));
console.log('📈 工作流配置汇总:');
console.log('   总项目数: ' + allWorkspaces.length);
console.log('   总映射规则: ' + totalMappings + ' 条');

// ══════════════════════════════════════════════════════════════════
// 第二部分：已同步数据检查
// ══════════════════════════════════════════════════════════════════

console.log('\n' + '═'.repeat(80));
console.log('🔍 第二部分：已同步数据状态验证\n');

// 构建全局映射表用于快速查找
const globalStoryMap = {};
const globalBugMap = {};

projectReports.forEach(p => {
  globalStoryMap[p.workspaceId] = p.storyMapping;
  globalBugMap[p.workspaceId] = p.bugMapping;
});

// 2.1 检查需求数据
console.log('─'.repeat(80));
console.log('📋 2.1 需求(tapd_story)数据检查\n');

const allStories = db.prepare(`
  SELECT id, name, workspace_id, status, raw_json
  FROM tapd_story
`).all();

let storyStats = {
  total: allStories.length,
  correct: 0,
  incorrect: 0,
  issues: []
};

allStories.forEach(story => {
  const mapping = globalStoryMap[story.workspace_id];
  
  if (!mapping) {
    storyStats.incorrect++;
    storyStats.issues.push({
      type: '无工作流配置',
      id: story.id,
      name: story.name,
      workspaceId: story.workspace_id,
      currentStatus: story.status,
      expectedStatus: '需要配置工作流'
    });
    return;
  }
  
  // 从raw_json获取原始状态
  let originalStatus = null;
  if (story.raw_json) {
    try {
      const rawData = typeof story.raw_json === 'string' ? JSON.parse(story.raw_json) : story.raw_json;
      originalStatus = rawData.Status || rawData.status || null;
    } catch(e) {}
  }
  
  if (!originalStatus) {
    // 无法确定原始状态，检查当前状态是否在有效值列表中
    const validValues = Object.values(mapping);
    if (validValues.includes(story.status)) {
      storyStats.correct++;
    } else {
      storyStats.incorrect++;
      storyStats.issues.push({
        type: '无效状态值',
        id: story.id,
        name: story.name,
        workspaceId: story.workspace_id,
        currentStatus: story.status,
        expectedStatus: validValues[0] || '未知'
      });
    }
    return;
  }
  
  // 有原始状态，检查转换是否正确
  const expectedValue = mapping[originalStatus];
  
  if (expectedValue && expectedValue === story.status) {
    storyStats.correct++;
  } else if (expectedValue) {
    storyStats.incorrect++;
    storyStats.issues.push({
      type: '转换错误',
      id: story.id,
      name: story.name,
      workspaceId: story.workspace_id,
      originalStatus: originalStatus,
      currentStatus: story.status,
      expectedStatus: expectedValue
    });
  } else {
    // 原始状态没有对应映射，但可能已经是正确的中文值
    const validValues = Object.values(mapping);
    if (validValues.includes(story.status)) {
      storyStats.correct++;
    } else {
      storyStats.incorrect++;
      storyStats.issues.push({
        type: '未映射的原始状态',
        id: story.id,
        name: story.name,
        workspaceId: story.workspace_id,
        originalStatus: originalStatus,
        currentStatus: story.status,
        expectedStatus: '需要添加映射或手动确认'
      });
    }
  }
});

const storyAccuracy = (storyStats.correct / storyStats.total * 100).toFixed(2);
console.log('📊 需求数据统计:');
console.log('   总记录数: ' + storyStats.total);
console.log('   正确数量: ' + storyStats.correct + ' (' + storyAccuracy + '%)');
console.log('   错误数量: ' + storyStats.incorrect);

if (storyStats.issues.length > 0) {
  console.log('\n⚠️ 发现的问题:');
  
  // 按类型分组
  const issuesByType = {};
  storyStats.issues.forEach(issue => {
    if (!issuesByType[issue.type]) issuesByType[issue.type] = [];
    issuesByType[issue.type].push(issue);
  });
  
  Object.keys(issuesByType).forEach(type => {
    console.log('\n   【' + type + '】 (' + issuesByType[type].length + ' 条):');
    
    issuesByType[type].slice(0, 3).forEach((issue, idx) => {
      console.log('      ' + (idx+1) + '. [' + issue.id.substring(0, 12) + '] ' + 
                 issue.name?.substring(0, 30) + '...');
      
      if (issue.originalStatus) {
        console.log('         原始: "' + issue.originalStatus + '" | 当前: "' + 
                   issue.currentStatus + '" | 应该: "' + issue.expectedStatus + '"');
      } else {
        console.log('         当前: "' + issue.currentStatus + '" | 应该: "' + issue.expectedStatus + '"');
      }
    });
    
    if (issuesByType[type].length > 3) {
      console.log('      ... 还有 ' + (issuesByType[type].length - 3) + ' 条');
    }
  });
} else {
  console.log('\n✅ 所有需求数据状态完全正确！');
}

// 2.2 检查缺陷数据（如果有）
console.log('\n' + '─'.repeat(80));
console.log('📋 2.2 缺陷(tapd_bug)数据检查\n');

const hasBugTable = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='tapd_bug'").get();

if (hasBugTable) {
  const allBugs = db.prepare(`
    SELECT id, title, workspace_id, status, raw_json
    FROM tapd_bug
  `).all();
  
  let bugStats = { total: allBugs.length, correct: 0, incorrect: 0, issues: [] };
  
  allBugs.forEach(bug => {
    const mapping = globalBugMap[bug.workspace_id];
    
    if (!mapping) {
      bugStats.incorrect++;
      return;
    }
    
    let originalStatus = null;
    if (bug.raw_json) {
      try {
        const rawData = typeof bug.raw_json === 'string' ? JSON.parse(bug.raw_json) : bug.raw_json;
        originalStatus = rawData.Status || rawData.status || null;
      } catch(e) {}
    }
    
    if (originalStatus && mapping[originalStatus]) {
      if (mapping[originalStatus] === bug.status) {
        bugStats.correct++;
      } else {
        bugStats.incorrect++;
        bugStats.issues.push({
          id: bug.id,
          currentStatus: bug.status,
          expectedStatus: mapping[originalStatus]
        });
      }
    } else {
      const validValues = Object.values(mapping);
      if (validValues.includes(bug.status)) {
        bugStats.correct++;
      } else {
        bugStats.incorrect++;
      }
    }
  });
  
  const bugAccuracy = (bugStats.correct / bugStats.total * 100).toFixed(2);
  console.log('📊 缺陷数据统计:');
  console.log('   总记录数: ' + bugStats.total);
  console.log('   正确数量: ' + bugStats.correct + ' (' + bugAccuracy + '%)');
  console.log('   错误数量: ' + bugStats.incorrect);
  
  if (bugStats.issues.length === 0) {
    console.log('\n✅ 所有缺陷数据状态完全正确！');
  }
} else {
  console.log('ℹ️ 当前数据库中没有 tapd_bug 表');
}

// 初始化 bugStats（如果未定义）
let bugStats = { total: 0, correct: 0, incorrect: 0 };

// ══════════════════════════════════════════════════════════════════
// 最终报告
// ══════════════════════════════════════════════════════════════════

console.log('\n' + '═'.repeat(80));
console.log('🎯 最终检查报告\n');

const overallCorrect = storyStats.correct + (hasBugTable ? bugStats.correct : 0);
const overallTotal = storyStats.total + (hasBugTable ? bugStats.total : 0);
const overallAccuracy = (overallCorrect / overallTotal * 100).toFixed(2);

console.log('┌────────────────────────────────────────────────────┐');
console.log('│              数据质量总览                           │');
console.log('├──────────────────┬──────────┬──────────┬──────────┤');
console.log('│ 数据类型         │ 总数     │ 正确     │ 准确率   │');
console.log('├──────────────────┼──────────┼──────────┼──────────┤');
console.log('│ 需求(story)      │ ' + String(storyStats.total).padStart(8) + ' │ ' + String(storyStats.correct).padStart(8) + ' │ ' + storyAccuracy.padStart(7) + '% │');
if (hasBugTable) {
  console.log('│ 缺陷(bug)        │ ' + String(bugStats?.total || 0).padStart(8) + ' │ ' + String(bugStats?.correct || 0).padStart(8) + ' │ ' + (bugStats ? ((bugStats.correct/bugStats.total*100)||0).toFixed(2) : 'N/A').padStart(7) + '% │');
}
console.log('├──────────────────┼──────────┼──────────┼──────────┤');
console.log('│ 合计             │ ' + String(overallTotal).padStart(8) + ' │ ' + String(overallCorrect).padStart(8) + ' │ ' + overallAccuracy.padStart(7) + '% │');
console.log('└──────────────────┴──────────┴──────────┴──────────┘');

if (parseFloat(overallAccuracy) >= 99.9) {
  console.log('\n🎉 完美！所有数据状态100%正确！');
} else if (parseFloat(overallAccuracy) >= 95) {
  console.log('\n✅ 数据质量良好，有少量问题需要关注');
  console.log('💡 建议: 运行 node scripts/full-scan-and-fix.js 自动修复');
} else {
  console.log('\n⚠️ 数据质量问题较多，建议立即修复');
  console.log('💡 请运行: node scripts/full-scan-and-fix.js');
}

db.close();
