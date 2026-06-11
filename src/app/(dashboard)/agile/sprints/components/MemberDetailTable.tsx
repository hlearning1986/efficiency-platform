'use client';

import React, { useState } from 'react';
import { Table, Tag, Progress, Typography, Badge, Collapse } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { MemberDetail, SaturationLevel } from '../types/sprint.types';
import { ROLE_LABELS, ROLE_COLORS, SATURATION_LABELS } from '../utils/constants';
import { getSaturationLevel } from '../utils/calculations';

interface MemberDetailTableProps {
  members: MemberDetail[];
}

const { Text } = Typography;

const saturationColors: Record<SaturationLevel, string> = {
  low: '#00b42a',
  normal: '#1677ff',
  high: '#ff7d00',
  over: '#f53f3f',
};

const MemberDetailTableComponent: React.FC<MemberDetailTableProps> = ({
  members,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const columns: ColumnsType<MemberDetail> = [
    {
      title: '成员',
      key: 'member',
      width: 120,
      render: (_, record) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              background: ROLE_COLORS[record.role],
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '14px',
              fontWeight: 600,
            }}
          >
            {record.name.charAt(0)}
          </div>
          <Text strong>{record.name}</Text>
        </div>
      ),
    },
    {
      title: '角色',
      dataIndex: 'role',
      width: 80,
      render: (value) => (
        <Tag color={ROLE_COLORS[value as keyof typeof ROLE_COLORS]}>
          {ROLE_LABELS[value as keyof typeof ROLE_LABELS]}
        </Tag>
      ),
    },
    {
      title: 'Story数',
      dataIndex: 'storyCount',
      width: 80,
      align: 'center',
      render: (value) => <Badge count={value} style={{ backgroundColor: '#1677ff' }} />,
    },
    {
      title: '需求人天',
      dataIndex: 'totalEffort',
      width: 90,
      align: 'center',
      render: (value) => <Text strong>{value.toFixed(2)}</Text>,
    },
    {
      title: '可用人天',
      dataIndex: 'availableDays',
      width: 90,
      align: 'center',
      render: (value) => value.toFixed(1),
    },
    {
      title: '投入人天',
      dataIndex: 'actualInput',
      width: 90,
      align: 'center',
      render: (value) => value.toFixed(2),
    },
    {
      title: '饱和度',
      dataIndex: 'saturationRate',
      width: 150,
      render: (value) => {
        const level = getSaturationLevel(value);
        const displayRate = Math.min(value, 100);
        return (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <Progress
              percent={displayRate}
              size="small"
              strokeColor={saturationColors[level]}
              showInfo={false}
              style={{ flex: 1 }}
            />
            <Text
              style={{
                fontSize: '12px',
                fontWeight: 500,
                color: saturationColors[level],
                minWidth: '35px',
                textAlign: 'right',
              }}
            >
              {value.toFixed(0)}%
            </Text>
          </div>
        );
      },
    },
    {
      title: '状态',
      dataIndex: 'saturationRate',
      width: 80,
      align: 'center',
      render: (value) => {
        const level = getSaturationLevel(value);
        const statusConfig = {
          low: { color: 'green', text: SATURATION_LABELS.low },
          normal: { color: 'blue', text: SATURATION_LABELS.normal },
          high: { color: 'orange', text: SATURATION_LABELS.high },
          over: { color: 'red', text: SATURATION_LABELS.over },
        };
        const config = statusConfig[level];
        return <Tag color={config.color}>{config.text}</Tag>;
      },
    },
  ];

  if (!members || members.length === 0) {
    return null;
  }

  const healthyCount = members.filter(
    (m) => m.saturationRate <= 85 && m.saturationRate > 60,
  ).length;
  const fullCount = members.filter(
    (m) => m.saturationRate > 85 && m.saturationRate <= 100,
  ).length;
  const overCount = members.filter((m) => m.saturationRate > 100).length;

  return (
    <div
      style={{
        background: '#fff',
        borderRadius: '8px',
        padding: '16px',
        marginBottom: '20px',
      }}
    >
      <Collapse
        ghost
        activeKey={isExpanded ? ['members'] : []}
        onChange={(keys) => setIsExpanded(keys.length > 0)}
        items={[
          {
            key: 'members',
            label: (
              <Text strong style={{ fontSize: '15px' }}>
                👥 人员明细 ({members.length}人)
              </Text>
            ),
            extra: (
              <Text type="secondary" style={{ fontSize: '12px' }}>
                ✅ 健康(≤85%): {healthyCount} ⚠️ 接近满载(86-100%):{' '}
                {fullCount} ❌ 过载(&gt;100%): {overCount}
              </Text>
            ),
            children: (
              <>
                <Table<MemberDetail>
                  dataSource={members}
                  columns={columns}
                  rowKey="id"
                  pagination={false}
                  size="small"
                  bordered
                  scroll={{ x: 900 }}
                />

                <div
                  style={{
                    marginTop: '12px',
                    padding: '10px 14px',
                    background: '#fafafa',
                    borderRadius: '6px',
                    borderLeft: '3px solid #722ed1',
                  }}
                >
                  <Text type="secondary" style={{ fontSize: '12px' }}>
                    📊 汇总：参与人数 {members.length} | 健康率{' '}
                    {((healthyCount / members.length) * 100).toFixed(0)}%
                    {' '}| 平均饱和度{' '}
                    {(members.reduce((sum, m) => sum + m.saturationRate, 0) /
                      members.length).toFixed(1)}
                    %
                  </Text>
                </div>
              </>
            ),
          },
        ]}
      />
    </div>
  );
};

export default MemberDetailTableComponent;
