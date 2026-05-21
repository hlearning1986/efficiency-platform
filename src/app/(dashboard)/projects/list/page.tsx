'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Card,
  Row,
  Col,
  Select,
  Input,
  Tag,
  Progress,
  Spin,
  Alert,
  Typography,
  Button,
  theme,
} from 'antd';
import {
  AppstoreOutlined,
  UnorderedListOutlined,
  SearchOutlined,
  ProjectOutlined,
  DollarOutlined,
  TrophyOutlined,
  PercentageOutlined,
  DownOutlined,
  RightOutlined,
  UserOutlined,
  ExpandAltOutlined,
  ShrinkOutlined,
} from '@ant-design/icons';
import type { ProjectItem, ProjectListResponse, ProjectStats } from '@/types/project';

const { Text } = Typography;

/** 分类映射 - 与附件保持一致 */
const categoryConfig: Record<string, { label: string; shortLabel: string; color: string; bgColor: string }> = {
  STRATEGIC: { label: '战略项目', shortLabel: '战略', color: '#ff4d4f', bgColor: '#fff1f0' },
  REGULAR: { label: '常规项目', shortLabel: '日常', color: '#1890ff', bgColor: '#e6f7ff' },
  TECHNICAL: { label: '技术项目', shortLabel: '技术', color: '#52c41a', bgColor: '#f6ffed' },
};

/** 进度条颜色规则 - 与附件一致 */
const getProgressColor = (percent: number): string => {
  if (percent >= 90) return '#52c41a';
  if (percent >= 70) return '#1890ff';
  if (percent >= 50) return '#faad14';
  return '#ff4d4f';
};

/** 进度条文字颜色 */
const getProgressTextColor = (percent: number): string => {
  if (percent >= 90) return '#389e0d';
  if (percent >= 70) return '#096dd9';
  if (percent >= 50) return '#d48806';
  return '#cf1322';
};

/** 格式化成本（万元） */
const formatCost = (value: number): string => {
  if (value >= 10000) {
    return `${(value / 10000).toFixed(1)}万`;
  }
  return `${value.toFixed(0)}`;
};

/** 格式化成本带币符号 */
const formatCostWithSymbol = (value: number): string => {
  if (value >= 10000) {
    return `¥${(value / 10000).toFixed(1)}万`;
  }
  return `¥${value.toFixed(0)}`;
};

/** 获取左侧竖条颜色 */
const getCategoryBarColor = (category: string): string => {
  if (category === 'STRATEGIC') return '#ff4d4f';
  if (category === 'REGULAR') return '#1890ff';
  if (category === 'TECHNICAL') return '#52c41a';
  return '#d9d9d9';
};

/** 获取OKR分组优先级排序值 - 基于该OKR下项目的category判断 */
const getOkrPriority = (projects: ProjectItem[]): number => {
  // 如果包含战略项目，排最前
  if (projects.some((p) => p.category === 'STRATEGIC')) return 1;
  // 如果包含常规项目
  if (projects.some((p) => p.category === 'REGULAR')) return 2;
  // 如果包含技术项目
  if (projects.some((p) => p.category === 'TECHNICAL')) return 3;
  return 4;
};

/** 获取OKR分组样式 - 基于该OKR下项目的category判断标签 */
const getOkrGroupStyle = (projects: ProjectItem[]): { barColor: string; tagColor: string; label: string } => {
  if (projects.some((p) => p.category === 'STRATEGIC')) {
    return { barColor: '#ff4d4f', tagColor: 'red', label: '战略' };
  }
  if (projects.some((p) => p.category === 'REGULAR')) {
    return { barColor: '#1890ff', tagColor: 'blue', label: '日常' };
  }
  if (projects.some((p) => p.category === 'TECHNICAL')) {
    return { barColor: '#52c41a', tagColor: 'green', label: '技术' };
  }
  return { barColor: '#d9d9d9', tagColor: 'default', label: '其他' };
};

/** 获取季度标签颜色 */
const getQuarterTagColor = (progress: number | null | undefined): string => {
  if (progress == null || progress === 0) return 'default';
  if (progress >= 100) return 'success';
  return 'processing';
};

/** 分类筛选按钮配置 */
const categoryFilterOptions = [
  { key: 'all', label: '全部', color: undefined },
  { key: 'STRATEGIC', label: '战略项目', color: '#ff4d4f' },
  { key: 'REGULAR', label: '常规项目', color: '#1890ff' },
  { key: 'TECHNICAL', label: '技术项目', color: '#52c41a' },
];

/** 季度筛选按钮配置 */
const quarterFilterOptions = [
  { key: 'all', label: '全年' },
  { key: 'Q1', label: 'Q1' },
  { key: 'Q2', label: 'Q2' },
  { key: 'Q3', label: 'Q3' },
  { key: 'Q4', label: 'Q4' },
];

const ProjectListPage = React.memo(function ProjectListPage() {
  const router = useRouter();
  const { token } = theme.useToken();

  // 筛选状态
  const [category, setCategory] = useState<string>('all');
  const [quarter, setQuarter] = useState<string>('all');
  const [okrFilter, setOkrFilter] = useState<string>('all');
  const [searchText, setSearchText] = useState<string>('');
  const [viewMode, setViewMode] = useState<'card' | 'okr'>('okr');

  // 数据状态
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [data, setData] = useState<ProjectListResponse | null>(null);
  const [allProjectsList, setAllProjectsList] = useState<ProjectItem[]>([]);

  // OKR分组展开状态
  const [expandedOkrs, setExpandedOkrs] = useState<Set<string>>(new Set());

  // 搜索防抖
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');
  const [searchTimer, setSearchTimer] = useState<NodeJS.Timeout | null>(null);

  /** 获取全量项目数据（仅用于顶部统计，不受筛选影响） */
  const fetchAllProjects = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/projects?page=1&pageSize=100');
      if (res.ok) {
        const json = await res.json();
        setAllProjectsList((json.data || json).list || []);
      }
    } catch {
      // 静默失败，不影响主流程
    }
  }, []);

  /** 获取项目数据 - 保持现有逻辑 */
  const fetchProjects = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const params = new URLSearchParams();
      if (category !== 'all') params.set('category', category);
      if (quarter !== 'all') params.set('quarter', quarter);
      if (debouncedSearch) params.set('search', debouncedSearch);
      params.set('page', '1');
      params.set('pageSize', '100');

      const res = await fetch(`/api/v1/projects?${params.toString()}`);
      if (!res.ok) {
        throw new Error(`请求失败: ${res.status}`);
      }
      const json = await res.json();
      setData(json.data || json);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '未知错误';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [category, quarter, debouncedSearch]);

  useEffect(() => {
    // ✅ 优化: 移除重复的全量查询，API已包含统计数据
    fetchProjects();
  }, [fetchProjects]);

  /** 搜索防抖处理 */
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchText(value);
    if (searchTimer) clearTimeout(searchTimer);
    const timer = setTimeout(() => {
      setDebouncedSearch(value);
    }, 300);
    setSearchTimer(timer);
  };

  /** 搜索框回车 */
  const handleSearchPressEnter = () => {
    if (searchTimer) clearTimeout(searchTimer);
    setDebouncedSearch(searchText);
  };

  /** 点击项目卡片 */
  const handleCardClick = (projectId: string) => {
    // 保存当前滚动位置和展开状态到URL参数
    const scrollY = Math.round(window.scrollY);
    const expandedList = Array.from(expandedOkrs);
    const url = new URL(window.location.href);
    url.searchParams.set('scrollY', String(scrollY));
    url.searchParams.set('expanded', encodeURIComponent(JSON.stringify(expandedList)));
    window.history.replaceState(null, '', url.toString());
    router.push(`/projects/${projectId}`);
  };

  /** 提取OKR筛选选项 */
  const okrOptions = useMemo(() => {
    if (!data?.list) return [{ label: '全部OKR', value: 'all' }];
    const okrs = new Set(data.list.map((p) => p.okrName).filter(Boolean));
    return [
      { label: '全部OKR', value: 'all' },
      ...Array.from(okrs).map((okr) => ({ label: okr, value: okr })),
    ];
  }, [data?.list]);

  /** 筛选后的项目列表 */
  const filteredProjects = useMemo(() => {
    if (!data?.list) return [];
    let result = data.list;

    if (category !== 'all') {
      result = result.filter((p) => p.category === category);
    }

    if (okrFilter !== 'all') {
      result = result.filter((p) => p.okrName === okrFilter);
    }

    if (debouncedSearch) {
      const keyword = debouncedSearch.toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(keyword) ||
          (p.partner && p.partner.toLowerCase().includes(keyword))
      );
    }

    // 按category排序：战略 > 常规 > 技术
    const categoryPriority: Record<string, number> = {
      STRATEGIC: 1,
      REGULAR: 2,
      TECHNICAL: 3,
    };
    result = result.sort((a, b) => (categoryPriority[a.category] || 99) - (categoryPriority[b.category] || 99));

    return result;
  }, [data?.list, category, okrFilter, debouncedSearch]);

  /** 按OKR分组 */
  const okrGroups = useMemo(() => {
    const groups: Record<string, ProjectItem[]> = {};
    filteredProjects.forEach((project) => {
      const key = project.okrName || '未关联OKR';
      if (!groups[key]) groups[key] = [];
      groups[key].push(project);
    });
    return groups;
  }, [filteredProjects]);

  /** 动态统计 - 仅基于季度筛选，不受分类/OKR/搜索影响 */
  const dynamicStats = useMemo(() => {
    const projects = allProjectsList;
    let totalProgress = 0;
    let validCount = 0;
    let highCount = 0;

    projects.forEach((p) => {
      if (quarter === 'all') {
        const validMs = (p.milestones || []).filter((m) => m.progress != null && m.progress > 0);
        if (validMs.length > 0) {
          const avg = validMs.reduce((s, m) => s + m.progress, 0) / validMs.length;
          totalProgress += avg;
          validCount++;
          if (avg >= 80) highCount++;
        }
      } else {
        const ms = p.milestones?.find((m) => m.quarter === quarter);
        if (ms && ms.progress != null && ms.progress > 0) {
          totalProgress += ms.progress;
          validCount++;
          if (ms.progress >= 80) highCount++;
        }
      }
    });

    return {
      avgProgress: validCount > 0 ? totalProgress / validCount : 0,
      highAchievementCount: highCount,
    };
  }, [allProjectsList, quarter]);

  /** OKR分组统计 */
  const okrGroupStats = useMemo(() => {
    const stats: Record<string, { count: number; totalCost: number; avgProgress: number; quarterLabel: string }> = {};
    Object.entries(okrGroups).forEach(([okr, projs]) => {
      let totalCost = 0;
      let totalProgress = 0;
      let validCount = 0;

      projs.forEach((p) => {
        totalCost += p.totalCost;
        // 基于milestones计算平均达成率（与附件逻辑一致）
        if (quarter === 'all') {
          // 全年：取所有有数据的milestone的平均进度
          const validMilestones = (p.milestones || []).filter((m) => m.progress != null && m.progress > 0);
          if (validMilestones.length > 0) {
            const avg = validMilestones.reduce((s, m) => s + m.progress, 0) / validMilestones.length;
            totalProgress += avg;
            validCount++;
          }
        } else {
          // 指定季度：取对应季度的进度
          const milestone = p.milestones?.find((m) => m.quarter === quarter);
          if (milestone && milestone.progress != null && milestone.progress > 0) {
            totalProgress += milestone.progress;
            validCount++;
          }
        }
      });

      stats[okr] = {
        count: projs.length,
        totalCost,
        avgProgress: validCount > 0 ? totalProgress / validCount : 0,
        quarterLabel: quarter === 'all' ? '全年平均' : quarter,
      };
    });
    return stats;
  }, [okrGroups, quarter]);

  /** OKR分组排序后的键列表 */
  const sortedOkrKeys = useMemo(() => {
    return Object.keys(okrGroups).sort((a, b) => getOkrPriority(okrGroups[a]) - getOkrPriority(okrGroups[b]));
  }, [okrGroups]);

  // 从URL参数恢复展开状态 + 恢复滚动位置
  useEffect(() => {
    if (!loading && data?.list) {
      const urlParams = new URLSearchParams(window.location.search);
      
      // 恢复展开状态
      const expandedParam = urlParams.get('expanded');
      if (expandedParam) {
        try {
          const decoded = decodeURIComponent(expandedParam);
          const list = JSON.parse(decoded) as string[];
          if (list.length > 0) {
            setExpandedOkrs(new Set(list));
          }
        } catch { /* ignore */ }
      }
      // 默认折叠全部（没有expanded参数时）

      // 恢复滚动位置
      const savedY = urlParams.get('scrollY');
      if (savedY) {
        const y = parseInt(savedY, 10);
        if (!isNaN(y) && y > 0) {
          // 清除URL中的参数
          const url = new URL(window.location.href);
          url.searchParams.delete('scrollY');
          url.searchParams.delete('expanded');
          window.history.replaceState(null, '', url.toString());
          // 延迟执行滚动
          requestAnimationFrame(() => {
            setTimeout(() => {
              window.scrollTo(0, y);
            }, 100);
          });
        }
      }
    }
  }, [loading, data?.list]);

  /** 切换OKR展开/折叠 */
  const toggleOkr = (okr: string) => {
    setExpandedOkrs((prev) => {
      const next = new Set(prev);
      if (next.has(okr)) next.delete(okr);
      else next.add(okr);
      return next;
    });
  };

  /** 展开/折叠所有 */
  const toggleAllOkrs = () => {
    if (expandedOkrs.size === sortedOkrKeys.length) {
      setExpandedOkrs(new Set());
    } else {
      setExpandedOkrs(new Set(sortedOkrKeys));
    }
  };

  /** 获取项目展示数据（根据季度筛选） */
  const getProjectDisplayData = (project: ProjectItem) => {
    if (quarter === 'all') {
      return {
        progress: project.avgProgress,
        cost: project.totalCost,
        label: '全年平均达成率',
        costLabel: '全年累计投入',
      };
    }
    const milestone = project.milestones?.find((m) => m.quarter === quarter);
    // 按季度取对应成本
    const quarterCost = project.costs?.find((c) => c.quarter === quarter)?.totalCost || 0;
    return {
      progress: milestone?.progress ?? 0,
      cost: quarterCost,
      label: `${quarter}达成率`,
      costLabel: `${quarter}投入`,
    };
  };

  /** 渲染项目卡片 - 复刻附件 ProjectCard 组件 */
  const renderProjectCard = (project: ProjectItem) => {
    const catInfo = categoryConfig[project.category] || { label: project.category, shortLabel: project.category, color: '#d9d9d9', bgColor: '#f5f5f5' };
    const barColor = getCategoryBarColor(project.category);
    const displayData = getProjectDisplayData(project);
    const progressPercent = Math.round(displayData.progress);
    const hasProgress = displayData.progress > 0;

    // 全部4个季度
    const allQuarters = ['Q1', 'Q2', 'Q3', 'Q4'];

    return (
      <Col xs={24} sm={12} xl={8} key={project.id}>
        <div
          onClick={() => handleCardClick(project.id)}
          style={{
            background: '#fff',
            borderRadius: 12,
            border: `1px solid ${token.colorBorderSecondary}`,
            overflow: 'hidden',
            cursor: 'pointer',
            transition: 'box-shadow 0.3s, border-color 0.3s',
            display: 'flex',
            height: '100%',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
            (e.currentTarget as HTMLDivElement).style.borderColor = token.colorPrimaryBorder;
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLDivElement).style.boxShadow = '0 1px 2px rgba(0,0,0,0.06)';
            (e.currentTarget as HTMLDivElement).style.borderColor = token.colorBorderSecondary;
          }}
        >
          {/* 左侧类别彩色竖条 - 宽度6px */}
          <div
            style={{
              width: 6,
              flexShrink: 0,
              backgroundColor: barColor,
            }}
          />

          {/* 卡片内容区 */}
          <div style={{ flex: 1, padding: '16px 16px 12px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {/* 第一行：项目名称 + 类别标签 */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <Text
                strong
                style={{
                  fontSize: 15,
                  lineHeight: 1.4,
                  flex: 1,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {project.name}
              </Text>
              <span
                style={{
                  fontSize: 10,
                  padding: '1px 6px',
                  borderRadius: 4,
                  fontWeight: 500,
                  color: '#fff',
                  backgroundColor: catInfo.color,
                  flexShrink: 0,
                  lineHeight: '18px',
                }}
              >
                {catInfo.shortLabel}
              </span>
            </div>

            {/* 第二行：OKR名称 */}
            {project.okrName && (
              <Text
                type="secondary"
                style={{ fontSize: 12, lineHeight: 1.4 }}
                ellipsis
              >
                {project.okrName}
              </Text>
            )}

            {/* 第三行：项目背景描述 - 最多2行 */}
            {project.description && (
              <div
                style={{
                  fontSize: 12,
                  color: token.colorTextSecondary,
                  lineHeight: '20px',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {project.description}
              </div>
            )}

            {/* 达成率进度条区域 */}
            <div style={{ marginTop: 4 }}>
              {hasProgress && (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {displayData.label}
                    </Text>
                    <Text
                      strong
                      style={{ fontSize: 13, color: getProgressTextColor(progressPercent) }}
                    >
                      {progressPercent}%
                    </Text>
                  </div>
                  <Progress
                    percent={progressPercent}
                    showInfo={false}
                    strokeColor={getProgressColor(progressPercent)}
                    trailColor="#f0f0f0"
                    size="small"
                    style={{ marginBottom: 0 }}
                  />
                </>
              )}
            </div>

            {/* 底部行：投入成本 | PO负责人 | 季度标签 */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingTop: 8,
                marginTop: 'auto',
                borderTop: `1px solid ${token.colorBorderSecondary}`,
                gap: 8,
              }}
            >
              {/* 投入成本 - 琥珀色背景框 */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '2px 8px',
                  backgroundColor: '#fffbe6',
                  borderRadius: 6,
                  border: '1px solid #ffe58f',
                  flexShrink: 0,
                }}
              >
                <DollarOutlined style={{ fontSize: 12, color: '#d48806' }} />
                <Text style={{ fontSize: 11, color: '#d48806' }}>{displayData.costLabel}</Text>
                <Text strong style={{ fontSize: 13, color: '#ad6800' }}>
                  {formatCostWithSymbol(displayData.cost)}
                </Text>
              </div>

              {/* PO负责人 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 1, overflow: 'hidden' }}>
                <UserOutlined style={{ fontSize: 12, color: token.colorTextSecondary }} />
                <Text
                  type="secondary"
                  style={{ fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 80 }}
                >
                  {project.po || '-'}
                </Text>
              </div>

              {/* 季度标签 - 全部4个季度都显示 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
                {allQuarters.map((q) => {
                  const qProgress = project.milestones?.find((m) => m.quarter === q)?.progress;
                  return (
                    <Tag
                      key={q}
                      color={getQuarterTagColor(qProgress)}
                      style={{
                        fontSize: 9,
                        padding: '0 4px',
                        lineHeight: '16px',
                        margin: 0,
                        borderRadius: 3,
                      }}
                    >
                      {q}
                    </Tag>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 右侧箭头 */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              paddingRight: 12,
              color: token.colorTextQuaternary,
            }}
          >
            <RightOutlined style={{ fontSize: 12 }} />
          </div>
        </div>
      </Col>
    );
  };

  /** 渲染OKR分组视图 */
  const renderOkrView = () => {
    if (sortedOkrKeys.length === 0) {
      return (
        <div style={{ textAlign: 'center', padding: 48 }}>
          <Text type="secondary">暂无项目数据</Text>
        </div>
      );
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* 展开/折叠全部按钮 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text type="secondary" style={{ fontSize: 13 }}>
            共 {sortedOkrKeys.length} 个 OKR 维度，{filteredProjects.length} 个项目
          </Text>
          <Button
            type="link"
            size="small"
            icon={expandedOkrs.size === sortedOkrKeys.length ? <ShrinkOutlined /> : <ExpandAltOutlined />}
            onClick={toggleAllOkrs}
            style={{ fontSize: 13 }}
          >
            {expandedOkrs.size === sortedOkrKeys.length ? '折叠全部' : '展开全部'}
          </Button>
        </div>

        {/* OKR分组列表 */}
        {sortedOkrKeys.map((okrName) => {
          const stats = okrGroupStats[okrName];
          const isExpanded = expandedOkrs.has(okrName);
          const groupStyle = getOkrGroupStyle(okrGroups[okrName]);
          const avgProgressPercent = Math.round(stats.avgProgress);

          return (
            <div
              key={okrName}
              style={{
                background: '#fff',
                borderRadius: 12,
                border: `1px solid ${token.colorBorderSecondary}`,
                overflow: 'hidden',
                boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
              }}
            >
              {/* OKR头部 - 左侧彩色竖条 + 信息 */}
              <div
                onClick={() => toggleOkr(okrName)}
                style={{
                  display: 'flex',
                  alignItems: 'stretch',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLDivElement).style.backgroundColor = '#fafafa';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLDivElement).style.backgroundColor = 'transparent';
                }}
              >
                {/* 左侧彩色竖条 */}
                <div
                  style={{
                    width: 6,
                    flexShrink: 0,
                    backgroundColor: groupStyle.barColor,
                  }}
                />

                {/* 头部内容 */}
                <div
                  style={{
                    flex: 1,
                    padding: '16px 20px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  {/* 左侧：展开图标 + OKR名称 + 标签 + 统计 */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <DownOutlined
                      style={{
                        fontSize: 12,
                        color: token.colorTextSecondary,
                        transition: 'transform 0.3s',
                        transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                      }}
                    />
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Text strong style={{ fontSize: 15 }}>
                          {okrName}
                        </Text>
                        <Tag
                          color={groupStyle.tagColor}
                          style={{
                            fontSize: 10,
                            padding: '0 6px',
                            lineHeight: '18px',
                            margin: 0,
                            borderRadius: 4,
                          }}
                        >
                          {groupStyle.label}
                        </Tag>
                      </div>
                      <Text type="secondary" style={{ fontSize: 12, marginTop: 2 }}>
                        {stats.count} 个项目 · {stats.quarterLabel}投入 {formatCostWithSymbol(stats.totalCost)} · {stats.quarterLabel}达成率 {avgProgressPercent}%
                      </Text>
                    </div>
                  </div>

                  {/* 右侧：进度条 */}
                  <div style={{ width: 160, flexShrink: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {stats.quarterLabel}进度
                      </Text>
                      <Text
                        strong
                        style={{ fontSize: 13, color: getProgressTextColor(avgProgressPercent) }}
                      >
                        {avgProgressPercent}%
                      </Text>
                    </div>
                    <Progress
                      percent={avgProgressPercent}
                      showInfo={false}
                      strokeColor={getProgressColor(avgProgressPercent)}
                      trailColor="#f0f0f0"
                      size="small"
                      style={{ marginBottom: 0 }}
                    />
                  </div>
                </div>
              </div>

              {/* OKR项目列表 */}
              {isExpanded && (
                <div
                  style={{
                    borderTop: `1px solid ${token.colorBorderSecondary}`,
                    padding: '16px 20px',
                  }}
                >
                  <Row gutter={[16, 16]}>
                    {okrGroups[okrName].map((project) => renderProjectCard(project))}
                  </Row>
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  /** 渲染统计卡片 - 保持现有4个统计卡片 */
  /** 渲染统计卡片 - 目标样式 */
  const renderStats = (stats: ProjectStats) => (
    <Row gutter={16} style={{ marginBottom: 24 }}>
      {/* 项目总数 */}
      <Col xs={12} sm={6}>
        <Card
          bordered={false}
          style={{ borderRadius: 12, background: '#fafafa' }}
          styles={{ body: { padding: 16 } }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <ProjectOutlined style={{ color: '#1890ff', fontSize: 14 }} />
            <Text style={{ fontSize: 13, color: '#666' }}>项目总数</Text>
          </div>
          <div style={{ fontSize: 28, fontWeight: 600, color: '#1890ff', marginBottom: 8 }}>
            {stats.totalProjects}
          </div>
          <div style={{ fontSize: 12, color: '#999' }}>
            战略{stats.strategicCount} · 常规{stats.regularCount} · 技术{stats.technicalCount}
          </div>
        </Card>
      </Col>

      {/* 平均达成率（动态计算） */}
      <Col xs={12} sm={6}>
        <Card
          bordered={false}
          style={{ borderRadius: 12, background: '#fafafa' }}
          styles={{ body: { padding: 16 } }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <PercentageOutlined style={{ color: getProgressColor(dynamicStats.avgProgress), fontSize: 14 }} />
            <Text style={{ fontSize: 13, color: '#666' }}>平均达成率</Text>
          </div>
          <div style={{ fontSize: 28, fontWeight: 600, color: getProgressColor(dynamicStats.avgProgress), marginBottom: 8 }}>
            {dynamicStats.avgProgress.toFixed(1)}%
          </div>
          <Progress
            percent={dynamicStats.avgProgress}
            size="small"
            strokeColor={getProgressColor(dynamicStats.avgProgress)}
            showInfo={false}
          />
        </Card>
      </Col>

      {/* 总成本 */}
      <Col xs={12} sm={6}>
        <Card
          bordered={false}
          style={{ borderRadius: 12, background: '#fafafa' }}
          styles={{ body: { padding: 16 } }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <DollarOutlined style={{ color: '#fa8c16', fontSize: 14 }} />
            <Text style={{ fontSize: 13, color: '#666' }}>总成本</Text>
          </div>
          <div style={{ fontSize: 28, fontWeight: 600, color: '#fa8c16', marginBottom: 8 }}>
            {formatCost(stats.totalCost)}<span style={{ fontSize: 14, fontWeight: 400 }}>万</span>
          </div>
          <div style={{ fontSize: 12, color: '#999' }}>
            {stats.totalProjects}个项目累计投入
          </div>
        </Card>
      </Col>

      {/* 高达成项目（动态计算） */}
      <Col xs={12} sm={6}>
        <Card
          bordered={false}
          style={{ borderRadius: 12, background: '#fafafa' }}
          styles={{ body: { padding: 16 } }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <TrophyOutlined style={{ color: '#52c41a', fontSize: 14 }} />
            <Text style={{ fontSize: 13, color: '#666' }}>高达成项目</Text>
          </div>
          <div style={{ fontSize: 28, fontWeight: 600, color: '#52c41a', marginBottom: 8 }}>
            {dynamicStats.highAchievementCount}<span style={{ fontSize: 14, fontWeight: 400 }}>个</span>
          </div>
          <div style={{ fontSize: 12, color: '#999' }}>
            里程碑达成率≥80%
          </div>
        </Card>
      </Col>
    </Row>
  );

  return (
    <div>
      {/* 看板标题横幅 */}
      {data?.stats && (
        <div
          style={{
            background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
            borderRadius: 12,
            padding: '24px 28px',
            marginBottom: 20,
            display: 'flex',
            alignItems: 'center',
            gap: 20,
          }}
        >
          {/* 左侧图标 */}
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 10,
              background: 'linear-gradient(135deg, #1890ff, #096dd9)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <ProjectOutlined style={{ color: '#fff', fontSize: 24 }} />
          </div>
          {/* 右侧文字 */}
          <div>
            <div style={{ fontSize: 20, fontWeight: 600, color: '#fff', marginBottom: 6 }}>
              2026年科技研发中心项目看板
            </div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)' }}>
              {data.stats.totalProjects}个项目 | 战略{data.stats.strategicCount}个 | 常规{data.stats.regularCount}个 | 技术{data.stats.technicalCount}个 | 总投入¥{formatCost(data.stats.totalCost)}万
            </div>
          </div>
        </div>
      )}

      {/* 统计卡片 */}
      {data?.stats && renderStats(data.stats)}

      {/* 筛选器栏 */}
      <Card
        bordered={false}
        style={{ marginBottom: 24, borderRadius: 8 }}
        styles={{ body: { padding: '16px 20px' } }}
      >
        {/* 搜索框 */}
        <div style={{ marginBottom: 12 }}>
          <Input
            placeholder="搜索项目名称或业务方..."
            value={searchText}
            onChange={handleSearchChange}
            onPressEnter={handleSearchPressEnter}
            allowClear
            prefix={<SearchOutlined style={{ color: token.colorTextQuaternary }} />}
            style={{ maxWidth: 400 }}
          />
        </div>

        {/* 筛选按钮组 */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
          {/* 季度筛选 - 按钮组样式 */}
          <Text type="secondary" style={{ fontSize: 13, fontWeight: 500, marginRight: 4 }}>
            季度:
          </Text>
          {quarterFilterOptions.map((opt) => (
            <Button
              key={opt.key}
              size="small"
              type={quarter === opt.key ? 'primary' : 'default'}
              onClick={() => setQuarter(opt.key)}
              style={
                quarter === opt.key
                  ? {
                      borderRadius: 16,
                      fontSize: 12,
                      backgroundColor: opt.key === 'all' ? token.colorPrimary : '#1890ff',
                      borderColor: opt.key === 'all' ? token.colorPrimary : '#1890ff',
                    }
                  : { borderRadius: 16, fontSize: 12 }
              }
            >
              {opt.label}
            </Button>
          ))}

          {/* 分隔 */}
          <div style={{ width: 1, height: 20, backgroundColor: token.colorBorderSecondary, margin: '0 8px' }} />

          {/* 分类筛选 - 彩色按钮组 */}
          <Text type="secondary" style={{ fontSize: 13, fontWeight: 500, marginRight: 4 }}>
            分类:
          </Text>
          {categoryFilterOptions.map((opt) => (
            <Button
              key={opt.key}
              size="small"
              type={category === opt.key ? 'primary' : 'default'}
              onClick={() => setCategory(opt.key)}
              style={
                category === opt.key
                  ? {
                      borderRadius: 16,
                      fontSize: 12,
                      backgroundColor: opt.color || token.colorPrimary,
                      borderColor: opt.color || token.colorPrimary,
                    }
                  : { borderRadius: 16, fontSize: 12 }
              }
            >
              {opt.label}
            </Button>
          ))}

          {/* 分隔 */}
          <div style={{ width: 1, height: 20, backgroundColor: token.colorBorderSecondary, margin: '0 8px' }} />

          {/* OKR筛选 - 下拉选择框 */}
          <Text type="secondary" style={{ fontSize: 13, fontWeight: 500, marginRight: 4 }}>
            OKR:
          </Text>
          <Select
            value={okrFilter}
            onChange={setOkrFilter}
            style={{ minWidth: 180 }}
            size="small"
            options={okrOptions}
          />

          {/* 视图切换 - 右侧 */}
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4 }}>
            <Text type="secondary" style={{ fontSize: 13, fontWeight: 500, marginRight: 4 }}>
              视图:
            </Text>
            <Button
              size="small"
              type={viewMode === 'card' ? 'primary' : 'default'}
              icon={<AppstoreOutlined />}
              onClick={() => setViewMode('card')}
              style={{ borderRadius: 8, fontSize: 12 }}
            >
              卡片视图
            </Button>
            <Button
              size="small"
              type={viewMode === 'okr' ? 'primary' : 'default'}
              icon={<UnorderedListOutlined />}
              onClick={() => setViewMode('okr')}
              style={{ borderRadius: 8, fontSize: 12 }}
            >
              OKR分组
            </Button>
          </div>
        </div>
      </Card>

      {/* 错误提示 */}
      {error && (
        <Alert
          message="加载失败"
          description={error}
          type="error"
          showIcon
          closable
          onClose={() => setError('')}
          style={{ marginBottom: 24 }}
        />
      )}

      {/* 加载状态 */}
      {loading && (
        <div style={{ textAlign: 'center', padding: 80 }}>
          <Spin size="large" tip="加载中..." />
        </div>
      )}

      {/* 项目内容 */}
      {!loading && data?.list && (
        <>
          {viewMode === 'card' ? (
            <Row gutter={[16, 16]}>
              {filteredProjects.map((project) => renderProjectCard(project))}
            </Row>
          ) : (
            renderOkrView()
          )}

          {filteredProjects.length === 0 && (
            <div style={{ textAlign: 'center', padding: 80 }}>
              <Text type="secondary" style={{ fontSize: 16 }}>
                暂无匹配的项目数据
              </Text>
            </div>
          )}
        </>
      )}
    </div>
  );
});

export default ProjectListPage;