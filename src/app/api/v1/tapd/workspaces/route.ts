import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// TAPD 项目 ID 到名称的映射
const PROJECT_NAME_MAP: Record<string, string> = {
  '48763054': '高顿直播间',
  '46357942': 'Luca专项',
  '30668918': '小吉英语',
  '36005436': 'GDBot',
  '48254671': '中台项目',
  '37329286': '公职团队',
  '66690643': '高顿APP鸿蒙化',
  '37198579': '高顿数据',
  '20074131': 'OnePiece',
  '37748852': 'Sail团队_new',
  '46422870': 'Areteup',
  '20189291': 'CRM_销售',
  '31751975': 'MCRM_SCRM',
  '37539133': 'SCRM营销管理',
  '35153283': '小课新链路',
  '49993684': 'AI销售专项',
  '45361805': '上岸鸭',
};

/**
 * GET /api/v1/tapd/workspaces
 * 获取 TAPD 项目列表（从本地数据库 + 团队配置 + 默认列表）
 * 支持参数：ids - 按逗号分隔的项目ID列表
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const idsParam = searchParams.get('ids');
    const filterIds = idsParam ? idsParam.split(',').filter(Boolean) : null;

    const projectMap = new Map<string, string>();

    // 1. 从本地数据库已同步的 workspace 获取
    const workspaces = await prisma.tapdWorkspace.findMany(
      filterIds ? { where: { id: { in: filterIds } } } : undefined
    );
    for (const ws of workspaces) {
      projectMap.set(ws.id, ws.name);
    }

    // 2. 从团队配置获取所有 TAPD 项目 ID
    if (!filterIds || projectMap.size < (filterIds?.length || 0)) {
      const teamConfigs = await prisma.teamConfig.findMany();
      for (const tc of teamConfigs) {
        try {
          const projectIds = JSON.parse(tc.tapdProjectIds) as string[];
          for (const pid of projectIds) {
            if (!projectMap.has(pid) && (!filterIds || filterIds.includes(pid))) {
              projectMap.set(pid, PROJECT_NAME_MAP[pid] || `项目${pid}`);
            }
          }
        } catch {
          // 忽略 JSON 解析错误
        }
      }
    }

    // 3. 如果还是没有，返回默认列表
    if (projectMap.size === 0 && !filterIds) {
      for (const [id, name] of Object.entries(PROJECT_NAME_MAP)) {
        projectMap.set(id, name);
      }
    }

    // 4. 如果指定了ids但还没找到，使用默认映射补充
    if (filterIds) {
      for (const id of filterIds) {
        if (!projectMap.has(id)) {
          projectMap.set(id, PROJECT_NAME_MAP[id] || `项目${id}`);
        }
      }
    }

    const projects = Array.from(projectMap.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));

    return NextResponse.json({ success: true, data: projects, projects });
  } catch (error) {
    const message = error instanceof Error ? error.message : '获取项目列表失败';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
