'use client';

/**
 * PersonDetailPanel - 人员详情面板组件
 * 以Drawer抽屉形式展示人员详细信息
 *
 * 特点：
 * - 右侧滑出，宽度720px
 * - 包含两个Tab：每日饱和度 | 任务时间线
 * - 显示人员基本信息（头像、姓名、团队、角色等）
 * - 支持加载状态和错误处理
 */

import React, { useState } from 'react';
import { Drawer, Tabs, Descriptions, Tag, Spin } from 'antd';
import type { PersonCard } from '../types/workload.types';
import {
  ROLE_COLORS,
  ROLE_LABELS,
} from '../utils/saturation';
import SaturationTab from './SaturationTab';
import TimelineTab from './TimelineTab';

interface PersonDetailPanelProps {
  /** 是否显示面板 */
  visible: boolean;
  /** 人员基本信息 */
  person: PersonCard | null;
  /** 日历热力图数据 */
  calendar: import('../types/workload.types').CalendarDay[];
  /** 项目工时分布 */
  projectDistribution: import('../types/workload.types').ProjectDist[];
  /** 任务时间线 */
  timeline: import('../types/workload.types').TaskTimelineEntry[];
  /** 是否正在加载 */
  loading: boolean;
  /** 关闭回调 */
  onClose: () => void;
}

const PersonDetailPanel: React.FC<PersonDetailPanelProps> = ({
  visible,
  person,
  calendar,
  projectDistribution,
  timeline,
  loading,
  onClose,
}) => {
  // 当前激活的Tab
  const [activeTab, setActiveTab] = useState<string>('saturation');

  if (!person) return null;

  return (
    <Drawer
      title={`${person.name}的饱和度详情`}
      open={visible}
      onClose={onClose}
      width={720}
    >
      {/* ===== 人员基本信息卡片 ===== */}
      <div className="mb-4 p-3 bg-gray-50 rounded-lg">
        <Descriptions column={2} size="small" bordered>
          {/* 姓名 */}
          <Descriptions.Item label="姓名">{person.name}</Descriptions.Item>

          {/* 团队 */}
          <Descriptions.Item label="所属团队">
            {person.team || '-'}
          </Descriptions.Item>

          {/* 主项目 */}
          <Descriptions.Item label="主项目">
            {person.project || '-'}
          </Descriptions.Item>

          {/* 角色 */}
          <Descriptions.Item label="角色">
            <Tag color={ROLE_COLORS[person.role]}>
              {ROLE_LABELS[person.role]}
            </Tag>
          </Descriptions.Item>

          {/* 工作日数 */}
          <Descriptions.Item label="工作日数">
            {person.days}天
          </Descriptions.Item>

          {/* 实际投入 */}
          <Descriptions.Item label="实际投入">
            {person.actual}h
          </Descriptions.Item>

          {/* 容量上限 */}
          <Descriptions.Item label="容量上限">
            {person.cap}h
          </Descriptions.Item>

          {/* 饱和度 */}
          <Descriptions.Item label="饱和度">
            <Tag color={person.sat > 100 ? 'red' : person.sat > 85 ? 'orange' : person.sat > 60 ? 'blue' : 'green'}>
              {Math.round(person.sat)}%
            </Tag>
          </Descriptions.Item>
        </Descriptions>
      </div>

      {/* ===== Tab切换区域 ===== */}
      <Tabs
        activeKey={activeTab}
        onChange={(key) => setActiveTab(key)}
        items={[
          {
            key: 'saturation',
            label: '每日饱和度',
            children: loading ? (
              <div className="text-center py-8">
                <Spin tip="加载中..." />
              </div>
            ) : (
              <SaturationTab
                calendar={calendar}
                projectDistribution={projectDistribution}
              />
            ),
          },
          {
            key: 'timeline',
            label: '任务时间线',
            children: loading ? (
              <div className="text-center py-8">
                <Spin tip="加载中..." />
              </div>
            ) : (
              <TimelineTab timeline={timeline} />
            ),
          },
        ]}
      />
    </Drawer>
  );
};

export default PersonDetailPanel;
