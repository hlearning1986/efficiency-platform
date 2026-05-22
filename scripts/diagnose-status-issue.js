/**
 * TAPD 状态问题深度诊断脚本
 * 
 * 功能：
 * 1. 查询图一、图二中的具体错误记录
 * 2. 分析各项目的工作流配置是否被正确获取
 * 3. 生成详细的诊断报告
 */

const Database = require('better-sqlite3');
const path = require('path');

// 连接数据库
const dbPath = path.join(__dirname, '..', 'prisma', 'dev.db');
const db = new Database(dbPath);

console.log('🔍 TAPD 状态问题深度诊断\n');
console.log('='.repeat(100));

// ============================================
// 图一分析：两个需求显示"新建"但实际是"待发布"
// ID前缀: 114825467100...
// 项目: 中台项目
// ============================================

console.log('\n📌 图一分析：中台项目 - 显示"新建"但实际应该是"待发布"\n');

const figure1Ids = ['114825467100%', '114825467100%'];  // 使用模糊匹配

const figure1Records = db.prepare(`
  SELECT id, name, workspace_id, workspace_name, status, 
         raw_json, created, modified
  FROM tapd_story 
  WHERE id LIKE '114825467100%'
    AND workspace_name LIKE '%中台%'
  ORDER BY modified DESC
`).all();

console.log(`找到 ${figure1Records.length} 条相关记录:\n`);

figure1Records.forEach((record, idx) => {
  console.log(`${'─'.repeat(80)}`);
  console.log(`📋 记录 ${idx + 1}:`);
  console.log(`   ID: ${record.id}`);
  console.log(`   标题: ${(record.name || '').substring(0, 60)}`);
  console.log(`   项目: ${record.workspace_name || '(空)'}`);
  console.log(`   数据库状态: "${record.status}"`);
  
  // 解析 raw_json 查看 TAPD 原始返回值
  if (record.raw_json) {
    try {
      const raw = JSON.parse(record.raw_json);
      const story = raw.Story || raw;
      
      console.log(`\n   📦 Raw JSON 关键字段:`);
      console.log(`      • status (TAPD原始): "${story.status}"`);
      console.log(`      • priority: "${story.priority || '(空)'}"`);
      console.log(`      • owner: "${story.owner || '(空)'}"`);
      console.log(`      • iteration_id: "${story.iteration_id || '(空)'}"`);
      console.log(`      • workspace_id: "${story.workspace_id || '(空)'}"`);
      
      // 检查时间戳
      const timeFields = ['created', 'modified', 'completed'];
      timeFields.forEach(field => {
        if (story[field]) {
          console.log(`      • ${field}: ${story[field]}`);
        }
      });
      
    } catch (e) {
      console.log(`   ⚠️ 无法解析 raw_json: ${e.message}`);
    }
  }
  
  console.log('');
});

// ============================================
// 图二分析：公职团队、AI销售团队 - "待发布"状态错误
// ============================================

console.log('\n' + '='.repeat(100));
console.log('\n📌 图二分析：公职团队、AI销售团队 - "待发布"状态错误\n');

const targetProjects = ['公职团队', 'AI销售专项', 'AI销售专项'];

targetProjects.forEach(projectName => {
  console.log(`\n${'─'.repeat(80)}`);
  console.log(`📊 项目: ${projectName}\n`);
  
  // 查询该项目中所有状态为"待发布"或包含"待发布"的记录
  const records = db.prepare(`
    SELECT id, name, workspace_id, workspace_name, status,
           raw_json, created, modified
    FROM tapd_story 
    WHERE workspace_name LIKE ?
      AND (status = '待发布' OR status LIKE '%待发布%' OR status = 'closed' OR status = 'status_6')
    ORDER BY modified DESC
    LIMIT 10
  `).all(`%${projectName}%`);
  
  console.log(`找到 ${records.length} 条"待发布"状态的记录:\n`);
  
  if (records.length === 0) {
    console.log('   ⚠️ 未找到"待发布"状态的记录');
    
    // 尝试查找该项目的所有记录，看有什么状态
    const allStatuses = db.prepare(`
      SELECT status, COUNT(*) as count
      FROM tapd_story 
      WHERE workspace_name LIKE ?
      GROUP BY status
      ORDER BY count DESC
      LIMIT 10
    `).all(`%${projectName}%`);
    
    console.log(`\n   📈 该项目的所有状态分布（Top 10）:\n`);
    allStatuses.forEach(s => {
      console.log(`      • "${s.status}": ${s.count} 条`);
    });
  } else {
    records.slice(0, 5).forEach((record, idx) => {
      console.log(`   ${idx + 1}. [${record.id.substring(0, 15)}...] ${(record.name || '').substring(0, 45)}...`);
      console.log(`      数据库状态: "${record.status}" | 修改时间: ${record.modified}\n`);
      
      // 解析 raw_json
      if (record.raw_json) {
        try {
          const raw = JSON.parse(record.raw_json);
          const story = raw.Story || raw;
          console.log(`      TAPD原始status: "${story.status}"`);
          
          // 对比数据库值和原始值是否一致
          if (story.status !== record.status) {
            console.log(`      ⚠️ 不一致！数据库="${record.status}", 原始="${story.status}"`);
          }
        } catch (e) {
          console.log(`      ⚠️ 无法解析raw_json`);
        }
      }
    });
  }
});

// ============================================
// 全局统计：各项目的状态分布情况
// ============================================

console.log('\n' + '='.repeat(100));
console.log('\n📊 全局统计：各项目的状态分布情况\n');

const projectStatusStats = db.prepare(`
  SELECT 
    workspace_id,
    workspace_name,
    status,
    COUNT(*) as count
  FROM tapd_story
  WHERE status NOT IN ('已实现', '规划中', '开发中', '测试中', '待测试', '新建',
                       '已验收', '待发布', 'T测试完成', '需求暂停', '已拒绝',
                       '重新打开', '已完成', '已关闭')
  GROUP BY workspace_id, workspace_name, status
  HAVING COUNT(*) > 0
  ORDER BY count DESC
`).all();

if (projectStatusStats.length > 0) {
  console.log(`⚠️ 发现 ${projectStatusStats.length} 组异常状态数据:\n`);
  
  let currentProject = '';
  projectStatusStats.forEach(stat => {
    if (stat.workspace_name !== currentProject) {
      currentProject = stat.workspace_name;
      console.log(`\n📁 项目: ${currentProject} (${stat.workspace_id})`);
      console.log('   异常状态:');
    }
    console.log(`     • "${stat.status}": ${stat.count} 条`);
  });
} else {
  console.log('✅ 所有项目的状态都是标准中文状态');
}

// ============================================
// 工作流配置检查：各项目是否有不同的工作流
// ============================================

console.log('\n' + '='.repeat(100));
console.log('\n🔧 工作流配置检查\n');

const allProjects = db.prepare(`
  SELECT DISTINCT workspace_id, workspace_name
  FROM tapd_story
  WHERE workspace_name IS NOT NULL
  ORDER BY workspace_name
`).all();

console.log(`共发现 ${allProjects.length} 个项目:\n`);

allProjects.slice(0, 10).forEach((project, idx) => {
  const statuses = db.prepare(`
    SELECT DISTINCT status
    FROM tapd_story
    WHERE workspace_id = ?
    ORDER BY status
  `).all(project.workspace_id);
  
  const statusList = statuses.map(s => s.status);
  const hasNonChinese = statusList.some(s => !/^[\u4e00-\u9fa5]+$/.test(s));
  
  const marker = hasNonChinese ? '⚠️' : '✅';
  console.log(`${marker} ${idx + 1}. ${project.workspace_name} (${project.workspace_id})`);
  console.log(`   状态数: ${statuses.length} | 包含非中文: ${hasNonChinese ? '是' : '否'}`);
  
  if (hasNonChinese && statuses.length <= 15) {
    console.log(`   状态列表: [${statusList.join(', ')}]`);
  } else if (hasNonChinese) {
    const nonChinese = statusList.filter(s => !/^[\u4e00-\u9fa5]+$/.test(s));
    console.log(`   非中文状态(${nonChinese.length}): [${nonChinese.slice(0, 8).join(', ')}...]`);
  }
  console.log('');
});

if (allProjects.length > 10) {
  console.log(`... 还有 ${allProjects.length - 10} 个项目未显示\n`);
}

// ============================================
// 结论和建议
// ============================================

console.log('═'.repeat(100));
console.log('\n💡 诊断结论和建议\n');
console.log('═'.repeat(100));

console.log(`
┌─────────────────────────────────────────────────────────────┐
│ 问题根因分析                                               │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ 1️⃣ 数据同步时未做状态转换                                   │
│    • 同步服务直接存储 TAPD API 返回的原始状态值              │
│    • 不同项目可能使用不同的状态编码方式                      │
│      - 有的用英文: resolved, planning, developing           │
│      - 有的用状态码: status_2, status_4, status_6           │
│      - 有的用中文: 已实现, 规划中                            │
│                                                             │
│ 2️⃣ 缺少项目级工作流配置                                     │
│    • 系统有 workflow-status-map API 可获取每个项目的映射     │
│    • 但同步时未调用此 API 进行状态转换                       │
│    • 导致不同项目的状态规则混乱                              │
│                                                             │
│ 3️⃣ 前端显示依赖动态加载                                    │
│    • getStatusConfig() 支持动态映射                         │
│    • 但需要先调用 loadCustomFieldMapping()                  │
│    • 如果映射未加载，会回退到硬编码（可能不准确）            │
│                                                             │
└─────────────────────────────────────────────────────────────┘

建议的修复方案：

方案A（推荐）: 在同步时转换状态
━━━━━━━━━━━━━━━━━━━━━━━
1. 修改 tapd-skill-sync.ts
2. 在同步每个项目时，调用 workflow-status-map API
3. 获取该项目的状态映射表
4. 存储时将原始状态转换为中文标准状态
5. 优点：一次修复，永久生效

方案B: 批量修正现有数据
━━━━━━━━━━━━━━━━━━━━━━━
1. 运行 fix-tapd-status.js --execute
2. 使用通用映射规则批量更新
3. 优点：立即见效
4. 缺点：如果遇到未知状态仍需手动处理

方案C（最完整）: A + B 结合
━━━━━━━━━━━━━━━━━━━━━━━
1. 先运行方案B修正现有数据
2. 再实施方案A防止未来再出现
3. 创建定时检查任务监控数据质量
`);

db.close();
console.log('\n🏁 诊断脚本执行完毕。\n');
