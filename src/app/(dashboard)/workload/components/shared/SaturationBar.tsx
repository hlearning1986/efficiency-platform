'use client';

/**
 * SaturationBar - 饱和度进度条组件
 * 完全匹配原型图设计规范
 *
 * 特点：
 * - 自定义实现，不依赖Ant Design Progress
 * - 圆角胶囊形状
 * - 根据饱和度自动着色（绿/蓝/橙/红）
 * - 支持自定义高度、宽度、标签显示
 */

import React from 'react';
import { getSaturationColor } from '../../utils/design-tokens';

interface SaturationBarProps {
  /** 饱和度百分比 (0-100+) */
  value: number;
  /** 进度条高度（像素），默认24 */
  height?: number;
  /** 进度条宽度（像素），默认auto */
  width?: number | string;
  /** 是否显示百分比标签，默认true */
  showLabel?: boolean;
  /** 是否使用紧凑模式（高度12px） */
  compact?: boolean;
}

const SaturationBar: React.FC<SaturationBarProps> = ({
  value,
  height = 24,
  width = '100%',
  showLabel = true,
  compact = false,
}) => {
  // 获取饱和度对应的颜色
  const clampedValue = Math.min(Math.max(value, 0), 999);
  const displayPercent = Math.min(clampedValue, 100);
  const color = getSaturationColor(clampedValue);

  // 实际高度
  const actualHeight = compact ? 12 : height;

  return (
    <div
      className="relative overflow-hidden rounded-full"
      style={{
        width,
        height: actualHeight,
        backgroundColor: '#f0f2f5',
      }}
    >
      {/* 进度填充 */}
      <div
        className="h-full rounded-full flex items-center justify-end pr-2 transition-all duration-500 ease-out"
        style={{
          width: `${displayPercent}%`,
          minWidth: showLabel && displayPercent > 10 ? '36px' : '0%',
          backgroundColor: color,
        }}
      >
        {/* 百分比标签 */}
        {showLabel && displayPercent > 10 && (
          <span
            className="text-white font-bold text-xs"
            style={{
              fontSize: compact ? '10px' : '11px',
              fontWeight: 700,
            }}
          >
            {Math.round(clampedValue)}%
          </span>
        )}
      </div>

      {/* 外部标签（当进度太短时显示在右侧） */}
      {showLabel && displayPercent <= 10 && (
        <span
          className="absolute right-2 top-1/2 -translate-y-1/2 font-bold"
          style={{
            fontSize: compact ? '10px' : '11px',
            fontWeight: 700,
            color: '#5a6b7c',
          }}
        >
          {Math.round(clampedValue)}%
        </span>
      )}
    </div>
  );
};

export default SaturationBar;
