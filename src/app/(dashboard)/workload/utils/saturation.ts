/**
 * 饱和度工具函数
 * 提供饱和度等级、颜色、标签等常量和辅助函数
 */

import type { SaturationLevel, WorkloadRole } from '../types/workload.types';

// ============================================================
// 饱和度阈值
// ============================================================

export const SATURATION_THRESHOLDS = {
  low: 60,      // ≤60% 空闲
  normal: 85,   // 61-85% 健康
  high: 100,    // 86-100% 满载
} as const;

// ============================================================
// 饱和度等级标签（中文）
// ============================================================

export const SATURATION_LABELS: Record<SaturationLevel, string> = {
  low: '空闲',
  normal: '健康',
  high: '满载',
  over: '过载',
};

// ============================================================
// 饱和度等级颜色
// ============================================================

export const SATURATION_COLORS: Record<SaturationLevel, string> = {
  low: '#00b42a',    // 绿色 - 空闲
  normal: '#1677ff', // 蓝色 - 健康
  high: '#ff7d00',   // 橙色 - 满载
  over: '#f53f3f',   // 红色 - 过载
};

// ============================================================
// 角色颜色映射
// ============================================================

export const ROLE_COLORS: Record<WorkloadRole, string> = {
  frontend: '#722ed1', // 紫色 - 前端
  backend: '#1677ff',  // 蓝色 - 后端
  mobile: '#13c2c2',   // 青色 - 移动端
  test: '#eb2f96',     // 粉色 - 测试
};

// ============================================================
// 角色中文名映射
// ============================================================

export const ROLE_LABELS: Record<WorkloadRole, string> = {
  frontend: '前端开发',
  backend: '后端开发',
  mobile: '移动端开发',
  test: '测试工程师',
};

// ============================================================
// 辅助函数
// ============================================================

/**
 * 获取饱和度等级
 *
 * @param saturation - 饱和度百分比 (0-100+)
 * @returns 饱和度等级
 */
export function getSaturationLevel(saturation: number): SaturationLevel {
  if (saturation <= SATURATION_THRESHOLDS.low) return 'low';
  if (saturation <= SATURATION_THRESHOLDS.normal) return 'normal';
  if (saturation <= SATURATION_THRESHOLDS.high) return 'high';
  return 'over';
}

/**
 * 获取饱和度对应的颜色
 *
 * @param saturation - 饱和度百分比
 * @returns 颜色值 (#xxxxxx)
 */
export function getSaturationColor(saturation: number): string {
  return SATURATION_COLORS[getSaturationLevel(saturation)];
}

/**
 * 获取角色颜色
 *
 * @param role - 工作角色
 * @returns 颜色值
 */
export function getRoleColor(role: WorkloadRole): string {
  return ROLE_COLORS[role];
}
