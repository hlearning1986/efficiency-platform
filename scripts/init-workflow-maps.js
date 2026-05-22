/**
 * TAPD 工作流配置初始化脚本
 * 
 * 功能：
 * 1. 批量获取所有TAPD项目的工作流状态映射
 * 2. 存储到数据库缓存
 * 3. 支持增量更新和强制刷新
 * 
 * 使用方法：
 *   node scripts/init-workflow-maps.js                    # 初始化所有项目
 *   node scripts/init-workflow-maps.js --force            # 强制刷新
 *   node scripts/init-workflow-maps.js --workspace=xxx    # 只处理指定项目
 */

const PROJECTS = [
  { id: '37198579', name: '高顿数据' },
  { id: '66690643', name: '高顿App鸿蒙化' },
  { id: '49993684', name: 'AI销售专项' },
  { id: '35153283', name: '小课新链路' },
  { id: '37539133', name: 'SCRM营销管理' },
  { id: '31751975', name: 'MCRM_SCRM' },
  { id: '20189291', name: 'CRM_销售' },
  { id: '37748852', name: 'Sail团队_new' },
  { id: '20074131', name: 'OnePiece' },
  { id: '46422870', name: '大学生第三空间' },
  { id: '48254671', name: '中台项目' },
  { id: '46357942', name: 'Luca专项' },
  { id: '48763054', name: '高顿直播间' },
  { id: '30668918', name: '小吉英语' },
  { id: '37329286', name: '公职团队' },
];

async function main() {
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║        🚀 TAPD 工作流配置初始化工具                          ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  // 解析命令行参数
  const args = process.argv.slice(2);
  const forceRefresh = args.includes('--force');
  const workspaceArg = args.find(a => a.startsWith('--workspace='));
  const targetWorkspaceId = workspaceArg ? workspaceArg.split('=')[1] : null;

  // 确定要处理的项目列表
  let targetProjects = PROJECTS;
  
  if (targetWorkspaceId) {
    targetProjects = PROJECTS.filter(p => p.id === targetWorkspaceId);
    if (targetProjects.length === 0) {
      console.error(`❌ 未找到 workspace_id: ${targetWorkspaceId}`);
      console.log('   可用的项目ID:');
      PROJECTS.forEach(p => console.log(`     - ${p.id} (${p.name})`));
      process.exit(1);
    }
    console.log(`📌 目标项目: ${targetProjects[0].name} (${targetWorkspaceId})`);
  } else {
    console.log(`📋 将处理 ${PROJECTS.length} 个项目\n`);
  }

  console.log(`模式: ${forceRefresh ? '✅ 强制刷新' : '🔄 增量初始化（跳过未过期的）'}\n`);

  try {
    // 调用API进行初始化
    const response = await fetch('http://localhost:3000/api/v1/tapd/workflow-status/init', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workspaceIds: targetProjects.map(p => p.id),
        forceRefresh,
      }),
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.message || '初始化失败');
    }

    // 显示结果
    console.log('\n' + '═'.repeat(70));
    console.log('📊 初始化结果汇总');
    console.log('═'.repeat(70) + '\n');

    if (result.data && result.data.results) {
      result.data.results.forEach((r, idx) => {
        const project = targetProjects.find(p => p.workspaceId === r.workspaceId);
        const projectName = project?.name || r.workspaceId;
        
        const icon = r.success ? '✅' : '❌';
        const details = r.storyCount !== undefined 
          ? ` (需求:${r.storyCount}, 缺陷:${r.bugCount || 0})` 
          : '';
        const duration = r.durationMs ? ` [${Math.round(r.durationMs/1000)}s]` : '';
        
        console.log(`${icon} ${idx + 1}. ${projectName}${details}${duration}`);
        if (!r.success) {
          console.log(`   错误: ${r.message}`);
        }
      });
    }

    console.log('\n' + '─'.repeat(70));
    console.log(`总计: ${result.data?.total || targetProjects.length} 个项目`);
    console.log(`成功: ${result.data?.success || 0} 个`);
    console.log(`失败: ${result.data?.failed || 0} 个`);
    console.log('─'.repeat(70) + '\n');

    // 提供后续操作建议
    console.log('💡 后续操作:\n');
    console.log('   1. 查看管理页面: http://localhost:3000/settings/tapd-workflow');
    console.log('   2. 刷新单个项目: node scripts/refresh-workflow-maps.js --workspace=XXX');
    console.log('   3. 修复历史数据: node scripts/fix-historical-status.js\n');

  } catch (error) {
    console.error('\n❌ 初始化失败:', error.message);
    
    if (error.message.includes('fetch failed') || error.message.includes('ECONNREFUSED')) {
      console.error('\n⚠️  请确保开发服务器已启动: npm run dev');
    }
    
    process.exit(1);
  }
}

main();
