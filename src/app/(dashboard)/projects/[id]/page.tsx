'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Button,
  Card,
  Descriptions,
  Tag,
  Tabs,
  Table,
  Progress,
  Input,
  InputNumber,
  Space,
  Spin,
  Result,
  Typography,
  Modal,
  Form,
  Select,
  Collapse,
  message,
} from 'antd';
import {
  ArrowLeftOutlined,
  EditOutlined,
  CheckOutlined,
  CloseOutlined,
  PlusOutlined,
} from '@ant-design/icons';

const { Title, Text } = Typography;

// ==================== 类型定义 ====================

interface ProjectOwner {
  id: string;
  name: string;
}

interface ProjectTeam {
  id: string;
  name: string;
}

interface Milestone {
  id: string;
  projectId: string;
  quarter: string;
  target: string;
  achievement: string;
  progress: number;
  sortOrder: number;
}

interface Cost {
  id: string;
  projectId: string;
  quarter: string;
  laborCost: number;
  infraCost: number;
  externalCost: number;
  totalCost: number;
  target: string;
  dataSource: string;
}

interface Roi {
  id: string;
  projectId: string;
  quarter: string;
  revenue: number;
  costSaving: number;
  efficiencyGain: number;
  totalBenefit: number;
  totalCost: number;
  roiPercent: number;
  targetRoi: number;
}

interface Project {
  id: string;
  name: string;
  code: string;
  type: string;
  priority: string;
  status: string;
  health: string;
  progress: number;
  delayDays: number;
  resourceRate: number;
  startDate: string | null;
  endDate: string | null;
  ownerId: string | null;
  teamId: string;
  budget: number | null;
  description: string | null;
  category: string;
  okrName: string;
  partner: string;
  po: string;
  createdAt: string;
  owner: ProjectOwner | null;
  team: ProjectTeam | null;
  milestones: Milestone[];
  costs: Cost[];
  rois: Roi[];
  totalCost: number;
}

// ==================== 映射工具 ====================

const categoryMap: Record<string, { label: string; color: string }> = {
  STRATEGIC: { label: '战略项目', color: 'red' },
  REGULAR: { label: '常规项目', color: 'blue' },
  TECHNICAL: { label: '技术项目', color: 'purple' },
};

const statusMap: Record<string, { label: string; color: string }> = {
  PLANNING: { label: '规划中', color: 'default' },
  IN_PROGRESS: { label: '进行中', color: 'processing' },
  ON_HOLD: { label: '暂停', color: 'warning' },
  COMPLETED: { label: '已完成', color: 'success' },
  CANCELLED: { label: '已取消', color: 'error' },
};

const healthMap: Record<string, { label: string; color: string }> = {
  HEALTHY: { label: '健康', color: 'green' },
  AT_RISK: { label: '风险', color: 'orange' },
  CRITICAL: { label: '严重', color: 'red' },
};

const priorityMap: Record<string, string> = {
  CRITICAL: '紧急',
  HIGH: '高',
  MEDIUM: '中',
  LOW: '低',
};

const typeMap: Record<string, string> = {
  INTERNAL: '内部项目',
  EXTERNAL: '外部项目',
  RESEARCH: '研究项目',
  MAINTENANCE: '维护项目',
  STRATEGIC: '战略项目',
  REGULAR: '常规项目',
  TECHNICAL: '技术项目',
};

// ==================== 组件 ====================

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [project, setProject] = useState<Project | null>(null);

  // 里程碑编辑状态
  const [editingMilestone, setEditingMilestone] = useState<string | null>(null);
  const [editMilestoneData, setEditMilestoneData] = useState<Partial<Milestone>>({});

  // 成本编辑状态
  const [editingCost, setEditingCost] = useState<string | null>(null);
  const [editCostData, setEditCostData] = useState<Partial<Cost>>({});

  // ROI编辑状态
  const [editingRoi, setEditingRoi] = useState<string | null>(null);
  const [editRoiData, setEditRoiData] = useState<Partial<Roi>>({});

  // 项目编辑弹窗状态
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editModalLoading, setEditModalLoading] = useState(false);
  const [editForm] = Form.useForm();
  const [editQuarters, setEditQuarters] = useState<Record<string, { target: string; achievement: string; progress: number | null; cost: number | null }>>({
    Q1: { target: '', achievement: '', progress: null, cost: null },
    Q2: { target: '', achievement: '', progress: null, cost: null },
    Q3: { target: '', achievement: '', progress: null, cost: null },
    Q4: { target: '', achievement: '', progress: null, cost: null },
  });

  const fetchProject = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/v1/projects/${projectId}`);
      if (res.status === 404) {
        setNotFound(true);
        return;
      }
      const json = await res.json();
      if (json.code === 0) {
        setProject(json.data);
      }
    } catch {
      message.error('获取项目数据失败');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchProject();
  }, [fetchProject]);

  // ==================== 里程碑编辑 ====================

  const handleMilestoneEdit = (record: Milestone) => {
    setEditingMilestone(record.id);
    setEditMilestoneData({
      target: record.target,
      achievement: record.achievement,
      progress: record.progress,
    });
  };

  const handleMilestoneSave = async (record: Milestone) => {
    try {
      const res = await fetch(`/api/v1/projects/${projectId}/milestones`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([
          {
            quarter: record.quarter,
            target: editMilestoneData.target ?? record.target,
            achievement: editMilestoneData.achievement ?? record.achievement,
            progress: editMilestoneData.progress ?? record.progress,
            sortOrder: record.sortOrder,
          },
        ]),
      });
      const json = await res.json();
      if (json.code === 0) {
        message.success('里程碑更新成功');
        setEditingMilestone(null);
        fetchProject();
      } else {
        message.error(json.message || '更新失败');
      }
    } catch {
      message.error('更新失败');
    }
  };

  const handleMilestoneCancel = () => {
    setEditingMilestone(null);
    setEditMilestoneData({});
  };

  // ==================== 成本编辑 ====================

  const handleCostEdit = (record: Cost) => {
    setEditingCost(record.id);
    setEditCostData({
      laborCost: record.laborCost,
      infraCost: record.infraCost,
      externalCost: record.externalCost,
      totalCost: record.totalCost,
      target: record.target,
    });
  };

  const handleCostSave = async (record: Cost) => {
    try {
      const res = await fetch(`/api/v1/projects/${projectId}/costs`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([
          {
            quarter: record.quarter,
            laborCost: editCostData.laborCost ?? record.laborCost,
            infraCost: editCostData.infraCost ?? record.infraCost,
            externalCost: editCostData.externalCost ?? record.externalCost,
            totalCost: editCostData.totalCost ?? record.totalCost,
            target: editCostData.target ?? record.target,
          },
        ]),
      });
      const json = await res.json();
      if (json.code === 0) {
        message.success('成本更新成功');
        setEditingCost(null);
        fetchProject();
      } else {
        message.error(json.message || '更新失败');
      }
    } catch {
      message.error('更新失败');
    }
  };

  const handleCostCancel = () => {
    setEditingCost(null);
    setEditCostData({});
  };

  // ==================== ROI编辑 ====================

  const handleRoiEdit = (record: Roi) => {
    setEditingRoi(record.id);
    setEditRoiData({
      revenue: record.revenue,
      costSaving: record.costSaving,
      efficiencyGain: record.efficiencyGain,
      totalBenefit: record.totalBenefit,
      totalCost: record.totalCost,
      roiPercent: record.roiPercent,
      targetRoi: record.targetRoi,
    });
  };

  const handleRoiSave = async (record: Roi) => {
    try {
      const res = await fetch(`/api/v1/projects/${projectId}/roi`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([
          {
            quarter: record.quarter,
            revenue: editRoiData.revenue ?? record.revenue,
            costSaving: editRoiData.costSaving ?? record.costSaving,
            efficiencyGain: editRoiData.efficiencyGain ?? record.efficiencyGain,
            totalBenefit: editRoiData.totalBenefit ?? record.totalBenefit,
            totalCost: editRoiData.totalCost ?? record.totalCost,
            roiPercent: editRoiData.roiPercent ?? record.roiPercent,
            targetRoi: editRoiData.targetRoi ?? record.targetRoi,
          },
        ]),
      });
      const json = await res.json();
      if (json.code === 0) {
        message.success('ROI更新成功');
        setEditingRoi(null);
        fetchProject();
      } else {
        message.error(json.message || '更新失败');
      }
    } catch {
      message.error('更新失败');
    }
  };

  const handleRoiCancel = () => {
    setEditingRoi(null);
    setEditRoiData({});
  };

  // ==================== 项目编辑弹窗 ====================

  const handleOpenEditModal = () => {
    if (!project) return;
    editForm.setFieldsValue({
      name: project.name,
      category: project.category,
      okrName: project.okrName || '',
      po: project.po || '',
      partner: project.partner || '',
      description: project.description || '',
      status: project.status,
    });
    const qData: Record<string, { target: string; achievement: string; progress: number | null; cost: number | null }> = {
      Q1: { target: '', achievement: '', progress: null, cost: null },
      Q2: { target: '', achievement: '', progress: null, cost: null },
      Q3: { target: '', achievement: '', progress: null, cost: null },
      Q4: { target: '', achievement: '', progress: null, cost: null },
    };
    project.milestones.forEach((m) => {
      if (qData[m.quarter]) {
        qData[m.quarter] = {
          target: m.target || '',
          achievement: m.achievement || '',
          progress: m.progress,
          cost: qData[m.quarter].cost,
        };
      }
    });
    project.costs.forEach((c) => {
      if (qData[c.quarter]) {
        qData[c.quarter].cost = c.totalCost;
      }
    });
    setEditQuarters(qData);
    setEditModalOpen(true);
  };

  const handleEditModalSubmit = async () => {
    try {
      const values = await editForm.validateFields();
      setEditModalLoading(true);

      const milestones = ['Q1', 'Q2', 'Q3', 'Q4'].map((q, idx) => ({
        quarter: q,
        target: editQuarters[q].target,
        achievement: editQuarters[q].achievement,
        progress: editQuarters[q].progress ?? 0,
        sortOrder: idx + 1,
      }));

      const costs = ['Q1', 'Q2', 'Q3', 'Q4']
        .filter((q) => editQuarters[q].cost != null && editQuarters[q].cost! > 0)
        .map((q) => ({
          quarter: q,
          totalCost: editQuarters[q].cost,
          target: `${q}目标`,
        }));

      const res = await fetch(`/api/v1/projects/${projectId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...values,
          milestones,
          costs,
        }),
      });
      const json = await res.json();
      if (json.code === 0) {
        message.success('项目更新成功');
        setEditModalOpen(false);
        fetchProject();
      } else {
        message.error(json.message || '更新失败');
      }
    } catch {
      // 表单验证失败
    } finally {
      setEditModalLoading(false);
    }
  };

  // ==================== 渲染辅助 ====================

  const formatCost = (val: number) => {
    return (val / 10000).toFixed(2);
  };

  const getProgressColor = (val: number) => {
    if (val < 30) return '#ff4d4f';
    if (val <= 70) return '#faad14';
    return '#52c41a';
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('zh-CN');
  };

  // ==================== 里程碑列定义 ====================

  const milestoneColumns = [
    {
      title: '季度',
      dataIndex: 'quarter',
      key: 'quarter',
      width: 100,
    },
    {
      title: '目标',
      dataIndex: 'target',
      key: 'target',
      render: (text: string, record: Milestone) => {
        if (editingMilestone === record.id) {
          return (
            <Input.TextArea
              value={editMilestoneData.target ?? text}
              onChange={(e) => setEditMilestoneData({ ...editMilestoneData, target: e.target.value })}
              autoSize={{ minRows: 2, maxRows: 6 }}
            />
          );
        }
        return <div style={{ whiteSpace: 'pre-wrap' }}>{text || '-'}</div>;
      },
    },
    {
      title: '达成',
      dataIndex: 'achievement',
      key: 'achievement',
      render: (text: string, record: Milestone) => {
        if (editingMilestone === record.id) {
          return (
            <Input.TextArea
              value={editMilestoneData.achievement ?? text}
              onChange={(e) => setEditMilestoneData({ ...editMilestoneData, achievement: e.target.value })}
              autoSize={{ minRows: 2, maxRows: 6 }}
            />
          );
        }
        return <div style={{ whiteSpace: 'pre-wrap' }}>{text || '-'}</div>;
      },
    },
    {
      title: '达成率',
      dataIndex: 'progress',
      key: 'progress',
      width: 200,
      render: (val: number, record: Milestone) => {
        if (editingMilestone === record.id) {
          return (
            <InputNumber
              value={editMilestoneData.progress ?? val}
              onChange={(v) => setEditMilestoneData({ ...editMilestoneData, progress: v ?? 0 })}
              min={0}
              max={100}
              formatter={(value) => `${value}%`}
              parser={(value) => Number(value?.replace('%', '') || 0)}
              size="small"
              style={{ width: 120 }}
            />
          );
        }
        return (
          <Progress
            percent={Math.round(val)}
            strokeColor={getProgressColor(val)}
            size="small"
          />
        );
      },
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_: unknown, record: Milestone) => {
        if (editingMilestone === record.id) {
          return (
            <Space size="small">
              <Button
                type="link"
                size="small"
                icon={<CheckOutlined />}
                onClick={() => handleMilestoneSave(record)}
              >
                保存
              </Button>
              <Button
                type="link"
                size="small"
                icon={<CloseOutlined />}
                onClick={handleMilestoneCancel}
              >
                取消
              </Button>
            </Space>
          );
        }
        return (
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleMilestoneEdit(record)}
          >
            编辑
          </Button>
        );
      },
    },
  ];

  // ==================== 成本列定义 ====================

  const costColumns = [
    {
      title: '季度',
      dataIndex: 'quarter',
      key: 'quarter',
      width: 100,
    },
    {
      title: '人力成本（万元）',
      dataIndex: 'laborCost',
      key: 'laborCost',
      render: (val: number, record: Cost) => {
        if (editingCost === record.id) {
          return (
            <InputNumber
              value={editCostData.laborCost ?? val}
              onChange={(v) => setEditCostData({ ...editCostData, laborCost: v ?? 0 })}
              min={0}
              size="small"
              style={{ width: 120 }}
            />
          );
        }
        return formatCost(val);
      },
    },
    {
      title: '基础设施成本（万元）',
      dataIndex: 'infraCost',
      key: 'infraCost',
      render: (val: number, record: Cost) => {
        if (editingCost === record.id) {
          return (
            <InputNumber
              value={editCostData.infraCost ?? val}
              onChange={(v) => setEditCostData({ ...editCostData, infraCost: v ?? 0 })}
              min={0}
              size="small"
              style={{ width: 120 }}
            />
          );
        }
        return formatCost(val);
      },
    },
    {
      title: '外部采购成本（万元）',
      dataIndex: 'externalCost',
      key: 'externalCost',
      render: (val: number, record: Cost) => {
        if (editingCost === record.id) {
          return (
            <InputNumber
              value={editCostData.externalCost ?? val}
              onChange={(v) => setEditCostData({ ...editCostData, externalCost: v ?? 0 })}
              min={0}
              size="small"
              style={{ width: 120 }}
            />
          );
        }
        return formatCost(val);
      },
    },
    {
      title: '总成本（万元）',
      dataIndex: 'totalCost',
      key: 'totalCost',
      render: (val: number, record: Cost) => {
        if (editingCost === record.id) {
          return (
            <InputNumber
              value={editCostData.totalCost ?? val}
              onChange={(v) => setEditCostData({ ...editCostData, totalCost: v ?? 0 })}
              min={0}
              size="small"
              style={{ width: 120 }}
            />
          );
        }
        return <Text strong>{formatCost(val)}</Text>;
      },
    },
    {
      title: '业务目标',
      dataIndex: 'target',
      key: 'target',
      render: (text: string, record: Cost) => {
        if (editingCost === record.id) {
          return (
            <Input
              value={editCostData.target ?? text}
              onChange={(e) => setEditCostData({ ...editCostData, target: e.target.value })}
              size="small"
            />
          );
        }
        return text || '-';
      },
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_: unknown, record: Cost) => {
        if (editingCost === record.id) {
          return (
            <Space size="small">
              <Button
                type="link"
                size="small"
                icon={<CheckOutlined />}
                onClick={() => handleCostSave(record)}
              >
                保存
              </Button>
              <Button
                type="link"
                size="small"
                icon={<CloseOutlined />}
                onClick={handleCostCancel}
              >
                取消
              </Button>
            </Space>
          );
        }
        return (
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleCostEdit(record)}
          >
            编辑
          </Button>
        );
      },
    },
  ];

  // 成本合计
  const costSummary = project?.costs.reduce(
    (acc, c) => ({
      laborCost: acc.laborCost + c.laborCost,
      infraCost: acc.infraCost + c.infraCost,
      externalCost: acc.externalCost + c.externalCost,
      totalCost: acc.totalCost + c.totalCost,
    }),
    { laborCost: 0, infraCost: 0, externalCost: 0, totalCost: 0 },
  );

  // ==================== ROI列定义 ====================

  const roiColumns = [
    {
      title: '季度',
      dataIndex: 'quarter',
      key: 'quarter',
      width: 100,
    },
    {
      title: '直接收入（万元）',
      dataIndex: 'revenue',
      key: 'revenue',
      render: (val: number, record: Roi) => {
        if (editingRoi === record.id) {
          return (
            <InputNumber
              value={editRoiData.revenue ?? val}
              onChange={(v) => setEditRoiData({ ...editRoiData, revenue: v ?? 0 })}
              size="small"
              style={{ width: 120 }}
            />
          );
        }
        return formatCost(val);
      },
    },
    {
      title: '成本节约（万元）',
      dataIndex: 'costSaving',
      key: 'costSaving',
      render: (val: number, record: Roi) => {
        if (editingRoi === record.id) {
          return (
            <InputNumber
              value={editRoiData.costSaving ?? val}
              onChange={(v) => setEditRoiData({ ...editRoiData, costSaving: v ?? 0 })}
              size="small"
              style={{ width: 120 }}
            />
          );
        }
        return formatCost(val);
      },
    },
    {
      title: '效率提升（万元）',
      dataIndex: 'efficiencyGain',
      key: 'efficiencyGain',
      render: (val: number, record: Roi) => {
        if (editingRoi === record.id) {
          return (
            <InputNumber
              value={editRoiData.efficiencyGain ?? val}
              onChange={(v) => setEditRoiData({ ...editRoiData, efficiencyGain: v ?? 0 })}
              size="small"
              style={{ width: 120 }}
            />
          );
        }
        return formatCost(val);
      },
    },
    {
      title: '总收益（万元）',
      dataIndex: 'totalBenefit',
      key: 'totalBenefit',
      render: (val: number, record: Roi) => {
        if (editingRoi === record.id) {
          return (
            <InputNumber
              value={editRoiData.totalBenefit ?? val}
              onChange={(v) => setEditRoiData({ ...editRoiData, totalBenefit: v ?? 0 })}
              size="small"
              style={{ width: 120 }}
            />
          );
        }
        return <Text strong>{formatCost(val)}</Text>;
      },
    },
    {
      title: '总成本（万元）',
      dataIndex: 'totalCost',
      key: 'totalCost',
      render: (val: number, record: Roi) => {
        if (editingRoi === record.id) {
          return (
            <InputNumber
              value={editRoiData.totalCost ?? val}
              onChange={(v) => setEditRoiData({ ...editRoiData, totalCost: v ?? 0 })}
              size="small"
              style={{ width: 120 }}
            />
          );
        }
        return formatCost(val);
      },
    },
    {
      title: 'ROI',
      dataIndex: 'roiPercent',
      key: 'roiPercent',
      width: 100,
      render: (val: number, record: Roi) => {
        if (editingRoi === record.id) {
          return (
            <InputNumber
              value={editRoiData.roiPercent ?? val}
              onChange={(v) => setEditRoiData({ ...editRoiData, roiPercent: v ?? 0 })}
              size="small"
              style={{ width: 100 }}
            />
          );
        }
        const isOk = val >= record.targetRoi;
        return (
          <Text style={{ color: isOk ? '#52c41a' : '#ff4d4f', fontWeight: 600 }}>
            {val.toFixed(1)}%
          </Text>
        );
      },
    },
    {
      title: '目标ROI',
      dataIndex: 'targetRoi',
      key: 'targetRoi',
      width: 100,
      render: (val: number, record: Roi) => {
        if (editingRoi === record.id) {
          return (
            <InputNumber
              value={editRoiData.targetRoi ?? val}
              onChange={(v) => setEditRoiData({ ...editRoiData, targetRoi: v ?? 0 })}
              size="small"
              style={{ width: 100 }}
            />
          );
        }
        return `${val.toFixed(1)}%`;
      },
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_: unknown, record: Roi) => {
        if (editingRoi === record.id) {
          return (
            <Space size="small">
              <Button
                type="link"
                size="small"
                icon={<CheckOutlined />}
                onClick={() => handleRoiSave(record)}
              >
                保存
              </Button>
              <Button
                type="link"
                size="small"
                icon={<CloseOutlined />}
                onClick={handleRoiCancel}
              >
                取消
              </Button>
            </Space>
          );
        }
        return (
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleRoiEdit(record)}
          >
            编辑
          </Button>
        );
      },
    },
  ];

  // ==================== 页面渲染 ====================

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 100 }}>
        <Spin size="large" tip="加载中..." />
      </div>
    );
  }

  if (notFound) {
    return (
      <Result
        status="404"
        title="404"
        subTitle="项目不存在"
        extra={
          <Button type="primary" onClick={() => router.push('/projects')}>
            返回项目列表
          </Button>
        }
      />
    );
  }

  if (!project) {
    return null;
  }

  const catInfo = categoryMap[project.category] || { label: project.category, color: 'default' };
  const statusInfo = statusMap[project.status] || { label: project.status, color: 'default' };
  const healthInfo = healthMap[project.health] || { label: project.health, color: 'default' };

  const tabItems = [
    {
      key: 'milestones',
      label: '季度里程碑',
      children: (
        <Card>
          <Table
            dataSource={project.milestones}
            columns={milestoneColumns}
            rowKey="id"
            pagination={false}
            size="middle"
            footer={() => (
              <Button type="dashed" icon={<PlusOutlined />} block disabled>
                添加里程碑
              </Button>
            )}
          />
        </Card>
      ),
    },
    {
      key: 'costs',
      label: '项目成本',
      children: (
        <Card>
          <Table
            dataSource={project.costs}
            columns={costColumns}
            rowKey="id"
            pagination={false}
            size="middle"
            footer={() =>
              costSummary ? (
                <div style={{ display: 'flex', gap: 48, fontWeight: 600 }}>
                  <span>合计</span>
                  <span>人力成本：{formatCost(costSummary.laborCost)} 万元</span>
                  <span>基础设施成本：{formatCost(costSummary.infraCost)} 万元</span>
                  <span>外部采购成本：{formatCost(costSummary.externalCost)} 万元</span>
                  <span>总成本：<Text type="danger">{formatCost(costSummary.totalCost)} 万元</Text></span>
                </div>
              ) : null
            }
          />
        </Card>
      ),
    },
    {
      key: 'roi',
      label: '项目ROI',
      children: (
        <Card>
          <Table
            dataSource={project.rois}
            columns={roiColumns}
            rowKey="id"
            pagination={false}
            size="middle"
          />
        </Card>
      ),
    },
  ];

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 0' }}>
      {/* 顶部区域 */}
      <div style={{ marginBottom: 24 }}>
        <Button
          type="link"
          icon={<ArrowLeftOutlined />}
          onClick={() => window.history.back()}
          style={{ padding: 0, marginBottom: 12 }}
        >
          返回项目列表
        </Button>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <Title level={2} style={{ marginBottom: 12 }}>
              {project.name}
            </Title>
            <Space size={8} wrap>
              <Tag color={catInfo.color}>{catInfo.label}</Tag>
              <Tag color={statusInfo.color}>{statusInfo.label}</Tag>
              <Tag color={healthInfo.color}>{healthInfo.label}</Tag>
            </Space>
          </div>
          <Button icon={<EditOutlined />} onClick={handleOpenEditModal}>编辑</Button>
        </div>
      </div>

      {/* 基本信息 */}
      <Card style={{ marginBottom: 24 }}>
        <Descriptions bordered column={{ xs: 1, sm: 2, md: 3 }} size="small">
          <Descriptions.Item label="项目编号">{project.code}</Descriptions.Item>
          <Descriptions.Item label="项目类型">{typeMap[project.type] || project.type}</Descriptions.Item>
          <Descriptions.Item label="优先级">{priorityMap[project.priority] || project.priority}</Descriptions.Item>
          <Descriptions.Item label="负责人（PO）">{project.po || project.owner?.name || '-'}</Descriptions.Item>
          <Descriptions.Item label="所属团队">{project.team?.name || '-'}</Descriptions.Item>
          <Descriptions.Item label="核心Partner">{project.partner || '-'}</Descriptions.Item>
          <Descriptions.Item label="开始日期">{formatDate(project.startDate)}</Descriptions.Item>
          <Descriptions.Item label="结束日期">{formatDate(project.endDate)}</Descriptions.Item>
          <Descriptions.Item label="项目进度">
            <Progress percent={Math.round(project.progress)} size="small" style={{ width: 120 }} />
          </Descriptions.Item>
          <Descriptions.Item label="项目描述" span={3}>
            {project.description || '-'}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      {/* Tabs区域 */}
      <Tabs items={tabItems} defaultActiveKey="milestones" />

      {/* 项目编辑弹窗 */}
      <Modal
        title="编辑项目"
        open={editModalOpen}
        onCancel={() => setEditModalOpen(false)}
        onOk={handleEditModalSubmit}
        confirmLoading={editModalLoading}
        width={720}
        destroyOnClose
      >
        <Form form={editForm} layout="vertical" size="small">
          <Form.Item name="name" label="项目名称" rules={[{ required: true, message: '请输入项目名称' }]}>
            <Input />
          </Form.Item>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <Form.Item name="category" label="分类">
              <Select options={[
                { value: 'STRATEGIC', label: '战略项目' },
                { value: 'REGULAR', label: '常规项目' },
                { value: 'TECHNICAL', label: '技术项目' },
              ]} />
            </Form.Item>
            <Form.Item name="okrName" label="OKR名称">
              <Input />
            </Form.Item>
            <Form.Item name="po" label="负责人（PO）">
              <Input />
            </Form.Item>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Form.Item name="partner" label="核心Partner">
              <Input />
            </Form.Item>
            <Form.Item name="status" label="状态">
              <Select options={[
                { value: 'PLANNING', label: '规划中' },
                { value: 'IN_PROGRESS', label: '进行中' },
                { value: 'ON_HOLD', label: '暂停' },
                { value: 'COMPLETED', label: '已完成' },
                { value: 'CANCELLED', label: '已取消' },
              ]} />
            </Form.Item>
          </div>
          <Form.Item name="description" label="项目描述">
            <Input.TextArea autoSize={{ minRows: 2, maxRows: 4 }} />
          </Form.Item>
        </Form>

        <div style={{ marginTop: 8, marginBottom: 12 }}>
          <Text strong style={{ fontSize: 14 }}>季度数据</Text>
        </div>
        <Collapse
          size="small"
          items={['Q1', 'Q2', 'Q3', 'Q4'].map((q) => ({
            key: q,
            label: <Text strong>{q}</Text>,
            children: (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <Text type="secondary" style={{ fontSize: 12 }}>季度目标</Text>
                  <Input.TextArea
                    value={editQuarters[q].target}
                    onChange={(e) => setEditQuarters({ ...editQuarters, [q]: { ...editQuarters[q], target: e.target.value } })}
                    autoSize={{ minRows: 2, maxRows: 6 }}
                    style={{ marginTop: 4 }}
                  />
                </div>
                <div>
                  <Text type="secondary" style={{ fontSize: 12 }}>已达成成果</Text>
                  <Input.TextArea
                    value={editQuarters[q].achievement}
                    onChange={(e) => setEditQuarters({ ...editQuarters, [q]: { ...editQuarters[q], achievement: e.target.value } })}
                    autoSize={{ minRows: 2, maxRows: 6 }}
                    style={{ marginTop: 4 }}
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <Text type="secondary" style={{ fontSize: 12 }}>达成率</Text>
                    <InputNumber
                      value={editQuarters[q].progress}
                      onChange={(v) => setEditQuarters({ ...editQuarters, [q]: { ...editQuarters[q], progress: v } })}
                      min={0}
                      max={100}
                      addonAfter="%"
                      style={{ width: '100%', marginTop: 4 }}
                    />
                  </div>
                  <div>
                    <Text type="secondary" style={{ fontSize: 12 }}>成本（元）</Text>
                    <InputNumber
                      value={editQuarters[q].cost}
                      onChange={(v) => setEditQuarters({ ...editQuarters, [q]: { ...editQuarters[q], cost: v } })}
                      min={0}
                      style={{ width: '100%', marginTop: 4 }}
                    />
                  </div>
                </div>
              </div>
            ),
          }))}
        />
      </Modal>
    </div>
  );
}
