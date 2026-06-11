/**
 * TAPD 数据处理公共工具库
 *
 * 统一封装所有TAPD相关的数据处理逻辑，避免代码重复
 * 包含：API调用、数据转换、字段解析、角色映射等功能
 *
 * @module tapd-data-utils
 * @author Efficiency Platform Team
 * @version 3.0.0 (2026-06-03 重构)
 */

// ============================================================
// 类型定义
// ============================================================

/** TAPD 原始数据项（从API返回的嵌套结构） */
export interface TapdRawItem {
  [key: string]: any;
}

/** 扁平化后的TAPD数据项 */
export interface TapdFlatItem {
  [key: string]: any;
}

/** TAPD Skill Proxy 调用参数 */
export interface TapdSkillParams {
  service: string;
  action: string;
  workspaceIds: string[];
  params?: Record<string, unknown>;
  fields?: string[];
}

/** TAPD Skill Proxy 返回结果 */
export interface TapdSkillResult {
  success: boolean;
  data: Array<{
    workspaceId: string;
    data: {
      status: number;
      data: TapdRawItem[];
      info?: string;
    };
  }>;
  message?: string;
}

/** 需求优先级解析结果 */
export type PriorityValue = number | undefined;

/** 提测时间解析结果 */
export type TestDateValue = string;

/** 角色类型 */
export type RoleType = 'backend' | 'frontend' | 'mobile' | 'test';

/** Task项（用于工时计算） */
export interface TaskItem {
  owner: string | null | undefined;
  effort: number;
}

/** 角色工时计算结果 */
export interface RoleEffortResult {
  roleEffort: Partial<Record<RoleType, number>>;
  totalTaskHours: number;
  unmappedOwners: string[];
}

// ============================================================
// 1. TAPD API 调用工具
// ============================================================

/**
 * 调用项目内置的 TAPD Skill Proxy
 * 自动使用系统配置的 TAPD 凭据（Basic Auth）
 *
 * @param params - 调用参数
 * @returns 扁平化的数据数组
 * @throws {Error} 当HTTP请求失败或返回错误时
 */
export async function callTapdSkill(params: TapdSkillParams): Promise<any[]> {
  const { service, action, workspaceIds, params: queryParams = {}, fields } = params;

  const resp = await fetch('http://localhost:3000/api/v1/tapd/skill-proxy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ service, action, workspaceIds, params: queryParams, fields }),
  });

  if (!resp.ok) {
    throw new Error(`Skill proxy HTTP ${resp.status}`);
  }

  const result: TapdSkillResult = await resp.json();
  if (!result.success) {
    throw new Error(result.message || 'Skill proxy 调用失败');
  }

  // 合并所有workspace的数据
  const allData: any[] = [];
  for (const item of result.data || []) {
    const wsData = item.data?.data || [];
    if (Array.isArray(wsData)) allData.push(...wsData);
  }

  return allData;
}

/**
 * 扁平化TAPD数据项
 * TAPD API返回的数据通常是嵌套结构：{ Story: { id: ..., name: ... } }
 * 此函数将其扁平化为：{ id: ..., name: ... }
 *
 * @param item - TAPD原始数据项
 * @returns 扁平化后的数据项
 */
export function flattenTapdItem(item: TapdRawItem): TapdFlatItem {
  const keys = Object.keys(item);

  // 如果只有一个key且不是'id'，则提取其值
  if (keys.length === 1 && keys[0] !== 'id') {
    return item[keys[0]];
  }

  return item;
}

// ============================================================
// 2. 字段验证工具
// ============================================================

/**
 * 验证字符串是否为有效的日期格式
 *
 * 支持格式：
 * - YYYY-MM-DD (如 "2026-06-04")
 * - YYYY-MM-DD HH:MM:SS (如 "2026-06-04 10:30:00")
 * - YYYY/MM/DD (如 "2026/6/4")
 *
 * 排除的无效值：
 * - 布尔值："是"、"否"、true、false、0、1、yes、no
 * - 短文本：✓、×、√
 * - 非日期字符串
 *
 * @param value - 待验证的字符串
 * @returns 是否为有效日期
 */
export function isValidDateStr(value: string): boolean {
  if (!value || typeof value !== 'string') return false;

  const trimmed = value.trim();

  // 排除布尔值或短文本
  if (/^(是|否|true|false|0|1|yes|no|y|n|✓|×|√)$/i.test(trimmed)) {
    return false;
  }

  // 检查日期模式（以4位数字开头，包含-或/分隔符）
  const datePattern = /^(\d{4}[-/]\d{1,2}[-/]\d{1,2})/;
  if (!datePattern.test(trimmed)) {
    return false;
  }

  // 尝试解析为Date对象并验证合理性
  const date = new Date(trimmed);
  return (
    !isNaN(date.getTime()) &&
    date.getFullYear() > 2000 &&
    date.getFullYear() < 2100
  );
}

// ============================================================
// 3. 优先级解析工具（超级增强版）
// ============================================================

/**
 * 解析TAPD需求的优先级字段
 *
 * 支持多种字段和格式（按优先级排序）：
 * 1. custom_field_seven (文字/数字)
 * 2. custom_field_7 (数字)
 * 3. priority (系统字段，支持文字/数字)
 * 4. priority_label (文字标签)
 * 5. type (类型字段，P0-P3格式)
 * 6. custom_field_one (部分项目的优先级字段)
 * 7. importance (重要性字段)
 * 8. 全自定义字段扫描 (兜底策略)
 *
 * @param story - TAPD需求原始数据
 * @returns 优先级数值(1-4)，如果无法解析则返回undefined
 */
export function parsePriority(story: any): PriorityValue {
  // 尝试1：custom_field_seven（文字格式，最常用）
  const cf7 = story.custom_field_seven;
  if (cf7 !== undefined && cf7 !== null && String(cf7).trim() !== '') {
    const cf7Str = String(cf7).trim();
    const num = Number(cf7Str);

    if (!isNaN(num) && num >= 0) return num;

    // 解析中文优先级
    const textPriority = parseTextPriority(cf7Str);
    if (textPriority !== undefined) return textPriority;

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

  // 尝试3：系统priority字段（支持文字和数字）
  const sysPriority = story.priority;
  if (sysPriority !== undefined && sysPriority !== null && String(sysPriority).trim() !== '') {
    const priorityStr = String(sysPriority).trim();
    const num = Number(priorityStr);

    if (!isNaN(num) && num > 0) return num;

    // 处理文字格式
    const textPriority = parseTextPriority(priorityStr);
    if (textPriority !== undefined) return textPriority;
  }

  // 尝试4：priority_label（文字标签格式）
  const priorityLabel = story.priority_label;
  if (priorityLabel && String(priorityLabel).trim()) {
    const textPriority = parseTextPriority(String(priorityLabel).trim());
    if (textPriority !== undefined) return textPriority;
  }

  // 尝试5：Type字段
  if (story.type !== undefined && story.type !== null && String(story.type).trim()) {
    const textPriority = parseTypePriority(String(story.type).trim());
    if (textPriority !== undefined) return textPriority;
  }

  // 尝试6：custom_field_one（部分项目用于存储优先级）
  const cf1 = story.custom_field_one;
  if (cf1 !== undefined && cf1 !== null && String(cf1).trim()) {
    const textPriority = parseTextPriority(String(cf1).trim());
    if (textPriority !== undefined) return textPriority;

    const num = Number(String(cf1).trim());
    if (!isNaN(num) && num >= 0 && num <= 14) return num;
  }

  // 尝试7：importance字段
  if (story.importance !== undefined && story.importance !== null && String(story.importance).trim()) {
    const textPriority = parseImportancePriority(String(story.importance).trim());
    if (textPriority !== undefined) return textPriority;
  }

  // 尝试8：扫描所有自定义字段（兜底策略）
  const scannedPriority = scanAllCustomFieldsForPriority(story);
  if (scannedPriority !== undefined) return scannedPriority;

  // 最终回退：记录详细日志并返回undefined
  console.log(
    `[parsePriority] ⚠️ 需求 ${story.id} "${story.name}" 优先级解析失败`,
    `\n可用字段:`,
    `\n  custom_field_seven: "${story.custom_field_seven}"`,
    `\n  custom_field_7: "${story.custom_field_7}"`,
    `\n  priority: "${story.priority}"`,
    `\n  priority_label: "${story.priority_label}"`,
    `\n  type: "${story.type}"`,
    `\n  importance: "${story.importance}"`,
  );

  return undefined;
}

/**
 * 解析文本格式的优先级
 * @private
 */
function parseTextPriority(text: string): PriorityValue | undefined {
  const lower = text.toLowerCase();

  if (/高|urgent|very_high/i.test(lower)) return 4;
  if (text === '中' || /high/i.test(lower)) return 3;
  if (/低|low/i.test(lower)) return 2;
  if (text === '普通' || /medium/i.test(lower)) return 1;

  return undefined;
}

/**
 * 解析Type字段的优先级（P0/P1/P2/P3格式）
 * @private
 */
function parseTypePriority(typeStr: string): PriorityValue | undefined {
  const lower = typeStr.toLowerCase();

  if (/p0|紧急|urgent/i.test(lower)) return 4;
  if (/p1|重要|high/i.test(lower)) return 3;
  if (/p2|一般|normal/i.test(lower)) return 2;
  if (/p3|低|low/i.test(lower)) return 1;

  return undefined;
}

/**
 * 解析Importance字段的优先级
 * @private
 */
function parseImportancePriority(impStr: string): PriorityValue | undefined {
  const lower = impStr.toLowerCase();

  if (/high|重要|紧急/i.test(lower)) return 3;
  if (/medium|一般/i.test(lower)) return 2;
  if (/low|低/i.test(lower)) return 1;

  return undefined;
}

/**
 * 扫描所有自定义字段查找可能的优先级值（兜底策略）
 * @private
 */
function scanAllCustomFieldsForPriority(story: any): PriorityValue | undefined {
  const fieldWords = [
    'one', 'two', 'three', 'four', 'five', 'six',
    'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve',
    'thirteen', 'fourteen', 'fifteen', 'sixteen',
    'seventeen', 'eighteen', 'nineteen', 'twenty'
  ];

  for (let i = 1; i <= 20; i++) {
    const fieldName = `custom_field_${i}`;
    const altFieldName = `custom_field_${fieldWords[i - 1]}`;

    let val = story[fieldName];
    if (!val) val = story[altFieldName];

    if (val !== undefined && val !== null && String(val).trim()) {
      const valStr = String(val).trim();
      const num = Number(valStr);

      // 如果是1-14之间的数字，可能是TAPD标准优先级
      if (!isNaN(num) && num > 0 && num <= 14) {
        console.log(
          `[parsePriority] 🎯 从 ${fieldName || altFieldName} 发现可能的优先级值: ${num}`,
        );
        return num;
      }
    }
  }

  return undefined;
}

// ============================================================
// 4. 提测时间解析工具（带验证）
// ============================================================

/**
 * 解析TAPD需求的提测时间字段
 *
 * 使用多层备选策略，每个字段都经过严格的日期格式验证，
 * 避免显示"是"、"否"等布尔值或非日期数据。
 *
 * 字段优先级：
 * 1. custom_field_two（最常用）
 * 2. due_date（系统截止日期）
 * 3. custom_field_ten（部分项目使用）
 * 4. completed（完成时间）
 * 5. created（创建时间）
 * 6. begin（开始时间）
 *
 * @param story - TAPD需求原始数据
 * @returns 有效日期字符串，如果没有有效日期则返回空字符串
 */
export function parseTestDate(story: any): TestDateValue {
  // 备选字段列表（按优先级排序）
  const dateFields: Array<{ key: string; getValue: () => string }> = [
    {
      key: 'custom_field_two',
      getValue: () => story.custom_field_two,
    },
    {
      key: 'due_date',
      getValue: () => story.due_date,
    },
    {
      key: 'custom_field_ten',
      getValue: () => story.custom_field_ten,
    },
    {
      key: 'completed',
      getValue: () => story.completed,
    },
    {
      key: 'created',
      getValue: () => story.created,
    },
    {
      key: 'begin',
      getValue: () => story.begin,
    },
  ];

  for (const field of dateFields) {
    const value = field.getValue();
    if (value && String(value).trim() && isValidDateStr(String(value))) {
      return String(value).trim();
    }
  }

  // 所有字段都无效，返回空字符串
  return '';
}

// ============================================================
// 5. 角色映射工具
// ============================================================

/** 角色名称到RoleType的映射表 */
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

/** 核心角色列表（用于工时统计） */
export const CORE_ROLES: RoleType[] = ['backend', 'frontend', 'mobile', 'test'];

/**
 * 将角色名称映射为RoleType
 *
 * @param name - 角色名称（中文或英文）
 * @returns 映射后的RoleType，如果未找到则返回'unmapped'
 */
export function mapRoleName(name: string): RoleType | 'unmapped' {
  if (!name) return 'unmapped';
  return ROLE_NAME_MAP[name] || (CORE_ROLES.includes(name as RoleType) ? (name as RoleType) : 'unmapped');
}

/**
 * 根据成员姓名特征推断角色（用于未配置映射时的智能回退）
 *
 * 通过分析姓名中的关键词自动推断角色归属：
 * - 前端关键词：前端、fe、web、h5、vue、react、ui、页面、交互、小程序
 * - 移动端关键词：移动、mobile、ios、android、flutter、app、客户端、原生、鸿蒙
 * - 测试关键词：测试、test、qa、质检、验收、自动化
 * - 后端关键词：后端、backend、server、服务端、java、python、go、接口、api、数据、算法
 *
 * @param name - 成员姓名
 * @returns 推断的角色类型，如果无法推断则返回null
 */
export function inferRoleFromName(name: string): RoleType | null {
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

// ============================================================
// 6. 工时计算工具
// ============================================================

/**
 * 根据Task列表计算各角色的工时分配
 *
 * 规则：
 *   遍历story下所有task
 *   每个task有owner(处理人) + effort(预估工时/小时)
 *   按owner查映射表 → 角色
 *   累加到对应角色的总人天（effort单位为小时，除以8换算为人天）
 *
 * @param tasks - Task列表
 * @param memberMap - 成员→角色的映射表
 * @returns 角色工时分配结果
 */
export function computeRoleEffortFromTasks(
  tasks: TaskItem[],
  memberMap: Map<string, RoleType>,
): RoleEffortResult {
  const roleEffort: Partial<Record<RoleType, number>> = {};
  let totalTaskHours = 0;
  const unmappedOwnerSet = new Set<string>();

  for (const task of tasks) {
    if (!task.owner || !task.effort || task.effort <= 0) continue;

    // 支持多人任务（用分号、逗号、顿号分隔）
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
  for (const role of CORE_ROLES) {
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
 * 增强版工时计算：包含智能回退逻辑
 *
 * 如果该需求没有任何task，则回退为按story.owner均分story._rawEffort
 * 如果未找到角色映射，尝试自动推断
 * 如果没有owner信息，均匀分配到所有核心角色
 *
 * @param story - 需求数据（包含_tasks和_rawEffort字段）
 * @param memberMap - 成员→角色的映射表
 * @returns 装饰后的需求数据（包含effort、totalEffort等字段）
 */
export function decorateStoryWithEffort(
  story: any,
  memberMap: Map<string, RoleType>,
): any {
  const tasks: TaskItem[] = story._tasks || [];
  const { roleEffort, totalTaskHours, unmappedOwners } =
    computeRoleEffortFromTasks(tasks, memberMap);

  // 增强版回退逻辑：如果该需求没有任何task
  if (totalTaskHours <= 0 && (story._rawEffort || 0) > 0) {
    const ownerNames = (story.owner || '')
      .split(/[;,、]/)
      .map((s: string) => s.trim())
      .filter(Boolean);

    if (ownerNames.length > 0) {
      const perPersonDays = (story._rawEffort / 8) / ownerNames.length;

      for (const name of ownerNames) {
        const role = memberMap.get(name);
        if (role) {
          roleEffort[role] = (roleEffort[role] || 0) + Math.round(perPersonDays * 100) / 100;
        } else {
          unmappedOwners.push(name);

          // 尝试根据姓名特征自动推断角色
          const inferredRole = inferRoleFromName(name);
          if (inferredRole) {
            console.log(
              `[decorateStoryWithEffort] 🤖 自动推断角色: ${name} -> ${inferredRole}`,
              `(建议在角色配置页面确认此映射)`,
            );
            roleEffort[inferredRole] = (roleEffort[inferredRole] || 0) + Math.round(perPersonDays * 100) / 100;
          }
        }
      }
    } else {
      // 如果没有owner信息，均匀分配到所有核心角色
      console.log(
        `[decorateStoryWithEffort] ⚠️ Story ${story.id} "${story.name}" 无owner信息`,
        `工时 ${story._rawEffort}h 将均分到${CORE_ROLES.length}个角色`,
      );
      const perRoleDays = (story._rawEffort / 8) / CORE_ROLES.length;
      for (const role of CORE_ROLES) {
        roleEffort[role] = (roleEffort[role] || 0) + Math.round(perRoleDays * 100) / 100;
      }
    }
  }

  // 构建最终结果
  story.effort = roleEffort;
  story.totalEffort = totalTaskHours > 0 ? Math.round(totalTaskHours * 100) / 100 : story._rawEffort || 0;
  story.taskCount = tasks.length;
  story.unmappedOwners = [...new Set(unmappedOwners)];

  // 清理临时字段
  delete story._rawEffort;
  delete story._tasks;

  return story;
}

// ============================================================
// 7. 需求数据转换工具
// ============================================================

/** 转换后的标准SprintStory格式 */
export interface SprintStory {
  id: string;
  tapdId: string;
  title: string;
  status: string;
  statusLabel: string;
  priority: PriorityValue;
  owner: string;
  creator: string;
  iterationId: string;
  workspaceId: string;
  product: string;
  testDate: TestDateValue;
  releasePlan: string;
  effort: Partial<Record<RoleType, number>>;
  totalEffort: number;
  taskCount: number;
  unmappedOwners: string[];
}

/**
 * 将TAPD原始需求数据转换为标准SprintStory格式
 *
 * 统一使用parsePriority()和parseTestDate()进行字段解析
 * 确保所有API返回的数据格式一致
 *
 * @param story - TAPD原始需求数据
 * @param iterationId - 当前迭代ID（用于fallback）
 * @param releaseMap - 发布计划ID→名称的映射
 * @returns 标准化的SprintStory对象
 */
export function convertToSprintStory(
  story: any,
  iterationId: string,
  releaseMap?: Map<string, string>,
): SprintStory {
  return {
    id: String(story.id),
    tapdId: String(story.id),
    title: String(story.name || ''),
    status: String(story.status || ''),
    statusLabel: String(story.v_status || story.status || ''),

    // 使用统一的优先级解析方法
    priority: parsePriority(story),

    owner: story.owner || '',
    creator: story.creator || '',
    iterationId: String(story.iteration_id || iterationId),

    // 产品：显示创建人
    product: story.creator || '',

    // 使用统一的提测时间解析方法（带验证）
    testDate: parseTestDate(story),

    // 发布计划：通过release_id查询Release对象获取真实名称
    releasePlan: (story.release_id && releaseMap?.has(String(story.release_id)))
      ? releaseMap.get(String(story.release_id))!
      : '',

    // 原始工时数据（后续由decorateStoryWithEffort处理）
    _rawEffort: parseFloat(String(story.effort)) || 0,
    effortCompleted: parseFloat(String(story.effort_completed)) || 0,
    remain: parseFloat(String(story.remain)) || 0,

    // Task数据（后续由decorateStoryWithEffort处理）
    _tasks: [],  // 需要外部填充
  } as any;  // 类型断言，因为包含临时字段
}

// ============================================================
// 导出汇总
// ============================================================

export default {
  // API调用
  callTapdSkill,
  flattenTapdItem,

  // 字段验证
  isValidDateStr,

  // 字段解析
  parsePriority,
  parseTestDate,

  // 角色映射
  mapRoleName,
  inferRoleFromName,
  CORE_ROLES,

  // 工时计算
  computeRoleEffortFromTasks,
  decorateStoryWithEffort,

  // 数据转换
  convertToSprintStory,
};
