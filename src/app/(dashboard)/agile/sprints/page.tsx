'use client';

import { useState, useEffect, useMemo, useCallback, lazy, Suspense } from 'react';
import { Typography, Spin, message, Tabs, Alert } from 'antd';
import { SettingOutlined, TeamOutlined, LoadingOutlined } from '@ant-design/icons';
import SprintToolbar from './components/SprintToolbar';
import SprintTableComponent from './components/SprintTable';
import RoleStatsPanelComponent from './components/RoleStatsPanel';
import RemovedStoriesPanel from './components/RemovedStoriesPanel';
import RoleConfigTabContent from './components/RoleConfigTabContent';
import FieldConfigPageComponent from '../field-config/FieldConfigPage';
import { useSprintData } from './hooks/useSprintData';
import { useCapacityCalculation } from './hooks/useCapacityCalculation';
import type { RoleType, SprintStory } from './types/sprint.types';
import type { FieldConfig } from '../field-config/types/field-config.types';

// ✅ 性能优化：懒加载重型弹窗组件（减少初始包大小）
const IterationAnalysisModal = lazy(() => import('./components/IterationAnalysisModal'));

const { Title } = Typography;

// ✅ 加载状态指示器（复用，避免重复创建）
const LoadingSpinner = () => (
  <div style={{ textAlign: 'center', padding: '80px 0' }}>
    <Spin indicator={<LoadingOutlined style={{ fontSize: 32 }} spin />} tip="加载中..." />
  </div>
);

export default function SprintPlanningPage() {
  const [selectedTeam, setSelectedTeam] = useState<string>('');
  const [selectedSprint, setSelectedSprint] = useState<string>('');
  const [searchKeyword, setSearchKeyword] = useState<string>('');
  const [showAnalysisModal, setShowAnalysisModal] = useState(false);
  const [fieldConfigs, setFieldConfigs] = useState<FieldConfig[]>([]);
  const [activeTab, setActiveTab] = useState<string>('sprint');
  const [removedStoryIds, setRemovedStoryIds] = useState<Set<string>>(new Set());

  // ✅ 优化：使用 AbortController 取消未完成的请求（防止竞态条件）
  useEffect(() => {
    if (!selectedTeam) return;

    const controller = new AbortController();

    const loadFieldConfigs = async () => {
      try {
        const url = `/api/v1/agile/field-configs?teamConfigId=${selectedTeam}`;
        console.log(`[SprintPage] 加载字段配置: ${url}`);

        const res = await fetch(url, { signal: controller.signal });
        const result = await res.json();

        if (result.success && Array.isArray(result.data)) {
          setFieldConfigs(result.data);
          console.log(`[SprintPage] 字段配置加载成功: ${result.data.length} 个字段`);
        }
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          console.error('Error loading field configs:', error);
        }
      }
    };

    loadFieldConfigs();

    // ✅ 清理函数：组件卸载或依赖变化时取消请求
    return () => controller.abort();
  }, [selectedTeam]);

  const {
    sprintData,
    isLoading,
    error,
    teams,
    sprints,
    loadSprint,
    loadSprints,
    refreshFromTAPD,
    searchStories,
    updateStoryEffort,
    updateTeamConfig,
  } = useSprintData();

  // ✅ 优化：使用 useMemo 缓存过滤后的故事列表（避免重复计算）
  const filteredStories: SprintStory[] = useMemo(() => {
    const baseStories = searchKeyword
      ? searchStories(searchKeyword)
      : sprintData?.stories || [];

    const activeStories: SprintStory[] = [];
    const removedStories: SprintStory[] = [];

    for (const story of baseStories) {
      if (removedStoryIds.has(story.id)) {
        removedStories.push({ ...story, _isRemoved: true } as SprintStory & { _isRemoved?: boolean });
      } else {
        activeStories.push(story);
      }
    }

    return [...activeStories, ...removedStories];
  }, [searchKeyword, sprintData?.stories, searchStories, removedStoryIds]);

  // ✅ 优化：使用 useCallback 保持稳定的引用（防止子组件不必要重渲染）
  const handleRemoveStory = useCallback((storyId: string) => {
    setRemovedStoryIds(prev => new Set([...prev, storyId]));
  }, []);

  const handleRestoreStory = useCallback((storyId: string) => {
    setRemovedStoryIds(prev => {
      const next = new Set(prev);
      next.delete(storyId);
      return next;
    });
  }, []);

  // 仅用于统计的故事列表（排除已移除的）
  const storiesForStats: SprintStory[] = useMemo(() => {
    return filteredStories.filter(s => !(s as any)._isRemoved);
  }, [filteredStories]);

  // 角色工时统计（仅计算未移除的story）
  const { roleSummaries } = useCapacityCalculation(
    storiesForStats,
    sprintData?.teamConfig || {
      backend: { teamSize: 9, availableDays: 10, leaveDays: 1 },
      frontend: { teamSize: 7, availableDays: 10, leaveDays: 0.5 },
      mobile: { teamSize: 10, availableDays: 10, leaveDays: 0 },
      test: { teamSize: 6, availableDays: 10, leaveDays: 0 },
    },
    sprintData?.members || [],
  );

  // ✅ 优化：事件处理函数（使用 useCallback 避免子组件重渲染）
  const handleTeamChange = useCallback((teamId: string) => {
    setSelectedTeam(teamId);
    setSelectedSprint('');
    if (teamId) {
      loadSprints(teamId);
    }
  }, [loadSprints]);

  const handleSprintChange = useCallback((sprintId: string) => {
    setSelectedSprint(sprintId);
    if (sprintId) {
      loadSprint(sprintId, selectedTeam);
    }
  }, [loadSprint, selectedTeam]);

  const handleRefreshTAPD = useCallback(() => {
    if (!selectedSprint || !selectedTeam) {
      message.warning('请先选择 TAPD 项目');
      return;
    }
    refreshFromTAPD(selectedSprint, selectedTeam);
  }, [selectedSprint, selectedTeam, refreshFromTAPD]);

  const handleSave = useCallback(() => {
    message.success('配置已临时保存到本地');
  }, []);

  const handleConfigChange = useCallback((
    role: RoleType,
    field: 'teamSize' | 'availableDays' | 'leaveDays',
    value: number,
  ) => {
    updateTeamConfig(role, field, value);
  }, [updateTeamConfig]);

  const handleIterationAnalysis = useCallback(() => {
    if (!selectedTeam || !selectedSprint) {
      message.warning('请先选择项目和迭代');
      return;
    }
    setShowAnalysisModal(true);
  }, [selectedTeam, selectedSprint]);

  const handleEffortChange = useCallback((storyId: string, role: RoleType, value: number) => {
    updateStoryEffort(storyId, role, value);
  }, [updateStoryEffort]);

  const handleTabChange = useCallback((key: string) => {
    setActiveTab(key);
    if (key === 'sprint' && selectedTeam) {
      fetch(`/api/v1/agile/field-configs?teamConfigId=${selectedTeam}`)
        .then(res => res.json())
        .then(result => {
          if (result.success && Array.isArray(result.data)) {
            setFieldConfigs(result.data);
          }
        })
        .catch(console.error);
    }
  }, [selectedTeam]);

  // ✅ 优化：稳定 tabItems 引用（减少 Tabs 组件重渲染）
  const tabItems = useMemo(() => [
    {
      key: 'sprint',
      label: <span>📋 迭代计划</span>,
      children: (
        <>
          <SprintToolbar
            selectedTeam={selectedTeam}
            selectedSprint={selectedSprint}
            searchKeyword={searchKeyword}
            isLoading={isLoading}
            onTeamChange={handleTeamChange}
            onSprintChange={handleSprintChange}
            onSearch={setSearchKeyword}
            onRefreshTAPD={handleRefreshTAPD}
            onSave={handleSave}
            onIterationAnalysis={handleIterationAnalysis}
            teams={teams}
            sprints={sprints}
          />

          {isLoading ? (
            <LoadingSpinner />
          ) : error ? (
            <Alert
              type="error"
              message="加载失败"
              description={error}
              showIcon
              style={{ margin: '16px 0' }}
            />
          ) : sprintData ? (
            <>
              <SprintTableComponent
                stories={filteredStories}
                onEffortChange={handleEffortChange}
                fieldConfigs={fieldConfigs}
                workspaceId={selectedTeam}
                onRemoveStory={handleRemoveStory}
                onRestoreStory={handleRestoreStory}
              />

              <RoleStatsPanelComponent
                teamConfig={sprintData.teamConfig}
                roleSummaries={roleSummaries}
                onConfigChange={handleConfigChange}
              />

              {/* 已移除的stories */}
              <RemovedStoriesPanel
                stories={filteredStories.filter(s => (s as any)._isRemoved)}
                workspaceId={selectedTeam}
                onRestoreStory={handleRestoreStory}
              />
            </>
          ) : null}
        </>
      ),
    },
    {
      key: 'role-config',
      label: <span><TeamOutlined /> 角色配置</span>,
      children: (
        <RoleConfigTabContent workspaceId={selectedTeam} />
      ),
    },
    {
      key: 'field-config',
      label: <span><SettingOutlined /> 字段展示配置</span>,
      children: <FieldConfigPageComponent />,
    },
  ], [
    selectedTeam, selectedSprint, searchKeyword, isLoading,
    error, sprintData, filteredStories, roleSummaries,
    fieldConfigs, teams, sprints,
    handleTeamChange, handleSprintChange, handleRefreshTAPD,
    handleSave, handleIterationAnalysis, handleEffortChange,
    handleConfigChange, handleRemoveStory, handleRestoreStory,
  ]);

  return (
    <div className="modern-sprint-page">
      {/* 页面头部装饰 */}
      <div className="page-header-accent" />

      {/* 现代化标签页容器 */}
      <div className="tabs-container">
        <Tabs
          activeKey={activeTab}
          onChange={handleTabChange}
          items={tabItems}
          type="card"
          size="large"
          className="modern-tabs"
        />
      </div>

      {/* ✅ 使用 Suspense 包裹懒加载组件 */}
      <Suspense fallback={<LoadingSpinner />}>
        <IterationAnalysisModal
          open={showAnalysisModal}
          onClose={() => setShowAnalysisModal(false)}
          workspaceId={selectedTeam}
          iterationId={selectedSprint}
          iterationName={sprintData?.sprint?.name}
        />
      </Suspense>

      {/* ✅ 全局样式 */}
      <style jsx global>{`
        /* ========== 页面容器 ========== */
        .modern-sprint-page {
          padding: 20px 24px;
          max-width: 100%;
          margin: 0 auto;
          min-height: calc(100vh - 120px);
          position: relative;
          background: linear-gradient(180deg, #f5f7fa 0%, #ffffff 100%);
        }

        /* ========== 页面顶部装饰 ========== */
        .page-header-accent {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
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
          animation: headerShimmer 8s ease-in-out infinite;
        }

        @keyframes headerShimmer {
          0%, 100% {
            background-position: 0% 50%;
          }
          50% {
            background-position: 100% 50%;
          }
        }

        /* ========== 标签页容器 ========== */
        .tabs-container {
          margin-bottom: 24px;
          animation: fadeInDown 0.5s ease-out;
        }

        @keyframes fadeInDown {
          from {
            opacity: 0;
            transform: translateY(-15px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        /* ========== 现代化标签页样式 ========== */
        .modern-tabs .ant-tabs-nav {
          margin-bottom: 0 !important;
        }

        .modern-tabs .ant-tabs-nav::before {
          border-bottom: none !important;
        }

        .modern-tabs .ant-tabs-tab {
          padding: 12px 28px !important;
          font-size: 14px !important;
          font-weight: 500 !important;
          border-radius: 10px 10px 0 0 !important;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
          background: transparent !important;
          border: none !important;
          position: relative;
          overflow: hidden;
        }

        .modern-tabs .ant-tabs-tab:hover {
          color: #1677ff !important;
          background: rgba(22, 119, 255, 0.04) !important;
        }

        .modern-tabs .ant-tabs-tab-active {
          background: linear-gradient(135deg, #ffffff 0%, #fafbfc 100%) !important;
          color: #1677ff !important;
          box-shadow:
            0 -2px 8px rgba(22, 119, 255, 0.08),
            0 2px 6px rgba(0, 0, 0, 0.04) !important;
        }

        .modern-tabs .ant-tabs-tab-active::after {
          content: '';
          position: absolute;
          bottom: 0;
          left: 50%;
          transform: translateX(-50%);
          width: 60%;
          height: 3px;
          background: linear-gradient(90deg, transparent, #1677ff, transparent);
          border-radius: 2px;
        }

        .modern-tabs .ant-tabs-content-holder {
          background: transparent;
          border-radius: 16px;
          overflow: hidden;
        }

        .modern-tabs .ant-tabs-content {
          background: transparent;
        }

        .modern-tabs .ant-tabs-tabpane {
          padding: 0 !important;
        }

        .modern-tabs .ant-tabs-card > .ant-tabs-nav .ant-tabs-tab-active .ant-tabs-tab-btn {
          color: #1677ff !important;
          font-weight: 600 !important;
        }

        /* ========== 加载状态样式优化 ========== */
        .modern-sprint-page .ant-spin-nested-loading > div > .ant-spin {
          max-height: none;
        }

        .modern-sprint-page .ant-alert {
          border-radius: 12px !important;
          border: none !important;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06) !important;
        }

        /* ========== 响应式设计 ========== */
        @media (max-width: 1400px) {
          .modern-sprint-page {
            padding: 16px 18px;
          }
        }

        @media (max-width: 1200px) {
          .modern-sprint-page {
            padding: 14px 16px;
          }

          .modern-tabs .ant-tabs-tab {
            padding: 10px 20px !important;
            font-size: 13px !important;
          }
        }

        @media (max-width: 768px) {
          .modern-sprint-page {
            padding: 12px;
          }

          .modern-tabs .ant-tabs-tab {
            padding: 8px 14px !important;
            font-size: 12px !important;
          }

          .tabs-container {
            margin-bottom: 16px;
          }
        }

        /* ========== 暗色模式支持（预留） ========== */
        @media (prefers-color-scheme: dark) {
          .modern-sprint-page {
            background: linear-gradient(180deg, #141414 0%, #1f1f1f 100%);
          }

          .modern-tabs .ant-tabs-tab-active {
            background: linear-gradient(135deg, #262626 0%, #1f1f1f 100%) !important;
          }
        }
      `}</style>
    </div>
  );
}
