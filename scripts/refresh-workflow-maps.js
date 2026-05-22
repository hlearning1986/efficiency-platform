/**
 * TAPD 工作流配置刷新脚本
 * 
 * 功能：
 * 1. 强制从TAPD API重新获取工作流配置
 * 2. 更新数据库缓存
 * 3. 可指定单个或全部项目
 * 
 * 使用方法：
 *   node scripts/refresh-workflow-maps.js              # 刷新所有已缓存的项目
 *   node scripts/refresh-workflow-maps.js --workspace=xxx  # 刷新指定项目
 */

async function main() {
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║        🔄 TAPD 工作流配置刷新工具                          ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  // 解析命令行参数
  const args = process.argv.slice(2);
  const workspaceArg = args.find(a => a.startsWith('--workspace='));
  const targetWorkspaceId = workspaceArg ? workspaceArg.split('=')[1] : null;

  console.log(`${targetWorkspaceId ? `📌 目标项目: ${targetWorkspaceId}` : '📋 将刷新所有已缓存的项目'}\n`);
  console.log('⚠️  注意：此操作将强制从TAPD API重新获取最新配置\n');

  try {
    let url;
    let body;

    if (targetWorkspaceId) {
      url = 'http://localhost:3000/api/v1/tapd/workflow-status/refresh';
      body = { workspaceId: targetWorkspaceId };
    } else {
      url = 'http://localhost:3000/api/v1/tapd/workflow-status/refresh';
      body = {}; // 不传参数则刷新全部
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.message || '刷新失败');
    }

    // 显示结果
    console.log('═'.repeat(70));
    console.log('📊 刷新结果');
    console.log('═'.repeat(70) + '\n');

    if (result.data?.results) {
      result.data.results.forEach((r, idx) => {
        const icon = r.success ? '✅' : '❌';
        const duration = r.durationMs ? ` [${Math.round(r.durationMs/1000)}s]` : '';
        
        console.log(`${icon} ${idx + 1}. ${r.workspaceId}${duration}`);
        if (!r.success) {
          console.log(`   ⚠️  ${r.message}`);
        } else if (r.storyCount !== undefined) {
          console.log(`   📝 需求:${r.storyCount}种状态 | 缺陷:${r.bugCount || 0}种状态`);
        }
      });
    }

    console.log('\n' + '─'.repeat(70));
    console.log(`成功: ${result.data?.success || 0} / 总计: ${result.data?.results?.length || 0}`);
    console.log('─'.repeat(70) + '\n');

    console.log('✅ 刷新完成！\n');

  } catch (error) {
    console.error('\n❌ 刷新失败:', error.message);
    
    if (error.message.includes('fetch failed')) {
      console.error('\n⚠️  请确保开发服务器已启动: npm run dev');
    }
    
    process.exit(1);
  }
}

main();
