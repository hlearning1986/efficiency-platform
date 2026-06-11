'use client';

import React, { memo, useMemo } from 'react';
import { Card, Typography, Tooltip } from 'antd';
import type { CapacityOverview } from '../types/sprint.types';

interface CapacityOverviewProps {
  data: CapacityOverview | null;
}

// ✅ 性能优化：使用 React.memo 避免不必要的重渲染
const CapacityOverviewCard: React.FC<CapacityOverviewProps> = memo(({ data }) => {
  // ✅ 使用 useMemo 缓存卡片配置（避免重复计算）
  const cards = useMemo(() => {
    if (!data) return [];

    return [
      {
        icon: '📦',
        label: '总容量',
        value: `${data.totalCapacity.toFixed(1)}`,
        unit: '天',
        bgColor: '#f0f5ff',
        borderColor: '#1677ff',
        tooltip: `团队总工作容量：${data.totalCapacity.toFixed(1)} 天`,
      },
      {
        icon: '✅',
        label: '已分配',
        value: `${data.totalUsed.toFixed(2)}`,
        unit: '天',
        bgColor: '#fff7e6',
        borderColor: '#fa8c16',
        tooltip: `已分配工时：${data.totalUsed.toFixed(2)} 天`,
      },
      {
        icon: '📊',
        label: '剩余容量',
        value: `${data.remaining.toFixed(2)}`,
        unit: '天',
        bgColor: '#f6ffed',
        borderColor: '#52c41a',
        highlight: true,
        tooltip: `剩余可用容量：${data.remaining.toFixed(2)} 天`,
      },
      {
        icon: '🎯',
        label: '建议承接',
        value: `~${data.suggestStories}`,
        unit: '个Story',
        bgColor: '#fff0f6',
        borderColor: '#eb2f96',
        highlight: true,
        tooltip: `基于当前容量建议承接约 ${data.suggestStories} 个需求`,
      },
      {
        icon:
          data.riskLevel === 'safe'
            ? '✅'
            : data.riskLevel === 'warning'
              ? '⚠️'
              : '❌',
        label: '风险状态',
        value:
          data.riskLevel === 'safe'
            ? '无风险'
            : data.riskLevel === 'warning'
              ? '有风险'
              : '高风险',
        unit: '',
        bgColor:
          data.riskLevel === 'safe'
            ? '#f6ffed'
            : data.riskLevel === 'warning'
              ? '#fffbe6'
              : '#fff1f0',
        borderColor:
          data.riskLevel === 'safe'
            ? '#52c41a'
            : data.riskLevel === 'warning'
              ? '#faad14'
              : '#ff4d4f',
        tooltip: `当前风险等级：${
          data.riskLevel === 'safe' ? '无风险（容量充足）' :
          data.riskLevel === 'warning' ? '有风险（接近满载）' :
          '高风险（已超载）'
        }`,
      },
    ];
  }, [data]);

  if (!data || cards.length === 0) return null;

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: '16px',
        marginBottom: '20px',
      }}
    >
      {cards.map((card, index) => (
        // ✅ UX优化：添加 Tooltip 提示和悬停效果
        <Tooltip key={index} title={card.tooltip} placement="top">
          <div
            style={{
              background: card.bgColor,
              border: `1px solid ${card.borderColor}`,
              borderRadius: '12px',
              padding: '20px',
              textAlign: 'center',
              cursor: 'pointer',
              transition: 'transform 0.3s ease, box-shadow 0.3s ease',
              ...(card.highlight && {
                boxShadow: `0 4px 12px ${card.borderColor}40`,
              }),
            }}
            className="capacity-card"
          >
            <div style={{ fontSize: '28px', marginBottom: '8px' }}>
              {card.icon}
            </div>
            <Typography.Text
              type="secondary"
              style={{ fontSize: '13px', display: 'block', marginBottom: '4px' }}
            >
              {card.label}
            </Typography.Text>
            <div style={{ fontSize: '22px', fontWeight: 600, color: '#1f1f1f' }}>
              {card.value}
              <span
                style={{
                  fontSize: '13px',
                  fontWeight: 400,
                  marginLeft: '4px',
                  color: '#8c8c8c',
                }}
              >
                {card.unit}
              </span>
            </div>
          </div>
        </Tooltip>
      ))}

      {/* ✅ 自定义样式 */}
      <style jsx global>{`
        .capacity-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
        }
      `}</style>
    </div>
  );
});

// ✅ 设置 displayName（便于调试）
CapacityOverviewCard.displayName = 'CapacityOverviewCard';

export default CapacityOverviewCard;
