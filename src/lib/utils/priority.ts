/**
 * TAPD 优先级解析和标准化工具
 * 
 * 支持多种输入格式：
 * - 数字字符串: "1", "2", "3", "4", "5"...
 * - 中文字符串: "紧急", "高", "中", "低"
 * - 英文字符串: "urgent", "high", "medium", "low"
 * - TAPD 格式: "P0", "P1", "P2"...
 */

export type StandardPriority = 1 | 2 | 3 | 4;

export const PRIORITY_LABELS: Record<StandardPriority, string> = {
  1: '紧急',
  2: '高',
  3: '中',
  4: '低',
};

const PRIORITY_MAP: Record<string, StandardPriority> = {
  // 标准数字
  '1': 1, '2': 2, '3': 3, '4': 4,
  
  // 中文
  '紧急': 1, '最高': 1, '非常紧急': 1,
  '高': 2, '较高': 2,
  '中': 3, '普通': 3, '一般': 3,
  '低': 4, '较低': 4,
  
  // 英文
  'urgent': 1, 'very_high': 1, 'critical': 1,
  'high': 2,
  'medium': 3, 'normal': 3,
  'low': 4,
  
  // TAPD P级别 (P0=最高优先级)
  'p0': 1, 'p1': 1,
  'p2': 2,
  'p3': 3,
  'p4': 4, 'p5': 4,
};

/**
 * 解析并标准化优先级值
 * @param rawValue 原始优先级值（可能是数字、字符串等）
 * @param fallback 默认值（默认为3-中）
 * @returns 标准化的优先级值 (1-4)
 */
export function parsePriority(rawValue: any, fallback: StandardPriority = 3): StandardPriority {
  if (rawValue === null || rawValue === undefined || rawValue === '') {
    return fallback;
  }
  
  const strValue = String(rawValue).trim().toLowerCase();
  
  // 1. 直接查找映射表
  if (PRIORITY_MAP[strValue] !== undefined) {
    return PRIORITY_MAP[strValue];
  }
  
  // 2. 尝试解析数字并映射到1-4范围
  const num = parseInt(strValue, 10);
  if (!isNaN(num) && num > 0) {
    // TAPD可能使用1-4或更大的数字，需要归一化
    if (num <= 4) {
      return num as StandardPriority;
    } else if (num >= 5 && num <= 8) {
      // 5-8 映射到 2(高)
      return 2;
    } else if (num >= 9 && num <= 12) {
      // 9-12 映射到 3(中)
      return 3;
    } else {
      // 更大的数字视为低优先级
      return 4;
    }
  }
  
  // 3. 特殊值处理
  if (strValue === '是' || strValue === 'yes' || strValue === 'true') {
    return 2; // 布尔true视为高优先级
  }
  
  return fallback;
}

/**
 * 获取优先级的显示标签
 * @param priority 标准化的优先级值
 * @returns 中文标签
 */
export function getPriorityLabel(priority: number): string {
  return PRIORITY_LABELS[priority as StandardPriority] || String(priority);
}

/**
 * 获取优先级的颜色（用于前端展示）
 * @param priority 标准化的优先级值
 * @returns 颜色值
 */
export function getPriorityColor(priority: number): string {
  const colors: Record<number, string> = {
    1: '#f5222d', // 红色-紧急
    2: '#fa8c16', // 橙色-高
    3: '#faad14', // 黄色-中
    4: '#52c41a', // 绿色-低
  };
  return colors[priority] || '#d9d9d9';
}
