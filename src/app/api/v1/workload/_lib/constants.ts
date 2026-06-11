import type { WorkloadRole, SaturationLevel } from './types';

// ---- 饱和度阈值 ----
export const SATURATION_THRESHOLDS = {
  low: 60,
  normal: 85,
  high: 100,
} as const;

// ---- 饱和度标签 ----
export const SATURATION_LABELS: Record<SaturationLevel, string> = {
  low: '空闲',
  normal: '健康',
  high: '满载',
  over: '过载',
};

// ---- 饱和度颜色 ----
export const SATURATION_COLORS: Record<SaturationLevel, string> = {
  low: '#00b42a',
  normal: '#1677ff',
  high: '#ff7d00',
  over: '#f53f3f',
};

// ---- 角色颜色（前端紫色、后端蓝色、移动端青色、测试粉色）----
export const ROLE_COLORS: Record<WorkloadRole, string> = {
  frontend: '#722ed1',
  backend: '#1677ff',
  mobile: '#13c2c2',
  test: '#eb2f96',
};

// ---- 角色中文名 ----
export const ROLE_LABELS: Record<WorkloadRole, string> = {
  frontend: '前端开发',
  backend: '后端开发',
  mobile: '移动端开发',
  test: '测试工程师',
};

// ---- 默认配置 ----
export const DAILY_CAPACITY_HOURS = 8;      // 每日标准工时(h)
export const DEFAULT_PAGE_SIZE = 50;         // 默认分页大小
export const DATA_FRESHNESS_HOURS = 24;     // 数据新鲜度阈值(h)
export const ROLE_KEYS: WorkloadRole[] = ['frontend', 'backend', 'mobile', 'test'];

// ---- 项目颜色调色板（基于workspaceId哈希）----
const PROJECT_PALETTE = [
  '#1677ff', '#722ed1', '#13c2c2', '#eb2f96',
  '#fa8c16', '#52c41a', '#f5222d', '#faad14',
  '#2f54eb', '#9254de', '#36cfc9', '#ff85c0',
];

/**
 * 根据workspaceId生成项目颜色
 * 使用简单哈希算法确保相同ID返回相同颜色
 */
export function getProjectColor(workspaceId: string): string {
  let hash = 0;
  for (let i = 0; i < workspaceId.length; i++) {
    hash = ((hash << 5) - hash + workspaceId.charCodeAt(i)) | 0;
  }
  return PROJECT_PALETTE[Math.abs(hash) % PROJECT_PALETTE.length];
}
