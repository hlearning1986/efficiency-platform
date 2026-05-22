const Database = require('better-sqlite3');
const db = new Database('./prisma/dev.db');

console.log('\n╔══════════════════════════════════════════════════════╗');
console.log('║  🛡️ 全面扫描与修复：所有项目的需求状态            ║');
console.log('╚══════════════════════════════════════════════════════╝\n');

// 1. 加载所有项目的工作流映射
console.log('═'.repeat(70));
console.log('📚 第一步：加载所有项目的工作流映射\n');

const allWorkflowMappings = db.prepare(`
  SELECT workspace_id, status_key, status_value, system
  FROM tapd_workflow_status 
  WHERE is_active = 1
`).all();

// 构建映射表: workspaceId -> system -> {statusKey -> statusValue}
const mappingByWorkspace = {};
allWorkflowMappings.forEach(m => {
  if (!mappingByWorkspace[m.workspace_id]) {
    mappingByWorkspace[m.workspace_id] = {};
  }
  if (!mappingByWorkspace[m.workspace_id][m.system]) {
    mappingByWorkspace[m.workspace_id][m.system] = {};
  }
  mappingByWorkspace[m.workspace_id][m.system][m.status_key] = m.status_value;
});

console.log('✅ 已加载 ' + Object.keys(mappingByWorkspace).length + ' 个项目的工作流配置');
console.log('   总计 ' + allWorkflowMappings.length + ' 条映射规则\n');

// 2. 扫描所有需求数据，找出不一致的记录
console.log('═'.repeat(70));
console.log('🔍 第二步：扫描所有需求数据的状态一致性\n');

const allStories = db.prepare(`
  SELECT id, name, workspace_id, status, raw_json
  FROM tapd_story
`).all();

let issuesFound = [];
let totalScanned = 0;

allStories.forEach(story => {
  totalScanned++;
  
  // 从raw_json中提取原始API返回的状态
  let originalStatus = null;
  if (story.raw_json) {
    try {
      const rawData = typeof story.raw_json === 'string' ? JSON.parse(story.raw_json) : story.raw_json;
      originalStatus = rawData.Status || rawData.status || null;
    } catch(e) {}
  }
  
  // 如果有原始状态，检查是否正确转换
  if (originalStatus && originalStatus !== story.status) {
    const workspaceMapping = mappingByWorkspace[story.workspace_id]?.['story'];
    
    if (workspaceMapping) {
      const expectedStatus = workspaceMapping[originalStatus];
      
      if (expectedStatus && expectedStatus !== story.status) {
        // 发现问题：应该转换为expectedStatus，但实际是story.status
        issuesFound.push({
          id: story.id,
          name: story.name,
          workspaceId: story.workspace_id,
          currentStatus: story.status,
          originalStatus: originalStatus,
          expectedStatus: expectedStatus
        });
      }
    }
  } else if (!originalStatus && story.status === '新建') {
    // 特殊情况：没有原始数据且状态为"新建"，可能是历史遗留问题
    issuesFound.push({
      id: story.id,
      name: story.name,
      workspaceId: story.workspace_id,
      currentStatus: story.status,
      originalStatus: '未知',
      expectedStatus: '需要人工确认',
      note: '无原始数据'
    });
  }
});

console.log('📊 扫描结果:');
console.log('   总需求数: ' + totalScanned);
console.log('   发现问题: ' + issuesFound.length + ' 条');
console.log('   正确率: ' + ((totalScanned - issuesFound.length) / totalScanned * 100).toFixed(2) + '%\n');

if (issuesFound.length === 0) {
  console.log('✨ 完美！所有需求数据的状态都是正确的！');
} else {
  console.log('⚠️ 发现以下问题:\n');
  
  // 按项目分组显示
  const issuesByWorkspace = {};
  issuesFound.forEach(issue => {
    if (!issuesByWorkspace[issue.workspaceId]) {
      issuesByWorkspace[issue.workspaceId] = [];
    }
    issuesByWorkspace[issue.workspaceId].push(issue);
  });
  
  Object.keys(issuesByWorkspace).forEach(wsId => {
    const issues = issuesByWorkspace[wsId];
    console.log('📁 项目 ' + wsId + ' (' + issues.length + ' 条):');
    
    issues.slice(0, 5).forEach((issue, idx) => {
      console.log('   ' + (idx+1) + '. [' + issue.id.substring(0, 12) + '...] ' + 
                 issue.name.substring(0, 25) + '...');
      console.log('      当前: "' + issue.currentStatus + '" | 原始: "' + issue.originalStatus + '" | 应该: "' + issue.expectedStatus + '"');
    });
    
    if (issues.length > 5) {
      console.log('   ... 还有 ' + (issues.length - 5) + ' 条');
    }
    console.log('');
  });

  // 3. 自动修复
  console.log('═'.repeat(70));
  console.log('🔧 第三步：自动修复问题记录\n');
  
  let fixedCount = 0;
  let failedCount = 0;
  
  issuesFound.forEach(issue => {
    if (issue.expectedStatus === '需要人工确认') {
      console.log('⏭️ 跳过 ' + issue.id + ': 需要人工确认');
      return;
    }
    
    try {
      const result = db.prepare(`
        UPDATE tapd_story 
        SET status = ?, modified = datetime('now')
        WHERE id = ?
      `).run(issue.expectedStatus, issue.id);
      
      if (result.changes > 0) {
        fixedCount++;
        
        if (fixedCount <= 10 || fixedCount % 50 === 0) {
          console.log('✅ #' + fixedCount + ' ' + issue.id.substring(0, 12) + 
                     ': "' + issue.currentStatus + '" → "' + issue.expectedStatus + '"');
        }
      } else {
        failedCount++;
      }
    } catch(error) {
      failedCount++;
      console.error('❌ 修复失败 ' + issue.id + ': ' + error.message);
    }
  });
  
  console.log('\n' + '─'.repeat(70));
  console.log('📈 修复统计:');
  console.log('   成功修复: ' + fixedCount + ' 条');
  console.log('   失败数量: ' + failedCount + ' 条');
  console.log('   跳过数量: ' + (issuesFound.length - fixedCount - failedCount) + ' 条');
}

// 4. 最终验证
console.log('\n' + '═'.repeat(70));
console.log('✅ 第四步：最终验证\n');

const finalCheck = db.prepare(`
  SELECT COUNT(*) as total,
         SUM(CASE WHEN status IN (
           SELECT DISTINCT status_value 
           FROM tapd_workflow_status 
           WHERE system = 'story' AND is_active = 1
         ) THEN 1 ELSE 0 END) as correct
  FROM tapd_story
`).get();

const accuracy = (finalCheck.correct / finalCheck.total * 100).toFixed(2);

console.log('🎯 最终数据质量报告:');
console.log('   总需求数: ' + finalCheck.total);
console.log('   正确数量: ' + finalCheck.correct);
console.log('   数据准确率: ' + accuracy + '%');

if (parseFloat(accuracy) >= 99) {
  console.log('\n🎉 数据质量优秀！');
} else if (parseFloat(accuracy) >= 95) {
  console.log('\n✅ 数据质量良好');
} else {
  console.log('\n⚠️ 数据质量需要改进');
}

db.close();
