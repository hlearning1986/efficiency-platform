'use client';

import React, { memo, useMemo } from 'react';
import { Table, InputNumber, Typography } from 'antd';
import type { RoleType, TeamConfig, RoleSummary } from '../types/sprint.types';
import { ROLE_LABELS } from '../utils/constants';
import { calculateFinalEffort } from '../utils/calculations';

interface RoleStatsPanelProps {
  teamConfig: TeamConfig;
  roleSummaries: RoleSummary[];
  onConfigChange: (
    role: RoleType,
    field: 'teamSize' | 'availableDays' | 'leaveDays',
    value: number,
  ) => void;
}

// ✅ 性能优化：使用 React.memo 避免不必要的重渲染
const RoleStatsPanelComponent: React.FC<RoleStatsPanelProps> = memo(({
  teamConfig,
  roleSummaries,
  onConfigChange,
}) => {
  const roles: RoleType[] = ['backend', 'frontend', 'mobile', 'test'];

  // ✅ 使用 useMemo 缓存列定义（避免重复创建）
  const columns = useMemo(() => [
    {
      title: '',
      dataIndex: 'label',
      key: 'label',
      width: 100,
      fixed: 'left' as const,
      render: (value: string) => (
        <Typography.Text
          strong
          style={{
            color: value.includes('需求人天') || value.includes('最终投入') ? '#f5222d' : undefined,
          }}
        >
          {value}
        </Typography.Text>
      ),
    },
    ...roles.map((role) => ({
      title: ROLE_LABELS[role],
      key: role,
      width: 120,
      align: 'center' as const,
      render: (_: unknown, record: Record<string, unknown>) => {
        const rowKey = record.key as string;

        if (rowKey === 'effort') {
          return <Typography.Text>{(record[role] as number)?.toFixed(2) || '0.00'}</Typography.Text>;
        }

        if (rowKey === 'final') {
          const value = record[role] as number;

          return (
            <Typography.Text strong style={{ color: '#f5222d' }}>
              {value.toFixed(2)}
            </Typography.Text>
          );
        }

        if (['size', 'available', 'leave'].includes(rowKey)) {
          const fieldMap = {
            size: 'teamSize',
            available: 'availableDays',
            leave: 'leaveDays',
          } as const;
          const field = fieldMap[rowKey as keyof typeof fieldMap];

          return (
            <InputNumber
              size="small"
              min={0}
              step={field === 'teamSize' ? 1 : 0.5}
              precision={field === 'teamSize' ? 0 : 1}
              value={(teamConfig as any)[role][field]}
              onChange={(value) =>
                onConfigChange(role, field, Number(value) || 0)
              }
              style={{ width: '70px' }}
              variant="borderless"
            />
          );
        }

        return null;
      },
    })),
  ], [teamConfig, roleSummaries, onConfigChange]);

  // ✅ 使用 useMemo 缓存数据源（避免重复计算）
  const dataSource = useMemo(() => [
    {
      key: 'effort',
      label: '需求人天',
      ...Object.fromEntries(
        roles.map((role) => [
          role,
          roleSummaries.find((r) => r.role === role)?.requiredEffort || 0,
        ]),
      ),
    },
    {
      key: 'size',
      label: '团队人数',
      ...Object.fromEntries(
        roles.map((role) => [role, (teamConfig as any)[role].teamSize]),
      ),
    },
    {
      key: 'available',
      label: '可用人天',
      ...Object.fromEntries(
        roles.map((role) => [role, (teamConfig as any)[role].availableDays]),
      ),
    },
    {
      key: 'leave',
      label: '请假人天',
      ...Object.fromEntries(
        roles.map((role) => [role, (teamConfig as any)[role].leaveDays]),
      ),
    },
    {
      key: 'final',
      label: '最终投入人天',
      ...Object.fromEntries(
        roles.map((role) => [
          role,
          calculateFinalEffort(
            (teamConfig as any)[role].teamSize,
            (teamConfig as any)[role].availableDays,
            (teamConfig as any)[role].leaveDays,
          ),
        ]),
      ),
    },
  ], [teamConfig, roleSummaries, roles]);

  return (
    <div
      style={{
        background: '#fff',
        borderRadius: '8px',
        padding: '16px 18px',
        marginTop: '16px',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.08)',
      }}
    >
      <Table
        dataSource={dataSource}
        columns={columns}
        pagination={false}
        bordered
        size="small"
        scroll={{ x: 700 }}
        // ✅ UX优化：添加行悬停效果
        rowClassName={() => 'role-stats-row'}
      />

      {/* ✅ 自定义样式 */}
      <style jsx global>{`
        .role-stats-row:hover {
          background-color: #fafafa !important;
        }

        .ant-table-small .ant-table-thead > tr > th {
          font-weight: 600;
          font-size: 13px;
        }
      `}</style>
    </div>
  );
});

// ✅ 设置 displayName（便于调试）
RoleStatsPanelComponent.displayName = 'RoleStatsPanelComponent';

export default RoleStatsPanelComponent;
