'use client';

/**
 * PersonSaturationDetail - 人员饱和度明细组件
 * 完全匹配原型图设计规范 V4 (角色端优化版)
 *
 * 功能特性：
 * - 多选筛选器栏（团队/项目/角色/人员名称）
 * - 左右分栏布局
 *   - 左侧：人员卡片列表（支持排序）
 *   - 右侧：选中人员详情面板
 *     - Tab1: 日历热力图 + 项目工时分布
 *     - Tab2: 任务时间线
 *
 * 页面结构：
 * ┌─────────────────────────────────────────────────────┐
 * │ 筛选器栏 (多选下拉)                                 │
 * ├──────────────────────┬──────────────────────────────┤
 * │ 人员列表 (340px)     │ 详情面板 (flex-1)            │
 * │ ┌─────────────────┐ │ ┌──────────────────────────┐ │
 * │ │ 头部(计数+排序) │ │ │ 头部卡片(头像+统计)      │ │
 * │ ├─────────────────┤ │ ├──────────────────────────┤ │
 * │ │ 人员卡片列表    │ │ │ Tab切换栏                │ │
 * │ │ - 姓名          │ │ ├──────────────────────────┤ │
 * │ │ - 团队/角色     │ │ │ 内容区域                 │ │
 * │ │ - 饱和度        │ │ │ - 日历热力图             │ │
 * │ └─────────────────┘ │ │ - 项目工时分布           │ │
 * │                     │ │ - 任务时间线             │ │
 * │                     │ └──────────────────────────┘ │
 * └──────────────────────┴──────────────────────────────┘
 */

import React, { useState, useMemo, useCallback, useEffect, useRef, lazy, Suspense } from 'react';
import {
  COLORS,
} from '../utils/design-tokens';
import type { PersonCard } from '../types/workload.types';
import { ROLE_COLORS, ROLE_LABELS } from '../utils/saturation';

// 子组件懒加载（仅在用户选中人员时才加载，避免首屏崩溃）
const CalendarHeatmap = lazy(() => import('./CalendarHeatmap'));
const ProjectDistributionChart = lazy(() => import('./ProjectDistributionChart'));

// ============================================================
// 类型定义
// ============================================================

interface PersonSaturationDetailProps {
  /** 人员列表数据 */
  persons: PersonCard[];
  /** 人员总数（分页场景） */
  total?: number;
  /** 是否正在加载筛选结果 */
  loading?: boolean;
  /** 团队数据 */
  teams: Array<{
    id: string;
    name: string;
    peopleCount: number;
    projectIds?: string[];
    projectName?: string[];
  }>;
  /** 项目映射 */
  projectNameMap: Map<string, string>;
  /** 日期范围 */
  dateRange: [Date, Date];
  /** 选中人员变更回调 */
  onPersonSelect?: (personName: string | null) => void;
}

/** 筛选状态类型 */
interface FilterState {
  teams: string[];      // 选中的团队ID列表
  projects: string[];   // 选中的项目ID列表
  roles: string[];      // 选中的角色列表
  persons: string[];    // 选中的人员姓名列表
}

/** 排序字段类型 */
type SortField = 'sat' | 'name';

// ============================================================
// 饱和度颜色工具函数（提取到组件外部，避免每次渲染重建）
// ============================================================

/** 根据饱和度获取颜色 */
const getSatColor = (sat: number): string => {
  if (sat <= 30) return '#52c41a';
  if (sat <= 50) return '#1677ff';
  if (sat <= 70) return '#fa8c16';
  return '#ff4d4f';
};

// ============================================================
// PersonCardItem - 单个人员卡片（React.memo 优化）
// ============================================================

interface PersonCardItemProps {
  person: PersonCard;
  isSelected: boolean;
  onClick: (name: string) => void;
}

/** 纯展示组件，仅在 person 或 isSelected 变化时重渲染 */
const PersonCardItem = React.memo<PersonCardItemProps>(({ person, isSelected, onClick }) => (
  <div
    className={`pcard ${isSelected ? 'active' : ''}`}
    onClick={() => onClick(person.name)}
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      padding: '12px 14px',
      borderRadius: '10px',
      cursor: 'pointer',
      transition: 'all .2s',
      marginBottom: '4px',
      border: isSelected ? `1.5px solid ${COLORS.primary}` : '1.5px solid transparent',
      background: isSelected
        ? 'linear-gradient(135deg,rgba(22,119,255,.04),rgba(114,46,209,.04))'
        : 'transparent',
      boxShadow: isSelected ? '0 2px 12px rgba(22,119,255,.08)' : 'none',
      // 浏览器原生虚拟化：不可见区域不计算布局
      contentVisibility: 'auto',
      containIntrinsicSize: '0 66px',
    }}
    onMouseEnter={(e) => {
      if (!isSelected) {
        e.currentTarget.style.background = '#f5f7fa';
      }
    }}
    onMouseLeave={(e) => {
      if (!isSelected) {
        e.currentTarget.style.background = 'transparent';
      }
    }}
  >
    {/* 头像 */}
    <div
      className="pcard-avatar"
      style={{
        width: '38px',
        height: '38px',
        borderRadius: '10px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '13px',
        fontWeight: 700,
        color: 'white',
        flexShrink: 0,
        background: person.avatar,
      }}
    >
      {person.name.charAt(0)}
    </div>

    {/* 信息 */}
    <div className="pcard-info" style={{ flex: 1, minWidth: 0 }}>
      <div
        className="pcard-name"
        style={{
          fontSize: '13.5px',
          fontWeight: 600,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {person.name}
      </div>
      <div
        className="pcard-meta"
        style={{
          fontSize: '11px',
          color: COLORS.textTertiary,
          marginTop: '2px',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {person.team} · {ROLE_LABELS[person.role]} · {person.project}
      </div>
    </div>

    {/* 饱和度 */}
    <div
      className="pcard-sat"
      style={{
        fontSize: '15px',
        fontWeight: 800,
        minWidth: '42px',
        textAlign: 'right',
        flexShrink: 0,
        fontVariantNumeric: 'tabular-nums',
        color: getSatColor(person.sat),
      }}
    >
      {person.sat}%
    </div>
  </div>
));

PersonCardItem.displayName = 'PersonCardItem';

// ============================================================
// 主组件
// ============================================================

/** 初始可见人员数量（防止大量数据一次性渲染导致浏览器崩溃） */
const INITIAL_VISIBLE_COUNT = 20;

const PersonSaturationDetail: React.FC<PersonSaturationDetailProps> = ({
  persons,
  total: propTotal,
  loading = false,
  teams,
  projectNameMap,
  dateRange,
  onPersonSelect,
}) => {
  // ============================================================
  // 状态管理
  // ============================================================

  // 筛选状态
  const [filters, setFilters] = useState<FilterState>({
    teams: [],
    projects: [],
    roles: [],
    persons: [],
  });

  // 排序状态
  const [sortField, setSortField] = useState<SortField>('sat');

  // 选中的人员姓名
  const [selectedPersonName, setSelectedPersonName] = useState<string | null>(null);

  /** 可见人员数量（渐进式加载） */
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE_COUNT);

  /** 内部分阶段渲染：先显示标题+筛选栏，再显示列表，避免首屏过重 */
  const [showList, setShowList] = useState(false);

  // 当前激活的Tab
  const [activeTab, setActiveTab] = useState<'saturation' | 'timeline'>('saturation');

  // 下拉菜单状态
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);

  // 搜索关键词
  const [searchKeyword, setSearchKeyword] = useState('');

  // ============================================================
  // 数据处理
  // ============================================================

  /**
   * 获取所有项目列表（从teams中提取）
   */
  const allProjects = useMemo(() => {
    const projects: Array<{ id: string; name: string; teamId: string; teamName: string }> = [];
    teams.forEach((team) => {
      (team.projectIds || []).forEach((projectId, index) => {
        projects.push({
          id: projectId,
          name: team.projectName?.[index] || projectId,
          teamId: team.id,
          teamName: team.name,
        });
      });
    });
    return projects;
  }, [teams]);

  /**
   * 角色选项列表
   */
  const roleOptions = [
    { key: 'frontend', label: '前端开发' },
    { key: 'backend', label: '后端开发' },
    { key: 'mobile', label: '移动端开发' },
    { key: 'test', label: '测试工程师' },
  ];

  /**
   * 过滤后的人员列表
   */
  const filteredPersons = useMemo(() => {
    let result = [...persons];

    // 团队筛选
    if (filters.teams.length > 0) {
      const selectedTeamNames = teams
        .filter((t) => filters.teams.includes(t.id))
        .map((t) => t.name);
      result = result.filter((p) => selectedTeamNames.includes(p.team));
    }

    // 项目筛选
    if (filters.projects.length > 0) {
      result = result.filter((p) =>
        filters.projects.some((pid) => p.project === pid)
      );
    }

    // 角色筛选
    if (filters.roles.length > 0) {
      result = result.filter((p) => filters.roles.includes(p.role));
    }

    // 人员姓名筛选
    if (filters.persons.length > 0) {
      result = result.filter((p) => filters.persons.includes(p.name));
    }

    // 排序
    if (sortField === 'sat') {
      result.sort((a, b) => b.sat - a.sat);
    } else {
      result.sort((a, b) => a.name.localeCompare(b.name));
    }

    return result;
  }, [persons, filters, sortField, teams]);

  /**
   * 统计信息
   */
  const stats = useMemo(() => {
    const total = propTotal ?? filteredPersons.length;
    const avgSat =
      total > 0
        ? Math.round(filteredPersons.reduce((sum, p) => sum + p.sat, 0) / total)
        : 0;
    const highSatCount = filteredPersons.filter((p) => p.sat >= 70).length;
    const loanCount = filteredPersons.filter((p) => p.loanStatus).length;

    return { total, avgSat, highSatCount, loanCount };
  }, [filteredPersons, propTotal]);

  /**
   * 获取选中人员的详细信息
   */
  const selectedPerson = useMemo(
    () => persons.find((p) => p.name === selectedPersonName),
    [persons, selectedPersonName]
  );

  // ============================================================
  // 事件处理函数
  // ============================================================

  /** 切换下拉菜单 */
  const toggleDropdown = useCallback((type: string) => {
    setActiveDropdown((prev) => (prev === type ? null : type));
  }, []);

  /** 切换筛选选项 */
  const toggleFilterOption = useCallback(
    (type: keyof FilterState, value: string) => {
      setFilters((prev) => {
        const currentList = prev[type];
        const newList = currentList.includes(value)
          ? currentList.filter((v) => v !== value)
          : [...currentList, value];
        return { ...prev, [type]: newList };
      });
    },
    []
  );

  /** 清空某个筛选项 */
  const clearFilter = useCallback((type: keyof FilterState) => {
    setFilters((prev) => ({ ...prev, [type]: [] }));
  }, []);

  /** 应用筛选 */
  const applyFilter = useCallback(() => {
    // 筛选已通过filteredPersons自动计算
  }, [filters]);

  /** 选择人员 */
  const handlePersonClick = useCallback(
    (name: string) => {
      setSelectedPersonName(name);
      setActiveTab('saturation'); // 重置到第一个Tab
      onPersonSelect?.(name);
    },
    [onPersonSelect]
  );

  /** 切换排序 */
  const handleSortChange = useCallback((field: SortField) => {
    setSortField(field);
  }, []);

  /** 切换Tab */
  const handleTabChange = useCallback((tab: 'saturation' | 'timeline') => {
    setActiveTab(tab);
  }, []);

  /** 点击外部关闭下拉菜单 */
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.pf-select-wrap') && activeDropdown) {
        setActiveDropdown(null);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [activeDropdown]);

  // 内部分阶段渲染：组件挂载后延迟显示人员列表
  // 避免标题+筛选栏+列表+详情面板同时渲染导致崩溃
  const listPhaseRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (listPhaseRef.current) clearTimeout(listPhaseRef.current);
    if (!showList && persons.length > 0) {
      listPhaseRef.current = setTimeout(() => {
        setShowList(true);
      }, 300);
    }
    return () => { if (listPhaseRef.current) clearTimeout(listPhaseRef.current); };
  }, [persons.length, showList]);

  // ============================================================
  // 渲染辅助函数
  // ============================================================

  /** 获取日历热力图颜色（getSatColor 已提取到组件外部） */
  const getCalendarColor = (sat: number): string => {
    if (sat === 0 || !sat) return '#e8e8e8'; // 休息或无数据
    if (sat <= 30) return '#f0f5ff';
    if (sat <= 50) return '#bae0ff';
    if (sat <= 70) return '#69b1ff';
    if (sat <= 90) return '#1890ff';
    return '#0050b3';
  };

  // ============================================================
  // 渲染
  // ============================================================

  return (
    <div className="detail-section" style={{ marginBottom: '28px' }}>
      {/* ===== 区域标题 + 统计信息 ===== */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '16px',
        }}
      >
        <h2
          style={{
            fontSize: '19px',
            fontWeight: 700,
            color: COLORS.textPrimary,
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            margin: 0,
          }}
        >
          <span
            style={{
              width: '4px',
              height: '22px',
              borderRadius: '2px',
              background: COLORS.primary,
            }}
          />
          人员饱和度明细
        </h2>
        <div
          className="person-stats-inline"
          style={{ display: 'flex', gap: '16px', fontSize: '12px', color: COLORS.textTertiary }}
        >
          <span>
            平均饱和度:{' '}
            <strong style={{ color: COLORS.primary }}>{stats.avgSat}%</strong>
          </span>
          <span>
            高饱和(≥70%):{' '}
            <strong style={{ color: COLORS.primary }}>{stats.highSatCount}人</strong>
          </span>
          <span>
            借调中:{' '}
            <strong style={{ color: COLORS.primary }}>{stats.loanCount}人</strong>
          </span>
        </div>
      </div>

      {/* ===== 多选筛选器栏 ===== */}
      <div
        className="person-filter-bar"
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: '14px',
          padding: '18px 22px',
          background: '#fff',
          borderRadius: '16px',
          border: `1px solid ${COLORS.borderLight}`,
          marginBottom: '20px',
          boxShadow: '0 1px 4px rgba(0,0,0,.05)',
          flexWrap: 'wrap',
        }}
      >
        {/* 团队选择 */}
        <div className="pf-field" style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
          <label className="pf-label" style={{ fontSize: '11.5px', fontWeight: 600, color: COLORS.textTertiary }}>
            团队
          </label>
          <div className="pf-select-wrap" style={{ position: 'relative' }}>
            <button
              className="pf-trigger"
              onClick={() => toggleDropdown('team')}
              style={{
                height: '36px',
                borderRadius: '8px',
                border: `1px solid ${COLORS.border}`,
                padding: '0 12px',
                fontSize: '13px',
                background: '#fff',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                minWidth: '150px',
                transition: 'all .2s',
              }}
            >
              <span className="pf-text" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '200px' }}>
                {filters.teams.length > 0 ? `已选 ${filters.teams.length} 项` : '全部团队'}
              </span>
              <span className="pf-arrow" style={{ fontSize: '10px', color: COLORS.textTertiary, marginLeft: '6px' }}>▼</span>
            </button>

            {/* 下拉选项 */}
            <div
              className={`pf-dropdown ${activeDropdown === 'team' ? 'active' : ''}`}
              style={{
                position: 'absolute',
                top: 'calc(100% + 4px)',
                left: 0,
                width: '260px',
                background: '#fff',
                borderRadius: '12px',
                border: `1px solid ${COLORS.borderLight}`,
                boxShadow: '0 12px 40px rgba(0,0,0,.12)',
                zIndex: 100,
                display: activeDropdown === 'team' ? 'block' : 'none',
                overflow: 'hidden',
              }}
            >
              <div className="pf-options" style={{ maxHeight: '220px', overflowY: 'auto', padding: '6px' }}>
                {teams.map((team) => (
                  <div
                    key={team.id}
                    className={`pf-opt ${filters.teams.includes(team.id) ? 'selected' : ''}`}
                    onClick={() => toggleFilterOption('teams', team.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '8px 10px',
                      borderRadius: '7px',
                      cursor: 'pointer',
                      fontSize: '13px',
                      transition: 'background .15s',
                      background: filters.teams.includes(team.id) ? 'rgba(22,119,255,.06)' : 'transparent',
                    }}
                  >
                    <span
                      className="pf-checkbox"
                      style={{
                        width: '16px',
                        height: '16px',
                        borderRadius: '4px',
                        border: `2px solid ${filters.teams.includes(team.id) ? COLORS.primary : '#d9d9d9'}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: filters.teams.includes(team.id) ? COLORS.primary : 'transparent',
                        color: 'white',
                        fontSize: '11px',
                      }}
                    >
                      {filters.teams.includes(team.id) && '✓'}
                    </span>
                    {team.name} ({team.peopleCount}人)
                  </div>
                ))}
              </div>
              <div
                className="pf-footer"
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  padding: '8px 12px',
                  borderTop: `1px solid ${COLORS.borderLight}`,
                }}
              >
                <button
                  className="pf-clear-btn"
                  onClick={() => clearFilter('teams')}
                  style={{
                    fontSize: '12px',
                    color: '#ff4d4f',
                    cursor: 'pointer',
                    background: 'none',
                    border: 'none',
                    fontWeight: 600,
                  }}
                >
                  清空
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* TAPD项目选择 */}
        <div className="pf-field" style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
          <label className="pf-label" style={{ fontSize: '11.5px', fontWeight: 600, color: COLORS.textTertiary }}>
            TAPD项目
          </label>
          <div className="pf-select-wrap" style={{ position: 'relative' }}>
            <button
              className="pf-trigger"
              onClick={() => toggleDropdown('project')}
              style={{
                height: '36px',
                borderRadius: '8px',
                border: `1px solid ${COLORS.border}`,
                padding: '0 12px',
                fontSize: '13px',
                background: '#fff',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                minWidth: '150px',
                transition: 'all .2s',
              }}
            >
              <span className="pf-text">
                {filters.projects.length > 0 ? `已选 ${filters.projects.length} 项` : '全部项目'}
              </span>
              <span className="pf-arrow" style={{ fontSize: '10px', color: COLORS.textTertiary, marginLeft: '6px' }}>▼</span>
            </button>

            <div
              className={`pf-dropdown ${activeDropdown === 'project' ? 'active' : ''}`}
              style={{
                position: 'absolute',
                top: 'calc(100% + 4px)',
                left: 0,
                width: '280px',
                background: '#fff',
                borderRadius: '12px',
                border: `1px solid ${COLORS.borderLight}`,
                boxShadow: '0 12px 40px rgba(0,0,0,.12)',
                zIndex: 100,
                display: activeDropdown === 'project' ? 'block' : 'none',
                overflow: 'hidden',
              }}
            >
              <div className="pf-search" style={{ padding: '10px', borderBottom: `1px solid ${COLORS.borderLight}` }}>
                <input
                  type="text"
                  placeholder="搜索项目..."
                  className="pf-input"
                  style={{
                    width: '100%',
                    height: '32px',
                    borderRadius: '7px',
                    border: `1px solid ${COLORS.border}`,
                    padding: '0 10px',
                    fontSize: '12.5px',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
              <div className="pf-options" style={{ maxHeight: '220px', overflowY: 'auto', padding: '6px' }}>
                {allProjects.map((proj) => (
                  <div
                    key={proj.id}
                    className={`pf-opt ${filters.projects.includes(proj.id) ? 'selected' : ''}`}
                    onClick={() => toggleFilterOption('projects', proj.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '8px 10px',
                      borderRadius: '7px',
                      cursor: 'pointer',
                      fontSize: '13px',
                      transition: 'background .15s',
                      background: filters.projects.includes(proj.id) ? 'rgba(22,119,255,.06)' : 'transparent',
                    }}
                  >
                    <span
                      className="pf-checkbox"
                      style={{
                        width: '16px',
                        height: '16px',
                        borderRadius: '4px',
                        border: `2px solid ${filters.projects.includes(proj.id) ? COLORS.primary : '#d9d9d9'}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: filters.projects.includes(proj.id) ? COLORS.primary : 'transparent',
                        color: 'white',
                        fontSize: '11px',
                      }}
                    >
                      {filters.projects.includes(proj.id) && '✓'}
                    </span>
                    {proj.name}
                    <span style={{ marginLeft: 'auto', color: '#bbb', fontSize: '11px' }}>({proj.teamName})</span>
                  </div>
                ))}
              </div>
              <div
                className="pf-footer"
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  padding: '8px 12px',
                  borderTop: `1px solid ${COLORS.borderLight}`,
                }}
              >
                <button
                  className="pf-clear-btn"
                  onClick={() => clearFilter('projects')}
                  style={{ fontSize: '12px', color: '#ff4d4f', cursor: 'pointer', background: 'none', border: 'none', fontWeight: 600 }}
                >
                  清空
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 角色端选择 */}
        <div className="pf-field" style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
          <label className="pf-label" style={{ fontSize: '11.5px', fontWeight: 600, color: COLORS.textTertiary }}>
            角色端
          </label>
          <div className="pf-select-wrap" style={{ position: 'relative' }}>
            <button
              className="pf-trigger"
              onClick={() => toggleDropdown('role')}
              style={{
                height: '36px',
                borderRadius: '8px',
                border: `1px solid ${COLORS.border}`,
                padding: '0 12px',
                fontSize: '13px',
                background: '#fff',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                minWidth: '150px',
                transition: 'all .2s',
              }}
            >
              <span className="pf-text">
                {filters.roles.length > 0 ? `已选 ${filters.roles.length} 项` : '全部角色'}
              </span>
              <span className="pf-arrow" style={{ fontSize: '10px', color: COLORS.textTertiary, marginLeft: '6px' }}>▼</span>
            </button>

            <div
              className={`pf-dropdown ${activeDropdown === 'role' ? 'active' : ''}`}
              style={{
                position: 'absolute',
                top: 'calc(100% + 4px)',
                left: 0,
                width: '200px',
                background: '#fff',
                borderRadius: '12px',
                border: `1px solid ${COLORS.borderLight}`,
                boxShadow: '0 12px 40px rgba(0,0,0,.12)',
                zIndex: 100,
                display: activeDropdown === 'role' ? 'block' : 'none',
                overflow: 'hidden',
              }}
            >
              <div className="pf-options" style={{ padding: '6px' }}>
                {roleOptions.map((role) => (
                  <div
                    key={role.key}
                    className={`pf-opt ${filters.roles.includes(role.key) ? 'selected' : ''}`}
                    onClick={() => toggleFilterOption('roles', role.key)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '8px 10px',
                      borderRadius: '7px',
                      cursor: 'pointer',
                      fontSize: '13px',
                      transition: 'background .15s',
                      background: filters.roles.includes(role.key) ? 'rgba(22,119,255,.06)' : 'transparent',
                    }}
                  >
                    <span
                      className="pf-checkbox"
                      style={{
                        width: '16px',
                        height: '16px',
                        borderRadius: '4px',
                        border: `2px solid ${filters.roles.includes(role.key) ? COLORS.primary : '#d9d9d9'}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: filters.roles.includes(role.key) ? COLORS.primary : 'transparent',
                        color: 'white',
                        fontSize: '11px',
                      }}
                    >
                      {filters.roles.includes(role.key) && '✓'}
                    </span>
                    {role.label}
                  </div>
                ))}
              </div>
              <div
                className="pf-footer"
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  padding: '8px 12px',
                  borderTop: `1px solid ${COLORS.borderLight}`,
                }}
              >
                <button
                  className="pf-clear-btn"
                  onClick={() => clearFilter('roles')}
                  style={{ fontSize: '12px', color: '#ff4d4f', cursor: 'pointer', background: 'none', border: 'none', fontWeight: 600 }}
                >
                  清空
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 人员名称搜索 */}
        <div className="pf-field pf-wide" style={{ display: 'flex', flexDirection: 'column', gap: '5px', flex: 1, minWidth: '180px' }}>
          <label className="pf-label" style={{ fontSize: '11.5px', fontWeight: 600, color: COLORS.textTertiary }}>
            人员名称
          </label>
          <div className="pf-select-wrap" style={{ position: 'relative' }}>
            <button
              className="pf-trigger"
              onClick={() => toggleDropdown('person')}
              style={{
                height: '36px',
                borderRadius: '8px',
                border: `1px solid ${COLORS.border}`,
                padding: '0 12px',
                fontSize: '13px',
                background: '#fff',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                minWidth: '180px',
                transition: 'all .2s',
              }}
            >
              <span className="pf-text">
                {searchKeyword || '搜索人员...'}
              </span>
              <span className="pf-arrow" style={{ fontSize: '10px', color: COLORS.textTertiary, marginLeft: '6px' }}>▼</span>
            </button>

            <div
              className={`pf-dropdown ${activeDropdown === 'person' ? 'active' : ''}`}
              style={{
                position: 'absolute',
                top: 'calc(100% + 4px)',
                left: 0,
                width: '280px',
                background: '#fff',
                borderRadius: '12px',
                border: `1px solid ${COLORS.borderLight}`,
                boxShadow: '0 12px 40px rgba(0,0,0,.12)',
                zIndex: 100,
                display: activeDropdown === 'person' ? 'block' : 'none',
                overflow: 'hidden',
              }}
            >
              <div className="pf-search" style={{ padding: '10px', borderBottom: `1px solid ${COLORS.borderLight}` }}>
                <input
                  type="text"
                  placeholder="输入姓名搜索..."
                  className="pf-input"
                  value={searchKeyword}
                  onChange={(e) => setSearchKeyword(e.target.value)}
                  style={{
                    width: '100%',
                    height: '32px',
                    borderRadius: '7px',
                    border: `1px solid ${COLORS.border}`,
                    padding: '0 10px',
                    fontSize: '12.5px',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
              <div className="pf-options" style={{ maxHeight: '220px', overflowY: 'auto', padding: '6px' }}>
                {persons
                  .filter((p) => p.name.toLowerCase().includes(searchKeyword.toLowerCase()))
                  .map((person) => (
                    <div
                      key={person.name}
                      className={`pf-opt ${filters.persons.includes(person.name) ? 'selected' : ''}`}
                      onClick={() => toggleFilterOption('persons', person.name)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '8px 10px',
                        borderRadius: '7px',
                        cursor: 'pointer',
                        fontSize: '13px',
                        transition: 'background .15s',
                        background: filters.persons.includes(person.name) ? 'rgba(22,119,255,.06)' : 'transparent',
                      }}
                    >
                      <span
                        className="pf-checkbox"
                        style={{
                          width: '16px',
                          height: '16px',
                          borderRadius: '4px',
                          border: `2px solid ${filters.persons.includes(person.name) ? COLORS.primary : '#d9d9d9'}`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: filters.persons.includes(person.name) ? COLORS.primary : 'transparent',
                          color: 'white',
                          fontSize: '11px',
                        }}
                      >
                        {filters.persons.includes(person.name) && '✓'}
                      </span>
                      {person.name}
                      <span style={{ marginLeft: 'auto', color: '#bbb', fontSize: '11px' }}>{person.team}</span>
                    </div>
                  ))}
              </div>
              <div
                className="pf-footer"
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  padding: '8px 12px',
                  borderTop: `1px solid ${COLORS.borderLight}`,
                }}
              >
                <button
                  className="pf-clear-btn"
                  onClick={() => {
                    clearFilter('persons');
                    setSearchKeyword('');
                  }}
                  style={{ fontSize: '12px', color: '#ff4d4f', cursor: 'pointer', background: 'none', border: 'none', fontWeight: 600 }}
                >
                  清空
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 筛选按钮 */}
        <button
          className="btn-primary"
          onClick={applyFilter}
          style={{
            height: '38px',
            marginTop: 'auto',
            padding: '0 26px',
            background: COLORS.primary,
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '13.5px',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all .2s',
            whiteSpace: 'nowrap',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '7px',
          }}
        >
          🔄 筛选
        </button>
      </div>

      {/* ===== 左右分栏布局 ===== */}
      <div
        className="person-detail-layout"
        style={{
          display: 'grid',
          gridTemplateColumns: '340px 1fr',
          gap: '20px',
        }}
      >
        {/* ========== 左侧：人员列表面板 ========== */}
        <div
          className="person-list-panel"
          style={{
            background: '#fff',
            borderRadius: '16px',
            border: `1px solid ${COLORS.borderLight}`,
            maxHeight: '800px',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 1px 4px rgba(0,0,0,.05)',
          }}
        >
          {/* 面板头部 */}
          <div
            className="plp-header"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '16px 18px',
              borderBottom: `1px solid ${COLORS.borderLight}`,
            }}
          >
            <span className="plp-count" style={{ fontSize: '13px', fontWeight: 600, color: COLORS.textSecondary }}>
              {stats.total} 人
            </span>
            <div className="plp-sort" style={{ display: 'flex', gap: '4px' }}>
              <button
                className={`ps-btn ${sortField === 'sat' ? 'active' : ''}`}
                onClick={() => handleSortChange('sat')}
                style={{
                  padding: '4px 10px',
                  borderRadius: '6px',
                  fontSize: '11.5px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  border: '1px solid transparent',
                  background: sortField === 'sat' ? COLORS.primary : 'transparent',
                  color: sortField === 'sat' ? 'white' : COLORS.textTertiary,
                  transition: 'all .15s',
                }}
              >
                饱和度 ↓
              </button>
              <button
                className={`ps-btn ${sortField === 'name' ? 'active' : ''}`}
                onClick={() => handleSortChange('name')}
                style={{
                  padding: '4px 10px',
                  borderRadius: '6px',
                  fontSize: '11.5px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  border: '1px solid transparent',
                  background: sortField === 'name' ? COLORS.primary : 'transparent',
                  color: sortField === 'name' ? 'white' : COLORS.textTertiary,
                  transition: 'all .15s',
                }}
              >
                姓名
              </button>
            </div>
          </div>

          {/* 人员卡片列表（渐进式渲染 + React.memo + content-visibility） */}
          <div
            className="person-card-list"
            style={{ overflowY: 'auto', padding: '8px', flex: 1 }}
            onScroll={(e) => {
              if (!showList) return;
              const target = e.currentTarget;
              if (target.scrollHeight - target.scrollTop - target.clientHeight < 50) {
                setVisibleCount((prev) =>
                  Math.min(prev + INITIAL_VISIBLE_COUNT, filteredPersons.length)
                );
              }
            }}
          >
            {!showList ? (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '40px 0',
                color: COLORS.textTertiary,
                fontSize: '13px',
              }}>
                <span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>⏳</span>
                加载人员列表...
              </div>
            ) : loading ? (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '40px 0',
                color: COLORS.textTertiary,
                fontSize: '13px',
                gap: '8px',
              }}>
                <span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>⏳</span>
                筛选中...
              </div>
            ) : filteredPersons.length === 0 ? (
              <div style={{
                textAlign: 'center',
                padding: '40px 0',
                color: COLORS.textTertiary,
                fontSize: '13px',
              }}>
                暂无匹配人员
              </div>
            ) : (
              <>
                {/* 只渲染可见数量的人员卡片 */}
                {filteredPersons.slice(0, visibleCount).map((person) => (
                  <PersonCardItem
                    key={person.name}
                    person={person}
                    isSelected={selectedPersonName === person.name}
                    onClick={handlePersonClick}
                  />
                ))}
                {/* 加载更多按钮 */}
                {visibleCount < filteredPersons.length && (
                  <button
                    onClick={() =>
                      setVisibleCount((prev) =>
                        Math.min(prev + INITIAL_VISIBLE_COUNT, filteredPersons.length)
                      )
                    }
                    style={{
                      display: 'block',
                      width: '100%',
                      padding: '10px',
                      margin: '8px 0',
                      border: `1px dashed ${COLORS.border}`,
                      borderRadius: '8px',
                      background: 'transparent',
                      color: COLORS.primary,
                      cursor: 'pointer',
                      fontSize: '12.5px',
                      fontWeight: 600,
                    }}
                  >
                    展示更多 ({visibleCount}/{filteredPersons.length})
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* ========== 右侧：详情面板 ========== */}
        <div
          className="person-detail-panel"
          style={{
            background: '#fff',
            borderRadius: '16px',
            border: `1px solid ${COLORS.borderLight}`,
            minHeight: '600px',
            boxShadow: '0 1px 4px rgba(0,0,0,.05)',
            overflowY: 'auto',
          }}
        >
          {!selectedPerson ? (
            /* 空状态 */
            <div
              className="pdp-empty"
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '500px',
                color: COLORS.textTertiary,
              }}
            >
              <div className="pdp-empty-icon" style={{ fontSize: '48px', marginBottom: '16px', opacity: 0.3 }}>
                📋
              </div>
              <div className="pdp-empty-text" style={{ textAlign: 'center', lineHeight: 1.8, fontSize: '14px' }}>
                点击左侧人员卡片查看<br />
                每日饱和度、参与项目和任务明细
              </div>
            </div>
          ) : (
            /* 人员详情内容 */
            <div className="pdp-content">
              {/* 人员头部卡片 */}
              <div
                className="pdp-header-card"
                style={{
                  background: 'linear-gradient(135deg,#f0f5ff,#e6f4ff)',
                  borderRadius: '14px 14px 0 0',
                  padding: '24px 28px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '18px',
                  borderBottom: '1px solid rgba(22,119,255,.08)',
                }}
              >
                {/* 大头像 */}
                <div
                  className="pdp-avatar-lg"
                  style={{
                    width: '56px',
                    height: '56px',
                    borderRadius: '14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '19px',
                    fontWeight: 700,
                    color: 'white',
                    background: selectedPerson.avatar,
                  }}
                >
                  {selectedPerson.name.charAt(0)}
                </div>

                {/* 信息 */}
                <div className="pdp-info">
                  <h3 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 4px 0' }}>
                    {selectedPerson.name}
                  </h3>
                  <div className="pdp-info-sub" style={{ fontSize: '13px', color: COLORS.textSecondary }}>
                    {selectedPerson.team} · {selectedPerson.project} · {ROLE_LABELS[selectedPerson.role]}
                    {selectedPerson.loanStatus && (
                      <span style={{ color: '#fa8c14', marginLeft: '6px' }}>🔒 {selectedPerson.loanStatus}</span>
                    )}
                  </div>
                </div>

                {/* 统计数字 */}
                <div className="pdp-header-stats" style={{ display: 'flex', gap: '20px', marginLeft: 'auto' }}>
                  <div className="phs-item" style={{ textAlign: 'center' }}>
                    <div className="phs-val" style={{ fontSize: '20px', fontWeight: 800, color: getSatColor(selectedPerson.sat) }}>
                      {selectedPerson.sat}%
                    </div>
                    <div className="phs-lbl" style={{ fontSize: '11px', color: COLORS.textTertiary }}>饱和度</div>
                  </div>
                  <div className="phs-item" style={{ textAlign: 'center' }}>
                    <div className="phs-val" style={{ fontSize: '20px', fontWeight: 800, color: COLORS.primary }}>
                      {selectedPerson.actual}<small>h</small>
                    </div>
                    <div className="phs-lbl" style={{ fontSize: '11px', color: COLORS.textTertiary }}>实际投入</div>
                  </div>
                  <div className="phs-item" style={{ textAlign: 'center' }}>
                    <div className="phs-val" style={{ fontSize: '20px', fontWeight: 800, color: '#52c41a' }}>
                      {selectedPerson.cap}<small>h</small>
                    </div>
                    <div className="phs-lbl" style={{ fontSize: '11px', color: COLORS.textTertiary }}>容量上限</div>
                  </div>
                  <div className="phs-item" style={{ textAlign: 'center' }}>
                    <div className="phs-val" style={{ fontSize: '20px', fontWeight: 800 }}>
                      {selectedPerson.days}<small>天</small>
                    </div>
                    <div className="phs-lbl" style={{ fontSize: '11px', color: COLORS.textTertiary }}>可用天数</div>
                  </div>
                </div>
              </div>

              {/* Tab切换栏（下划线式 - 按原型100%还原） */}
              <div
                className="pdp-tab-bar"
                style={{
                  display: 'flex',
                  gap: 0,
                  borderBottom: `2px solid ${COLORS.borderLight}`,
                  marginBottom: '16px',
                  padding: '0 28px',
                }}
              >
                <div
                  className={`pdp-tab ${activeTab === 'saturation' ? 'active' : ''}`}
                  onClick={() => handleTabChange('saturation')}
                  style={{
                    padding: '10px 20px',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: activeTab === 'saturation' ? COLORS.primary : COLORS.textTertiary,
                    borderBottom: activeTab === 'saturation' ? `2px solid ${COLORS.primary}` : '2px solid transparent',
                    marginBottom: '-2px',
                    transition: 'all .2s',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <span className="pdp-tab-icon" style={{ fontSize: '15px' }}>📅</span>
                  每日饱和度分布
                  <span className="pdp-tab-count" style={{
                    fontSize: '10px',
                    background: 'rgba(22,119,255,.1)',
                    color: COLORS.primary,
                    padding: '1px 7px',
                    borderRadius: '10px',
                    fontWeight: 800,
                  }}>
                    {selectedPerson.days || 31}天
                  </span>
                </div>
                <div
                  className={`pdp-tab ${activeTab === 'timeline' ? 'active' : ''}`}
                  onClick={() => handleTabChange('timeline')}
                  style={{
                    padding: '10px 20px',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: activeTab === 'timeline' ? COLORS.primary : COLORS.textTertiary,
                    borderBottom: activeTab === 'timeline' ? `2px solid ${COLORS.primary}` : '2px solid transparent',
                    marginBottom: '-2px',
                    transition: 'all .2s',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <span className="pdp-tab-icon" style={{ fontSize: '15px' }}>📝</span>
                  任务时间线
                  <span className="pdp-tab-count" style={{
                    fontSize: '10px',
                    background: 'rgba(22,119,255,.1)',
                    color: COLORS.primary,
                    padding: '1px 7px',
                    borderRadius: '10px',
                    fontWeight: 800,
                  }}>
                    {(() => {
                      const raw = selectedPerson.taskList || [];
                      const rs = dateRange[0] ? (typeof dateRange[0].format === 'function' ? dateRange[0].format('YYYY-MM-DD') : new Date(dateRange[0]).toISOString().slice(0, 10)) : null;
                      const re = dateRange[1] ? (typeof dateRange[1].format === 'function' ? dateRange[1].format('YYYY-MM-DD') : new Date(dateRange[1]).toISOString().slice(0, 10)) : null;
                      return raw.filter(t => t.begin && t.due && (!rs || !re || (
                        (typeof t.begin.format === 'function' ? t.begin.format('YYYY-MM-DD') : new Date(t.begin).toISOString().slice(0, 10)) <= re &&
        (typeof t.due.format === 'function' ? t.due.format('YYYY-MM-DD') : new Date(t.due).toISOString().slice(0, 10)) >= rs
      ))).length + '个';
                    })()}
                  </span>
                </div>
              </div>

              {/* Tab内容区域 */}
              {activeTab === 'saturation' ? (
                /* Tab1: 饱和度分布 */
                <div className="pdp-tab-panel active">
                  {/* 日历热力图（懒加载，仅在选中人员时加载） */}
                  <div className="pdp-section" style={{ padding: '20px 28px', borderBottom: `1px solid ${COLORS.borderLight}` }}>
                    <Suspense fallback={
                      <div style={{ textAlign: 'center', padding: '40px', color: COLORS.textTertiary, fontSize: '13px' }}>
                        加载日历热力图...
                      </div>
                    }>
                      <CalendarHeatmap
                        person={selectedPerson}
                        dateRange={dateRange}
                      />
                    </Suspense>
                  </div>

                  {/* 项目工时分布（懒加载） */}
                  <div className="pdp-section" style={{ padding: '20px 28px' }}>
                    <Suspense fallback={
                      <div style={{ textAlign: 'center', padding: '40px', color: COLORS.textTertiary, fontSize: '13px' }}>
                        加载项目分布图...
                      </div>
                    }>
                      <ProjectDistributionChart
                        person={selectedPerson}
                      />
                    </Suspense>
                  </div>
                </div>
              ) : (
                /* Tab2: 任务时间线 */
                <div className="pdp-tab-panel">
                  <div className="pdp-section" style={{ padding: '20px 28px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                      <h4 className="pdp-sec-title" style={{ margin: 0, fontSize: '13px' }}>
                        跨天任务明细
                      </h4>
                      <span className="timeline-range-info" style={{ fontSize: '12px', color: COLORS.textTertiary }}>
                        {dateRange[0]?.toLocaleDateString()} ~ {dateRange[1]?.toLocaleDateString()}
                      </span>
                    </div>

                    {/* 任务时间线（基于真实taskList数据） */}
                    {(() => {
                      const rawTasks = selectedPerson.taskList || [];
                      // 用字符串比较避免时区BUG：只取日期部分 YYYY-MM-DD（兼容Date和dayjs）
                      const fmtLocal = (d: any): string => {
                        if (!d) return '';
                        // 兼容 dayjs 对象（有 format 方法）和原生 Date
                        if (typeof d.format === 'function') return d.format('YYYY-MM-DD');
                        if (typeof d.toDate === 'function') return d.toDate().toISOString().slice(0, 10);
                        if (typeof d.getFullYear === 'function') {
                          const y = d.getFullYear();
                          const m = String(d.getMonth() + 1).padStart(2, '0');
                          const dd = String(d.getDate()).padStart(2, '0');
                          return `${y}-${m}-${dd}`;
                        }
                        // fallback: 尝试转字符串
                        return String(d).slice(0, 10);
                      };
                      const rangeStartStr = dateRange[0] ? fmtLocal(dateRange[0]) : null;
                      const rangeEndStr = dateRange[1] ? fmtLocal(dateRange[1]) : null;

                      // 过滤规则1：去除无预计开始/预计结束日期的任务
                      // 规则2：只保留与查询周期有交集的任务
                      const tasks = rawTasks.filter((task) => {
                        if (!task.begin || !task.due) return false;
                        if (!rangeStartStr || !rangeEndStr) return true;
                        const beginStr = fmtLocal(task.begin);
                        const dueStr = fmtLocal(task.due);
                        return beginStr <= rangeEndStr && dueStr >= rangeStartStr;
                      });

                      if (tasks.length === 0) {
                        return (
                          <div style={{ textAlign: 'center', padding: '40px', color: COLORS.textTertiary }}>
                            <div style={{ fontSize: '40px', opacity: 0.3, marginBottom: '12px' }}>�</div>
                            <p>暂无任务数据</p>
                            <p style={{ fontSize: '12px', marginTop: '6px' }}>该人员在查询期间未分配任务</p>
                          </div>
                        );
                      }

                      // 按开始日期排序
                      const sorted = [...tasks].sort((a, b) => {
                        const ta = a.begin ? new Date(a.begin).getTime() : 0;
                        const tb = b.begin ? new Date(b.begin).getTime() : 0;
                        return ta - tb;
                      });

                      // 状态映射
                      const statusMap: Record<string, { label: string; color: string }> = {
                        done: { label: '已完成', color: '#52c41a' },
                        progressing: { label: '进行中', color: '#1677ff' },
                        open: { label: '待处理', color: '#faad14' },
                      };

                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          {sorted.map((task) => {
                            const st = statusMap[task.status] || { label: task.status || '未知', color: '#999' };
                            const beginStr = task.begin ? new Date(task.begin).toLocaleDateString('zh-CN') : '-';
                            const dueStr = task.due ? new Date(task.due).toLocaleDateString('zh-CN') : '-';
                            // 进度计算：优先用完成工时/预估工时，已完成任务兜底100%
                            const isDone = task.status === 'done';
                            const progress = (task.effort > 0 && task.effortCompleted !== undefined)
                              ? Math.min(100, Math.round((task.effortCompleted / task.effort) * 100))
                              : (isDone ? 100 : 0);
                            // TAPD任务链接
                            const tapdTaskUrl = task.workspaceId && task.id
                              ? `https://www.tapd.cn/tapd_fe/${task.workspaceId}/task/detail/${task.id}`
                              : null;

                            return (
                              <div
                                key={task.id}
                                style={{
                                  display: 'flex',
                                  alignItems: 'flex-start',
                                  gap: '12px',
                                  padding: '14px 16px',
                                  borderRadius: '10px',
                                  background: '#fafbfc',
                                  border: '1px solid #f0f2f5',
                                  transition: 'background .15s ease, box-shadow .15s ease',
                                }}
                              >
                                {/* 左侧状态色条 */}
                                <div style={{
                                  width: '3px',
                                  height: '40px',
                                  borderRadius: '2px',
                                  flexShrink: 0,
                                  background: st.color,
                                  marginTop: '2px',
                                }} />

                                {/* 中间：任务信息 */}
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  {/* 第一行：任务名称（带链接）+ 状态标签 */}
                                  <div style={{
                                    display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px',
                                  }}>
                                    {tapdTaskUrl ? (
                                      <a
                                        href={tapdTaskUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        title={`在TAPD中查看: ${task.name}`}
                                        style={{
                                          fontWeight: 600, fontSize: '13px', color: '#1677ff',
                                          textDecoration: 'none',
                                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                          maxWidth: '280px',
                                        }}
                                      >
                                        {task.name}
                                      </a>
                                    ) : (
                                      <span style={{
                                        fontWeight: 600, fontSize: '13px', color: '#1a1a2e',
                                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                        maxWidth: '320px',
                                      }} title={task.name}>
                                        {task.name}
                                      </span>
                                    )}
                                    <span style={{
                                      fontSize: '11px', padding: '1px 7px', borderRadius: '4px',
                                      fontWeight: 500, color: st.color, background: `${st.color}14`,
                                      flexShrink: 0,
                                    }}>
                                      {st.label}
                                    </span>
                                  </div>

                                  {/* 第二行：项目 + 迭代 + 工时 */}
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '11.5px', color: '#8896a4', marginBottom: '4px' }}>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                      <span style={{ opacity: 0.6 }}>项目</span>
                                      <span style={{ color: '#555', fontWeight: 500, maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                                        title={task.projectName || '-'}>
                                        {task.projectName || '-'}
                                      </span>
                                    </span>
                                    {task.iterationName && (
                                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <span style={{ opacity: 0.6 }}>迭代</span>
                                        <span style={{ color: '#555', fontWeight: 500, maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                                          title={task.iterationName}>
                                          {task.iterationName}
                                        </span>
                                      </span>
                                    )}
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                      <span style={{ opacity: 0.6 }}>预估</span>
                                      <span style={{ color: '#faad14', fontWeight: 600 }}>{task.effort}h</span>
                                    </span>
                                    {/* 完成工时：有数据时显示，已完成任务即使为0也显示 */}
                                    {(task.effortCompleted !== undefined || isDone) && (
                                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <span style={{ opacity: 0.6 }}>完成</span>
                                        <span style={{ color: '#52c41a', fontWeight: 600 }}>{task.effortCompleted || 0}h</span>
                                      </span>
                                    )}
                                  </div>

                                  {/* 第三行：日期范围 */}
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', color: '#aab2bd' }}>
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                                      <line x1="16" y1="2" x2="16" y2="6"></line>
                                      <line x1="8" y1="2" x2="8" y2="6"></line>
                                      <line x1="3" y1="10" x2="21" y2="10"></line>
                                    </svg>
                                    <span>{beginStr}</span>
                                    <span style={{ opacity: 0.4 }}>→</span>
                                    <span>{dueStr}</span>
                                  </div>

                                  {/* 进度条 */}
                                  {task.effort > 0 && (
                                    <div style={{
                                      marginTop: '8px', height: '4px', background: '#f0f2f5',
                                      borderRadius: '2px', overflow: 'hidden', width: '100%',
                                    }}>
                                      <div style={{
                                        height: '100%', borderRadius: '2px',
                                        background: `linear-gradient(90deg, ${st.color}, ${st.color}dd)`,
                                        width: `${Math.min(progress, 100)}%`,
                                        transition: 'width .3s ease',
                                      }} />
                                    </div>
                                  )}
                                </div>

                                {/* 右侧：完成百分比 */}
                                <div style={{
                                  fontSize: '15px', fontWeight: 800, color: st.color,
                                  minWidth: '48px', textAlign: 'right', flexShrink: 0,
                                  paddingTop: '2px',
                                }}>
                                  {progress}%
                                </div>
                              </div>
                            );
                          })}

                          {/* 底部统计 */}
                          <div style={{
                            display: 'flex', gap: '20px', paddingTop: '12px',
                            borderTop: '1px solid #f0f2f5', fontSize: '12px', color: '#8896a4',
                          }}>
                            <span>共 <b style={{ color: '#1a1a2e' }}>{tasks.length}</b> 个任务</span>
                            <span>总预估 <b style={{ color: '#faad14' }}>{tasks.reduce((s, t) => s + (t.effort || 0), 0)}h</b></span>
                            <span>已完成 <b style={{ color: '#52c41a' }}>{tasks.filter(t => t.status === 'done').length}</b> 个</span>
                            <span>进行中 <b style={{ color: '#1677ff' }}>{tasks.filter(t => t.status === 'progressing').length}</b> 个</span>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PersonSaturationDetail;
