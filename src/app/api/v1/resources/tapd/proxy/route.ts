import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/v1/resources/tapd/proxy
 * 统一 TAPD API 代理，避免浏览器 CORS 限制
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { apiUser, apiPassword, action, ...params } = body;

    if (!apiUser || !apiPassword) {
      return NextResponse.json(
        { success: false, message: '缺少 API 凭据' },
        { status: 400 },
      );
    }

    // 清理凭据前后的空白字符（防止粘贴时带入 Tab/空格）
    const cleanUser = apiUser.trim();
    const cleanPass = apiPassword.trim();
    const credentials = Buffer.from(`${cleanUser}:${cleanPass}`).toString('base64');
    const headers: Record<string, string> = {
      Authorization: `Basic ${credentials}`,
    };

    let url: string;

    switch (action) {
      case 'test-auth':
        url = 'https://api.tapd.cn/quickstart/testauth';
        break;

      case 'projects': {
        url = 'https://api.tapd.cn/workspaces';
        const data = await tapdGet(url, headers);
        const wsList = data.data || data.workspace || data.Workspaces || [];
        const projects = (Array.isArray(wsList) ? wsList : []).map(
          (ws: Record<string, unknown>) => ({
            id: String(ws.id || ws.workspace_id || ''),
            name: String(
              ws.name || ws.workspace_name || ws.workspace || ws.id || '',
            ),
          }),
        );
        return NextResponse.json({ success: true, projects });
      }

      case 'fetch-stories': {
        const {
          workspaceIds,
          createdBegin,
          createdEnd,
          completedBegin,
          completedEnd,
          status,
        } = params as {
          workspaceIds: string[];
          createdBegin?: string;
          createdEnd?: string;
          completedBegin?: string;
          completedEnd?: string;
          status?: string[];
        };

        if (!workspaceIds?.length) {
          return NextResponse.json(
            { success: false, message: '未选择项目' },
            { status: 400 },
          );
        }

        const allStories: Record<string, unknown>[] = [];

        for (const wsId of workspaceIds) {
          let page = 1;
          const limit = 200;

          while (true) {
            const searchParams = new URLSearchParams({
              workspace_id: wsId,
              limit: String(limit),
              page: String(page),
              fields: [
                'id', 'name', 'description', 'status', 'priority', 'priority_label',
                'business_value', 'owner', 'cc', 'creator', 'developer',
                'created', 'modified', 'completed',
                'begin', 'due',
                'effort', 'effort_completed', 'remain', 'exceed',
                'size', 'type', 'source', 'module', 'feature', 'version',
                'workspace_id', 'iteration_id', 'category_id', 'release_id',
                'workitem_type_id', 'parent_id', 'children_id', 'ancestor_id',
                'label', 'test_focus', 'is_archived', 'level',
                'custom_field_one', 'custom_field_two', 'custom_field_three',
                'custom_field_four', 'custom_field_five',
                'custom_field_six', 'custom_field_seven', 'custom_field_eight',
                'custom_field_9', 'custom_field_10', 'custom_field_11',
                'custom_field_12', 'custom_field_13', 'custom_field_14',
                'custom_field_15', 'custom_field_16', 'custom_field_17',
                'custom_field_18', 'custom_field_19', 'custom_field_20',
                'custom_field_21', 'custom_field_22', 'custom_field_23',
                'custom_field_24', 'custom_field_25', 'custom_field_26',
                'custom_field_27', 'custom_field_28', 'custom_field_29', 'custom_field_30',
              ].join(','),
            });

            if (createdBegin && createdEnd) {
              searchParams.set('created', `${createdBegin}~${createdEnd}`);
            }
            // 注意：completed 条件不在 API 查询中传，而是在拉取后内存过滤
            // 逻辑：先按创建时间范围拉取，再在结果中按完成时间范围二次筛选
            if (status?.length) {
              // TAPD API 中文状态用 v_status 参数，英文状态用 status 参数
              const hasChinese = status.some((s) => /[\u4e00-\u9fa5]/.test(s));
              if (hasChinese) {
                searchParams.set('v_status', status.join('|'));
              } else {
                searchParams.set('status', status.join('|'));
              }
            }

            const data = await tapdGet(
              `https://api.tapd.cn/stories?${searchParams.toString()}`,
              headers,
            );
            const items = (Array.isArray(data.data) ? data.data : []) as Record<string, unknown>[];
            if (items.length === 0) break;
            // TAPD 返回格式为 [{ Story: { id, name, ... } }]，需要展平
            const flattened = items.map((item) => {
              const keys = Object.keys(item);
              if (keys.length === 1 && keys[0] !== 'id') {
                return item[keys[0]] as Record<string, unknown>;
              }
              return item;
            });
            allStories.push(...flattened);
            page++;
            if (items.length < limit) break;
          }
        }

        // 第二步：在已拉取的数据中，按完成时间范围二次筛选
        if (completedBegin && completedEnd) {
          const beginTs = new Date(completedBegin).getTime();
          const endTs = new Date(completedEnd).getTime();
          const filtered = allStories.filter((story) => {
            const completed = story['completed'];
            if (!completed) return false;
            const ts = new Date(String(completed)).getTime();
            return ts >= beginTs && ts <= endTs;
          });
          allStories.length = 0;
          allStories.push(...filtered);
        }

        // 获取项目名称，写入每条 story 的 workspace_name 字段
        const workspaceNameMap = new Map<string, string>();
        for (const wsId of workspaceIds) {
          try {
            const wsData = await tapdGet(
              `https://api.tapd.cn/workspaces/get_workspace_info?workspace_id=${wsId}`,
              headers,
            );
            const wsInfo = wsData.data as Record<string, unknown> | undefined;
            if (wsInfo) {
              // 展平 { Workspace: { id, name, ... } } 格式
              const keys = Object.keys(wsInfo);
              const wsObj = (keys.length === 1 && keys[0] !== 'id')
                ? wsInfo[keys[0]] as Record<string, unknown>
                : wsInfo;
              const wsName = String(wsObj['name'] ?? wsId);
              workspaceNameMap.set(wsId, wsName);
            }
          } catch {
            // 获取项目名称失败不影响主流程
          }
        }
        for (const story of allStories) {
          const wsId = String(story['workspace_id'] ?? '');
          story['workspace_name'] = workspaceNameMap.get(wsId) ?? wsId;
        }

        // 获取每个项目的自定义字段映射（字段中文名 → custom_field_x）
        // 用于前端动态读取成本归属、项目归属、冒烟通过等字段
        const customFieldMapping: Record<string, Record<string, string>> = {};
        for (const wsId of workspaceIds) {
          try {
            const cfData = await tapdGet(
              `https://api.tapd.cn/stories/custom_fields_settings?workspace_id=${wsId}`,
              headers,
            );
            const cfItems = Array.isArray(cfData.data) ? cfData.data : [];
            const wsMapping: Record<string, string> = {};
            for (const item of cfItems) {
              const keys = Object.keys(item);
              const cf = (keys.length === 1 ? item[keys[0]] : item) as Record<string, unknown>;
              const name = String(cf['name'] ?? '');
              const field = String(cf['custom_field'] ?? '');
              if (name && field) {
                wsMapping[name] = field;
              }
            }
            customFieldMapping[wsId] = wsMapping;
          } catch {
            // 获取自定义字段配置失败不影响主流程
          }
        }

        return NextResponse.json({
          success: true,
          stories: allStories,
          total: allStories.length,
          customFieldMapping,
        });
      }

      case 'fetch-tasks': {
        const { workspaceIds, storyIds } = params as {
          workspaceIds: string[];
          storyIds?: string[];
        };

        if (!workspaceIds?.length) {
          return NextResponse.json(
            { success: false, message: '未选择项目' },
            { status: 400 },
          );
        }

        const allTasks: Record<string, unknown>[] = [];
        const batchSize = 20; // 每批最多 20 个 story_id，避免 URL 过长（414 错误）

        for (const wsId of workspaceIds) {
          // 如果没有 storyIds，直接查询所有 tasks
          if (!storyIds?.length) {
            let page = 1;
            const limit = 200;
            while (true) {
              const searchParams = new URLSearchParams({
                workspace_id: wsId,
                limit: String(limit),
                page: String(page),
                fields: [
                  'id', 'name', 'description', 'status', 'priority', 'priority_label',
                  'owner', 'cc', 'creator',
                  'created', 'modified', 'completed',
                  'begin', 'due',
                  'effort', 'effort_completed', 'remain', 'exceed',
                  'progress', 'type',
                  'story_id', 'iteration_id', 'release_id',
                  'workspace_id',
                  'label', 'has_attachment',
                  'custom_field_one', 'custom_field_two', 'custom_field_three',
                  'custom_field_four', 'custom_field_five',
                  'custom_field_six', 'custom_field_seven', 'custom_field_eight',
                  'custom_field_9', 'custom_field_10', 'custom_field_11',
                  'custom_field_12', 'custom_field_13', 'custom_field_14',
                  'custom_field_15', 'custom_field_16', 'custom_field_17',
                  'custom_field_18', 'custom_field_19', 'custom_field_20',
                ].join(','),
              });

              const data = await tapdGet(
                `https://api.tapd.cn/tasks?${searchParams.toString()}`,
                headers,
              );
              const items = (Array.isArray(data.data) ? data.data : []) as Record<string, unknown>[];
              if (items.length === 0) break;
              const flattened = items.map((item) => {
                const keys = Object.keys(item);
                if (keys.length === 1 && keys[0] !== 'id') {
                  return item[keys[0]] as Record<string, unknown>;
                }
                return item;
              });
              allTasks.push(...flattened);
              page++;
              if (items.length < limit) break;
            }
            continue;
          }

          // 分批查询 tasks（避免 URL 过长）
          for (let i = 0; i < storyIds.length; i += batchSize) {
            const batch = storyIds.slice(i, i + batchSize);
            let page = 1;
            const limit = 200;

            while (true) {
              const searchParams = new URLSearchParams({
                workspace_id: wsId,
                limit: String(limit),
                page: String(page),
                fields: 'id,name,status,owner,creator,created,completed,effort,effort_completed,story_id,workspace_id',
              });

              // 分批传入 story_id
              searchParams.set('story_id', batch.join(','));

              const data = await tapdGet(
                `https://api.tapd.cn/tasks?${searchParams.toString()}`,
                headers,
              );
              const items = (Array.isArray(data.data) ? data.data : []) as Record<string, unknown>[];
              if (items.length === 0) break;
              const flattened = items.map((item) => {
                const keys = Object.keys(item);
                if (keys.length === 1 && keys[0] !== 'id') {
                  return item[keys[0]] as Record<string, unknown>;
                }
                return item;
              });
              allTasks.push(...flattened);
              page++;
              if (items.length < limit) break;
            }
          }
        }

        // 获取项目名称，写入每条 task 的 workspace_name 字段
        const taskWsNameMap = new Map<string, string>();
        for (const wsId of workspaceIds) {
          try {
            const wsData = await tapdGet(
              `https://api.tapd.cn/workspaces/get_workspace_info?workspace_id=${wsId}`,
              headers,
            );
            const wsInfo = wsData.data as Record<string, unknown> | undefined;
            if (wsInfo) {
              const keys = Object.keys(wsInfo);
              const wsObj = (keys.length === 1 && keys[0] !== 'id')
                ? wsInfo[keys[0]] as Record<string, unknown>
                : wsInfo;
              const wsName = String(wsObj['name'] ?? wsId);
              taskWsNameMap.set(wsId, wsName);
            }
          } catch {
            // 获取项目名称失败不影响主流程
          }
        }
        for (const task of allTasks) {
          const wsId = String(task['workspace_id'] ?? '');
          task['workspace_name'] = taskWsNameMap.get(wsId) ?? wsId;
        }

        return NextResponse.json({
          success: true,
          tasks: allTasks,
          total: allTasks.length,
        });
      }

      default:
        return NextResponse.json(
          { success: false, message: `未知操作: ${action}` },
          { status: 400 },
        );
    }

    // 对于 test-auth 等简单 GET 请求
    const data = await tapdGet(url!, headers);
    if (data.status === 1 || data.info === 'success') {
      return NextResponse.json({ success: true, data });
    }
    return NextResponse.json({
      success: false,
      message: `TAPD 返回错误: ${data.info || JSON.stringify(data)}`,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : '代理请求异常';
    return NextResponse.json(
      { success: false, message },
      { status: 500 },
    );
  }
}

/** 封装 TAPD GET 请求 */
async function tapdGet(
  url: string,
  headers: Record<string, string>,
): Promise<Record<string, unknown>> {
  const res = await fetch(url, { method: 'GET', headers });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(
      `TAPD API ${res.status}: ${text || res.statusText}`,
    );
  }

  return res.json();
}
