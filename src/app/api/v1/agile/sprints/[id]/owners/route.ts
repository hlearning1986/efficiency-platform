import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/v1/agile/sprints/[id]/owners
 * 汇总该迭代下所有需求的 owner 列表（去重），用于角色人员分配助手
 *
 * 策略：优先查本地 tapdStory 表，无数据时直连 TAPD stories API
 */
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id: iterationId } = await context.params;

    let stories: Array<{ owner: string | null; workspaceId: string }> = [];

    // 策略1：优先查本地 DB
    const localStories = await prisma.tapdStory.findMany({
      where: { iterationId, owner: { not: '' } },
      select: { owner: true, workspaceId: true },
    });
    stories = localStories;

    // 策略2：本地无数据时，直连 TAPD stories API
    if (stories.length === 0) {
      try {
        const config = await prisma.systemSetting.findUnique({
          where: { key: 'tapd_api_config' },
        });

        if (config?.value) {
          let tapdConfig: { apiUser?: string; apiPassword?: string };
          try {
            tapdConfig = JSON.parse(config.value);
          } catch {
            // skip
          }

          if (tapdConfig?.apiUser && tapdConfig?.apiPassword) {
            const credentials = Buffer.from(
              `${tapdConfig.apiUser.trim()}:${tapdConfig.apiPassword.trim()}`,
            ).toString('base64');

            // 先通过 iterationId 反查 workspaceId
            const wsFromIter = await prisma.tapdIteration.findFirst({
              where: { id: iterationId },
              select: { workspaceId: true },
            });
            const workspaceId = wsFromIter?.workspaceId || '';

            if (workspaceId) {
              const url = `https://api.tapd.cn/stories?workspace_id=${workspaceId}&iteration_id=${iterationId}&limit=200&fields=id,owner,workspace_id`;
              const resp = await fetch(url, {
                headers: { Authorization: `Basic ${credentials}` },
                signal: AbortSignal.timeout(20000),
              });

              if (resp.ok) {
                const json = await resp.json();
                const rawList = json?.data;
                const list = Array.isArray(rawList)
                  ? rawList
                  : Array.isArray(rawList?.data)
                    ? rawList.data
                    : [];

                if (list.length > 0) {
                  stories = list
                    .filter((item: Record<string, unknown>) => item.owner)
                    .map((item: Record<string, unknown>) => ({
                      owner: String(item.owner || ''),
                      workspaceId,
                    }));
                }
              }
            }
          }
        }
      } catch (e) {
        console.warn('[SprintOwners] TAPD 直连失败:', e);
      }
    }

    // 拆分 owner 字段，分隔符为分号、逗号、顿号
    const ownerSet = new Set<string>();
    const wsId = stories[0]?.workspaceId || '';
    for (const s of stories) {
      if (!s.owner) continue;
      s.owner
        .split(/[;,、]/)
        .map((o: string) => o.trim())
        .filter(Boolean)
        .forEach((o: string) => ownerSet.add(o));
    }

    const mappings = wsId
      ? await prisma.tapdMemberRoleMapping.findMany({
          where: { workspaceId: wsId, isActive: true },
        })
      : [];
    const mappingMap = new Map(
      mappings.map((m) => [m.memberName, m.role] as const),
    );

    const owners = Array.from(ownerSet)
      .sort((a, b) => a.localeCompare(b, 'zh'))
      .map((name) => ({
        name,
        role: mappingMap.get(name) || '',
      }));

    return NextResponse.json({
      success: true,
      data: {
        iterationId,
        workspaceId: wsId,
        owners,
        total: owners.length,
        mappedCount: owners.filter((o) => o.role).length,
        source: localStories.length > 0 ? 'local' : 'tapd',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '查询 owner 列表失败';
    console.error('[SprintOwners GET]', error);
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
