'use client';

/**
 * 人力负荷页面 - 主页面组件（崩溃修复版）
 *
 * 崩溃根因分析与修复：
 * 1. 页面挂载时所有组件同时渲染 → 分阶段渲染（FilterBar→概览→团队→人员）
 * 2. console.log 在 useMemo 内大量输出 → 已从子组件移除
 * 3. 人员详情面板(日历+图表)与列表同时渲染 → 延迟渲染详情面板
 * 4. Props 每次渲染创建新对象 → useMemo 稳定化
 */

import React, { useState, useCallback, useEffect, useRef, useMemo, useTransition } from 'react';
import { Spin } from 'antd';
import dayjs from 'dayjs';

// 组件导入
import FilterBar from './components/FilterBar';
import OrgOverview from './components/OrgOverview';
import TeamCards from './components/TeamCards';
import PersonSaturationDetail from './components/PersonSaturationDetail';

// Hooks导入
import { useWorkloadOverview } from './hooks/useWorkloadOverview';
import { usePersonList } from './hooks/usePersonList';

// 类型导入
import type {
  WorkloadFilters,
  PersonCard,
} from './types/workload.types';
import type { PersonSatResult } from '../../app/api/v1/workload/_lib/types';

// 工具函数导入
import { getThisMonth } from './utils/date-range';
import {
  COLORS,
} from './utils/design-tokens';

/** 默认每页条数 */
const DEFAULT_PAGE_SIZE = 20;

/** 筛选防抖延迟(ms) */
const FILTER_DEBOUNCE_MS = 300;

/**
 * 将 PersonSatResult (overview返回的精简版) 转换为 PersonCard (前端组件用)
 */
function convertToPersonCard(p: PersonSatResult): PersonCard {
  const avatarColors = ['#1677ff', '#722ed1', '#13c2c2', '#eb2f96', '#fa8c16', '#52c41a'];
  let hash = 0;
  for (let i = 0; i < p.name.length; i++) {
    hash = ((hash << 5) - hash + p.name.charCodeAt(i)) | 0;
  }
  const avatar = avatarColors[Math.abs(hash) % avatarColors.length];

  return {
    name: p.name,
    avatar,
    team: p.teamName,
    project: p.mainProject || p.project || '',
    role: p.role,
    roleName: p.roleName,
    days: p.workDayCount,
    actual: p.totalEffort,
    cap: p.capacity,
    sat: p.saturation,
    loanStatus: p.loanStatus,
    // 传递完整任务数据（用于日历热力图和任务时间线）
    dailyBreakdown: p.dailyBreakdown,
    dailyActualHours: p.dailyActualHours,
    taskList: p.taskList?.map(t => ({
      id: t.id,
      name: t.name,
      workspaceId: t.workspaceId,
      projectName: t.projectName,
      iterationId: t.iterationId,
      iterationName: t.iterationName,
      effort: t.effort,
      effortCompleted: t.effortCompleted,
      begin: t.begin,
      due: t.due,
      status: t.status,
    })),
  };
}

export default function WorkloadPage() {
  // ============================================================
  // 状态管理
  // ============================================================

  // 日期范围状态（默认本月）
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>(() => {
    const range = getThisMonth();
    return [dayjs(range.start), dayjs(range.end)];
  });

  // 筛选条件状态
  const [filters, setFilters] = useState<WorkloadFilters>({});

  // 团队展开状态
  const [expandedTeams, setExpandedTeams] = useState<Set<string>>(new Set());

  // 是否需要从persons接口获取数据
  const [needsFilteredFetch, setNeedsFilteredFetch] = useState(false);

  // 分阶段渲染控制：避免所有组件同时挂载导致浏览器崩溃
  const [showTeamCards, setShowTeamCards] = useState(false);
  const [showPersonDetail, setShowPersonDetail] = useState(false);

  // 低优先级更新（用于非紧急渲染，不阻塞用户交互）
  const [isPending, startTransition] = useTransition();

  // ============================================================
  // Hooks初始化
  // ============================================================

  const {
    org,
    teams,
    roleSummary,
    personSatResults,
    loading: overviewLoading,
    load: loadOverview,
  } = useWorkloadOverview();

  const {
    persons: filteredPersons,
    total,
    loading: personLoading,
    load: loadPersons,
  } = usePersonList();

  // ============================================================
  // 数据加载逻辑
  // ============================================================

  /** 加载概览数据 */
  useEffect(() => {
    if (dateRange && dateRange[0] && dateRange[1]) {
      loadOverview(dateRange[0].format('YYYY-MM-DD'), dateRange[1].format('YYYY-MM-DD'));
      setNeedsFilteredFetch(false);
      // 重置分阶段渲染标记
      setShowTeamCards(false);
      setShowPersonDetail(false);
    }
  }, [dateRange, loadOverview]);

  /**
   * 分阶段渲染控制：
   * - 概览数据就绪后 → 延迟显示团队卡片（给浏览器喘息时间）
   * - 团队卡片显示后 → 再显示人员明细
   */
  const phaseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // 清除之前的定时器
    if (phaseTimerRef.current) {
      clearTimeout(phaseTimerRef.current);
    }

    const isReady = !overviewLoading && org && teams.length > 0;

    if (isReady && !showTeamCards) {
      // 概览就绪 → 100ms后显示团队卡片
      phaseTimerRef.current = setTimeout(() => {
        startTransition(() => {
          setShowTeamCards(true);
        });
      }, 100);
    }

    if (isReady && showTeamCards && !showPersonDetail) {
      // 团队卡片已显示 → 再等200ms后显示人员明细
      phaseTimerRef.current = setTimeout(() => {
        startTransition(() => {
          setShowPersonDetail(true);
        });
      }, 200);
    }

    return () => {
      if (phaseTimerRef.current) {
        clearTimeout(phaseTimerRef.current);
      }
    };
  }, [overviewLoading, org, teams.length, showTeamCards, showPersonDetail, startTransition]);

  /** 防抖后的筛选加载 */
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    const hasActiveFilter =
      filters.teamId || filters.projectId || filters.role || filters.name;

    if (!hasActiveFilter) {
      setNeedsFilteredFetch(false);
      return;
    }

    debounceTimerRef.current = setTimeout(() => {
      if (dateRange && dateRange[0] && dateRange[1]) {
        setNeedsFilteredFetch(true);
        loadPersons(
          dateRange[0].format('YYYY-MM-DD'),
          dateRange[1].format('YYYY-MM-DD'),
          filters,
          1,
          DEFAULT_PAGE_SIZE
        );
      }
    }, FILTER_DEBOUNCE_MS);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [filters, dateRange, loadPersons]);

  // ============================================================
  // 人员数据源选择 + 稳定化Props
  // ============================================================

  const displayPersons = useMemo((): PersonCard[] => {
    if (needsFilteredFetch) {
      return filteredPersons;
    }
    if (personSatResults && personSatResults.length > 0) {
      // 按人名合并：同一人多项目数据合并为一条（人员饱和度明细需要一人一行）
      const cards = personSatResults.map(convertToPersonCard);
      const mergedMap = new Map<string, PersonCard>();
      for (const p of cards) {
        const existing = mergedMap.get(p.name);
        if (existing) {
          // 累加工时和容量
          existing.actualHours += p.actualHours;
          existing.capacityHours += p.capacityHours;
          // 取最高饱和度
          if (p.saturation > existing.saturation) {
            existing.saturation = p.saturation;
          }
          // 合并团队/项目名称（去重）
          if (p.team && !existing.team.includes(p.team)) {
            existing.team = existing.team ? `${existing.team}&${p.team}` : p.team;
          }
          if (p.project && !existing.project.includes(p.project)) {
            existing.project = existing.project ? `${existing.project}&${p.project}` : p.project;
          }
          // 合并每日工时
          if (p.dailyBreakdown) {
            for (const [date, hours] of Object.entries(p.dailyBreakdown)) {
              existing.dailyBreakdown[date] = (existing.dailyBreakdown[date] || 0) + hours;
            }
          }
          // 合并任务列表（去重）
          if (p.taskList) {
            const existingIds = new Set((existing.taskList || []).map(t => t.id));
            for (const t of p.taskList) {
              if (!existingIds.has(t.id)) {
                (existing.taskList ||= []).push(t);
              }
            }
          }
        } else {
          mergedMap.set(p.name, { ...p });
        }
      }
      return Array.from(mergedMap.values());
    }
    return [];
  }, [needsFilteredFetch, filteredPersons, personSatResults]);

  // displayTotal 在 displayPersons 计算后由调用方决定，此处保留兼容
  const displayTotal = useMemo(() => {
    if (needsFilteredFetch) return total;
    // 按人名去重后的数量
    if (personSatResults && personSatResults.length > 0) {
      return new Set(personSatResults.map(p => p.name)).size;
    }
    return 0;
  }, [needsFilteredFetch, total, personSatResults]);

  const isPersonLoading = needsFilteredFetch && personLoading;

  /** 团队数据（memoized） */
  const detailTeams = useMemo(
    () => teams.map((t) => ({
      id: t.teamId,
      name: t.teamName,
      peopleCount: t.peopleCount,
      projectIds: t.projectIds,
      projectName: t.projectName,
    })),
    [teams]
  );

  const stableProjectMap = useMemo(() => new Map(), []);

  const stableDateRange = useMemo<[Date, Date]>(
    () => [dateRange[0]?.toDate() || new Date(), dateRange[1]?.toDate() || new Date()],
    [dateRange]
  );

  // ============================================================
  // 事件处理函数（全部useCallback稳定引用）
  // ============================================================

  const handleDateChange = useCallback((dates: [dayjs.Dayjs, dayjs.Dayjs] | null) => {
    if (dates && dates[0] && dates[1]) {
      setDateRange(dates);
      setFilters({});
    }
  }, []);

  const handleFilterChange = useCallback((newFilters: WorkloadFilters) => {
    setFilters(newFilters);
  }, []);

  const handleReset = useCallback(() => {
    setFilters({});
  }, []);

  const handleTeamToggle = useCallback((teamId: string) => {
    setExpandedTeams((prev) => {
      const next = new Set(prev);
      if (next.has(teamId)) {
        next.delete(teamId);
      } else {
        next.add(teamId);
      }
      return next;
    });
  }, []);

  const handleTeamClick = useCallback((teamId: string) => {
    setFilters((prev) => ({ ...prev, teamId }));
  }, []);

  const handlePersonSelect = useCallback((_name: string) => {
    // 可扩展
  }, []);

  // ============================================================
  // 渲染（分阶段，避免同时渲染所有组件）
  // ============================================================

  const isDataReady = !overviewLoading && org && teams.length > 0;

  return (
    <div style={{
      padding: '28px 32px',
      maxWidth: '1680px',
      minHeight: '100vh',
      background: '#f5f7fa',
    }}>
      {/* ===== 页面标题 ===== */}
      <header style={{ marginBottom: '24px' }}>
        <h1 style={{
          fontSize: '22px',
          fontWeight: 800,
          color: COLORS.textPrimary,
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
        }}>
          <span style={{
            width: '4px',
            height: '24px',
            borderRadius: '2px',
            background: COLORS.primary,
          }} />
          人力负荷分析
        </h1>
        <p style={{
          fontSize: '13px',
          color: COLORS.textTertiary,
          marginTop: '6px',
          marginLeft: '14px',
        }}>
          查看团队和人员的工时饱和度分布情况
        </p>
      </header>

      {/* ===== 筛选器栏（始终显示，轻量组件） ===== */}
      <FilterBar
        dateRange={dateRange}
        teams={teams}
        filters={filters}
        onDateChange={handleDateChange}
        onFilterChange={handleFilterChange}
        onReset={handleReset}
      />

      {/* ===== 加载中状态 ===== */}
      {!isDataReady ? (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '80px 0',
          flexDirection: 'column',
          gap: '16px',
        }}>
          <Spin size="large" />
          <span style={{ color: COLORS.textTertiary, fontSize: '13px' }}>
            正在加载数据...
          </span>
        </div>
      ) : (
        <>
          {/* ===== Section 1: 组织概览区（CSS contain隔离布局计算） ===== */}
          <section style={{
            contain: 'layout style',
            marginBottom: '20px',
          }}>
            <OrgOverview
              org={org!}
              teams={teams}
              roleSummary={roleSummary}
              onTeamClick={handleTeamClick}
              allPersons={personSatResults}
            />
          </section>

          {/* ===== Section 2: 团队卡片列表（分阶段延迟渲染） ===== */}
          {showTeamCards ? (
            <section style={{
              contain: 'layout style',
              marginBottom: '20px',
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                marginBottom: '16px',
                marginTop: '8px',
              }}>
                <h2 style={{
                  fontSize: '17px',
                  fontWeight: 700,
                  color: COLORS.textPrimary,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  margin: 0,
                }}>
                  <span style={{
                    width: '4px',
                    height: '20px',
                    borderRadius: '2px',
                    background: COLORS.primary,
                  }} />
                  团队详情
                </h2>
              </div>

              <TeamCards
                teams={teams}
                expandedTeams={expandedTeams}
                onToggle={handleTeamToggle}
              />
            </section>
          ) : (
            /* 占位：让用户知道还有内容在加载 */
            <div style={{
              padding: '30px 0',
              textAlign: 'center',
              color: COLORS.textTertiary,
              fontSize: '12px',
            }}>
              {isPending ? '正在加载团队数据...' : ''}
            </div>
          )}

          {/* ===== Section 3: 人员饱和度明细（最后渲染，最重的部分） ===== */}
          {showPersonDetail ? (
            <section style={{ contain: 'layout style' }}>
              <PersonSaturationDetail
                persons={displayPersons}
                total={displayTotal}
                loading={isPersonLoading}
                teams={detailTeams}
                projectNameMap={stableProjectMap}
                dateRange={stableDateRange}
                onPersonSelect={handlePersonSelect}
              />
            </section>
          ) : showTeamCards ? (
            <div style={{
              padding: '40px 0',
              textAlign: 'center',
              color: COLORS.textTertiary,
              fontSize: '12px',
            }}>
              {isPending ? '正在加载人员明细...' : ''}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
