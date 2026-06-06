import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * 获取 TAPD 数据库元信息
 * 包括：项目列表、状态列表（中文化）、数据统计等
 * 用于动态填充数据同步页面的下拉选项
 * 
 * 优化：从 tapd_workflow_status 表读取工作流配置，显示中文状态标签
 */

export async function GET() {
  try {
    console.log('📋 [TAPD Meta] 正在获取数据库元信息...\n');

    // ========== 1. 获取所有项目 ==========
    const workspaceStats = await prisma.tapdStory.groupBy({
      by: ['workspaceId', 'workspaceName'],
      _count: { id: true },
      _max: { syncedAt: true },
      orderBy: [{ workspaceName: 'asc' }],
    });

    // 去重并格式化
    const projectMap = new Map<string, { id: string; name: string; storyCount: number; lastSyncedAt: Date | null }>();
    
    for (const ws of workspaceStats) {
      if (!projectMap.has(ws.workspaceId)) {
        projectMap.set(ws.workspaceId, {
          id: ws.workspaceId,
          name: ws.workspaceName || ws.workspaceId,
          storyCount: ws._count.id,
          lastSyncedAt: ws._max.syncedAt,
        });
      } else {
        // 累加数量
        const existing = projectMap.get(ws.workspaceId)!;
        existing.storyCount += ws._count.id;
      }
    }

    const projects = Array.from(projectMap.values()).sort((a, b) => 
        a.name.localeCompare(b.name, 'zh-CN')
    );

    console.log(`✅ 找到 ${projects.length} 个项目:`);
    projects.slice(0, 10).forEach((p, i) => {
      console.log(`   ${i + 1}. [${p.id}] ${p.name} (${p.storyCount} 条Story)`);
    });
    if (projects.length > 10) {
      console.log(`   ... 还有 ${projects.length - 10} 个项目`);
    }

    // ========== 2. 从工作流表获取状态映射（中文化） ==========
    console.log('\n🔄 [Meta] 正在加载工作流状态映射...');
    
    // 查询所有活跃的工作流状态配置
    const workflowStatusRecords = await prisma.tapdWorkflowStatus.findMany({
      where: {
        system: 'story',
        isActive: true,
      },
      select: {
        statusKey: true,
        statusValue: true,
        workspaceId: true,
      },
    });

    // 构建多层映射表：
    // 1. 正向映射：英文键 -> 中文值 (statusKey -> statusValue) — 全局（取第一个）
    const statusKeyToChineseMap = new Map<string, string>();
    
    // 2. 反向映射：中文值 -> 英文键数组 (statusValue -> statusKey[])
    const chineseToKeysMap = new Map<string, string[]>();
    
    // 3. 中文自映射
    const chineseSelfMap = new Map<string, string>();

    // 4. 🎯 按项目(workspaceId)的映射：(workspaceId, statusKey) -> statusValue
    // 解决不同项目同一状态码含义不同的问题（如 status_8 在A项目=已发布，B项目=需求暂停）
    const wsStatusMapping = new Map<string, Map<string, string>>();
    
    workflowStatusRecords.forEach(record => {
      // 正向映射：英文 -> 中文（全局，取第一个遇到的值）
      if (!statusKeyToChineseMap.has(record.statusKey)) {
        statusKeyToChineseMap.set(record.statusKey, record.statusValue);
      }
      
      // 反向映射：中文 -> 英文列表
      if (!chineseToKeysMap.has(record.statusValue)) {
        chineseToKeysMap.set(record.statusValue, []);
      }
      chineseToKeysMap.get(record.statusValue)!.push(record.statusKey);
      
      chineseSelfMap.set(record.statusValue, record.statusValue);

      // 🎯 按项目映射
      if (!wsStatusMapping.has(record.workspaceId)) {
        wsStatusMapping.set(record.workspaceId, new Map());
      }
      wsStatusMapping.get(record.workspaceId)!.set(record.statusKey, record.statusValue);
    });

    console.log(`   ✅ 加载 ${workflowStatusRecords.length} 条工作流配置`);
    console.log(`   ✅ 构建了 ${statusKeyToChineseMap.size} 个英文→中文映射`);
    console.log(`   ✅ 构建了 ${chineseToKeysMap.size} 个中文→英文映射`);

    // ========== 3. 获取所有状态值（带智能中文标签） ==========
    const statusDistribution = await prisma.tapdStory.groupBy({
      by: ['status'],
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
    });

    // 为每个状态添加中文标签（增强版逻辑）
    const statuses = statusDistribution.map(s => {
      const originalValue = s.status;
      
      let chineseLabel: string;
      let isTranslated: boolean;
      
      // 策略1：检查是否在工作流表的英文键中（如 "resolved"）
      if (statusKeyToChineseMap.has(originalValue)) {
        chineseLabel = statusKeyToChineseMap.get(originalValue)!;
        isTranslated = true;
      }
      // 策略2：检查是否本身就是一个已知的中文值（如 "已实现"）
      else if (chineseSelfMap.has(originalValue)) {
        chineseLabel = originalValue; // 保持原样
        isTranslated = true; // 标记为"已知中文"
      }
      // 策略3：未找到映射，保持原始值
      else {
        chineseLabel = originalValue;
        isTranslated = false;
      }
      
      return {
        value: originalValue,           // 原始值（用于API查询）
        label: chineseLabel,            // 显示标签（中文优先）
        count: s._count.id,
        isTranslated,                   // 标记是否已识别/翻译
        translationSource: statusKeyToChineseMap.has(originalValue) 
          ? 'workflow_mapping' 
          : chineseSelfMap.has(originalValue)
            ? 'chinese_value'
            : 'original',
      };
    });

    // 合并相同标签的状态（避免重复显示）
    // 例如："resolved"和"已实现"都显示为"已实现"，应该合并
    const labelGroups = new Map<string, typeof statuses>();
    
    statuses.forEach(status => {
      if (!labelGroups.has(status.label)) {
        labelGroups.set(status.label, []);
      }
      labelGroups.get(status.label)!.push(status);
    });

    // 合并后的最终列表
    const mergedStatuses = Array.from(labelGroups.entries()).map(([label, items]) => ({
      value: items[0].value,  // 取第一个原始值作为主要value
      label,
      count: items.reduce((sum, item) => sum + item.count, 0),  // 合并数量
      isTranslated: items.some(item => item.isTranslated),
      allValues: items.map(item => item.value),  // 所有对应的原始值
      translationSources: [...new Set(items.map(item => item.translationSource))],
    }));

    console.log(`\n🏷️  找到 ${statuses.length} 个不同的状态值，合并为 ${mergedStatuses.length} 个显示项:`);
    mergedStatuses.slice(0, 15).forEach(s => {
      const translated = s.isTranslated ? '✓' : ' ';
      const valuesInfo = s.allValues.length > 1 ? ` [${s.allValues.join(', ')}]` : '';
      console.log(`   ${translated} "${s.label}"${valuesInfo}: ${s.count} 条`);
    });
    if (mergedStatuses.length > 15) {
      console.log(`   ... 还有 ${mergedStatuses.length - 15} 个状态`);
    }

    // ========== 4. 获取时间范围 ==========
    const timeRange = await prisma.tapdStory.aggregate({
      _min: { created: true },
      _max: { created: true },
    });

    console.log(`\n⏰ 数据时间范围:`);
    console.log(`   最早: ${timeRange._min.created}`);
    console.log(`   最晚: ${timeRange._max.created}`);

    // ========== 5. 统计总数据量 ==========
    const totalStories = await prisma.tapdStory.count();
    const totalTasks = await prisma.tapdTask.count();

    console.log(`\n📊 总数据量:`);
    console.log(`   Stories: ${totalStories}`);
    console.log(`   Tasks: ${totalTasks}`);

    return NextResponse.json({
      success: true,
      data: {
        projects,
        statuses: mergedStatuses,  // 使用合并后的列表
        statusMapping: {
          // 正向映射：英文原始值 -> 中文显示值（全局，取第一个）
          keyToChinese: Object.fromEntries(statusKeyToChineseMap),
          // 反向映射：中文显示值 -> 可能的英文原始值数组
          chineseToKeys: Object.fromEntries(chineseToKeysMap),
          totalMappings: statusKeyToChineseMap.size,
          // 中文自映射：已知的中文值
          knownChineseValues: Array.from(chineseSelfMap.keys()),
          // 🎯 按项目映射：{ workspaceId: { statusKey: statusValue } }
          // 解决不同项目同一状态码含义不同的问题
          workspaceKeyToChinese: Object.fromEntries(
            Array.from(wsStatusMapping.entries()).map(([wsId, m]) => [wsId, Object.fromEntries(m)])
          ),
        },
        timeRange: {
          earliest: timeRange._min.created,
          latest: timeRange._max.created,
        },
        statistics: {
          totalStories,
          totalTasks,
          totalProjects: projects.length,
          workflowConfigured: workflowStatusRecords.length > 0, // 是否有工作流配置
        },
      },
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('❌ [TAPD Meta] 获取失败:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '获取元信息失败',
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}
