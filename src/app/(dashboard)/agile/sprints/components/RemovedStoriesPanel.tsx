'use client';

import React, { memo, useMemo, useCallback } from 'react';
import { Table, Button, Typography, Tooltip } from 'antd';
import type { SprintStory, RoleType } from '../types/sprint.types';
import { ROLE_LABELS } from '../utils/constants';

interface RemovedStoriesPanelProps {
  stories: SprintStory[];
  workspaceId?: string;
  onRestoreStory: (storyId: string) => void;
}

// ✅ 性能优化：使用 React.memo 避免不必要的重渲染
const RemovedStoriesPanel: React.FC<RemovedStoriesPanelProps> = memo(({
  stories,
  workspaceId,
  onRestoreStory,
}) => {
  if (stories.length === 0) return null;

  // ✅ 使用 useCallback 稳化"全部恢复"回调（避免子组件重渲染）
  const handleRestoreAll = useCallback(() => {
    stories.forEach(s => onRestoreStory(s.id));
  }, [stories, onRestoreStory]);

  // ✅ 使用 useMemo 缓存列定义（避免重复创建）
  const columns = useMemo(() => [
    {
      title: 'ID',
      dataIndex: 'tapdId',
      width: 85,
      render: (value: string) =>
        value && workspaceId ? (
          <Typography.Link
            style={{ color: '#1677ff', fontSize: '12px' }}
            href={`https://www.tapd.cn/${workspaceId}/prong/stories/view/${value}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            {value}
          </Typography.Link>
        ) : (
          value || '-'
        ),
    },
    {
      title: '标题',
      dataIndex: 'title',
      width: 250,
      ellipsis: true,
      render: (value: string, record: SprintStory) =>
        value && workspaceId ? (
          <Tooltip title="点击查看TAPD详情">
            <Typography.Link
              style={{ color: '#1677ff', fontSize: '13px' }}
              href={`https://www.tapd.cn/${workspaceId}/prong/stories/view/${record.tapdId}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              {value}
            </Typography.Link>
          </Tooltip>
        ) : (
          <Typography.Text style={{ color: '#999' }}>{value}</Typography.Text>
        ),
    },
    {
      title: '状态',
      dataIndex: 'statusLabel',
      width: 90,
      render: (value: string) => value || '-',
    },
    {
      title: '优先级',
      dataIndex: 'priority',
      width: 60,
      align: 'center' as const,
      render: (value: number) => (value && value > 0) ? value : '-',
    },
    {
      title: '处理人',
      dataIndex: 'owner',
      width: 80,
      render: (value: string) => value || '-',
    },
    ...(['backend', 'frontend', 'mobile', 'test'] as RoleType[]).map((role) => ({
      title: ROLE_LABELS[role],
      key: role,
      width: 90,
      align: 'center' as const,
      render: (_: unknown, record: SprintStory) =>
        record.effort?.[role] || 0,
    })),
    {
      title: '操作',
      key: 'action',
      width: 80,
      align: 'center' as const,
      fixed: 'right' as const,
      render: (_: unknown, record: SprintStory) => (
        <Tooltip title="恢复到本迭代">
          <Button
            type="link"
            size="small"
            icon={<span>↩</span>}
            onClick={() => onRestoreStory(record.id)}
            style={{ color: '#52c41a' }}
          >
            恢复
          </Button>
        </Tooltip>
      ),
    },
  ], [workspaceId, onRestoreStory]);

  return (
    <div
      className="removed-stories-panel"
      style={{
        marginTop: '16px',
        background: '#fff',
        borderRadius: '8px',
        padding: '14px 18px',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.08)',
      }}
    >
      {/* ✅ UX优化：更醒目的提示栏 */}
      <div style={{
        marginBottom: '10px',
        padding: '8px 14px',
        background: '#fff1f0',
        border: '1px solid #ffa39e',
        borderRadius: '6px',
        color: '#cf1322',
        fontSize: '13px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <span>
          ⚠️ 已临时移除 ({stories.length} 条) - 不计入本迭代工时统计
        </span>
        <Button
          type="link"
          size="small"
          danger
          onClick={handleRestoreAll}
          style={{ padding: 0, fontSize: '12px' }}
        >
          全部恢复
        </Button>
      </div>

      <Table
        dataSource={stories}
        columns={columns}
        rowKey="id"
        rowClassName="removed-story-row"
        pagination={false}
        scroll={{ x: 1200 }}
        size="small"
        bordered
      />

      {/* ✅ 自定义样式 */}
      <style jsx global>{`
        .removed-story-row {
          background-color: #fafafa;
          opacity: 0.75;
        }

        .removed-story-row:hover {
          background-color: #f5f5f5 !important;
          opacity: 1;
        }

        .removed-stories-panel:hover {
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.12);
        }
      `}</style>
    </div>
  );
});

// ✅ 设置 displayName（便于调试）
RemovedStoriesPanel.displayName = 'RemovedStoriesPanel';

export default RemovedStoriesPanel;
