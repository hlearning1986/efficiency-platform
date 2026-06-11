'use client';

import React, { useState, useMemo, memo, useCallback } from 'react';
import { Table, InputNumber, Tag, Typography, Empty, Button, Popconfirm, Tooltip, Badge } from 'antd';
import { DeleteOutlined, UndoOutlined, SettingOutlined, InfoCircleOutlined, FileTextOutlined, EditOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { SprintStory, RoleType } from '../types/sprint.types';
import { ROLE_LABELS, ROLE_COLORS } from '../utils/constants';
import type { FieldConfig } from '../../field-config/types/field-config.types';

interface SprintTableProps {
  stories: SprintStory[];
  onEffortChange: (storyId: string, role: RoleType, value: number) => void;
  fieldConfigs?: FieldConfig[];
  workspaceId?: string;
  onRemoveStory?: (storyId: string) => void;
  onRestoreStory?: (storyId: string) => void;
}

const { Text, Link } = Typography;

/**
 * 提取ID的公共前缀
 * 例如：['1135153283001', '11351532837931', '11351532837496'] → '1135153283'
 */
function extractCommonPrefix(ids: string[]): string {
  if (!ids || ids.length < 2) return '';

  const sortedIds = [...ids].sort();
  const first = sortedIds[0];
  const last = sortedIds[sortedIds.length - 1];

  let i = 0;
  while (i < first.length && i < last.length && first[i] === last[i]) {
    i++;
  }

  // 至少保留4位数字作为前缀（避免过度截取）
  return first.substring(0, Math.max(i - 4, 0));
}

/**
 * 格式化显示ID（去除公共前缀）
 */
function formatDisplayId(fullId: string, commonPrefix: string): string {
  if (!commonPrefix || !fullId.startsWith(commonPrefix)) {
    return fullId;
  }
  return fullId.substring(commonPrefix.length);
}

/**
 * SprintTableComponent - 现代化需求表格组件
 *
 * 优化特性：
 * ✅ 1. ID智能显示：自动去除项目公共前缀
 * ✅ 2. 标题蓝色超链接：醒目的可点击样式
 * ✅ 3. 状态彩色底色：每种状态独特的背景色
 * ✅ 4. 处理人省略显示：单行+省略号+悬浮提示
 * ✅ 5. 工时输入框：明显的可编辑边框样式
 * ✅ 6. 列宽可拖拽：支持动态调整列宽
 */
const SprintTableComponent: React.FC<SprintTableProps> = memo(({
  stories,
  onEffortChange,
  fieldConfigs,
  workspaceId,
  onRemoveStory,
  onRestoreStory,
}) => {
  const [pageSize, setPageSize] = useState(20);

  // ✅ 优化1：提取所有ID的公共前缀（用于智能显示）
  const commonPrefix = useMemo(() => {
    const allIds = stories.map(s => s.tapdId).filter(Boolean) as string[];
    return extractCommonPrefix(allIds);
  }, [stories]);

  // ✅ 优化6：列宽状态管理（支持拖拽调整）
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});

  // 处理列宽变化
  const handleColumnResize = useCallback((key: string, width: number) => {
    setColumnWidths(prev => ({
      ...prev,
      [key]: width,
    }));
  }, []);

  // ✅ 优化：稳定列定义（仅在依赖变化时重新计算）
  const columns: ColumnsType<SprintStory> = useMemo(() => {
    const dynamicColumns: ColumnsType<SprintStory> = [];

    if (fieldConfigs && fieldConfigs.length > 0) {
      const sortedConfigs = [...fieldConfigs]
        .filter(config => config.isVisible && config.fieldKey !== 'remark')
        .sort((a, b) => a.sortOrder - b.sortOrder);

      for (const config of sortedConfigs) {
        const column: any = {
          title: (
            <div className="resizable-header">
              <span>{config.name}</span>
              {/* 拖拽手柄 */}
              <div
                className="resize-handle"
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  startResize(config.fieldKey, e);
                }}
              />
            </div>
          ),
          dataIndex: config.fieldKey,
          key: config.fieldKey,
          width: columnWidths[config.fieldKey] || config.width || undefined,
          ...(config.width ? { fixed: undefined } : {}),
        };

        switch (config.dataType) {
          case 'LINK_TEXT':
            column.render = (value: any) =>
              value ? (
                <Link className="table-link" href="#">
                  {value}
                </Link>
              ) : (
                <span className="empty-value">-</span>
              );
            column.sorter = (a: any, b: any) =>
              (a[config.fieldKey] || '').localeCompare(b[config.fieldKey] || '', 'zh-CN');
            break;

          case 'NUMBER':
            if (config.fieldType === 'ROLE_EFFORT') {
              column.align = 'center';
              // ✅ 优化5：工时输入框 - 明显的可编辑样式
              column.render = (_: unknown, record: SprintStory) => (
                <div className="effort-cell">
                  <InputNumber
                    size="small"
                    min={0}
                    step={0.25}
                    precision={2}
                    value={record.effort?.[config.fieldKey as RoleType] || 0}
                    onChange={(value) =>
                      onEffortChange(record.id, config.fieldKey as RoleType, Number(value) || 0)
                    }
                    style={{ width: '100%' }}
                    disabled={!config.isEditable}
                    className="effort-input-visible"
                  />
                  <EditOutlined className="edit-icon" />
                </div>
              );
              column.sorter = (a: any, b: any) =>
                (a.effort?.[config.fieldKey as RoleType] || 0) - (b.effort?.[config.fieldKey as RoleType] || 0);
            } else {
              column.align = 'center';
              column.render = (value: any) => value ?? <span className="empty-value">-</span>;
              column.sorter = (a: any, b: any) =>
                (Number(a[config.fieldKey]) || 0) - (Number(b[config.fieldKey]) || 0);
            }
            break;

          case 'DATE':
            column.render = (value: any) => {
              if (!value) return <span className="empty-value">-</span>;

              try {
                const date = new Date(value);
                if (!isNaN(date.getTime())) {
                  return (
                    <span className="date-value">
                      {date.toLocaleDateString('zh-CN', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                      })}
                    </span>
                  );
                }
              } catch (e) {
                // 解析失败
              }

              const strVal = String(value).trim();
              if (strVal.length > 20) {
                return <Tooltip title={strVal}><span>{strVal.substring(0, 20)}...</span></Tooltip>;
              }
              return strVal;
            };
            column.sorter = (a: any, b: any) => {
              const dateA = a[config.fieldKey] ? new Date(a[config.fieldKey]).getTime() : 0;
              const dateB = b[config.fieldKey] ? new Date(b[config.fieldKey]).getTime() : 0;
              return dateA - dateB;
            };
            break;

          case 'TEXT':
          default:
            if (config.fieldKey === 'statusLabel') {
              // ✅ 优化3：状态标签 - 不同底色
              column.render = (value: any) => {
                const statusConfig: Record<string, { color: string; bg: string; textColor: string }> = {
                  '已实现': { color: '#52c41a', bg: '#f6ffed', textColor: '#389e0d' },
                  '已关闭': { color: '#8c8c8c', bg: '#fafafa', textColor: '#595959' },
                  '进行中': { color: '#1677ff', bg: '#e6f4ff', textColor: '#0958d9' },
                  '待开始': { color: '#faad14', bg: '#fffbe6', textColor: '#d48806' },
                  '已挂起': { color: '#ff4d4f', bg: '#fff2f0', textColor: '#cf1322' },
                  '已拒绝': { color: '#ff4d4f', bg: '#fff2f0', textColor: '#cf1322' },
                  '规划中': { color: '#722ed1', bg: '#f9f0ff', textColor: '#531dab' },
                  '待测试': { color: '#13c2c2', bg: '#e6fffb', textColor: '#08979c' },
                  '待发布': { color: '#fa8c16', bg: '#fff7e6', textColor: '#d46b08' },
                };

                const config = statusConfig[value] || { color: '#d9d9d9', bg: '#fafafa', textColor: '#8c8c8c' };
                return (
                  <Tag
                    style={{
                      backgroundColor: config.bg,
                      color: config.textColor,
                      border: `1px solid ${config.color}20`,
                      borderRadius: '6px',
                      padding: '4px 12px',
                      fontWeight: 500,
                      fontSize: '12px',
                    }}
                  >
                    {value || '-'}
                  </Tag>
                );
              };
              column.sorter = (a: any, b: any) =>
                (a.statusLabel || '').localeCompare(b.statusLabel || '', 'zh-CN');
            } else if (config.fieldKey === 'priority') {
              column.align = 'center';
              column.render = (value: any) => {
                if (value === null || value === undefined) {
                  return <span className="priority-empty">未设置</span>;
                }
                if (value > 0) {
                  const priorityColors: Record<number, string> = {
                    1: '#cf1322',
                    2: '#fa541c',
                    3: '#fa8c16',
                    4: '#d48806',
                    5: '#52c41a',
                  };
                  return (
                    <Badge
                      count={value}
                      style={{
                        backgroundColor: priorityColors[value] || '#1677ff',
                        fontSize: '12px',
                        padding: '0 6px',
                        height: '20px',
                        lineHeight: '20px',
                        borderRadius: '10px',
                        boxShadow: 'none',
                      }}
                      className="priority-badge"
                    />
                  );
                }
                return <span className="empty-value">-</span>;
              };
              column.sorter = (a: any, b: any) =>
                (Number(a.priority) || 0) - (Number(b.priority) || 0);
            } else {
              column.render = (value: any) => value || <span className="empty-value">-</span>;
              column.sorter = (a: any, b: any) =>
                (a[config.fieldKey] || '').localeCompare(b[config.fieldKey] || '', 'zh-CN');
            }
            break;
        }

        dynamicColumns.push(column);
      }

      for (const col of dynamicColumns) {
        // ✅ 优化1 & 2：ID和标题的渲染优化
        if (col.dataIndex === 'tapdId') {
          col.render = (value: any, record: SprintStory) => {
            if (value && workspaceId) {
              const displayId = formatDisplayId(value, commonPrefix);
              return (
                <Tooltip title={`完整ID: ${value}`}>
                  <Link
                    className="id-link-optimized"
                    href={`https://www.tapd.cn/${workspaceId}/prong/stories/view/${value}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    #{displayId}
                  </Link>
                </Tooltip>
              );
            }
            return value || <span className="empty-value">-</span>;
          };
        }
        if (col.dataIndex === 'title') {
          col.render = (value: any, record: SprintStory) =>
            value && workspaceId ? (
              <Tooltip title={`点击查看 TAPD 详情：${value}`}>
                <Link
                  className="title-link-optimized"
                  href={`https://www.tapd.cn/${workspaceId}/prong/stories/view/${record.tapdId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <FileTextOutlined className="title-icon" />
                  {value}
                </Link>
              </Tooltip>
            ) : (
              <Text className="title-text">{value}</Text>
            );
        }
        // ✅ 优化4：处理人列 - 不换行+省略号+悬浮提示
        if (col.dataIndex === 'owner') {
          col.ellipsis = true;
          col.render = (value: any) => {
            if (!value) return <span className="empty-value">-</span>;
            return (
              <Tooltip title={value} placement="topLeft">
                <span className="owner-text">{value}</span>
              </Tooltip>
            );
          };
        }
      }

      // ✅ 操作列
      const renderActionColumn = (_: unknown, record: SprintStory) => {
        const isRemoved = (record as any)._isRemoved;
        if (isRemoved) {
          return (
            <Button
              type="text"
              size="small"
              icon={<UndoOutlined />}
              onClick={() => onRestoreStory?.(record.id)}
              className="restore-btn"
              title="恢复到本迭代"
            >
              恢复
            </Button>
          );
        }
        return (
          <Popconfirm
            title="确定要临时移除该需求吗？"
            description="移除后将不计入本迭代的工时统计（不影响TAPD真实数据）"
            onConfirm={() => onRemoveStory?.(record.id)}
            okText="确认移除"
            cancelText="取消"
            okButtonProps={{ danger: true }}
            overlayClassName="modern-popconfirm"
          >
            <Button
              type="text"
              danger
              size="small"
              icon={<DeleteOutlined />}
              className="remove-btn"
              title="临时移除出本迭代"
            >
              移除
            </Button>
          </Popconfirm>
        );
      };

      dynamicColumns.push({
        title: '操作',
        key: 'action',
        width: 90,
        align: 'center' as const,
        fixed: 'right' as const,
        render: renderActionColumn,
      });

      return dynamicColumns;
    }

    // ✅ 默认列配置（无字段配置时）- 包含所有优化
    dynamicColumns.push(
      {
        title: '#',
        key: 'index',
        width: 50,
        align: 'center' as const,
        render: (_text, _record, index) => (
          <span className="row-index">{index + 1}</span>
        ),
      },
      {
        // ✅ 优化1：智能ID显示
        title: (
          <div className="resizable-header">
            <span>ID</span>
            <div className="resize-handle" onMouseDown={(e) => { e.preventDefault(); startResize('tapdId', e); }} />
          </div>
        ),
        dataIndex: 'tapdId',
        width: columnWidths['tapdId'] || 110,
        render: (value, record) => {
          if (value && workspaceId) {
            const displayId = formatDisplayId(value, commonPrefix);
            return (
              <Tooltip title={`完整ID: ${value}`}>
                <Link
                  className="id-link-optimized"
                  href={`https://www.tapd.cn/${workspaceId}/prong/stories/view/${value}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  #{displayId}
                </Link>
              </Tooltip>
            );
          }
          return value || <span className="empty-value">-</span>;
        },
      },
      {
        // ✅ 优化2：标题蓝色超链接
        title: (
          <div className="resizable-header">
            <span>需求标题</span>
            <div className="resize-handle" onMouseDown={(e) => { e.preventDefault(); startResize('title', e); }} />
          </div>
        ),
        dataIndex: 'title',
        width: columnWidths['title'] || 280,
        ellipsis: true,
        render: (value, record) =>
          value && workspaceId ? (
            <Tooltip title={`点击查看 TAPD 详情：${value}`}>
              <Link
                className="title-link-optimized"
                href={`https://www.tapd.cn/${workspaceId}/prong/stories/view/${record.tapdId}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <FileTextOutlined className="title-icon" />
                {value}
              </Link>
            </Tooltip>
          ) : (
            <Text className="title-text">{value}</Text>
          ),
      },
      {
        title: '产品',
        dataIndex: 'creator',
        width: 80,
        ellipsis: true,
        render: (value) => value || <span className="empty-value">-</span>,
      },
      {
        // ✅ 优化3：状态彩色底色
        title: (
          <div className="resizable-header">
            <span>状态</span>
            <div className="resize-handle" onMouseDown={(e) => { e.preventDefault(); startResize('statusLabel', e); }} />
          </div>
        ),
        dataIndex: 'statusLabel',
        width: columnWidths['statusLabel'] || 105,
        render: (value) => {
          const statusConfig: Record<string, { color: string; bg: string; textColor: string }> = {
            '已实现': { color: '#52c41a', bg: '#f6ffed', textColor: '#389e0d' },
            '已关闭': { color: '#8c8c8c', bg: '#fafafa', textColor: '#595959' },
            '进行中': { color: '#1677ff', bg: '#e6f4ff', textColor: '#0958d9' },
            '待开始': { color: '#faad14', bg: '#fffbe6', textColor: '#d48806' },
            '已挂起': { color: '#ff4d4f', bg: '#fff2f0', textColor: '#cf1322' },
            '已拒绝': { color: '#ff4d4f', bg: '#fff2f0', textColor: '#cf1322' },
            '规划中': { color: '#722ed1', bg: '#f9f0ff', textColor: '#531dab' },
            '待测试': { color: '#13c2c2', bg: '#e6fffb', textColor: '#08979c' },
            '待发布': { color: '#fa8c16', bg: '#fff7e6', textColor: '#d46b08' },
          };
          const config = statusConfig[value] || { color: '#d9d9d9', bg: '#fafafa', textColor: '#8c8c8c' };
          return (
            <Tag
              style={{
                backgroundColor: config.bg,
                color: config.textColor,
                border: `1px solid ${config.color}30`,
                borderRadius: '6px',
                padding: '4px 12px',
                fontWeight: 500,
                fontSize: '12px',
              }}
            >
              {value || '-'}
            </Tag>
          );
        },
      },
      {
        title: '优先级',
        dataIndex: 'priority',
        width: 70,
        align: 'center' as const,
        render: (value) => {
          if (value && value > 0) {
            const priorityColors: Record<number, string> = {
              1: '#cf1322',
              2: '#fa541c',
              3: '#fa8c16',
              4: '#d48806',
              5: '#52c41a',
            };
            return (
              <Badge
                count={value}
                style={{
                  backgroundColor: priorityColors[value] || '#1677ff',
                  fontSize: '12px',
                  padding: '0 6px',
                  height: '20px',
                  lineHeight: '20px',
                  borderRadius: '10px',
                  boxShadow: 'none',
                }}
                className="priority-badge"
              />
            );
          }
          return <span className="empty-value">-</span>;
        },
      },
      {
        // ✅ 优化4：处理人不换行+省略号+悬浮提示
        title: (
          <div className="resizable-header">
            <span>处理人</span>
            <div className="resize-handle" onMouseDown={(e) => { e.preventDefault(); startResize('owner', e); }} />
          </div>
        ),
        dataIndex: 'owner',
        width: columnWidths['owner'] || 90,
        ellipsis: true,
        render: (value) => {
          if (!value) return <span className="empty-value">-</span>;
          return (
            <Tooltip title={value} placement="topLeft">
              <span className="owner-text">{value}</span>
            </Tooltip>
          );
        },
      },
      ...(['backend', 'frontend', 'mobile', 'test'] as RoleType[]).map((role) => ({
        // ✅ 优化5：工时输入框明显可编辑样式 + 可拖拽宽度
        title: (
          <div className="resizable-header">
            <span>{ROLE_LABELS[role]}</span>
            <div className="resize-handle" onMouseDown={(e) => { e.preventDefault(); startResize(role, e); }} />
          </div>
        ),
        key: role,
        width: columnWidths[role] || 95,
        align: 'center' as const,
        render: (_: unknown, record: SprintStory) => (
          <div className="effort-cell">
            <InputNumber
              size="small"
              min={0}
              step={0.25}
              precision={2}
              value={record.effort?.[role] || 0}
              onChange={(value) => onEffortChange(record.id, role, Number(value) || 0)}
              style={{ width: '100%' }}
              className="effort-input-visible"
            />
            <EditOutlined className="edit-icon" />
          </div>
        ),
      })),
      {
        title: '操作',
        key: 'action',
        width: 90,
        align: 'center' as const,
        fixed: 'right' as const,
        render: (_: unknown, record: SprintStory) => {
          const isRemoved = (record as any)._isRemoved;
          if (isRemoved) {
            return (
              <Button
                type="text"
                size="small"
                icon={<UndoOutlined />}
                onClick={() => onRestoreStory?.(record.id)}
                className="restore-btn"
                title="恢复到本迭代"
              >
                恢复
              </Button>
            );
          }
          return (
            <Popconfirm
              title="确定要临时移除该需求吗？"
              description="移除后将不计入本迭代的工时统计（不影响TAPD真实数据）"
              onConfirm={() => onRemoveStory?.(record.id)}
              okText="确认移除"
              cancelText="取消"
              okButtonProps={{ danger: true }}
              overlayClassName="modern-popconfirm"
            >
              <Button
                type="text"
                danger
                size="small"
                icon={<DeleteOutlined />}
                className="remove-btn"
                title="临时移除出本迭代"
              >
                移除
              </Button>
            </Popconfirm>
          );
        },
      },
    );

    return dynamicColumns;
  }, [fieldConfigs, onEffortChange, onRemoveStory, onRestoreStory, workspaceId, commonPrefix, columnWidths]);

  // ✅ 优化6：列宽拖拽逻辑
  const startResize = useCallback((columnKey: string, e: React.MouseEvent) => {
    const startX = e.clientX;
    const headerCell = (e.target as HTMLElement).closest('th');
    if (!headerCell) return;

    const startWidth = headerCell.offsetWidth;

    const doDrag = (moveEvent: MouseEvent) => {
      const diff = moveEvent.clientX - startX;
      const newWidth = Math.max(60, startWidth + diff); // 最小宽度60px
      handleColumnResize(columnKey, newWidth);

      // 实时更新表头宽度（视觉反馈）
      headerCell.style.width = `${newWidth}px`;
    };

    const stopDrag = () => {
      document.removeEventListener('mousemove', doDrag);
      document.removeEventListener('mouseup', stopDrag);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.addEventListener('mousemove', doDrag);
    document.addEventListener('mouseup', stopDrag);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [handleColumnResize]);

  // ✅ 优化：提前过滤活跃故事
  const activeStories = useMemo(() => {
    return stories.filter(s => !(s as any)._isRemoved);
  }, [stories]);

  if (!stories || stories.length === 0) {
    return (
      <div className="modern-table-empty">
        <Empty
          description={
            <span className="empty-description">暂无需求数据</span>
          }
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      </div>
    );
  }

  return (
    <div className="modern-table-container">
      {/* 配置提示 */}
      {!fieldConfigs && (
        <div className="config-notice">
          <InfoCircleOutlined className="notice-icon" />
          <span className="notice-text">
            使用默认字段配置。前往「字段展示」页面自定义列显示。
          </span>
          <Button
            type="link"
            size="small"
            icon={<SettingOutlined />}
            href="/agile/field-config"
            className="config-btn"
          >
            去配置
          </Button>
        </div>
      )}

      {/* 表格头部信息栏 */}
      <div className="table-header-bar">
        <div className="stats-info">
          <FileTextOutlined className="stats-icon" />
          <span className="stats-count">{activeStories.length}</span>
          <span className="stats-label">条需求</span>
          {stories.length !== activeStories.length && (
            <>
              <span className="divider">|</span>
              <span className="removed-info">
                已移除 <strong>{stories.length - activeStories.length}</strong> 条
              </span>
            </>
          )}
        </div>
        {commonPrefix && (
          <Tooltip title={`项目公共前缀: ${commonPrefix}（已自动隐藏）`}>
            <span className="prefix-info">
              ID 前缀已优化
            </span>
          </Tooltip>
        )}
      </div>

      {/* 现代表格 */}
      <Table
        dataSource={activeStories}
        columns={columns}
        rowKey="id"
        pagination={{
          pageSize,
          showSizeChanger: true,
          pageSizeOptions: ['10', '20', '50', '100'],
          showTotal: (total, range) => (
            <span className="pagination-info">
              显示第 <strong>{range[0]}</strong>-<strong>{range[1]}</strong> 条 / 共 <strong>{total}</strong> 条
            </span>
          ),
          onChange: (_page, size) => setPageSize(size),
          size: 'default',
          className: 'modern-pagination',
        }}
        scroll={{ x: 1300 }}
        size="middle"
        bordered={false}
        virtual={activeStories.length > 100}
        rowClassName={() => 'modern-table-row'}
        className="modern-data-table"
      />

      {/* ✅ 全部优化样式 */}
      <style jsx global>{`
        /* ========== 容器样式 ========== */
        .modern-table-container {
          background: linear-gradient(135deg, #ffffff 0%, #fafbfc 100%);
          border-radius: 16px;
          box-shadow:
            0 2px 8px rgba(0, 0, 0, 0.04),
            0 8px 24px rgba(0, 0, 0, 0.06);
          overflow: hidden;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          animation: fadeInUp 0.6s ease-out;
        }

        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        /* ========== 配置提示 ========== */
        .config-notice {
          margin: 0 24px;
          margin-top: 20px;
          padding: 14px 18px;
          background: linear-gradient(135deg, #fff7e6 0%, #fffbe6 100%);
          border-left: 4px solid #faad14;
          border-radius: 0 10px 10px 0;
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .notice-icon {
          font-size: 16px;
          color: #faad14;
          flex-shrink: 0;
        }

        .notice-text {
          flex: 1;
          font-size: 13px;
          color: #ad6800;
        }

        .config-btn {
          padding: 0 !important;
          height: auto !important;
          color: #1677ff !important;
          font-weight: 500;
        }

        /* ========== 表格头部信息栏 ========== */
        .table-header-bar {
          padding: 18px 24px 12px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 1px solid #f0f0f0;
        }

        .stats-info {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          color: #666;
        }

        .stats-icon {
          font-size: 16px;
          color: #1677ff;
        }

        .stats-count {
          font-size: 22px;
          font-weight: 700;
          color: #1677ff;
          line-height: 1;
        }

        .stats-label {
          color: #8c8c8c;
        }

        .divider {
          color: #e8e8e8;
          margin: 0 4px;
        }

        .removed-info {
          color: #999;
          font-size: 12px;
        }

        .removed-info strong {
          color: #ff4d4f;
        }

        .prefix-info {
          font-size: 11px;
          color: #52c41a;
          background: #f6ffed;
          padding: 4px 10px;
          border-radius: 10px;
          border: 1px solid #b7eb8f;
          cursor: help;
        }

        /* ========== 现代表格样式 ========== */
        .modern-data-table {
          padding: 0 24px 24px;
        }

        .modern-data-table .ant-table {
          border-radius: 12px;
          overflow: hidden;
        }

        .modern-data-table .ant-table-thead > tr > th {
          background: linear-gradient(180deg, #fafbfc 0%, #f5f5f5 100%) !important;
          font-weight: 600 !important;
          font-size: 13px !important;
          color: #262626 !important;
          border-bottom: 2px solid #e8e8e8 !important;
          padding: 14px 16px !important;
          position: relative;
          user-select: none;
        }

        .modern-data-table .ant-table-tbody > tr {
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .modern-table-row:hover {
          background: linear-gradient(90deg, #f0f5ff 0%, #ffffff 100%) !important;
          transform: scale(1.001);
        }

        .modern-table-row:hover td {
          color: #1677ff;
        }

        .modern-data-table .ant-table-tbody > tr > td {
          padding: 14px 16px !important;
          font-size: 13px !important;
          border-bottom: 1px solid #f5f5f5 !important;
          transition: all 0.25s ease;
          vertical-align: middle;
        }

        .modern-data-table .ant-table-tbody > tr:last-child > td {
          border-bottom: none !important;
        }

        /* ========== ✅ 优化1：智能ID链接样式 ========== */
        .id-link-optimized {
          color: #1677ff !important;
          font-weight: 600 !important;
          font-family: 'SF Mono', Monaco, Consolas, 'Courier New', monospace !important;
          font-size: 13px !important;
          text-decoration: none !important;
          transition: all 0.2s ease;
          display: inline-flex;
          align-items: center;
          gap: 2px;
        }

        .id-link-optimized:hover {
          color: #0958d9 !important;
          text-decoration: underline !important;
          text-underline-offset: 2px;
        }

        .id-link-optimized::before {
          content: '#';
          color: #91caff;
          font-weight: 700;
        }

        /* ========== ✅ 优化2：标题蓝色超链接 ========== */
        .title-link-optimized {
          color: #0958d9 !important;
          font-size: 13px !important;
          font-weight: 500 !important;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          transition: all 0.2s ease;
          text-decoration: none !important;
          border-bottom: 1px dashed transparent;
        }

        .title-link-optimized:hover {
          color: #1677ff !important;
          border-bottom-color: #1677ff !important;
          text-decoration: none !important;
        }

        .title-icon {
          font-size: 12px;
          color: #1677ff;
          transition: color 0.2s ease;
        }

        .title-link-optimized:hover .title-icon {
          color: #0958d9;
        }

        .title-text {
          color: #262626;
          font-size: 13px;
        }

        .table-link {
          color: #1677ff !important;
          font-size: 12px;
        }

        .empty-value {
          color: #bfbfbf;
          font-style: italic;
        }

        .date-value {
          color: #595959;
          font-size: 12px;
        }

        /* ========== ✅ 优化3：状态标签彩色底色（已在render中内联设置） ========== */

        /* ========== ✅ 优化4：处理人文本样式 ========== */
        .owner-text {
          color: #262626;
          font-size: 13px;
          cursor: default;
          max-width: 100%;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          display: inline-block;
        }

        /* ========== ✅ 优化5：工时输入框明显可编辑样式 ========== */
        .effort-cell {
          position: relative;
          display: inline-block;
          width: 80px;
        }

        .effort-input-visible {
          border-radius: 6px !important;
          border: 1.5px solid #d9d9d9 !important;
          background: linear-gradient(135deg, #ffffff 0%, #fafafa 100%) !important;
          box-shadow:
            0 1px 3px rgba(0, 0, 0, 0.08),
            inset 0 1px 2px rgba(0, 0, 0, 0.04) !important;
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1) !important;
          height: 32px !important;
          font-size: 13px !important;
          font-weight: 500 !important;
          color: #262626 !important;
        }

        .effort-input-visible:hover {
          border-color: #91caff !important;
          background: #ffffff !important;
          box-shadow:
            0 2px 6px rgba(22, 119, 255, 0.12),
            inset 0 1px 2px rgba(0, 0, 0, 0.04) !important;
        }

        .effort-input-visible:focus,
        .effort-input-visible.ant-input-number-focused {
          border-color: #1677ff !important;
          background: #ffffff !important;
          box-shadow:
            0 0 0 3px rgba(22, 119, 255, 0.12),
            inset 0 1px 2px rgba(0, 0, 0, 0.04) !important;
        }

        .edit-icon {
          position: absolute;
          right: 6px;
          top: 50%;
          transform: translateY(-50%);
          font-size: 11px;
          color: #bfbfbf;
          pointer-events: none;
          opacity: 0;
          transition: all 0.2s ease;
        }

        .effort-cell:hover .edit-icon {
          opacity: 1;
          color: #1677ff;
        }

        .effort-input-visible:focus ~ .edit-icon,
        .effort-cell:hover .edit-icon {
          opacity: 1;
        }

        /* ========== ✅ 优化6：列宽拖拽样式 ========== */
        .resizable-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          width: 100%;
          position: relative;
        }

        .resize-handle {
          position: absolute;
          right: -4px;
          top: 0;
          bottom: 0;
          width: 8px;
          cursor: col-resize;
          background: transparent;
          transition: background 0.2s ease;
          z-index: 1;
        }

        .resize-handle::after {
          content: '';
          position: absolute;
          right: 3px;
          top: 50%;
          transform: translateY(-50%);
          width: 2px;
          height: 40%;
          background: transparent;
          border-radius: 1px;
          transition: all 0.2s ease;
        }

        .resizable-header:hover .resize-handle::after {
          background: #d9d9d9;
        }

        .resize-handle:hover {
          background: rgba(22, 119, 255, 0.1);
        }

        .resize-handle:hover::after {
          background: #1677ff;
          height: 60%;
        }

        /* ========== 行序号 ========== */
        .row-index {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 24px;
          height: 24px;
          background: #f5f5f5;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 600;
          color: #8c8c8c;
        }

        .modern-table-row:hover .row-index {
          background: #1677ff;
          color: #fff;
        }

        /* ========== 优先级徽章 ========== */
        .priority-badge {
          cursor: help;
          transition: all 0.2s ease;
        }

        .priority-badge:hover {
          transform: scale(1.1);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
        }

        .priority-empty {
          color: #bfbfbf;
          font-size: 12px;
          font-style: italic;
        }

        /* ========== 操作按钮 ========== */
        .remove-btn {
          color: #ff4d4f !important;
          border-radius: 6px !important;
          transition: all 0.2s ease !important;
        }

        .remove-btn:hover {
          background: #fff1f0 !important;
          color: #cf1322 !important;
        }

        .restore-btn {
          color: #52c41a !important;
          border-radius: 6px !important;
          transition: all 0.2s ease !important;
        }

        .restore-btn:hover {
          background: #f6ffed !important;
          color: #389e0d !important;
        }

        /* ========== 分页器 ========== */
        .modern-pagination {
          margin-top: 16px !important;
          padding-top: 16px !important;
          border-top: 1px solid #f0f0f0;
        }

        .pagination-info {
          font-size: 13px;
          color: #8c8c8c;
        }

        .pagination-info strong {
          color: #1677ff;
          font-weight: 600;
        }

        .modern-pagination .ant-pagination-item {
          border-radius: 8px !important;
          min-width: 36px !important;
          height: 36px !important;
          line-height: 34px !important;
          transition: all 0.2s ease !important;
        }

        .modern-pagination .ant-pagination-item-active {
          background: #1677ff !important;
          border-color: #1677ff !important;
        }

        .modern-pagination .ant-select-selector {
          border-radius: 8px !important;
        }

        /* ========== 空状态 ========== */
        .modern-table-empty {
          background: linear-gradient(135deg, #ffffff 0%, #fafbfc 100%);
          border-radius: 16px;
          padding: 60px 40px;
          text-align: center;
          box-shadow:
            0 2px 8px rgba(0, 0, 0, 0.04),
            0 8px 24px rgba(0, 0, 0, 0.06);
        }

        .empty-description {
          color: #8c8c8c;
          font-size: 14px;
        }

        /* ========== Popconfirm ========== */
        .modern-popconfirm .ant-popover-inner {
          border-radius: 12px !important;
          box-shadow: 0 6px 24px rgba(0, 0, 0, 0.15) !important;
        }

        /* ========== 响应式设计 ========== */
        @media (max-width: 1400px) {
          .modern-data-table {
            padding: 0 16px 16px;
          }

          .table-header-bar {
            padding: 14px 16px 10px;
          }
        }

        @media (max-width: 1200px) {
          .modern-table-container {
            border-radius: 12px;
          }
        }

        @media (max-width: 768px) {
          .modern-data-table {
            padding: 0 12px 12px;
          }

          .config-notice {
            margin: 12px;
            flex-direction: column;
            text-align: center;
            gap: 8px;
          }

          .table-header-bar {
            padding: 12px;
            flex-direction: column;
            gap: 8px;
          }

          .effort-cell {
            width: 65px;
          }
        }
      `}</style>
    </div>
  );
});

// ✅ 设置 displayName（便于调试）
SprintTableComponent.displayName = 'SprintTableComponent';

export default SprintTableComponent;
