'use client';

/**
 * GaugeRing - SVG圆环仪表盘组件
 * 完全匹配原型图设计规范
 *
 * 特点：
 * - 纯SVG实现，无第三方图表库依赖
 * - 支持自定义尺寸、环宽、颜色
 * - 平滑动画过渡效果（1.5s cubic-bezier）
 * - 支持发光效果和渐变背景
 */

import React from 'react';
import { getSaturationColor, getSaturationLabel } from '../../utils/design-tokens';

interface GaugeRingProps {
  /** 饱和度百分比 (0-100+) */
  value: number;
  /** 圆环直径（像素），默认200（组织大圆环） */
  size?: number;
  /** 环宽（像素），默认16 */
  strokeWidth?: number;
  /** 中心显示文字，默认显示百分比 */
  label?: string;
  /** 副标题文字（饱和度状态） */
  subLabel?: string;
  /** 是否显示数值，默认true */
  showValue?: boolean;
  /** 是否显示单位符号，默认true */
  showUnit?: boolean;
  /** 背景圆环颜色，默认 #f0f2f5 */
  bgColor?: string;
  /** 是否使用角色背景色（半透明白色） */
  useRoleBg?: boolean;
  /** 是否使用渐变色（用于组织整体饱和度） */
  useGradient?: boolean;
}

const GaugeRing: React.FC<GaugeRingProps> = ({
  value,
  size = 200,
  strokeWidth = 16,
  label,
  subLabel,
  showValue = true,
  showUnit = true,
  bgColor = '#f0f2f5',
  useRoleBg = false,
  useGradient = false,
}) => {
  // 计算圆环几何参数
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  // 计算进度偏移量（从顶部开始，顺时针绘制）
  const clampedValue = Math.min(Math.max(value, 0), 999);
  const displayPercent = Math.min(clampedValue, 100);
  const offset = circumference - (displayPercent / 100) * circumference;

  // 根据饱和度获取颜色
  const color = getSaturationColor(clampedValue);

  // 圆心坐标
  const cx = size / 2;
  const cy = size / 2;

  // 实际背景颜色
  const actualBgColor = useRoleBg ? 'rgba(255,255,255,0.5)' : bgColor;

  // 渐变色ID（确保唯一性）
  const gradientId = `gauge-gradient-${cx}-${cy}-${size}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      aria-label={`饱和度：${Math.round(value)}%`}
      style={{ transform: 'rotate(-90deg)' }}
    >
      {/* 定义渐变（仅在useGradient时使用） */}
      {useGradient && (
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#ff4d4f" />
            <stop offset="25%" stopColor="#faad14" />
            <stop offset="50%" stopColor="#52c41a" />
            <stop offset="75%" stopColor="#13c2c2" />
            <stop offset="100%" stopColor="#1677ff" />
          </linearGradient>
        </defs>
      )}

      {/* 背景圆环 */}
      <circle
        cx={cx}
        cy={cy}
        r={radius}
        fill="none"
        stroke={actualBgColor}
        strokeWidth={strokeWidth}
      />

      {/* 进度圆环 - 带发光效果 */}
      <defs>
        <filter id={`glow-${cx}-${cy}`}>
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* 发光层 */}
      <circle
        cx={cx}
        cy={cy}
        r={radius}
        fill="none"
        stroke={useGradient ? `url(#${gradientId})` : color}
        strokeWidth={strokeWidth + 4}
        strokeLinecap="round"
        strokeDasharray={`${circumference} ${circumference}`}
        strokeDashoffset={offset}
        opacity={0.15}
        filter={`url(#glow-${cx}-${cy})`}
        style={{
          transition: 'stroke-dashoffset 1.5s cubic-bezier(.25,.8,.25,1), stroke .4s ease',
        }}
      />

      {/* 主进度圆环 */}
      <circle
        cx={cx}
        cy={cy}
        r={radius}
        fill="none"
        stroke={useGradient ? `url(#${gradientId})` : color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={`${circumference} ${circumference}`}
        strokeDashoffset={offset}
        style={{
          transition: 'stroke-dashoffset 1.5s cubic-bezier(.25,.8,.25,1), stroke .4s ease',
        }}
      />
    </svg>
  );
};

/**
 * GaugeRingWithCenter - 带中心文字的圆环仪表盘
 * 将SVG和中心文字组合在一起
 */
interface GaugeRingWithCenterProps extends GaugeRingProps {
  /** 自定义副标签文本 */
  customSubLabel?: string;
}

const GaugeRingWithCenter: React.FC<GaugeRingWithCenterProps> = ({
  value,
  size = 200,
  strokeWidth = 16,
  label,
  subLabel,
  showValue = true,
  showUnit = true,
  bgColor,
  useRoleBg,
  useGradient = false,
  customSubLabel,
}) => {
  const clampedValue = Math.min(Math.max(value, 0), 999);
  const displayLabel = label ?? `${Math.round(clampedValue)}`;
  // 支持通过 customSubLabel="" 显式隐藏副标题
  const displaySubLabel = customSubLabel !== undefined ? customSubLabel : (subLabel || getSaturationLabel(clampedValue));

  return (
    <div className="flex flex-col items-center justify-center">
      {/* SVG圆环容器（必须设置明确尺寸以支持绝对定位） */}
      <div className="relative" style={{ width: size, height: size, minWidth: size, minHeight: size }}>
        <GaugeRing
          value={value}
          size={size}
          strokeWidth={strokeWidth}
          showValue={false}
          bgColor={bgColor}
          useRoleBg={useRoleBg}
          useGradient={useGradient}
        />

        {/* 中心文字覆盖层 */}
        <div
          className="absolute inset-0 flex flex-col items-center justify-center"
          style={{
            transform: 'rotate(0deg)',
            zIndex: 10,
            pointerEvents: 'none',
          }}
        >
          {showValue && (
            <div style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: '1px',
              whiteSpace: 'nowrap',  // 防止换行
            }}>
              <span
                style={{
                  fontSize: size > 120 ? '48px' : size > 80 ? '28px' : '20px',
                  fontWeight: 800,
                  lineHeight: 1,
                  fontVariantNumeric: 'tabular-nums',
                  letterSpacing: '-1px',
                }}
              >
                {displayLabel}
              </span>
              {showUnit && (
                <span
                  style={{
                    fontSize: size > 120 ? '20px' : '12px',
                    fontWeight: 600,
                    color: '#94a3b8',
                  }}
                >
                  %
                </span>
              )}
            </div>
          )}

          {displaySubLabel && (
            <span
              style={{
                fontSize: '12px',
                color: '#94a3b8',
                marginTop: '3px',
                fontWeight: 500,
              }}
            >
              {displaySubLabel}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default GaugeRing;
export { GaugeRingWithCenter };
