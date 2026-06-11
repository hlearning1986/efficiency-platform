'use client';

/**
 * RoleDetailModal - 角色详情弹窗组件
 * 点击角色饱和度卡片后显示该角色的所有人员明细
 *
 * 功能：
 * - 显示角色名称、人数、平均饱和度
 * - 表格展示：姓名、团队、项目、投入(h)、容量(h)、饱和度
 * - 支持点击行联动到人员明细（可选）
 * - 按饱和度降序排列
 */

import React, { useMemo } from 'react';
import { Modal, Table, Tag, Badge } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  COLORS,
} from '../utils/design-tokens';
import type { PersonSatResult } from '../../../app/api/v1/workload/_lib/types';
import type { WorkloadRole } from '../../../app/api/v1/workload/_lib/types';

/** 角色名称映射 */
const ROLE_NAMES: Record<WorkloadRole, string> = {
  frontend: '前端开发',
  backend: '后端开发',
  mobile: '移动端开发',
  test: '测试工程师',
};

/** 角色颜色映射 */
const ROLE_COLORS: Record<WorkloadRole, string> = {
  frontend: '#722ed1',
  backend: '#1677ff',
  mobile: '#13c2c2',
  test: '#eb2f96',
};

interface RoleDetailModalProps {
  /** 是否可见 */
  visible: boolean;
  /** 关闭回调 */
  onClose: () => void;
  /** 选中的角色 */
  role: WorkloadRole | null;
  /** 该角色的所有人员数据 */
  persons: PersonSatResult[];
}

/**
 * 获取饱和度对应的颜色
 */
function getSaturationColor(sat: number): string {
  if (sat >= 85) return '#52c41a';   // 绿色 - 健康
  if (sat >= 70) return '#1677ff';   // 蓝色 - 正常
  if (sat >= 50) return '#faad14';   // 黄色 - 注意
  return '#ff4d4f';                   // 红色 - 风险
}

const RoleDetailModal: React.FC<RoleDetailModalProps> = ({
  visible,
  onClose,
  role,
  persons,
}) => {
  // 计算统计数据
  const stats = useMemo(() => {
    // 按角色过滤，同一人可能有多行（多项目）
    const validPersons = persons.filter(p => p.role === role);
    // 按姓名去重统计人数
    const uniqueNames = new Set(validPersons.map(p => p.name));
    const count = uniqueNames.size;
    const avgSat = validPersons.length > 0
      ? Math.round(validPersons.reduce((sum, p) => sum + p.saturation, 0) / validPersons.length)
      : 0;

    // 按饱和度降序排列
    const sorted = [...validPersons].sort((a, b) => b.saturation - a.saturation);

    return { count, avgSat, sorted };
  }, [persons, role]);

  // 表格列定义
  const columns: ColumnsType<PersonSatResult> = [
    {
      title: '姓名',
      dataIndex: 'name',
      key: 'name',
      width: 100,
      render: (name: string) => (
        <span style={{ fontWeight: 600, color: COLORS.textPrimary }}>{name}</span>
      ),
    },
    {
      title: '团队',
      dataIndex: 'teamName',
      key: 'teamName',
      width: 120,
      render: (team: string) => (
        <span style={{ color: COLORS.textSecondary }}>{team || '-'}</span>
      ),
    },
    {
      title: '项目',
      dataIndex: 'mainProject',
      key: 'mainProject',
      width: 140,
      render: (project: string) => (
        <span style={{ color: COLORS.primary, fontWeight: 500 }}>
          {project || '-'}
        </span>
      ),
    },
    {
      title: '投入(h)',
      dataIndex: 'totalEffort',
      key: 'totalEffort',
      width: 90,
      align: 'center' as const,
      sorter: (a, b) => (a.totalEffort || 0) - (b.totalEffort || 0),
      render: (effort: number) => (
        <span style={{ fontWeight: 600 }}>{Math.round(effort || 0)}</span>
      ),
    },
    {
      title: '容量(h)',
      dataIndex: 'capacity',
      key: 'capacity',
      width: 90,
      align: 'center' as const,
      sorter: (a, b) => (a.capacity || 0) - (b.capacity || 0),
      render: (cap: number) => (
        <span style={{ color: COLORS.textSecondary }}>{Math.round(cap || 0)}</span>
      ),
    },
    {
      title: '饱和度',
      dataIndex: 'saturation',
      key: 'saturation',
      width: 100,
      align: 'center' as const,
      sorter: (a, b) => (a.saturation || 0) - (b.saturation || 0),
      defaultSortOrder: 'descend' as const,
      render: (sat: number) => {
        const color = getSaturationColor(sat);
        return (
          <Tag
            color={color}
            style={{
              fontWeight: 600,
              borderRadius: '6px',
              padding: '2px 12px',
              fontSize: '13px',
              border: `1px solid ${color}30`,
            }}
          >
            {sat}%
          </Tag>
        );
      },
    },
  ];

  // 如果没有选中角色，不渲染
  if (!role) return null;

  const roleName = ROLE_NAMES[role] || role;
  const roleColor = ROLE_COLORS[role] || COLORS.primary;

  return (
    <Modal
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span
            style={{
              display: 'inline-block',
              width: '4px',
              height: '18px',
              background: roleColor,
              borderRadius: '2px',
            }}
          />
          <span style={{ fontSize: '17px', fontWeight: 700 }}>
            {roleName} - 角色详情
          </span>
          <Badge
            count={`${stats.count}人 · 平均${stats.avgSat}%饱和度`}
            style={{
              background: `${roleColor}15`,
              color: roleColor,
              fontSize: '12px',
              fontWeight: 500,
              borderRadius: '8px',
              padding: '0 8px',
              lineHeight: '20px',
            }}
          />
        </div>
      }
      open={visible}
      onCancel={onClose}
      footer={null}
      width={720}
      styles={{
        body: { padding: '16px 24px 24px' },
        header: { 
          borderBottom: `1px solid ${COLORS.borderLight}`,
          paddingBottom: '16px',
        },
      }}
      closeIcon={
        <span
          style={{
            fontSize: '18px',
            cursor: 'pointer',
            color: COLORS.textTertiary,
            transition: 'all .2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = COLORS.textPrimary;
            e.currentTarget.style.transform = 'rotate(90deg)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = COLORS.textTertiary;
            e.currentTarget.style.transform = 'rotate(0deg)';
          }}
        >
          ×
        </span>
      }
    >
      {/* 人员数据表格 */}
      <Table<PersonSatResult>
        dataSource={stats.sorted}
        columns={columns}
        rowKey={(record) => `${record.name}::${record.mainProject}`}
        pagination={false}
        size="middle"
        scroll={{ y: 400 }}
        rowClassName={() => 'role-detail-row'}
        locale={{
          emptyText: (
            <div style={{ padding: '40px 0', textAlign: 'center', color: COLORS.textTertiary }}>
              <p>暂无{roleName}人员数据</p>
            </div>
          ),
        }}
        style={{
          borderRadius: '12px',
          overflow: 'hidden',
        }}
      />

      {/* 自定义表格行样式 */}
      <style jsx global>{`
        .role-detail-row {
          transition: all 0.2s ease;
          cursor: pointer;
        }
        .role-detail-row:hover > td {
          background: rgba(22, 119, 255, 0.04) !important;
        }
        .ant-table-thead > tr > th {
          background: #fafbfc !important;
          font-weight: 600 !important;
          color: #5a6b7c !important;
          font-size: 13px !important;
        }
        .ant-table-tbody > tr:last-child > td {
          border-bottom: none !important;
        }
      `}</style>
    </Modal>
  );
};

export default RoleDetailModal;
