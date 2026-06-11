'use client';

/**
 * RoleDetailPanel - 角色详情面板组件
 * 以Drawer抽屉形式展示角色饱和度详细信息
 *
 * 特点：
 * - Drawer侧边滑出，不遮挡主内容
 * - 显示角色的详细统计数据
 * - 包含饱和度进度条可视化
 */

import React from 'react';
import { Drawer, Descriptions, Tag } from 'antd';
import SaturationBar from './shared/SaturationBar';
import type { RoleSummaryItem } from '../types/workload.types';
import {
  ROLE_COLORS,
  ROLE_LABELS,
} from '../utils/saturation';

interface RoleDetailPanelProps {
  /** 是否显示面板 */
  visible: boolean;
  /** 角色详情数据 */
  data: RoleSummaryItem | null;
  /** 关闭回调 */
  onClose: () => void;
}

const RoleDetailPanel: React.FC<RoleDetailPanelProps> = ({
  visible,
  data,
  onClose,
}) => {
  if (!data) return null;

  return (
    <Drawer
      title={`${ROLE_LABELS[data.role]}饱和度详情`}
      open={visible}
      onClose={onClose}
      width={420}
    >
      <Descriptions column={1} size="small" bordered>
        {/* 角色 */}
        <Descriptions.Item label="角色">
          <Tag color={ROLE_COLORS[data.role]}>
            {ROLE_LABELS[data.role]}
          </Tag>
        </Descriptions.Item>

        {/* 人数 */}
        <Descriptions.Item label="人数">
          {data.peopleCount}人
        </Descriptions.Item>

        {/* 总工时 */}
        <Descriptions.Item label="总工时">
          {data.totalHours}h
        </Descriptions.Item>

        {/* 总容量 */}
        <Descriptions.Item label="总容量">
          {data.totalCap}h
        </Descriptions.Item>

        {/* 饱和度 */}
        <Descriptions.Item label="饱和度">
          <SaturationBar value={data.saturation} />
        </Descriptions.Item>
      </Descriptions>
    </Drawer>
  );
};

export default RoleDetailPanel;
