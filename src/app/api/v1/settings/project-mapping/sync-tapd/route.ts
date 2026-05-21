import { NextRequest, NextResponse } from 'next/server';

// POST /api/v1/settings/project-mapping/sync-tapd
// 从 TAPD API 同步所有项目的项目归属可选值
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { apiUser, apiPassword, workspaceIds } = body as {
      apiUser: string;
      apiPassword: string;
      workspaceIds: string[];
    };

    if (!apiUser || !apiPassword || !workspaceIds?.length) {
      return NextResponse.json(
        { success: false, message: '缺少 TAPD API 凭据或项目ID' },
        { status: 400 },
      );
    }

    const auth = Buffer.from(`${apiUser}:${apiPassword}`).toString('base64');
    const headers = {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/json',
    };

    // 从所有 TAPD 项目中收集项目归属可选值
    const tapdBelongings = new Map<string, { value: string; source: string }>();

    for (const wsId of workspaceIds) {
      try {
        const resp = await fetch(
          `https://api.tapd.cn/stories/custom_fields_settings?workspace_id=${wsId}`,
          { headers },
        );
        if (!resp.ok) continue;

        const result = await resp.json();
        const items: Record<string, unknown>[] = Array.isArray(result.data)
          ? result.data
          : [];

        for (const item of items) {
          const keys = Object.keys(item);
          const cf = (keys.length === 1 ? item[keys[0]] : item) as Record<
            string,
            unknown
          >;
          const name = String(cf['name'] ?? '');
          const fieldKey = keys.length === 1 ? keys[0] : '';
          const options = String(cf['options'] ?? '');

          // 匹配"项目归属"字段：按名称或按已知字段编号
          const isProjectBelonging =
            name.includes('项目归属') ||
            fieldKey === 'custom_field_11' ||
            fieldKey === 'custom_field_13';

          if (isProjectBelonging && options && options.startsWith('[')) {
            const parsed = JSON.parse(options) as {
              name: string;
              children?: { name: string; children?: { name: string }[] }[];
            }[];

            // 递归提取所有叶子节点的完整层级路径
            // 如：战略项目/AI销售 → "战略项目/AI销售"
            // 如：战略项目/核心系统/支付模块 → "战略项目/核心系统/支付模块"
            const extractPaths = (
              nodes: { name: string; children?: { name: string; children?: { name: string }[] }[] }[],
              prefix: string,
            ): string[] => {
              const paths: string[] = [];
              for (const node of nodes) {
                const currentPath = prefix ? `${prefix}/${node.name}` : node.name;
                if (node.children && node.children.length > 0) {
                  // 有子节点，继续递归
                  paths.push(...extractPaths(node.children, currentPath));
                } else {
                  // 叶子节点，返回完整路径
                  if (node.name) paths.push(currentPath);
                }
              }
              return paths;
            };

            const paths = extractPaths(parsed, '');
            for (const path of paths) {
              if (path && !tapdBelongings.has(path)) {
                tapdBelongings.set(path, {
                  value: path,
                  source: wsId,
                });
              }
            }
          }
        }
      } catch (err) {
        console.error(`[sync-tapd] workspace ${wsId} failed:`, err);
      }
    }

    const data = Array.from(tapdBelongings.values());

    return NextResponse.json({
      success: true,
      data,
      message: `同步完成，共获取 ${data.length} 个项目归属值`,
    });
  } catch (error) {
    console.error('[sync-tapd]', error);
    return NextResponse.json(
      { success: false, message: '同步失败' },
      { status: 500 },
    );
  }
}
