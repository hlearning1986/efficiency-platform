/**
 * 批量修复TAPD需求数据的历史状态值
 * 
 * 功能：
 * 1. 查询所有项目的当前状态分布
 * 2. 使用工作流配置表进行状态转换
 * 3. 批量更新数据库中的错误状态
 * 
 * 使用方法：
 *   node scripts/fix-historical-status.js              # 预览模式（只显示将要修改的内容）
 *   node scripts/fix-historical-status.js --execute    # 执行模式（实际修改数据）
 *   node scripts/fix-historical-status.js --workspace=xxx  # 只处理指定项目
 */

const Database = require('better-sqlite3');
const db = new Database('./prisma/dev.db');

// ============================================================
// 命令行参数解析
// ============================================================

const args = process.argv.slice(2);
const isExecuteMode = args.includes('--execute');
const workspaceArg = args.find(a => a.startsWith('--workspace='));
const targetWorkspaceId = workspaceArg ? workspaceArg.split('=')[1] : null;

console.log('\n╔══════════════════════════════════════════════════════════════╗');
console.log('║        🔧 TAPD 历史状态数据批量修复工具                     ║');
console.log('╚══════════════════════════════════════════════════════════════╝\n');

if (isExecuteMode) {
  console.log('⚠️  模式: 执行模式（将实际修改数据库）\n');
} else {
  console.log('📋 模式: 预览模式（只显示，不修改）\n');
  console.log('💡 提示: 如需执行修改，请使用 --execute 参数\n');
}

if (targetWorkspaceId) {
  console.log(`📌 目标项目: ${targetWorkspaceId}\n`);
} else {
  console.log('📋 范围: 所有项目\n');
}

// ============================================================
// 第一步：查询工作流配置表
// ============================================================

console.log('═'.repeat(70));
console.log('🔍 第一步：加载工作流配置映射\n');

let workflowMappings = {};

try {
  const mappings = db.prepare(`
    SELECT workspace_id, status_key, status_value, system
    FROM tapd_workflow_status
    WHERE is_active = 1
  `).all();

  mappings.forEach(m => {
    if (!workflowMappings[m.workspace_id]) {
      workflowMappings[m.workspace_id] = {};
    }
    workflowMappings[m.workspace_id][m.status_key] = m.status_value;
  });

  const projectCount = Object.keys(workflowMappings).length;
  const totalMappings = mappings.length;

  console.log(`✅ 已加载 ${projectCount} 个项目的工作流配置`);
  console.log(`   总计 ${totalMappings} 条状态映射规则\n`);

  if (projectCount === 0) {
    console.error('❌ 错误: 工作流配置表为空！');
    console.error('   请先运行: node scripts/init-workflow-maps.js\n');
    process.exit(1);
  }

} catch (error) {
  console.error('❌ 加载工作流配置失败:', error.message);
  process.exit(1);
}

// ============================================================
// 第二步：查询需要修复的数据
// ============================================================

console.log('═'.repeat(70));
console.log('📊 第二步：分析现有数据状态\n');

let whereClause = '';
let params = [];

if (targetWorkspaceId) {
  whereClause = 'WHERE workspace_id = ?';
  params.push(targetWorkspaceId);
}

// 查询所有不同的状态值及其数量
const statusStats = db.prepare(`
  SELECT 
    workspace_id,
    workspace_name,
    status,
    COUNT(*) as count
  FROM tapd_story
  ${whereClause}
  GROUP BY workspace_id, status
  ORDER BY workspace_name, count DESC
`).all(...params);

// 分析每个项目的状态情况
const projectAnalysis = {};

statusStats.forEach(stat => {
  if (!projectAnalysis[stat.workspace_id]) {
    projectAnalysis[stat.workspace_id] = {
      workspaceName: stat.workspace_name,
      totalRecords: 0,
      statuses: [],
      needsFix: [],
    };
  }

  const analysis = projectAnalysis[stat.workspace_id];
  analysis.totalRecords += stat.count;
  analysis.statuses.push({
    status: stat.status,
    count: stat.count,
  });

  // 检查该状态是否在映射表中存在
  const mapping = workflowMappings[stat.workspace_id]?.[stat.status];
  
  if (mapping && mapping !== stat.status) {
    analysis.needsFix.push({
      currentStatus: stat.status,
      correctStatus: mapping,
      count: stat.count,
    });
  }
});

// 显示分析结果
Object.keys(projectAnalysis).forEach(wsId => {
  const analysis = projectAnalysis[wsId];
  
  console.log(`${'─'.repeat(70)}`);
  console.log(`📁 项目: ${analysis.workspaceName || wsId} (${wsId})`);
  console.log(`   总记录数: ${analysis.totalRecords}`);
  console.log(`   状态种类: ${analysis.statuses.length} 种`);
  
  if (analysis.needsFix.length > 0) {
    console.log(`\n   ⚠️  需要修正的状态 (${analysis.needsFix.length} 种):`);
    
    let totalToFix = 0;
    analysis.needsFix.forEach(fix => {
      console.log(`     • "${fix.currentStatus}" → "${fix.correctStatus}" (${fix.count} 条)`);
      totalToFix += fix.count;
    });
    
    console.log(`\n   📝 该项目共需修正 ${totalToFix} 条记录`);
  } else {
    console.log(`\n   ✅ 所有状态已正确，无需修正`);
  }
  console.log();
});

// ============================================================
// 第三步：执行修复或显示摘要
// ============================================================

console.log('═'.repeat(70));

if (!isExecuteMode) {
  console.log('📋 第三步：预览模式 - 以下是将要执行的修复操作\n');
  
  let grandTotal = 0;
  Object.keys(projectAnalysis).forEach(wsId => {
    const analysis = projectAnalysis[wsId];
    
    if (analysis.needsFix.length > 0) {
      console.log(`【${analysis.workspaceName || wsId}】`);
      
      analysis.needsFix.forEach(fix => {
        console.log(`  UPDATE tapd_story SET status = '${fix.correctStatus}' WHERE workspace_id = '${wsId}' AND status = '${fix.currentStatus}'  (${fix.count} 条)`);
        grandTotal += fix.count;
      });
      console.log();
    }
  });
  
  console.log('─'.repeat(70));
  console.log(`📊 预览汇总:`);
  console.log(`   将要修正的项目: ${Object.keys(projectAnalysis).filter(k => projectAnalysis[k].needsFix.length > 0).length} 个`);
  console.log(`   将要修正的记录: ${grandTotal} 条`);
  console.log('─'.repeat(70));
  
  console.log('\n💡 如确认无误，请运行:');
  console.log('   node scripts/fix-historical-status.js --execute\n');
  
} else {
  console.log('🔨 第三步：执行修复操作\n');
  
  let totalFixed = 0;
  let successProjects = 0;
  let failedProjects = 0;

  Object.keys(projectAnalysis).forEach(wsId => {
    const analysis = projectAnalysis[wsId];
    
    if (analysis.needsFix.length === 0) return; // 跳过无需修复的项目

    console.log(`\n🔄 正在修复: ${analysis.workspaceName || wsId}`);
    
    try {
      let projectFixed = 0;
      
      for (const fix of analysis.needsFix) {
        const result = db.prepare(`
          UPDATE tapd_story 
          SET status = ?, modified = datetime('now')
          WHERE workspace_id = ? AND status = ?
        `).run(fix.correctStatus, wsId, fix.currentStatus);
        
        console.log(`  ✅ "${fix.currentStatus}" → "${fix.correctStatus}": 修正 ${result.changes} 条`);
        projectFixed += result.changes;
        totalFixed += result.changes;
      }
      
      console.log(`  📊 小计: 修正 ${projectFixed} 条记录`);
      successProjects++;
      
    } catch (error) {
      console.error(`  ❌ 修复失败: ${error.message}`);
      failedProjects++;
    }
  });
  
  console.log('\n' + '═'.repeat(70));
  console.log('🎉 修复完成！结果汇总:');
  console.log('═'.repeat(70));
  console.log(`✅ 成功修复: ${successProjects} 个项目`);
  console.log(`❌ 失败项目: ${failedProjects} 个`);
  console.log(`📝 总计修正: ${totalFixed} 条记录`);
  console.log('═'.repeat(70) + '\n');
}

db.close();

console.log('✅ 脚本执行完毕！\n');
