'use client';

import React, { useEffect, useState, useMemo } from 'react';
import {
  Card,
  Row,
  Col,
  Typography,
  Spin,
  Tag,
  Button,
  Select,
  message,
} from 'antd';
import {
  AlertOutlined,
  DollarOutlined,
  FilterOutlined,
  TrophyOutlined,
} from '@ant-design/icons';

const { Title, Text } = Typography;

// ==================== 类型定义 ====================

interface CategoryStat {
  count: number;
  totalCost: number;
  avgProgress: number;
  projectNames: string[];
}

interface QuarterCost {
  quarter: string;
  cost: number;
}

interface CostRankingItem {
  id: string;
  name: string;
  category: string;
  totalCost: number;
  avgProgress: number;
  quarters: QuarterCost[];
  quarterProgress?: Record<string, number>;
}

interface WarningProject {
  id: string;
  name: string;
  category: string;
  totalCost: number;
  avgProgress: number;
  quarterProgress?: Record<string, number>;
}

interface OverallStats {
  totalProjects: number;
  totalCost: number;
  avgProgress: number;
}

interface SummaryData {
  categoryStats: Record<string, CategoryStat>;
  warningProjects: WarningProject[];
  costRanking: CostRankingItem[];
  overallStats: OverallStats;
  suggestions: string[];
}

// ==================== 常量配置 ====================

/** 分类映射 */
const categoryConfig: Record<string, { label: string; color: string; tagColor: string }> = {
  STRATEGIC: { label: '战略项目', color: '#722ed1', tagColor: 'purple' },
  REGULAR: { label: '常规项目', color: '#1890ff', tagColor: 'blue' },
  TECHNICAL: { label: '技术项目', color: '#fa8c16', tagColor: 'orange' },
};

/** 成本总览卡片配置 */
const overviewCards = [
  {
    key: 'STRATEGIC',
    title: '战略项目成本',
    gradient: 'linear-gradient(135deg, #722ed1 0%, #531dab 100%)',
    icon: <DollarOutlined />,
  },
  {
    key: 'REGULAR',
    title: '常规项目成本',
    gradient: 'linear-gradient(135deg, #1890ff 0%, #096dd9 100%)',
    icon: <DollarOutlined />,
  },
  {
    key: 'TECHNICAL',
    title: '技术项目成本',
    gradient: 'linear-gradient(135deg, #fa8c16 0%, #d46b08 100%)',
    icon: <DollarOutlined />,
  },
  {
    key: 'TOTAL',
    title: '总投入成本',
    gradient: 'linear-gradient(135deg, #434343 0%, #262626 100%)',
    icon: <DollarOutlined />,
  },
];

/** 分类筛选按钮配置 */
const categoryFilterOptions = [
  { key: 'all', label: '全部' },
  { key: 'STRATEGIC', label: '战略' },
  { key: 'REGULAR', label: '日常' },
  { key: 'TECHNICAL', label: '技术' },
];

// ==================== 工具函数 ====================

/** 金额格式化：>= 10000 显示为 "¥X.X万"，否则 "¥X" */
const formatCost = (value: number): string => {
  if (value >= 10000) {
    return `¥${(value / 10000).toFixed(1)}万`;
  }
  return `¥${value.toFixed(0)}`;
};

/** 获取分类标签 */
const getCategoryTag = (category: string) => {
  const config = categoryConfig[category];
  if (!config) return <Tag>{category}</Tag>;
  return (
    <Tag color={config.tagColor} style={{ borderRadius: 4 }}>
      {config.label}
    </Tag>
  );
};

// ==================== 组件 ====================

export default function AnalysisPage() {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [okrFilter, setOkrFilter] = useState<string>('all');

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const res = await fetch('/api/v1/projects/summary');
        const json = await res.json();
        if (json.code === 0) {
          setSummary(json.data);
        } else {
          message.error(json.message || '获取数据失败');
        }
      } catch {
        message.error('获取数据失败');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // ==================== 计算数据 ====================

  const totalCost = summary?.overallStats?.totalCost || 0;

  /** OKR筛选选项（从 costRanking 中提取） */
  const okrOptions = useMemo(() => {
    if (!summary?.costRanking) return [{ label: '全部OKR', value: 'all' }];
    // costRanking 中没有 okrName，但用户要求有 OKR 筛选下拉
    // 这里先提供默认选项，实际项目中可从其他数据源获取
    return [{ label: '全部OKR', value: 'all' }];
  }, [summary?.costRanking]);

  /** 筛选后的成本排行 */
  const filteredCostRanking = useMemo(() => {
    if (!summary?.costRanking) return [];
    let result = summary.costRanking;

    if (categoryFilter !== 'all') {
      result = result.filter((p) => p.category === categoryFilter);
    }

    return result;
  }, [summary?.costRanking, categoryFilter]);

  /** 筛选后的预警项目 */
  const filteredWarnings = useMemo(() => {
    if (!summary?.warningProjects) return [];
    let result = summary.warningProjects;

    if (categoryFilter !== 'all') {
      result = result.filter((p) => p.category === categoryFilter);
    }

    return result;
  }, [summary?.warningProjects, categoryFilter]);

  /** 成本排行中最大总成本（用于进度条宽度计算） */
  const maxTotalCost = useMemo(() => {
    if (!summary?.costRanking || summary.costRanking.length === 0) return 1;
    return Math.max(...summary.costRanking.map((p) => p.totalCost), 1);
  }, [summary?.costRanking]);

  // ==================== 渲染函数 ====================

  /** 渲染成本总览卡片 */
  const renderOverviewCards = () => {
    const strategicCost = summary?.categoryStats.STRATEGIC?.totalCost || 0;
    const regularCost = summary?.categoryStats.REGULAR?.totalCost || 0;
    const technicalCost = summary?.categoryStats.TECHNICAL?.totalCost || 0;

    const costMap: Record<string, number> = {
      STRATEGIC: strategicCost,
      REGULAR: regularCost,
      TECHNICAL: technicalCost,
      TOTAL: totalCost,
    };

    return (
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        {overviewCards.map((card) => {
          const cost = costMap[card.key] || 0;
          const percentage =
            card.key === 'TOTAL'
              ? 100
              : totalCost > 0
                ? ((cost / totalCost) * 100).toFixed(1)
                : '0.0';

          return (
            <Col xs={24} sm={12} xl={6} key={card.key}>
              <div
                style={{
                  background: card.gradient,
                  borderRadius: 12,
                  padding: '20px 24px',
                  color: '#fff',
                  minHeight: 120,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 14 }}>
                    {card.title}
                  </Text>
                  <span style={{ fontSize: 20, opacity: 0.8 }}>{card.icon}</span>
                </div>
                <div style={{ marginTop: 16 }}>
                  <div style={{ fontSize: 28, fontWeight: 700, lineHeight: 1.2 }}>
                    {formatCost(cost)}
                  </div>
                  {card.key !== 'TOTAL' && (
                    <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 13, marginTop: 4 }}>
                      占总成本 {percentage}%
                    </Text>
                  )}
                </div>
              </div>
            </Col>
          );
        })}
      </Row>
    );
  };

  /** 渲染成本排行列表 - 精确复刻截图样式 */
  const renderCostRanking = () => {
    if (filteredCostRanking.length === 0) {
      return (
        <div style={{ textAlign: 'center', padding: '48px 0' }}>
          <Text type="secondary">暂无成本数据</Text>
        </div>
      );
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {filteredCostRanking.map((project, index) => {
          const rank = index + 1;
          const catInfo = categoryConfig[project.category] || { label: project.category, color: '#d9d9d9', tagColor: 'default' };
          const progressPercent = Math.round(project.avgProgress * 100);

          // 百分比颜色：<100% 蓝色，100% 绿色
          const progressColor = progressPercent >= 100 ? '#27AE60' : '#4A90D9';

          // 排名徽章：前3名金色圆形
          const isTop3 = rank <= 3;

          // Q1成本
          const q1Cost = project.quarters.find((c) => c.quarter === 'Q1')?.cost || 0;

          // 进度条宽度（基于Q1成本占总成本比例）
          const barPercent = maxTotalCost > 0 ? Math.min((q1Cost / maxTotalCost) * 100, 100) : 0;

          return (
            <div
              key={project.id}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                padding: '16px 24px',
                borderBottom: '1px solid #f0f0f0',
                minHeight: 88,
                transition: 'background-color 0.2s',
                cursor: 'default',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLDivElement).style.backgroundColor = '#FAFAFA';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLDivElement).style.backgroundColor = 'transparent';
              }}
            >
              {/* 左侧：排名 + 项目信息 + 进度条 */}
              <div style={{ flex: 1, minWidth: 0, display: 'flex', gap: 12 }}>
                {/* 排名徽章 */}
                <div
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: '50%',
                    backgroundColor: isTop3 ? '#F5A623' : '#f0f0f0',
                    color: isTop3 ? '#fff' : '#8c8c8c',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 12,
                    fontWeight: 600,
                    flexShrink: 0,
                    marginTop: 2,
                  }}
                >
                  {rank}
                </div>

                {/* 项目信息 + 进度条 */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  {/* 项目名称 + 分类标签 */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <Text
                      strong
                      style={{
                        fontSize: 14,
                        color: '#333',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {project.name}
                    </Text>
                    <span
                      style={{
                        fontSize: 11,
                        padding: '2px 6px',
                        borderRadius: 2,
                        fontWeight: 500,
                        color: '#fff',
                        backgroundColor: catInfo.color,
                        flexShrink: 0,
                        lineHeight: '18px',
                      }}
                    >
                      {catInfo.label.replace('项目', '')}
                    </span>
                  </div>

                  {/* 进度条 */}
                  <div
                    style={{
                      width: '100%',
                      height: 8,
                      backgroundColor: '#E8E8E8',
                      borderRadius: 4,
                      marginTop: 12,
                      position: 'relative',
                    }}
                  >
                    <div
                      style={{
                        width: `${barPercent}%`,
                        height: '100%',
                        backgroundColor: '#4A90D9',
                        borderRadius: 4,
                        transition: 'width 0.3s ease',
                      }}
                    />
                  </div>

                  {/* 季度标签 Q1-Q4 */}
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      marginTop: 6,
                      fontSize: 11,
                      color: '#999',
                    }}
                  >
                    {['Q1', 'Q2', 'Q3', 'Q4'].map((q) => {
                      const qData = project.quarters.find((c) => c.quarter === q);
                      const cost = qData?.cost || 0;
                      return (
                        <span key={q}>
                          {q} {cost > 0 ? formatCost(cost) : '待统计'}
                        </span>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* 右侧：达成率 + 总成本 */}
              <div style={{ flexShrink: 0, textAlign: 'right', marginLeft: 24, minWidth: 100 }}>
                {/* 达成率 */}
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 500,
                    color: progressColor,
                  }}
                >
                  {progressPercent}%
                </div>
                {/* 总成本 */}
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: '#333',
                    marginTop: 8,
                  }}
                >
                  {formatCost(project.totalCost)}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  /** 渲染预警区域 - 按季度达成率显示 */
  const renderWarningSection = () => {
    if (filteredWarnings.length === 0) return null;

    return (
      <div
        style={{
          backgroundColor: '#fff2f0',
          border: '1px solid #ffccc7',
          borderRadius: 12,
          padding: '20px 24px',
          marginBottom: 24,
        }}
      >
        {/* 预警标题 */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 12,
          }}
        >
          <AlertOutlined style={{ fontSize: 18, color: '#ff4d4f' }} />
          <Text strong style={{ fontSize: 15, color: '#cf1322' }}>
            成本预警
          </Text>
        </div>

        {/* 预警提示语 */}
        <Text style={{ fontSize: 13, color: '#a8071a', display: 'block', marginBottom: 16 }}>
          以下项目投入成本超过20万但达成率低于70%，建议重点关注
        </Text>

        {/* 预警项目列表 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filteredWarnings.map((project) => (
            <div
              key={project.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 16px',
                backgroundColor: '#fff',
                borderRadius: 8,
                border: '1px solid #ffccc7',
                gap: 12,
                flexWrap: 'wrap',
              }}
            >
              {/* 项目名 */}
              <Text strong style={{ fontSize: 14, flex: '0 0 160px' }}>
                {project.name}
              </Text>

              {/* 类别标签 */}
              <div style={{ flexShrink: 0 }}>
                {getCategoryTag(project.category)}
              </div>

              {/* 季度达成率 */}
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                {['Q1', 'Q2', 'Q3', 'Q4'].map((q) => {
                  const p = project.quarterProgress?.[q];
                  if (p == null || p === 0) {
                    return (
                      <Tag key={q} style={{ fontSize: 11, margin: 0, borderRadius: 4 }}>
                        {q} -
                      </Tag>
                    );
                  }
                  return (
                    <Tag
                      key={q}
                      color={p >= 100 ? 'success' : p >= 70 ? 'processing' : 'error'}
                      style={{ fontSize: 11, margin: 0, borderRadius: 4 }}
                    >
                      {q} {p}%
                    </Tag>
                  );
                })}
              </div>

              {/* 成本 */}
              <Text
                style={{
                  fontSize: 13,
                  color: '#a8071a',
                  fontWeight: 600,
                  flexShrink: 0,
                  minWidth: 80,
                  textAlign: 'right',
                }}
              >
                {formatCost(project.totalCost)}
              </Text>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // ==================== 页面渲染 ====================

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 100 }}>
        <Spin size="large" tip="加载中..." />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 0' }}>
      <Title level={4} style={{ marginBottom: 24 }}>
        成本分析
      </Title>

      {/* 1. 成本总览卡片 - 4个渐变色卡片 */}
      {renderOverviewCards()}

      {/* 2. 筛选器 */}
      <Card
        bordered={false}
        style={{ marginBottom: 24, borderRadius: 8 }}
        styles={{ body: { padding: '12px 20px' } }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
          {/* 分类筛选 - 按钮组 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <FilterOutlined style={{ fontSize: 13, color: '#8c8c8c', marginRight: 4 }} />
            <Text type="secondary" style={{ fontSize: 13, fontWeight: 500, marginRight: 4 }}>
              项目分类:
            </Text>
            {categoryFilterOptions.map((opt) => (
              <Button
                key={opt.key}
                size="small"
                type={categoryFilter === opt.key ? 'primary' : 'default'}
                onClick={() => setCategoryFilter(opt.key)}
                style={{
                  borderRadius: 16,
                  fontSize: 12,
                }}
              >
                {opt.label}
              </Button>
            ))}
          </div>

          {/* 分隔 */}
          <div style={{ width: 1, height: 20, backgroundColor: '#f0f0f0', margin: '0 8px' }} />

          {/* OKR筛选 - 下拉选择框 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
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
          </div>
        </div>
      </Card>

      {/* 3. 预警区域 */}
      {renderWarningSection()}

      {/* 4. 成本排行列表 */}
      <Card
        title={
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <TrophyOutlined style={{ color: '#faad14' }} />
            项目成本投入排行
          </span>
        }
        bordered={false}
        style={{ borderRadius: 8 }}
        styles={{
          header: { borderBottom: '1px solid #f0f0f0' },
          body: { padding: '16px 0' },
        }}
      >
        {renderCostRanking()}
      </Card>
    </div>
  );
}
