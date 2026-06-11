import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import type { RoleType } from '@/app/(dashboard)/agile/sprints/types/sprint.types';

const ROLES: RoleType[] = ['backend', 'frontend', 'mobile', 'test'];

/**
 * 验证字符串是否为有效的日期格式
 * 支持格式：YYYY-MM-DD, YYYY-MM-DD HH:MM:SS, YYYY/MM/DD 等
 */
function isValidDateStr(value: string): boolean {
  if (!value || typeof value !== 'string') return false;

  const trimmed = value.trim();

  // 布尔值或短文本（如"是"、"否"、"true"、"false"等）不是有效日期
  if (/^(是|否|true|false|0|1|yes|no|y|n|✓|×|√)$/i.test(trimmed)) {
    return false;
  }

  // 检查是否匹配日期模式（以数字开头，包含-或/分隔符）
  const datePattern = /^(\d{4}[-/]\d{1,2}[-/]\d{1,2})/;
  if (!datePattern.test(trimmed)) {
    return false;
  }

  // 尝试解析为Date对象
  const date = new Date(trimmed);
  return !isNaN(date.getTime()) && date.getFullYear() > 2000 && date.getFullYear() < 2100;
}

const ROLE_NAME_MAP: Record<string, RoleType | 'unmapped'> = {
  后端: 'backend',
  后台: 'backend',
  服务端: 'backend',
  前端: 'frontend',
  移动端: 'mobile',
  安卓: 'mobile',
  IOS: 'mobile',
  客户端: 'mobile',
  测试: 'test',
  QA: 'test',
  PO: 'unmapped',
  UED: 'unmapped',
  UI: 'unmapped',
  借调人员: 'unmapped',
  借调: 'unmapped',
  运维: 'unmapped',
  行政: 'unmapped',
  PM: 'unmapped',
  HR: 'unmapped',
  其他: 'unmapped',
  Other: 'unmapped',
};

function mapRoleName(name: string): RoleType | 'unmapped' {
  if (!name) return 'unmapped';
  return ROLE_NAME_MAP[name] || (ROLES.includes(name as RoleType) ? (name as RoleType) : 'unmapped');
}

/**
 * 根据成员姓名特征推断角色（用于未配置映射时的回退）
 * 规则：通过姓名中的关键词或常见命名模式推断
 */
function inferRoleFromName(name: string): RoleType | null {
  if (!name) return null;

  const nameLower = name.toLowerCase();

  // 前端相关关键词
  if (/(前端|fe|web|h5|vue|react|ui|页面|交互|小程序)/i.test(name)) return 'frontend';

  // 移动端相关关键词
  if (/(移动|mobile|ios|android|flutter|app|客户端|原生|鸿蒙)/i.test(name)) return 'mobile';

  // 测试相关关键词
  if (/(测试|test|qa|质检|验收|自动化)/i.test(name)) return 'test';

  // 后端相关关键词（默认）
  if (/(后端|backend|server|服务端|java|python|go|接口|api|数据|算法)/i.test(name)) return 'backend';

  // 无法推断
  return null;
}

async function buildMemberRoleMap(workspaceId: string): Promise<Map<string, RoleType>> {
  const map = new Map<string, RoleType>();
  if (!workspaceId) return map;
  const mappings = await prisma.tapdMemberRoleMapping.findMany({
    where: { workspaceId, isActive: true },
  });
  for (const m of mappings) {
    const role = mapRoleName(m.role);
    if (role !== 'unmapped') {
      map.set(m.memberName, role);
    }
  }
  return map;
}

/**
 * 核心计算：根据需求下的 Task 列表，按 task.owner 归类到角色，汇总各角色工时
 *
 * 规则：
 *   遍历 story 下所有 task
 *   每个 task 有 owner(处理人) + effort(预估工时/小时)
 *   按 owner 查映射表 → 角色
 *   累加到对应角色的总人天（effort 单位为小时，除以8换算为人天）
 */
interface TaskItem {
  owner: string | null | undefined;
  effort: number;
}

function computeRoleEffortFromTasks(
  tasks: TaskItem[],
  memberMap: Map<string, RoleType>,
): {
  roleEffort: Partial<Record<RoleType, number>>;
  totalTaskHours: number;
  unmappedOwners: string[];
} {
  const roleEffort: Partial<Record<RoleType, number>> = {};
  let totalTaskHours = 0;
  const unmappedOwnerSet = new Set<string>();

  for (const task of tasks) {
    if (!task.owner || !task.effort || task.effort <= 0) continue;

    const ownerNames = task.owner.split(/[;,、]/).map((s: string) => s.trim()).filter(Boolean);
    if (ownerNames.length === 0) continue;

    totalTaskHours += task.effort;
    const perPersonHours = task.effort / ownerNames.length;

    for (const name of ownerNames) {
      const role = memberMap.get(name);
      if (role) {
        roleEffort[role] = (roleEffort[role] || 0) + perPersonHours;
      } else {
        unmappedOwnerSet.add(name);
      }
    }
  }

  // 小时 → 人天 (按 8h/天)
  for (const role of ROLES) {
    if ((roleEffort[role] || 0) > 0) {
      roleEffort[role] = Math.round((roleEffort[role]! / 8) * 100) / 100;
    }
  }

  return {
    roleEffort,
    totalTaskHours,
    unmappedOwners: Array.from(unmappedOwnerSet),
  };
}

/**
 * 去除HTML标签，提取纯文本
 * 处理TAPD description字段中的HTML内容
 */
function stripHtmlTags(html: string | null | undefined): string {
  if (!html) return '';

  return html
    // 去除HTML标签
    .replace(/<[^>]*>/g, '')
    // 将多个空格替换为单个空格
    .replace(/\s+/g, ' ')
    // 去除首尾空格
    .trim()
    // 限制长度，避免过长文本
    .substring(0, 200);
}

async function callTapdSkill(
  service: string,
  action: string,
  workspaceIds: string[],
  params: Record<string, unknown> = {},
  fields?: string[],
) {
  const resp = await fetch('http://localhost:3000/api/v1/tapd/skill-proxy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ service, action, workspaceIds, params, fields }),
  });

  if (!resp.ok) throw new Error(`Skill proxy HTTP ${resp.status}`);

  const result = await resp.json();
  if (!result.success) throw new Error(result.message || 'Skill proxy 调用失败');

  const allData: any[] = [];
  for (const item of result.data || []) {
    const wsData = item.data?.data || [];
    if (Array.isArray(wsData)) allData.push(...wsData);
  }
  return allData;
}

function flattenTapdItem(item: any): any {
  const keys = Object.keys(item);
  if (keys.length === 1 && keys[0] !== 'id') return item[keys[0]];
  return item;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: iterationId } = await params;
    const searchParams = request.nextUrl.searchParams;

    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = Math.min(
      parseInt(searchParams.get('pageSize') || '200', 10),  // 🔧 修复：默认改为200，避免分页丢失需求数据
      500,  // 🔧 提高上限到500，支持大型迭代
    );
    const status = searchParams.get('status');
    const owner = searchParams.get('owner');
    const search = searchParams.get('search');
    const useRealtime = searchParams.get('realtime') === 'true';
    const workspaceId = searchParams.get('workspaceId');

    if (!iterationId) {
      return NextResponse.json(
        { success: false, message: '缺少迭代ID' },
        { status: 400 },
      );
    }

    // 强制要求workspaceId参数（必须从TAPD实时拉取）
    if (!workspaceId) {
      return NextResponse.json(
        { success: false, message: '缺少workspaceId参数，必须指定TAPD项目ID以实时拉取数据' },
        { status: 400 },
      );
    }

    let sprint: any = null;
    let stories: any[] = [];
    let total = 0;
    let dataSource = 'tapd_realtime';

    // ============================================================
    // 强制使用 TAPD 实时数据（不读取本地数据库）
    // ============================================================
    console.log(
      `[Sprint Detail API] 使用 TAPD Skill 实时数据。iterationId=${iterationId}, workspaceId=${workspaceId}`,
    );

    try {
      const iterItems = await callTapdSkill(
        'iterations',
        'list',
        [workspaceId],
        { id: iterationId, limit: 1 },
      );
      const iterations = iterItems.map(flattenTapdItem);

      if (iterations.length > 0) {
        const iterRaw = iterations[0];
        sprint = {
          id: iterRaw.id,
          name: iterRaw.name,
          projectId: '',
          projectName: workspaceId,
          startDate: iterRaw.startdate
            ? new Date(iterRaw.startdate).toISOString()
            : new Date().toISOString(),
          endDate: iterRaw.enddate
            ? new Date(iterRaw.enddate).toISOString()
            : new Date().toISOString(),
          status: iterRaw.status === 'open' ? 'ACTIVE' : 'CLOSED',
        };
        dataSource = 'tapd_skill_realtime';
      } else {
        return NextResponse.json(
          { success: false, message: `在TAPD中未找到迭代ID: ${iterationId}` },
          { status: 404 },
        );
      }

        const storiesParams: Record<string, unknown> = {
          iteration_id: iterationId,
          with_v_status: '1',
          limit: pageSize,
          page,
          order: 'created desc',
        };
        if (status) storiesParams.v_status = status;
        if (owner) storiesParams.owner = owner;
        if (search) storiesParams.name = search;

        const storyItems = await callTapdSkill(
          'stories',
          'list',
          [workspaceId],
          storiesParams,
          [
            'id', 'name', 'status', 'v_status', 'priority', 'priority_label',
            'custom_field_seven', 'owner', 'creator', 'iteration_id',
            'workspace_id', 'effort', 'effort_completed', 'remain',
            // 自定义字段
            'custom_field_one', 'custom_field_two', 'custom_field_three',
            'custom_field_four', 'custom_field_five', 'custom_field_six',
            'custom_field_seven', 'custom_field_eight', 'custom_field_nine',
            'custom_field_ten', 'custom_field_eleven', 'custom_field_twelve',
            'custom_field_thirteen', 'custom_field_fourteen', 'custom_field_fifteen',
            // 自定义字段 - 数字格式（备用）
            'custom_field_1', 'custom_field_2', 'custom_field_3',
            'custom_field_4', 'custom_field_5', 'custom_field_6',
            'custom_field_7', 'custom_field_8', 'custom_field_9',
            // 发布和日期字段（关键修复！）
            'release_id', 'release_name', 'due_date', 'created', 'completed',
            'description', 'remark'
          ],
        );
        const rawStories = storyItems.map(flattenTapdItem);

        if (rawStories.length > 0) {
          // 批量拉取所有 story 的 tasks（一次请求，用 story_ids 过滤）
          const storyIds = rawStories.map((s: any) => String(s.id));
          let allTasks: any[] = [];

          try {
            // TAPD tasks 接口支持多 story_id 查询
            const taskItems = await callTapdSkill(
              'tasks',
              'list',
              [workspaceId],
              { story_id: storyIds.join(','), limit: 500 },
            );
            allTasks = taskItems.map(flattenTapdItem);
          } catch (taskErr) {
            console.warn('[Sprint Detail] Tasks 实时获取失败:', taskErr);
          }

          // 按 story_id 分组 tasks
          const tasksByStory = new Map<string, TaskItem[]>();
          for (const t of allTasks) {
            const sid = String(t.story_id || '');
            if (!sid) continue;
            if (!tasksByStory.has(sid)) tasksByStory.set(sid, []);
            tasksByStory.get(sid)!.push({
              owner: t.owner || null,
              effort: parseFloat(String(t.effort)) || 0,
            });
          }

          // 🔥 新增：查询所有Story关联的Release对象，获取真实的发布计划名称
          const releaseIds = [...new Set(rawStories.map((s: any) => s.release_id).filter(Boolean))];
          const releaseMap = new Map<string, string>(); // release_id -> release_name
          
          if (releaseIds.length > 0) {
            try {
              console.log(`[Sprint Detail] 查询 ${releaseIds.length} 个发布计划...`);
              const releaseItems = await callTapdSkill(
                'releases',
                'list',
                [workspaceId],
                { id: releaseIds.join(','), limit: releaseIds.length },
                ['id', 'name', 'releasetime', 'status'],
              );
              
              for (const rel of releaseItems.map(flattenTapdItem)) {
                if (rel.id && rel.name) {
                  releaseMap.set(String(rel.id), String(rel.name));
                  console.log(`[Sprint Detail] Release映射: ${rel.id} -> ${rel.name}`);
                }
              }
              console.log(`[Sprint Detail] 成功加载 ${releaseMap.size} 个发布计划`);
            } catch (releaseErr) {
              console.warn('[Sprint Detail] 发布计划查询失败:', releaseErr);
            }
          }

          // 🔥 新增：查询项目级配置（优先级字段映射等）
          let projectConfig: any = null;
          try {
            projectConfig = await prisma.tapdProjectConfig.findUnique({
              where: { workspaceId: workspaceId },
            });
            if (projectConfig) {
              console.log(`[Sprint Detail] 📋 找到项目配置: workspaceId=${workspaceId}, priorityField=${projectConfig.priorityField || '未配置'}`);
            }
          } catch (configErr) {
            console.warn('[Sprint Detail] 项目配置查询失败:', configErr);
          }

          stories = rawStories.map((story: any) => ({
            id: String(story.id),
            tapdId: String(story.id),
            title: String(story.name || ''),
            status: String(story.status || ''),
            statusLabel: String(story.v_status || story.status || ''),

            // 优先级：三层解析策略（方案C - 混合策略）
            // 第1层: 项目级配置（最高优先级）→ 第2层: 自动检测缓存 → 第3层: 多字段尝试逻辑（兜底）
            // 关键修复2026-06-04：支持不同TAPD项目使用不同的优先级字段
            priority: (function() {
              // ════════════════════════════════════════
              // 第1层：项目级配置（最高优先级）
              // 如果数据库中为该项目配置了优先级字段，直接使用
              // ════════════════════════════════════════
              if (projectConfig?.priorityField) {
                const configuredField = projectConfig.priorityField;
                const fieldValue = story[configuredField];

                if (fieldValue !== undefined && fieldValue !== null && String(fieldValue).trim() !== '') {
                  const fieldStr = String(fieldValue).trim();
                  const num = Number(fieldStr);

                  // 根据配置的字段类型处理
                  if (projectConfig.priorityFieldType === 'text') {
                    // 文字格式：映射为数字
                    if (/高|urgent|very_high/i.test(fieldStr)) return 4;
                    if (fieldStr === '中' || /high/i.test(fieldStr)) return 3;
                    if (/低|low/i.test(fieldStr)) return 2;
                    if (/普通|medium/i.test(fieldStr)) return 1;
                    // P1、P2等格式
                    const pMatch = fieldStr.match(/^p(\d)$/i);
                    if (pMatch) return Math.min(5 - parseInt(pMatch[1]), 4);
                  } else {
                    // 数字格式（默认）：直接返回数值
                    if (!isNaN(num) && num >= 0) return num;
                  }

                  console.log(`[Sprint Detail] ✅ 使用项目配置字段 ${configuredField}: "${fieldStr}"`);
                } else {
                  console.log(`[Sprint Detail] ⚠️ 项目配置字段 ${configuredField} 为空`);
                }

                // 如果配置了但值为空，返回null而不是继续尝试其他字段
                return null;
              }

              // ════════════════════════════════════════
              // 第2层：自动检测缓存（如果有高置信度的检测结果）
              // TODO: 后续可以实现自动检测结果的缓存机制
              // ════════════════════════════════════════

              // ════════════════════════════════════════
              // 第3层：多字段尝试逻辑（兜底 - 兼容未配置的项目）
              // 按照常见程度和可靠性排序尝试各个可能的字段
              // ════════════════════════════════════════

              // 尝试A：custom_field_four（数字格式 - 小课新链路等项目）
              const cf4 = story.custom_field_four;
              if (cf4 !== undefined && cf4 !== null && String(cf4).trim() !== '') {
                const cf4Str = String(cf4).trim();
                const num = Number(cf4Str);
                if (!isNaN(num) && num >= 0) return num;
              }

              // 尝试1：custom_field_seven（文字格式，最常用）
              const cf7 = story.custom_field_seven;
              if (cf7 !== undefined && cf7 !== null && String(cf7).trim() !== '') {
                const cf7Str = String(cf7).trim();
                const num = Number(cf7Str);
                if (!isNaN(num) && num >= 0) return num;
                // 尝试解析中文数字（如"高"、"中"、"低"）
                if (['高', 'urgent', 'very_high'].includes(cf7Str.toLowerCase())) return 4;
                if (cf7Str === '中' || cf7Str === 'high') return 3;
                if (cf7Str === '低' || cf7Str === 'low') return 2;
                if (cf7Str === '普通' || cf7Str === 'medium') return 1;
                // 支持P1、P2等格式
                const pMatch = cf7Str.match(/^p(\d)$/i);
                if (pMatch) return Math.min(5 - parseInt(pMatch[1]), 4);
              }

              // 尝试2：custom_field_7（数字格式）
              const cf7Num = story.custom_field_7;
              if (cf7Num !== undefined && cf7Num !== null && String(cf7Num).trim() !== '') {
                const num = Number(cf7Num);
                if (!isNaN(num) && num >= 0) return num;
              }

              // 尝试3：系统priority字段（数字格式）
              const sysPriority = story.priority;
              if (sysPriority !== undefined && sysPriority !== null && String(sysPriority).trim() !== '') {
                const priorityStr = String(sysPriority).trim();
                const num = Number(priorityStr);
                if (!isNaN(num) && num > 0) return num;

                // 处理文字格式的priority字段
                if (priorityStr.includes('高') || /urgent|very_high/i.test(priorityStr)) return 4;
                if (priorityStr === '中' || /high/i.test(priorityStr)) return 3;
                if (priorityStr.includes('低') || /low/i.test(priorityStr)) return 2;
              }

              // 尝试4：priority_label（文字标签格式）
              const priorityLabel = story.priority_label;
              if (priorityLabel && String(priorityLabel).trim()) {
                const labelStr = String(priorityLabel).toLowerCase().trim();
                if (labelStr.includes('高') || /urgent|very_high/i.test(labelStr)) return 4;
                if (labelStr === '中' || /high/i.test(labelStr)) return 3;
                if (labelStr.includes('低') || /low/i.test(labelStr)) return 2;
                if (labelStr === '普通' || /medium/i.test(labelStr)) return 1;
              }

              // 尝试5：Type字段
              if (story.type !== undefined && story.type !== null && String(story.type).trim()) {
                const typeStr = String(story.type).toLowerCase().trim();
                if (/p0|紧急|urgent/i.test(typeStr)) return 4;
                if (/p1|重要|high/i.test(typeStr)) return 3;
                if (/p2|一般|normal/i.test(typeStr)) return 2;
                if (/p3|低|low/i.test(typeStr)) return 1;
              }

              // 尝试6：custom_field_one（部分项目用于存储优先级）
              const cf1 = story.custom_field_one;
              if (cf1 !== undefined && cf1 !== null && String(cf1).trim()) {
                const cf1Str = String(cf1).trim();
                const num = Number(cf1Str);
                if (!isNaN(num) && num >= 0 && num <= 14) return num;
                if (/高|urgent/i.test(cf1Str)) return 4;
                if (/中|high/i.test(cf1Str)) return 3;
                if (/低|low/i.test(cf1Str)) return 2;
              }

              // 尝试7：importance字段
              if (story.importance !== undefined && story.importance !== null && String(story.importance).trim()) {
                const impStr = String(story.importance).toLowerCase().trim();
                if (/high|重要|紧急/i.test(impStr)) return 3;
                if (/medium|一般/i.test(impStr)) return 2;
                if (/low|低/i.test(impStr)) return 1;
              }

              // 尝试8：扫描所有自定义字段，查找包含优先级关键词的值
              for (let i = 1; i <= 20; i++) {
                const fieldName = `custom_field_${i}`;
                const fieldWordName = ['one', 'two', 'three', 'four', 'five', 'six',
                                      'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve',
                                      'thirteen', 'fourteen', 'fifteen', 'sixteen',
                                      'seventeen', 'eighteen', 'nineteen', 'twenty'][i-1];
                const altFieldName = `custom_field_${fieldWordName}`;

                // 检查数字格式字段名
                let val = story[fieldName];
                if (!val) val = story[altFieldName];

                if (val !== undefined && val !== null && String(val).trim()) {
                  const valStr = String(val).trim();
                  const num = Number(valStr);

                  // 如果是0-14之间的数字，可能是优先级
                  if (!isNaN(num) && num >= 0 && num <= 14 && num > 0) {
                    console.log(`[Sprint Detail] 🎯 从 ${fieldName || altFieldName} 发现可能的优先级值: ${num}`);
                    return num;
                  }
                }
              }

              // 最终回退：如果所有方法都失败，返回null表示未设置优先级
              // （而不是返回0或undefined，这样前端可以明确显示"未设置"）
              console.log(
                `[Sprint Detail] ℹ️ 需求 ${story.id} "${(story.name || '').substring(0, 40)}" 未设置优先级`,
                `(该项目可能未配置优先级字段)`,
              );
              return null;  // ← 关键改进：返回null而非undefined/0
            })(),

            owner: story.owner || '',
            creator: story.creator || '',
            iterationId: String(story.iteration_id || iterationId),
            workspaceId: workspaceId || '',

            // 产品：显示创建人（已验证正确）
            product: story.creator || '',

            // 提测时间：增强版 - 支持多个自定义字段，带日期格式验证
            // 优先级：custom_field_two > due_date > custom_field_ten > completed > created
            // 关键修复：添加日期格式验证，避免显示"是"、"否"等布尔值
            testDate: (function() {
              // 尝试1：custom_field_two（最常用）
              const cf2 = story.custom_field_two;
              if (cf2 && String(cf2).trim() && isValidDateStr(String(cf2))) {
                return String(cf2).trim();
              }

              // 尝试2：due_date（系统截止日期）
              const dueDate = story.due_date;
              if (dueDate && String(dueDate).trim() && isValidDateStr(String(dueDate))) {
                return String(dueDate).trim();
              }

              // 尝试3：custom_field_ten（部分项目使用）
              const cf10 = story.custom_field_ten;
              if (cf10 && String(cf10).trim() && isValidDateStr(String(cf10))) {
                return String(cf10).trim();
              }

              // 尝试4：completed（完成时间）
              const completed = story.completed;
              if (completed && String(completed).trim() && isValidDateStr(String(completed))) {
                return String(completed).trim();
              }

              // 尝试5：created（创建时间，最后备选）
              const created = story.created;
              if (created && String(created).trim() && isValidDateStr(String(created))) {
                return String(created).trim();
              }

              // 尝试6：begin（开始时间）
              const begin = story.begin;
              if (begin && String(begin).trim() && isValidDateStr(String(begin))) {
                return String(begin).trim();
              }

              return '';
            })(),

            // 发布计划：通过release_id查询Release对象获取真实名称（如"2026-06-30"）
            releasePlan: (story.release_id && releaseMap.has(String(story.release_id)))
              ? releaseMap.get(String(story.release_id))!
              : '',

            _rawEffort: parseFloat(String(story.effort)) || 0,
            effortCompleted: parseFloat(String(story.effort_completed)) || 0,
            remain: parseFloat(String(story.remain)) || 0,
            _tasks: tasksByStory.get(String(story.id)) || [],
          }));
          total = stories.length;
        }
      } catch (err) {
        console.error('[Sprint Detail] TAPD 实时获取失败:', err);
        return NextResponse.json(
          {
            success: false,
            message: `从TAPD实时拉取数据失败: ${err instanceof Error ? err.message : '未知错误'}`,
            error: err instanceof Error ? err.message : String(err),
          },
          { status: 500 },
        );
      }

    // ============================================================
    // 统一处理：基于 Task 计算 role effort（增强版）
    // ============================================================
    // 从 stories 中提取真实的 workspaceId
    const realWorkspaceId = workspaceId || (stories.length > 0 ? stories[0].workspaceId : '') || '';
    const memberRoleMap = await buildMemberRoleMap(realWorkspaceId);

    console.log(
      `[Sprint Detail] 角色映射: workspaceId=${realWorkspaceId}, 映射数=${memberRoleMap.size}`,
    );

    // 如果角色映射为空，输出警告日志
    if (memberRoleMap.size === 0) {
      console.warn(
        `[Sprint Detail] ⚠️ 警告: 项目 ${realWorkspaceId} 未配置成员角色映射！`,
        `工时将无法按角色分配。请前往「角色配置」页面配置成员角色。`,
      );
    }

    const decorateWithTaskEffort = (story: any) => {
      const tasks: TaskItem[] = story._tasks || [];
      const { roleEffort, totalTaskHours, unmappedOwners } =
        computeRoleEffortFromTasks(tasks, memberRoleMap);

      // 增强版回退逻辑：如果该需求没有任何 task
      if (totalTaskHours <= 0 && (story._rawEffort || 0) > 0) {
        const ownerNames = (story.owner || '')
          .split(/[;,、]/)
          .map((s: string) => s.trim())
          .filter(Boolean);

        if (ownerNames.length > 0) {
          const perPersonDays = (story._rawEffort / 8) / ownerNames.length;

          for (const name of ownerNames) {
            const role = memberRoleMap.get(name);
            if (role) {
              roleEffort[role] = (roleEffort[role] || 0) + Math.round(perPersonDays * 100) / 100;
            } else {
              unmappedOwners.push(name);
              // 🔥 新增：如果未找到角色映射，尝试根据姓名特征推断角色
              const inferredRole = inferRoleFromName(name);
              if (inferredRole) {
                console.log(
                  `[Sprint Detail] 🤖 自动推断角色: ${name} -> ${inferredRole}`,
                  `(建议在角色配置页面确认此映射)`,
                );
                roleEffort[inferredRole] = (roleEffort[inferredRole] || 0) + Math.round(perPersonDays * 100) / 100;
              }
            }
          }
        } else {
          // 🔥 新增：如果没有owner信息，均匀分配到所有核心角色
          console.log(
            `[Sprint Detail] ⚠️ Story ${story.id} "${story.title}" 无owner信息`,
            `工时 ${story._rawEffort}h 将均分到4个角色`,
          );
          const perRoleDays = (story._rawEffort / 8) / ROLES.length;
          for (const role of ROLES) {
            roleEffort[role] = (roleEffort[role] || 0) + Math.round(perRoleDays * 100) / 100;
          }
        }
      }

      story.effort = roleEffort;
      story.totalEffort = totalTaskHours > 0 ? Math.round(totalTaskHours * 100) / 100 : story._rawEffort || 0;
      story.taskCount = tasks.length;
      story.unmappedOwners = [...new Set(unmappedOwners)];

      delete story._rawEffort;
      delete story._tasks;
      return story;
    };

    stories = stories.map(decorateWithTaskEffort);

    const members = sprint.projectId
      ? await prisma.member.findMany({
          where: { teamId: sprint.projectId, status: 'ACTIVE' },
          orderBy: { name: 'asc' },
        })
      : [];

    const stats = stories.reduce(
      (acc, s) => {
        acc.totalEffort += s.totalEffort || 0;
        acc.totalCompleted += s.effortCompleted || 0;
        acc.totalRemain += s.remain || 0;
        acc.statusBreakdown[s.statusLabel] =
          (acc.statusBreakdown[s.statusLabel] || 0) + 1;
        acc.taskCount += s.taskCount || 0;

        const roleEff = s.effort || {};
        acc.roleEffort.backend = (acc.roleEffort.backend || 0) + (roleEff.backend || 0);
        acc.roleEffort.frontend = (acc.roleEffort.frontend || 0) + (roleEff.frontend || 0);
        acc.roleEffort.mobile = (acc.roleEffort.mobile || 0) + (roleEff.mobile || 0);
        acc.roleEffort.test = (acc.roleEffort.test || 0) + (roleEff.test || 0);
        if (s.unmappedOwners && s.unmappedOwners.length > 0) {
          acc.unmappedOwnerCount += s.unmappedOwners.length;
        }
        return acc;
      },
      {
        totalEffort: 0,
        totalCompleted: 0,
        totalRemain: 0,
        taskCount: 0,
        statusBreakdown: {} as Record<string, number>,
        roleEffort: { backend: 0, frontend: 0, mobile: 0, test: 0 },
        unmappedOwnerCount: 0,
      },
    );

    return NextResponse.json({
      success: true,
      data: {
        sprint: {
          id: sprint.id,
          name: sprint.name,
          projectId: sprint.projectId,
          projectName:
            sprint.project?.name ||
            (dataSource.includes('tapd') ? 'TAPD实时数据' : ''),
          startDate: (sprint.startDate instanceof Date
            ? sprint.startDate
            : new Date(sprint.startDate)
          ).toISOString(),
          endDate: (sprint.endDate instanceof Date
            ? sprint.endDate
            : new Date(sprint.endDate)
          ).toISOString(),
          status: sprint.status,
        },
        stories,
        members: members.map((m) => ({
          id: m.id,
          name: m.name,
          role: m.role || 'backend',
          teamName: m.teamName || '',
        })),
        total,
        page,
        pageSize,
        source: dataSource,
        fetchedAt: new Date().toISOString(),
        stats,
      },
    });
  } catch (error) {
    console.error('Error fetching sprint details:', error);
    return NextResponse.json(
      {
        success: false,
        message: '获取迭代详情失败',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
