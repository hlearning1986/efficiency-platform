'use client';

import React from 'react';
import { Progress, Typography } from 'antd';
import type { CapacityOverview } from '../types/sprint.types';
import { getUtilizationStyle } from '../utils/calculations';

interface UtilizationBarProps {
  data: CapacityOverview | null;
}

const UtilizationBarComponent: React.FC<UtilizationBarProps> = ({ data }) => {
  if (!data) return null;

  const style = getUtilizationStyle(data.utilizationRate);
  const displayRate = Math.min(data.utilizationRate, 100);

  return (
    <div
      style={{
        marginBottom: '20px',
        padding: '20px',
        background: '#fff',
        borderRadius: '8px',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '12px',
        }}
      >
        <Typography.Text strong style={{ fontSize: '15px' }}>
          📈 整体利用率
        </Typography.Text>
        <Typography.Text
          style={{
            fontSize: '14px',
            fontWeight: 600,
            color: style.color,
          }}
        >
          {data.utilizationRate.toFixed(1)}%
        </Typography.Text>
      </div>

      <Progress
        percent={displayRate}
        strokeColor={{
          '0%': style.color,
          '100%': style.color,
        }}
        trailColor="#f0f0f0"
        strokeWidth={12}
        showInfo={false}
        style={{ marginBottom: '8px' }}
      />

      <div
        style={{
          textAlign: 'center',
          padding: '6px 12px',
          background: `${style.color}10`,
          borderRadius: '4px',
          borderLeft: `3px solid ${style.color}`,
        }}
      >
        <Typography.Text
          style={{ fontSize: '13px', color: style.color }}
        >
          💡 {style.tipMessage}
        </Typography.Text>
      </div>
    </div>
  );
};

export default UtilizationBarComponent;
