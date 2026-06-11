/**
 * 人力负荷页面 - 设计令牌
 * 完全匹配原型图视觉规范
 */

// ============================================================
// 颜色系统
// ============================================================
export const COLORS = {
  // 主色调
  primary: '#1677ff',
  primaryLight: '#e6f4ff',
  primaryHover: '#4096ff',

  // 语义色
  success: '#52c41a',
  warning: '#faad14',
  danger: '#ff4d4f',

  // 背景色
  bgBase: '#f5f7fa',
  bgCard: '#ffffff',

  // 边框
  border: '#e8ecf1',
  borderLight: '#f0f2f5',

  // 文字色
  textPrimary: '#1a1a2e',
  textSecondary: '#5a6b7c',
  textTertiary: '#94a3b8',

  // 角色专属色彩
  roleFrontend: '#722ed1',
  roleBackend: '#1677ff',
  roleMobile: '#13c2c2',
  roleTest: '#eb2f96',
} as const;

/** 角色颜色映射 */
export const ROLE_COLORS = {
  frontend: COLORS.roleFrontend,
  backend: COLORS.roleBackend,
  mobile: COLORS.roleMobile,
  test: COLORS.roleTest,
} as const;

/** 角色名称映射 */
export const ROLE_LABELS = {
  frontend: '前端开发',
  backend: '后端开发',
  mobile: '移动端开发',
  test: '测试工程师',
} as const;

// ============================================================
// 圆角
// ============================================================
export const RADIUS = {
  sm: '10px',
  md: '16px',
  lg: '22px',
} as const;

// ============================================================
// 阴影
// ============================================================
export const SHADOWS = {
  sm: '0 1px 4px rgba(0,0,0,.05)',
  md: '0 8px 24px rgba(0,0,0,.07)',
  lg: '0 16px 48px rgba(0,0,0,.12)',
} as const;

// ============================================================
// 饱和度阈值与颜色
// ============================================================
export const SATURATION_LEVELS = {
  low: { max: 60, color: COLORS.success, label: '空闲' },
  normal: { max: 85, color: COLORS.primary, label: '健康' },
  high: { max: 100, color: COLORS.warning, label: '满载' },
  over: { max: Infinity, color: COLORS.danger, label: '过载' },
} as const;

/** 根据饱和度值获取颜色 */
export function getSaturationColor(value: number): string {
  if (value <= SATURATION_LEVELS.low.max) return SATURATION_LEVELS.low.color;
  if (value <= SATURATION_LEVELS.normal.max) return SATURATION_LEVELS.normal.color;
  if (value <= SATURATION_LEVELS.high.max) return SATURATION_LEVELS.high.color;
  return SATURATION_LEVELS.over.color;
}

/** 根据饱和度值获取标签 */
export function getSaturationLabel(value: number): string {
  if (value <= SATURATION_LEVELS.low.max) return SATURATION_LEVELS.low.label;
  if (value <= SATURATION_LEVELS.normal.max) return SATURATION_LEVELS.normal.label;
  if (value <= SATURATION_LEVELS.high.max) return SATURATION_LEVELS.high.label;
  return SATURATION_LEVELS.over.label;
}

/** 根据饱和度值获取等级 */
export function getSaturationLevel(value: number): 'low' | 'normal' | 'high' | 'over' {
  if (value <= SATURATION_LEVELS.low.max) return 'low';
  if (value <= SATURATION_LEVELS.normal.max) return 'normal';
  if (value <= SATURATION_LEVELS.high.max) return 'high';
  return 'over';
}
