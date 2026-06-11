'use client';

/**
 * TimelineTab - 任务时间线Tab组件
 * 以时间线形式展示人员的任务分布
 *
 * 特点：
 * - 按日期排序显示任务
 * - 显示任务名称、项目、状态、进度
 * - 颜色编码：已完成(绿)、进行中(蓝)、待开始(灰)
 */

import React from 'react';
import { Card, Tag, Timeline, Tooltip } from 'antd';
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  MinusCircleOutlined,
} from '@ant-design/icons';
import type { TaskTimelineEntry, TaskStatus } from '../types/workload.types';

interface TimelineTabProps {
  /** 任务时间线数据 */
  timeline: TaskTimelineEntry[];
}

const TimelineTab: React.FC<TimelineTabProps> = ({ timeline }) => {
  // 按状态分组统计
  const statusStats = {
    done: timeline.filter((t) => t.status === 'done').length,
    in_progress: timeline.filter((t) => t.status === 'in_progress').length,
    todo: timeline.filter((t) => t.status === 'todo').length,
  };

  return (
    <div className="space-y-4">
      {/* ===== Section 1: 任务统计概览 ===== */}
      <Card size="small">
        <div className="flex items-center gap-6 text-sm">
          <span>任务总数: {timeline.length}</span>
          <Tag icon={<CheckCircleOutlined />} color="success">
            已完成: {statusStats.done}
          </Tag>
          <Tag icon={<ClockCircleOutlined />} color="processing">
            进行中: {statusStats.in_progress}
          </Tag>
          <Tag icon={<MinusCircleOutlined />} color="default">
            待开始: {statusStats.todo}
          </Tag>
        </div>
      </Card>

      {/* ===== Section 2: 任务时间线 ===== */}
      <Card title="任务列表" size="small">
        {timeline.length > 0 ? (
          <Timeline
            items={timeline.map((task) => ({
              key: task.id,
              color: getStatusColor(task.status),
              dot: <getStatusIcon task={task} />,
              children: (
                <div className="pb-2">
                  {/* 任务头部 */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      {/* 任务名称 */}
                      <Tooltip title={task.name}>
                        <div className="font-medium truncate">{task.name}</div>
                      </Tooltip>

                      {/* 项目标签 */}
                      <Tag
                        color={task.color}
                        style={{ marginTop: 4, fontSize: 11 }}
                      >
                        {task.projectName}
                      </Tag>
                    </div>

                    {/* 状态标签 */}
                    <Tag
                      color={
                        task.status === 'done'
                          ? 'success'
                          : task.status === 'in_progress'
                            ? 'processing'
                            : 'default'
                      }
                    >
                      {task.statusLabel}
                    </Tag>
                  </div>

                  {/* 任务详情 */}
                  <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                    <span>
                      {task.startDate} ~ {task.endDate}
                    </span>
                    <span>预估: {task.estHours}h</span>
                    <span>实际: {task.actHours}h</span>

                    {/* 进度条 */}
                    <div className="flex-1 max-w-[120px]">
                      <div className="bg-gray-100 rounded-full h-2 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            task.progressPct >= 100
                              ? 'bg-green-500'
                              : task.progressPct >= 50
                                ? 'bg-blue-500'
                                : 'bg-gray-400'
                          }`}
                          style={{ width: `${Math.min(task.progressPct, 100)}%` }}
                        />
                      </div>
                      <span className="ml-1">{Math.round(task.progressPct)}%</span>
                    </div>
                  </div>
                </div>
              ),
            }))}
          />
        ) : (
          <div className="text-center py-8 text-gray-400">暂无任务数据</div>
        )}
      </Card>
    </div>
  );
};

// ============================================================
// 辅助函数
// ============================================================

/** 获取状态对应的颜色 */
function getStatusColor(status: TaskStatus): string {
  switch (status) {
    case 'done':
      return '#00b42a'; // 绿色
    case 'in_progress':
      return '#1677ff'; // 蓝色
    default:
      return '#c9cdd4'; // 灰色
  }
}

/** 获取状态图标 */
function getStatusIcon({ task }: { task: TaskTimelineEntry }): React.ReactNode {
  switch (task.status) {
    case 'done':
      return <CheckCircleOutlined style={{ color: '#00b42a' }} />;
    case 'in_progress':
      return <ClockCircleOutlined style={{ color: '#1677ff' }} />;
    default:
      return <MinusCircleOutlined style={{ color: '#c9cdd4' }} />;
  }
}

export default TimelineTab;
