'use client';

import React from 'react';
import { Card, Tag, Typography, Space, Alert, Tooltip } from 'antd';
import { TeamOutlined, WarningOutlined, UnorderedListOutlined } from '@ant-design/icons';
import { ROLE_LABELS, ROLE_COLORS } from '../utils/constants';
import type { RoleType } from '../types/sprint.types';

const { Text } = Typography;

interface RoleEffortSummaryProps {
  roleEffort: Partial<Record<RoleType, number>>;
  unmappedOwnerCount: number;
  totalEffort: number;
  taskCount?: number;
}

const ROLES: RoleType[] = ['backend', 'frontend', 'mobile', 'test'];

const RoleEffortSummaryComponent: React.FC<RoleEffortSummaryProps> = ({
  roleEffort,
  unmappedOwnerCount,
  totalEffort,
  taskCount = 0,
}) => {
  const mappedTotal = ROLES.reduce(
    (sum, role) => sum + (roleEffort[role] || 0),
    0,
  );
  const mappedRate = totalEffort > 0 ? (mappedTotal / totalEffort) * 100 : 0;

  return (
    <Card
      size="small"
      style={{ marginBottom: 20 }}
      title={
        <Space>
          <TeamOutlined />
          <span>📊 按角色工作量汇总（基于 Task 任务工时）</span>
        </Space>
      }
      extra={
        <Space>
          {taskCount > 0 && (
            <Tag icon={<UnorderedListOutlined />} color="blue">
              {taskCount} 个任务
            </Tag>
          )}
          <Tooltip title="已成功归类到研发四角色的人天占比">
            <Tag color={mappedRate >= 90 ? 'green' : mappedRate >= 60 ? 'blue' : 'orange'}>
              归类率 {mappedRate.toFixed(0)}%
            </Tag>
          </Tooltip>
          {unmappedOwnerCount > 0 && (
            <Tag color="warning" icon={<WarningOutlined />}>
              {unmappedOwnerCount} 个 owner 未分配
            </Tag>
          )}
        </Space>
      }
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 12,
          marginBottom: 12,
        }}
      >
        {ROLES.map((role) => {
          const value = roleEffort[role] || 0;
          const percent = totalEffort > 0 ? (value / totalEffort) * 100 : 0;
          return (
            <div
              key={role}
              style={{
                background: `linear-gradient(135deg, ${ROLE_COLORS[role]}15 0%, ${ROLE_COLORS[role]}05 100%)`,
                border: `1px solid ${ROLE_COLORS[role]}40`,
                borderRadius: 8,
                padding: 16,
                textAlign: 'center',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  height: 4,
                  width: `${Math.min(percent, 100)}%`,
                  background: ROLE_COLORS[role],
                  transition: 'width 0.3s',
                }}
              />
              <Tag
                color={ROLE_COLORS[role]}
                style={{ marginBottom: 6, fontSize: 13, padding: '2px 10px' }}
              >
                {ROLE_LABELS[role]}
              </Tag>
              <div
                style={{
                  fontSize: 24,
                  fontWeight: 600,
                  color: ROLE_COLORS[role],
                  lineHeight: 1.2,
                }}
              >
                {value.toFixed(2)}
                <span style={{ fontSize: 13, color: '#8c8c8c', marginLeft: 4 }}>
                  天
                </span>
              </div>
              <Text type="secondary" style={{ fontSize: 12 }}>
                占比 {percent.toFixed(1)}%
              </Text>
            </div>
          );
        })}
      </div>

      {unmappedOwnerCount > 0 && (
        <Alert
          type="warning"
          showIcon
          message={
            <Space>
              <Text>检测到 {unmappedOwnerCount} 个 owner 未分配角色</Text>
              <a href="/agile/role-mapping" target="_blank">
                立即配置 →
              </a>
            </Space>
          }
          description="未分配的 owner 对应的人天将不会计入任何角色，可在「角色人员映射」页面进行批量配置"
        />
      )}

      {taskCount === 0 && totalEffort === 0 && unmappedOwnerCount === 0 && (
        <Alert
          type="info"
          showIcon
          message="当前迭代暂无任务数据或任务预估工时为空"
          description="工作量统计依赖需求下关联的 Task（任务）及其「预估工时」字段，请确认 TAPD 中每个需求已拆分 Task 并填写了预估工时"
        />
      )}
    </Card>
  );
};

export default RoleEffortSummaryComponent;
