'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  Select,
  InputNumber,
  Tag,
  Progress,
  Popconfirm,
  Space,
  Card,
  Row,
  Col,
  Collapse,
  message,
  Typography,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';

const { TextArea } = Input;
const { Text } = Typography;

// ==================== 类型定义 ====================

/** 季度里程碑数据 */
interface QuarterMilestone {
  quarter: string;
  target: string;
  achievement: string;
  progress: number;
}

/** 季度成本数据 */
interface QuarterCost {
  quarter: string;
  totalCost: number;
  target: string;
}

/** 项目列表项 */
interface ProjectItem {
  id: string;
  code: string;
  name: string;
  category: string;
  okrName: string;
  po: string;
  status: string;
  totalCost: number;
  avgProgress: number;
  partner?: string;
  description?: string;
  milestones?: QuarterMilestone[];
  costs?: QuarterCost[];
}

/** 项目详情（编辑时获取） */
interface ProjectDetail extends ProjectItem {
  partner: string;
  description: string;
}

/** API 响应 */
interface ApiResponse<T> {
  code: number;
  data: T;
  message?: string;
}

/** 列表响应 */
interface ListData {
  list: ProjectItem[];
  total: number;
  page: number;
  pageSize: number;
}

/** 表单季度数据 */
interface QuarterFormData {
  target: string;
  achievement: string;
  progress: number | null;
  cost: number | null;
}

/** 提交表单数据 */
interface ProjectFormData {
  name: string;
  category: string;
  okrName?: string;
  po?: string;
  partner?: string;
  description?: string;
  status: string;
  quarters: Record<string, QuarterFormData>;
}

// ==================== 常量配置 ====================

/** 分类配置 */
const categoryConfig: Record<string, { label: string; color: string }> = {
  STRATEGIC: { label: '战略项目', color: 'red' },
  REGULAR: { label: '常规项目', color: 'blue' },
  TECHNICAL: { label: '技术项目', color: 'green' },
};

/** 状态配置 */
const statusConfig: Record<string, { label: string; color: string }> = {
  PLANNING: { label: '规划中', color: 'default' },
  IN_PROGRESS: { label: '进行中', color: 'processing' },
  COMPLETED: { label: '已完成', color: 'success' },
  ON_HOLD: { label: '暂停', color: 'warning' },
  CANCELLED: { label: '取消', color: 'error' },
};

/** 分类选项 */
const categoryOptions = [
  { label: '战略项目', value: 'STRATEGIC' },
  { label: '常规项目', value: 'REGULAR' },
  { label: '技术项目', value: 'TECHNICAL' },
];

/** 状态选项（表单用） */
const statusOptions = [
  { label: '规划中', value: 'PLANNING' },
  { label: '进行中', value: 'IN_PROGRESS' },
  { label: '已完成', value: 'COMPLETED' },
  { label: '暂停', value: 'ON_HOLD' },
  { label: '取消', value: 'CANCELLED' },
];

/** 季度列表 */
const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4'];

/** 进度条颜色 */
const getProgressColor = (percent: number): string => {
  if (percent >= 90) return '#52c41a';
  if (percent >= 70) return '#1890ff';
  if (percent >= 50) return '#faad14';
  return '#ff4d4f';
};

/** 格式化成本（万元） */
const formatCost = (value: number): string => {
  if (!value && value !== 0) return '-';
  if (value >= 10000) {
    return `${(value / 10000).toFixed(1)}万元`;
  }
  return `${value.toFixed(0)}元`;
};

/** 生成空季度数据 */
const getEmptyQuarters = (): Record<string, QuarterFormData> => {
  const result: Record<string, QuarterFormData> = {};
  QUARTERS.forEach((q) => {
    result[q] = { target: '', achievement: '', progress: null, cost: null };
  });
  return result;
};

/** 从项目详情中提取季度表单数据 */
const extractQuartersFromDetail = (
  milestones: QuarterMilestone[] | undefined,
  costs: QuarterCost[] | undefined
): Record<string, QuarterFormData> => {
  const result = getEmptyQuarters();
  if (milestones) {
    milestones.forEach((m) => {
      if (result[m.quarter]) {
        result[m.quarter].target = m.target || '';
        result[m.quarter].achievement = m.achievement || '';
        result[m.quarter].progress = m.progress || null;
      }
    });
  }
  if (costs) {
    costs.forEach((c) => {
      if (result[c.quarter]) {
        result[c.quarter].cost = c.totalCost || null;
      }
    });
  }
  return result;
};

// ==================== 组件 ====================

function ProjectManageContent() {
  const searchParams = useSearchParams();
  const [form] = Form.useForm<ProjectFormData>();
  const [messageApi, contextHolder] = message.useMessage();

  // 列表状态
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ProjectItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [categoryFilter, setCategoryFilter] = useState<string | undefined>(undefined);
  const [searchText, setSearchText] = useState('');

  // 弹窗状态
  const [modalOpen, setModalOpen] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [quarters, setQuarters] = useState<Record<string, QuarterFormData>>(getEmptyQuarters());

  // ==================== 获取列表数据 ====================

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('pageSize', String(pageSize));
      if (categoryFilter) params.set('category', categoryFilter);
      if (searchText) params.set('search', searchText);

      const res = await fetch(`/api/v1/projects?${params.toString()}`);
      const json: ApiResponse<ListData> = await res.json();
      if (json.code === 0) {
        setData(json.data.list || []);
        setTotal(json.data.total || 0);
      } else {
        messageApi.error(json.message || '获取列表失败');
      }
    } catch {
      messageApi.error('获取列表失败');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, categoryFilter, searchText, messageApi]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  // ==================== 搜索与筛选 ====================

  const handleSearch = (value: string) => {
    setSearchText(value);
    setPage(1);
  };

  const handleCategoryChange = (value: string | undefined) => {
    setCategoryFilter(value || undefined);
    setPage(1);
  };

  // ==================== 新增 / 编辑 ====================

  const handleAdd = () => {
    setEditingId(null);
    form.resetFields();
    setQuarters(getEmptyQuarters());
    setModalOpen(true);
  };

  const handleEdit = async (recordOrId: ProjectItem | string) => {
    const id = typeof recordOrId === 'string' ? recordOrId : recordOrId.id;
    setEditingId(id);
    setModalOpen(true);
    setModalLoading(true);

    try {
      const res = await fetch(`/api/v1/projects/${id}`);
      const json: ApiResponse<ProjectDetail> = await res.json();
      if (json.code === 0) {
        const detail = json.data;
        form.setFieldsValue({
          name: detail.name,
          category: detail.category,
          okrName: detail.okrName || '',
          po: detail.po || '',
          partner: detail.partner || '',
          description: detail.description || '',
          status: detail.status,
        });
        setQuarters(extractQuartersFromDetail(detail.milestones, detail.costs));
      } else {
        messageApi.error(json.message || '获取项目详情失败');
        setModalOpen(false);
      }
    } catch {
      messageApi.error('获取项目详情失败');
      setModalOpen(false);
    } finally {
      setModalLoading(false);
    }
  };

  // 从URL读取edit参数，自动打开编辑弹窗
  useEffect(() => {
    const editId = searchParams.get('edit');
    if (editId) {
      handleEdit(editId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setModalLoading(true);

      // 构造提交数据
      const payload = {
        ...values,
        milestones: QUARTERS.map((q) => ({
          quarter: q,
          target: quarters[q]?.target || '',
          achievement: quarters[q]?.achievement || '',
          progress: quarters[q]?.progress || 0,
        })),
        costs: QUARTERS.map((q) => ({
          quarter: q,
          totalCost: quarters[q]?.cost || 0,
          target: quarters[q]?.target || '',
        })),
      };

      const url = editingId
        ? `/api/v1/projects/${editingId}`
        : '/api/v1/projects';
      const method = editingId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();

      if (json.code === 0) {
        messageApi.success(editingId ? '更新成功' : '创建成功');
        setModalOpen(false);
        fetchList();
      } else {
        messageApi.error(json.message || '操作失败');
      }
    } catch (err) {
      if (err instanceof Error && err.message.includes('validateFields')) {
        // 表单校验失败，不提示
        return;
      }
      messageApi.error('操作失败');
    } finally {
      setModalLoading(false);
    }
  };

  // ==================== 删除 ====================

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/v1/projects/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.code === 0) {
        messageApi.success('删除成功');
        fetchList();
      } else {
        messageApi.error(json.message || '删除失败');
      }
    } catch {
      messageApi.error('删除失败');
    }
  };

  // ==================== 季度数据更新 ====================

  const updateQuarterField = (
    quarter: string,
    field: keyof QuarterFormData,
    value: string | number | null
  ) => {
    setQuarters((prev) => ({
      ...prev,
      [quarter]: { ...prev[quarter], [field]: value },
    }));
  };

  // ==================== 表格列定义 ====================

  const columns: ColumnsType<ProjectItem> = [
    {
      title: '项目编号',
      dataIndex: 'code',
      key: 'code',
      width: 100,
      ellipsis: true,
    },
    {
      title: '项目名称',
      dataIndex: 'name',
      key: 'name',
      width: 200,
      ellipsis: true,
    },
    {
      title: '分类',
      dataIndex: 'category',
      key: 'category',
      width: 100,
      filters: categoryOptions.map((opt) => ({ text: opt.label, value: opt.value })),
      onFilter: (value, record) => record.category === value,
      render: (category: string) => {
        const config = categoryConfig[category];
        return config ? (
          <Tag color={config.color}>{config.label}</Tag>
        ) : (
          <Tag>{category}</Tag>
        );
      },
    },
    {
      title: 'OKR',
      dataIndex: 'okrName',
      key: 'okrName',
      width: 160,
      ellipsis: true,
      render: (text: string) => text || '-',
    },
    {
      title: '负责人',
      dataIndex: 'po',
      key: 'po',
      width: 100,
      ellipsis: true,
      render: (text: string) => text || '-',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => {
        const config = statusConfig[status];
        return config ? (
          <Tag color={config.color}>{config.label}</Tag>
        ) : (
          <Tag>{status}</Tag>
        );
      },
    },
    {
      title: '总成本',
      dataIndex: 'totalCost',
      key: 'totalCost',
      width: 120,
      sorter: (a, b) => a.totalCost - b.totalCost,
      render: (value: number) => formatCost(value),
    },
    {
      title: '平均达成率',
      dataIndex: 'avgProgress',
      key: 'avgProgress',
      width: 160,
      sorter: (a, b) => a.avgProgress - b.avgProgress,
      render: (value: number) => (
        <Progress
          percent={Math.round(value)}
          size="small"
          strokeColor={getProgressColor(value)}
          format={(percent) => `${percent}%`}
        />
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 140,
      fixed: 'right',
      render: (_: unknown, record: ProjectItem) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确认删除"
            description={`确定要删除项目「${record.name}」吗？此操作不可恢复。`}
            onConfirm={() => handleDelete(record.id)}
            okText="删除"
            cancelText="取消"
            okButtonProps={{ danger: true }}
          >
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // ==================== 页面渲染 ====================

  return (
    <div>
      {contextHolder}

      {/* 页面标题 */}
      <div style={{ marginBottom: 24 }}>
        <Text style={{ fontSize: 20, fontWeight: 600 }}>项目管理</Text>
      </div>

      {/* 筛选与操作栏 */}
      <Card
        bordered={false}
        style={{ marginBottom: 16, borderRadius: 8 }}
        styles={{ body: { padding: '16px 20px' } }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          {/* 左侧：搜索 + 分类筛选 */}
          <Space size="middle" wrap>
            <Input.Search
              placeholder="搜索项目名称"
              allowClear
              onSearch={handleSearch}
              style={{ width: 240 }}
              prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
            />
            <Select
              placeholder="按分类筛选"
              allowClear
              style={{ width: 150 }}
              value={categoryFilter}
              onChange={handleCategoryChange}
              options={categoryOptions}
            />
          </Space>

          {/* 右侧：新增按钮 */}
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
            新增项目
          </Button>
        </div>
      </Card>

      {/* 数据表格 */}
      <Card bordered={false} style={{ borderRadius: 8 }}>
        <Table<ProjectItem>
          columns={columns}
          dataSource={data}
          rowKey="id"
          loading={loading}
          scroll={{ x: 1200 }}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: false,
            showTotal: (t) => `共 ${t} 条`,
            onChange: (p) => setPage(p),
          }}
        />
      </Card>

      {/* 新增/编辑弹窗 */}
      <Modal
        title={editingId ? '编辑项目' : '新增项目'}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => setModalOpen(false)}
        confirmLoading={modalLoading}
        okText="提交"
        cancelText="取消"
        width={800}
        destroyOnClose
        maskClosable={false}
      >
        <Form
          form={form}
          layout="vertical"
          style={{ marginTop: 16 }}
          initialValues={{
            status: 'PLANNING',
          }}
        >
          {/* 基本信息 */}
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="项目名称"
                name="name"
                rules={[{ required: true, message: '请输入项目名称' }]}
              >
                <Input placeholder="请输入项目名称" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="分类"
                name="category"
                rules={[{ required: true, message: '请选择分类' }]}
              >
                <Select placeholder="请选择分类" options={categoryOptions} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="OKR名称" name="okrName">
                <Input placeholder="请输入OKR名称" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="负责人/PO" name="po">
                <Input placeholder="请输入负责人" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="核心Partner" name="partner">
                <Input placeholder="请输入核心Partner" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="状态" name="status">
                <Select placeholder="请选择状态" options={statusOptions} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item label="项目背景/描述" name="description">
            <TextArea placeholder="请输入项目背景描述" autoSize={{ minRows: 3, maxRows: 6 }} />
          </Form.Item>

          {/* 季度数据区域 */}
          <div style={{ marginTop: 8, marginBottom: 8 }}>
            <Text strong style={{ fontSize: 14 }}>
              季度数据
            </Text>
          </div>
          <Collapse
            defaultActiveKey={QUARTERS}
            ghost
            items={QUARTERS.map((q) => ({
              key: q,
              label: (
                <Text strong style={{ fontSize: 13 }}>
                  {q}
                </Text>
              ),
              children: (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <Row gutter={16}>
                    <Col span={12}>
                      <Text type="secondary" style={{ fontSize: 12, marginBottom: 4, display: 'block' }}>
                        季度目标
                      </Text>
                      <TextArea
                        value={quarters[q]?.target || ''}
                        onChange={(e) => updateQuarterField(q, 'target', e.target.value)}
                        placeholder="请输入季度目标"
                        autoSize={{ minRows: 2, maxRows: 4 }}
                      />
                    </Col>
                    <Col span={12}>
                      <Text type="secondary" style={{ fontSize: 12, marginBottom: 4, display: 'block' }}>
                        已达成成果
                      </Text>
                      <TextArea
                        value={quarters[q]?.achievement || ''}
                        onChange={(e) => updateQuarterField(q, 'achievement', e.target.value)}
                        placeholder="请输入已达成成果"
                        autoSize={{ minRows: 2, maxRows: 4 }}
                      />
                    </Col>
                  </Row>
                  <Row gutter={16}>
                    <Col span={12}>
                      <Text type="secondary" style={{ fontSize: 12, marginBottom: 4, display: 'block' }}>
                        达成率
                      </Text>
                      <InputNumber
                        value={quarters[q]?.progress}
                        onChange={(v) => updateQuarterField(q, 'progress', v)}
                        min={0}
                        max={100}
                        placeholder="0-100"
                        style={{ width: '100%' }}
                        addonAfter="%"
                      />
                    </Col>
                    <Col span={12}>
                      <Text type="secondary" style={{ fontSize: 12, marginBottom: 4, display: 'block' }}>
                        成本
                      </Text>
                      <InputNumber
                        value={quarters[q]?.cost}
                        onChange={(v) => updateQuarterField(q, 'cost', v)}
                        min={0}
                        placeholder="请输入"
                        style={{ width: '100%' }}
                        addonAfter="元"
                      />
                    </Col>
                  </Row>
                </div>
              ),
            }))}
          />
        </Form>
      </Modal>
    </div>
  );
}

export default function ProjectManagePage() {
  return (
    <Suspense fallback={<div style={{ textAlign: 'center', padding: 100 }}>加载中...</div>}>
      <ProjectManageContent />
    </Suspense>
  );
}
