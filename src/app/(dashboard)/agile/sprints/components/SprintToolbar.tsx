'use client';

import React, { memo, useMemo } from 'react';
import { Select, Input, Button, Space, Spin, Tooltip, Tag, Badge } from 'antd';
import {
  ReloadOutlined,
  SaveOutlined,
  SearchOutlined,
  CloudOutlined,
  ExperimentOutlined,
  InfoCircleOutlined,
  ThunderboltOutlined,
  FilterOutlined,
  DatabaseOutlined,
} from '@ant-design/icons';
import type { TeamOption, SprintOption } from '../types/sprint.types';

interface SprintToolbarProps {
  selectedTeam: string;
  selectedSprint: string;
  searchKeyword: string;
  isLoading: boolean;
  onTeamChange: (teamId: string) => void;
  onSprintChange: (sprintId: string) => void;
  onSearch: (keyword: string) => void;
  onRefreshTAPD: () => void;
  onSave: () => void;
  onIterationAnalysis?: () => void;
  teams: TeamOption[];
  sprints: SprintOption[];
}

/**
 * SprintToolbar - 现代化迭代管理工具栏
 *
 * 设计理念：
 * - 采用分层卡片布局，清晰的视觉层次
 * - 渐变色和微妙阴影营造深度感
 * - 响应式设计，适配不同屏幕尺寸
 * - 微交互动画提升用户体验
 */
const SprintToolbar: React.FC<SprintToolbarProps> = memo(({
  selectedTeam,
  selectedSprint,
  searchKeyword,
  isLoading,
  onTeamChange,
  onSprintChange,
  onSearch,
  onRefreshTAPD,
  onSave,
  onIterationAnalysis,
  teams,
  sprints,
}) => {
  // ✅ 使用 useMemo 缓存选项列表（避免重复创建）
  const teamOptions = useMemo(() =>
    teams.map((t) => ({ label: t.name, value: t.id })),
    [teams]
  );

  const sprintOptions = useMemo(() =>
    sprints.map((s) => ({ label: s.name, value: s.id })),
    [sprints]
  );

  return (
    <div className="modern-toolbar-container">
      {/* 主工具栏卡片 */}
      <div className="toolbar-card">
        {/* 顶部装饰条 */}
        <div className="toolbar-accent-bar" />

        <div className="toolbar-content">
          {/* 左侧：筛选区域 */}
          <div className="filter-section">
            <div className="filter-group">
              <label className="filter-label">
                <DatabaseOutlined className="filter-icon" />
                项目
              </label>
              <Select
                placeholder="选择 TAPD 项目"
                value={selectedTeam || undefined}
                onChange={onTeamChange}
                style={{ width: 200 }}
                options={teamOptions}
                allowClear
                size="large"
                showSearch
                filterOption={(input, option) =>
                  (option?.label as string)?.toLowerCase().includes(input.toLowerCase())
                }
                popupMatchSelectWidth={false}
                className="custom-select"
              />
            </div>

            <div className="filter-divider" />

            <div className="filter-group">
              <label className="filter-label">
                <ThunderboltOutlined className="filter-icon" />
                迭代
              </label>
              <Select
                placeholder="选择迭代周期"
                value={selectedSprint || undefined}
                onChange={onSprintChange}
                style={{ width: 260 }}
                options={sprintOptions}
                allowClear
                disabled={!selectedTeam}
                size="large"
                showSearch
                filterOption={(input, option) =>
                  (option?.label as string)?.toLowerCase().includes(input.toLowerCase())
                }
                popupMatchSelectWidth={false}
                className="custom-select"
              />
            </div>

            <div className="filter-divider" />

            <div className="filter-group search-group">
              <Input.Search
                placeholder="搜索 ID / 标题 / 处理人..."
                value={searchKeyword}
                onChange={(e) => onSearch(e.target.value)}
                allowClear
                style={{ width: 240 }}
                prefix={<FilterOutlined style={{ color: '#bfbfbf' }} />}
                size="large"
                className="search-input"
              />
            </div>
          </div>

          {/* 右侧：操作按钮组 */}
          <div className="action-section">
            <Space size="middle" wrap>
              <Spin spinning={isLoading} size="small">
                <Tooltip title="从 TAPD 同步最新数据到本地" placement="bottom">
                  <Button
                    icon={<CloudOutlined />}
                    onClick={onRefreshTAPD}
                    disabled={!selectedSprint || isLoading}
                    size="large"
                    className="action-btn sync-btn"
                  >
                    <span className="btn-text">同步数据</span>
                  </Button>
                </Tooltip>
              </Spin>

              <Tooltip title="保存当前配置到浏览器缓存" placement="bottom">
                <Button
                  type="primary"
                  icon={<SaveOutlined />}
                  onClick={onSave}
                  size="large"
                  className="action-btn save-btn"
                >
                  <span className="btn-text">保存配置</span>
                </Button>
              </Tooltip>

              {onIterationAnalysis && (
                <Tooltip title="生成排期诊断报告，分析人员负载与风险" placement="bottom">
                  <Button
                    icon={<ExperimentOutlined />}
                    onClick={onIterationAnalysis}
                    disabled={!selectedSprint}
                    size="large"
                    className="action-btn analysis-btn"
                  >
                    <span className="btn-text">诊断分析</span>
                    <Badge
                      count="AI"
                      size="small"
                      style={{
                        backgroundColor: '#722ed1',
                        fontSize: '10px',
                        padding: '0 4px',
                        height: '16px',
                        lineHeight: '16px',
                        boxShadow: 'none',
                      }}
                      className="ai-badge"
                    />
                  </Button>
                </Tooltip>
              )}
            </Space>
          </div>
        </div>
      </div>

      {/* 提示信息卡片 */}
      <div className="hint-card">
        <InfoCircleOutlined className="hint-icon" />
        <div className="hint-content">
          <strong>温馨提示：</strong>
          <span>计划数据仅保存在浏览器本地，不会同步至 TAPD。如需更新需求状态或工时，请直接在 TAPD 中操作。</span>
        </div>
      </div>

      {/* ✅ 现代化样式 */}
      <style jsx global>{`
        /* ========== 容器样式 ========== */
        .modern-toolbar-container {
          margin-bottom: 24px;
          animation: fadeInDown 0.5s ease-out;
        }

        @keyframes fadeInDown {
          from {
            opacity: 0;
            transform: translateY(-20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        /* ========== 主工具栏卡片 ========== */
        .toolbar-card {
          background: linear-gradient(135deg, #ffffff 0%, #fafbfc 100%);
          border-radius: 16px;
          box-shadow:
            0 2px 8px rgba(0, 0, 0, 0.04),
            0 8px 24px rgba(0, 0, 0, 0.06),
            0 0 0 1px rgba(0, 0, 0, 0.02);
          overflow: hidden;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          position: relative;
        }

        .toolbar-card:hover {
          box-shadow:
            0 4px 12px rgba(0, 0, 0, 0.06),
            0 12px 32px rgba(0, 0, 0, 0.08),
            0 0 0 1px rgba(22, 119, 255, 0.08);
          transform: translateY(-2px);
        }

        /* ========== 顶部装饰条 ========== */
        .toolbar-accent-bar {
          height: 4px;
          background: linear-gradient(
            90deg,
            #1677ff 0%,
            #4096ff 25%,
            #69b1ff 50%,
            #4096ff 75%,
            #1677ff 100%
          );
          background-size: 200% 100%;
          animation: shimmer 3s ease-in-out infinite;
        }

        @keyframes shimmer {
          0%, 100% {
            background-position: 0% 50%;
          }
          50% {
            background-position: 100% 50%;
          }
        }

        /* ========== 内容区域 ========== */
        .toolbar-content {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 32px;
          padding: 24px 28px;
        }

        /* ========== 筛选区域 ========== */
        .filter-section {
          display: flex;
          align-items: center;
          gap: 20px;
          flex: 1;
        }

        .filter-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .filter-label {
          font-size: 12px;
          font-weight: 600;
          color: #8c8c8c;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          display: flex;
          align-items: center;
          gap: 6px;
          transition: color 0.3s ease;
        }

        .filter-icon {
          font-size: 13px;
          transition: transform 0.3s ease;
        }

        .filter-group:hover .filter-label {
          color: #1677ff;
        }

        .filter-group:hover .filter-icon {
          transform: scale(1.1);
        }

        .filter-divider {
          width: 1px;
          height: 48px;
          background: linear-gradient(
            to bottom,
            transparent,
            #e8e8e8 20%,
            #e8e8e8 80%,
            transparent
          );
          margin-top: 18px;
        }

        .search-group {
          flex: 1;
          max-width: 280px;
        }

        /* ========== 自定义选择器样式 ========== */
        .custom-select .ant-select-selector {
          border-radius: 10px !important;
          border: 1.5px solid #e8e8e8 !important;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
          box-shadow: none !important;
        }

        .custom-select:hover .ant-select-selector {
          border-color: #91caff !important;
          box-shadow: 0 0 0 3px rgba(22, 119, 255, 0.04) !important;
        }

        .custom-select.ant-select-focused .ant-select-selector {
          border-color: #1677ff !important;
          box-shadow: 0 0 0 3px rgba(22, 119, 255, 0.12) !important;
        }

        /* ========== 搜索框样式 ========== */
        .search-input.ant-input-affix-wrapper {
          border-radius: 10px !important;
          border: 1.5px solid #e8e8e8 !important;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
        }

        .search-input:hover {
          border-color: #91caff !important;
          box-shadow: 0 0 0 3px rgba(22, 119, 255, 0.04) !important;
        }

        .search-input:focus,
        .search-input.ant-input-affix-wrapper-focused {
          border-color: #1677ff !important;
          box-shadow: 0 0 0 3px rgba(22, 119, 255, 0.12) !important;
        }

        /* ========== 操作按钮区域 ========== */
        .action-section {
          display: flex;
          align-items: center;
        }

        /* ========== 按钮通用样式 ========== */
        .action-btn {
          border-radius: 10px !important;
          font-weight: 500 !important;
          height: 42px !important;
          padding: 0 20px !important;
          display: inline-flex !important;
          align-items: center !important;
          gap: 8px !important;
          position: relative;
          overflow: hidden;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
          border: none !important;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05) !important;
        }

        .action-btn::before {
          content: '';
          position: absolute;
          top: 0;
          left: -100%;
          width: 100%;
          height: 100%;
          background: linear-gradient(
            90deg,
            transparent,
            rgba(255, 255, 255, 0.2),
            transparent
          );
          transition: left 0.5s ease;
        }

        .action-btn:hover::before {
          left: 100%;
        }

        .action-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15) !important;
        }

        .action-btn:active {
          transform: translateY(0);
        }

        .btn-text {
          font-size: 14px;
          white-space: nowrap;
        }

        /* ========== 同步按钮（默认） ========== */
        .sync-btn {
          background: linear-gradient(135deg, #f5f5f5 0%, #ffffff 100%) !important;
          color: #595959 !important;
          border: 1.5px solid #d9d9d9 !important;
        }

        .sync-btn:hover:not(:disabled) {
          background: linear-gradient(135deg, #ffffff 0%, #f0f0f0 100%) !important;
          color: #1677ff !important;
          border-color: #1677ff !important;
        }

        .sync-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        /* ========== 保存按钮（主操作） ========== */
        .save-btn {
          background: linear-gradient(135deg, #1677ff 0%, #0958d9 100%) !important;
          color: #fff !important;
          text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
        }

        .save-btn:hover {
          background: linear-gradient(135deg, #4096ff 0%, #1677ff 100%) !important;
          box-shadow: 0 4px 14px rgba(22, 119, 255, 0.35) !important;
        }

        /* ========== 分析按钮（特殊） ========== */
        .analysis-btn {
          background: linear-gradient(135deg, #f0f5ff 0%, #e6f4ff 100%) !important;
          color: #1677ff !important;
          border: 1.5px solid #91caff !important;
        }

        .analysis-btn:hover:not(:disabled) {
          background: linear-gradient(135deg, #e6f4ff 0%, #bae0ff 100%) !important;
          border-color: #1677ff !important;
          box-shadow: 0 4px 14px rgba(22, 119, 255, 0.2) !important;
        }

        .analysis-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .ai-badge {
          margin-left: 4px;
          animation: pulse 2s ease-in-out infinite;
        }

        @keyframes pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.6;
          }
        }

        /* ========== 提示信息卡片 ========== */
        .hint-card {
          margin-top: 16px;
          padding: 14px 20px;
          background: linear-gradient(135deg, #fffbe6 0%, #fff7cc 100%);
          border-left: 4px solid #faad14;
          border-radius: 0 12px 12px 0;
          display: flex;
          align-items: flex-start;
          gap: 12px;
          animation: slideInRight 0.4s ease-out;
          box-shadow: 0 2px 8px rgba(250, 173, 20, 0.1);
        }

        @keyframes slideInRight {
          from {
            opacity: 0;
            transform: translateX(-20px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        .hint-icon {
          font-size: 16px;
          color: #faad14;
          margin-top: 2px;
          flex-shrink: 0;
        }

        .hint-content {
          font-size: 13px;
          line-height: 1.6;
          color: #876800;
          display: flex;
          gap: 6px;
        }

        .hint-content strong {
          color: #d48806;
          font-weight: 600;
        }

        /* ========== 响应式设计 ========== */
        @media (max-width: 1400px) {
          .toolbar-content {
            gap: 24px;
            padding: 20px 24px;
          }

          .search-group {
            max-width: 220px;
          }
        }

        @media (max-width: 1200px) {
          .toolbar-content {
            flex-direction: column;
            align-items: stretch;
            gap: 20px;
          }

          .filter-section {
            justify-content: center;
            flex-wrap: wrap;
          }

          .action-section {
            justify-content: center;
          }

          .filter-divider {
            display: none;
          }

          .search-group {
            max-width: 100%;
            flex-basis: 100%;
          }

          .search-input {
            width: 100% !important;
          }
        }

        @media (max-width: 768px) {
          .toolbar-content {
            padding: 16px 18px;
          }

          .filter-group {
            min-width: calc(50% - 10px);
          }

          .action-btn {
            padding: 0 14px !important;
          }

          .btn-text {
            font-size: 13px;
          }
        }

        /* ========== 暗色模式支持（预留） ========== */
        @media (prefers-color-scheme: dark) {
          .toolbar-card {
            background: linear-gradient(135deg, #1f1f1f 0%, #141414 100%);
            box-shadow:
              0 2px 8px rgba(0, 0, 0, 0.3),
              0 8px 24px rgba(0, 0, 0, 0.4);
          }

          .filter-label {
            color: #a6a6a6;
          }

          .hint-card {
            background: linear-gradient(135deg, #2b2111 0%, #231808 100%);
            border-left-color: #d48806;
          }

          .hint-content {
            color: #c4a44a;
          }
        }
      `}</style>
    </div>
  );
});

// ✅ 设置 displayName（便于调试）
SprintToolbar.displayName = 'SprintToolbar';

export default SprintToolbar;
