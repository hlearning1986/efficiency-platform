'use client';

/**
 * MiniGaugeRing - 迷你圆环仪表盘组件
 * 完全匹配原型图设计规范
 *
 * 特点：
 * - 紧凑设计，默认64px直径（团队卡片）/ 60px（卡片头部）
 * - 中心显示数值和标签
 * - 带发光效果
 * - 平滑动画过渡（1.2s cubic-bezier）
 */

import React from 'react';
import { getSaturationColor } from '../../utils/design-tokens';

interface MiniGaugeRingProps {
  /** 饱和度百分比 (0-100+) */
  value: number;
  /** 圆环直径（像素），默认64 */
  size?: number;
  /** 环宽（像素），默认6 */
  strokeWidth?: number;
  /** 是否显示底部标签，默认true */
  showLabel?: boolean;
  /** 自定义标签文本 */
  label?: string;
}

const MiniGaugeRing: React.FC<MiniGaugeRingProps> = ({
  value,
  size = 64,
  strokeWidth = 6,
  showLabel = true,
  label,
}) => {
  // 计算几何参数
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clampedValue = Math.min(Math.max(value, 0), 999);
  const displayPercent = Math.min(clampedValue, 100);
  const offset = circumference - (displayPercent / 100) * circumference;

  // 获取颜色
  const color = getSaturationColor(clampedValue);

  // 圆心坐标
  const cx = size / 2;
  const cy = size / 2;

  return (
    <div className="relative inline-flex flex-col items-center">
      {/* SVG圆环容器 */}
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          aria-label={`饱和度：${Math.round(value)}%`}
          style={{ transform: 'rotate(-90deg)' }}
        >
          {/* 背景圆环 */}
          <circle
            cx={cx}
            cy={cy}
            r={radius}
            fill="none"
            stroke="#e8ecf1"
            strokeWidth={strokeWidth}
          />

          {/* 发光层 */}
          <circle
            cx={cx}
            cy={cy}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth + 4}
            strokeLinecap="round"
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={offset}
            opacity={0.15}
            filter="blur(6px)"
            style={{
              transition: 'stroke-dashoffset 1.2s cubic-bezier(.25,.8,.25,1)',
            }}
          />

          {/* 进度圆环 */}
          <circle
            cx={cx}
            cy={cy}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={offset}
            style={{
              transition: 'stroke-dashoffset 1.2s cubic-bezier(.25,.8,.25,1), stroke .4s ease',
            }}
          />
        </svg>

        {/* 中心文字覆盖层 */}
        <div
          className="absolute inset-0 flex flex-col items-center justify-center"
          style={{ transform: `rotate(0deg)` }}
        >
          <span
            style={{
              fontSize: size > 60 ? '16px' : '14px',
              fontWeight: 800,
              lineHeight: 1,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {Math.round(clampedValue)}
            <span
              style={{
                fontSize: size > 60 ? '10px' : '9px',
                fontWeight: 600,
                marginLeft: '1px',
                color: '#94a3b8',
              }}
            >
              %
            </span>
          </span>
        </div>
      </div>

      {/* 底部标签 */}
      {showLabel && (
        <span
          style={{
            fontSize: '9px',
            color: '#94a3b8',
            marginTop: '4px',
            fontWeight: 500,
          }}
        >
          {label || '饱和度'}
        </span>
      )}
    </div>
  );
};

export default MiniGaugeRing;
