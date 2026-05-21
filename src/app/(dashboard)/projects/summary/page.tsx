'use client';

import React, { useEffect, useState } from 'react';
import {
  Card,
  Row,
  Col,
  Typography,
  Spin,
  Tag,
  Alert,
} from 'antd';
import {
  TrophyOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  DashboardOutlined,
  ThunderboltOutlined,
  BulbOutlined,
} from '@ant-design/icons';

const { Title, Text } = Typography;

// ==================== 类型定义 ====================

interface ProgressProject {
  id: string;
  name: string;
  category: string;
  avgProgress: number;
  totalCost: number;
}

interface ProgressDistribution {
  highProgress: ProgressProject[];
  mediumProgress: ProgressProject[];
  lowProgress: ProgressProject[];
}

interface RoiProject {
  id: string;
  name: string;
  category: string;
  avgProgress: number;
  totalCost: number;
}

interface RoiAnalysis {
  efficientProjects: RoiProject[];
  inefficientProjects: RoiProject[];
}

interface OverallStats {
  totalProjects: number;
  totalCost: number;
  avgProgress: number;
}

interface CategoryStatItem {
  count: number;
  [key: string]: unknown;
}

interface CategoryStats {
  STRATEGIC?: CategoryStatItem;
  REGULAR?: CategoryStatItem;
  TECHNICAL?: CategoryStatItem;
}

interface SummaryData {
  progressDistribution: ProgressDistribution;
  roiAnalysis: RoiAnalysis;
  overallStats: OverallStats;
  categoryStats: CategoryStats;
}

// ==================== 工具函数 ====================

/** 金额格式化：>= 10000 显示为 "¥X.X万"，否则 "¥X" */
const formatCost = (value: number): string => {
  if (value >= 10000) {
    return `¥${(value / 10000).toFixed(1)}万`;
  }
  return `¥${value.toFixed(0)}`;
};

/** 达成率格式化：0-1 小数转为百分比 */
const formatProgress = (value: number): string => {
  return `${(value * 100).toFixed(1)}%`;
};

// ==================== 组件 ====================

export default function SummaryPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState<SummaryData | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError('');
        const res = await fetch('/api/v1/projects/summary');
        if (!res.ok) {
          throw new Error(`请求失败: ${res.status}`);
        }
        const json = await res.json();
        if (json.code === 0) {
          setData(json.data);
        } else {
          setError(json.message || '获取数据失败');
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : '获取数据失败';
        setError(message);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // ==================== 计算数据 ====================

  const highProgressCount = data?.progressDistribution?.highProgress?.length || 0;
  const mediumProgressCount = data?.progressDistribution?.mediumProgress?.length || 0;
  const lowProgressCount = data?.progressDistribution?.lowProgress?.length || 0;
  const avgProgress = data?.overallStats?.avgProgress || 0;
  const totalCost = data?.overallStats?.totalCost || 0;

  const efficientProjects = data?.roiAnalysis?.efficientProjects || [];
  const inefficientProjects = data?.roiAnalysis?.inefficientProjects || [];

  const strategicCount = data?.categoryStats?.STRATEGIC?.count || 0;
  const regularCount = data?.categoryStats?.REGULAR?.count || 0;
  const technicalCount = data?.categoryStats?.TECHNICAL?.count || 0;

  // ==================== 渲染：核心指标卡片 ====================

  const renderMetricCards = () => (
    <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
      {/* 高达成项目 */}
      <Col xs={24} sm={12} xl={6}>
        <div
          style={{
            background: 'linear-gradient(135deg, #52c41a 0%, #389e0d 100%)',
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
              高达成项目
            </Text>
            <TrophyOutlined style={{ fontSize: 20, opacity: 0.8 }} />
          </div>
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 36, fontWeight: 700, lineHeight: 1.2 }}>
              {highProgressCount}
            </div>
            <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 13, marginTop: 4, display: 'block' }}>
              {'达成率 >= 90%'}
            </Text>
          </div>
        </div>
      </Col>

      {/* 中等达成项目 */}
      <Col xs={24} sm={12} xl={6}>
        <div
          style={{
            background: 'linear-gradient(135deg, #1890ff 0%, #096dd9 100%)',
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
              中等达成项目
            </Text>
            <CheckCircleOutlined style={{ fontSize: 20, opacity: 0.8 }} />
          </div>
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 36, fontWeight: 700, lineHeight: 1.2 }}>
              {mediumProgressCount}
            </div>
            <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 13, marginTop: 4, display: 'block' }}>
              达成率 50%-90%
            </Text>
          </div>
        </div>
      </Col>

      {/* 需关注项目 */}
      <Col xs={24} sm={12} xl={6}>
        <div
          style={{
            background: 'linear-gradient(135deg, #faad14 0%, #d48806 100%)',
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
              需关注项目
            </Text>
            <WarningOutlined style={{ fontSize: 20, opacity: 0.8 }} />
          </div>
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 36, fontWeight: 700, lineHeight: 1.2 }}>
              {lowProgressCount}
            </div>
            <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 13, marginTop: 4, display: 'block' }}>
              达成率 &lt; 50%
            </Text>
          </div>
        </div>
      </Col>

      {/* 平均达成率 */}
      <Col xs={24} sm={12} xl={6}>
        <div
          style={{
            background: 'linear-gradient(135deg, #434343 0%, #262626 100%)',
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
              平均达成率
            </Text>
            <DashboardOutlined style={{ fontSize: 20, opacity: 0.8 }} />
          </div>
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 36, fontWeight: 700, lineHeight: 1.2 }}>
              {(avgProgress * 100).toFixed(1)}%
            </div>
            <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 13, marginTop: 4, display: 'block' }}>
              总投入 {formatCost(totalCost)}
            </Text>
          </div>
        </div>
      </Col>
    </Row>
  );

  // ==================== 渲染：决策建议区域 ====================

  /** 渲染项目胶囊标签列表 */
  const renderProjectTags = (projects: RoiProject[], tagColor: string) => (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {projects.map((project) => (
        <Tag
          key={project.id}
          color={tagColor}
          style={{
            borderRadius: 16,
            padding: '4px 12px',
            fontSize: 13,
            lineHeight: '20px',
          }}
        >
          {project.name}
          <span style={{ margin: '0 4px', opacity: 0.6 }}>|</span>
          {formatProgress(project.avgProgress)}
          <span style={{ margin: '0 4px', opacity: 0.6 }}>|</span>
          {formatCost(project.totalCost)}
        </Tag>
      ))}
    </div>
  );

  const renderDecisionSection = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* 区块一：高效低投入项目 */}
      {efficientProjects.length > 0 && (
        <div
          style={{
            backgroundColor: '#f6ffed',
            border: '1px solid #b7eb8f',
            borderRadius: 12,
            padding: '20px 24px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <ThunderboltOutlined style={{ fontSize: 18, color: '#52c41a' }} />
            <Text strong style={{ fontSize: 15, color: '#389e0d' }}>
              高效低投入项目 - 建议复制推广
            </Text>
          </div>
          <Text style={{ fontSize: 13, color: '#135200', display: 'block', marginBottom: 12 }}>
            {'以下项目达成率 >= 90% 且成本 < 20万，表现出色，建议总结经验并推广复制'}
          </Text>
          {renderProjectTags(efficientProjects, 'success')}
        </div>
      )}

      {/* 区块二：高投入低达成项目 */}
      {inefficientProjects.length > 0 && (
        <div
          style={{
            backgroundColor: '#fff2f0',
            border: '1px solid #ffccc7',
            borderRadius: 12,
            padding: '20px 24px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <WarningOutlined style={{ fontSize: 18, color: '#ff4d4f' }} />
            <Text strong style={{ fontSize: 15, color: '#cf1322' }}>
              高投入低达成项目 - 建议重点关注
            </Text>
          </div>
          <Text style={{ fontSize: 13, color: '#a8071a', display: 'block', marginBottom: 12 }}>
            以下项目达成率 &lt; 50% 且成本 &gt; 20万，投入产出比偏低，建议重点评估调整
          </Text>
          {renderProjectTags(inefficientProjects, 'error')}
        </div>
      )}

      {/* 区块三：资源配置建议 */}
      <Card
        bordered={false}
        style={{ borderRadius: 12 }}
        styles={{ body: { padding: '20px 24px' } }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <BulbOutlined style={{ fontSize: 18, color: '#faad14' }} />
          <Text strong style={{ fontSize: 15 }}>
            资源配置建议
          </Text>
        </div>
        <Text style={{ fontSize: 14, lineHeight: 1.8 }}>
          战略项目{strategicCount}个，常规项目{regularCount}个，技术项目{technicalCount}个。建议优先保障高达成率项目的资源，对低达成率项目进行评估调整。
        </Text>
      </Card>
    </div>
  );

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
        执行摘要
      </Title>

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

      {/* 1. 核心指标卡片 */}
      {renderMetricCards()}

      {/* 2. 决策建议区域 */}
      {data && renderDecisionSection()}
    </div>
  );
}
