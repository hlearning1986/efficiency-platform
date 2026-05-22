'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Card,
  Table,
  Button,
  Select,
  Space,
  Tag,
  message,
  Modal,
  Input,
  Tooltip,
  Typography,
  Alert,
  Spin,
  Tabs,
  Statistic,
  Row,
  Col,
  Popconfirm,
  Empty,
  Badge,
} from 'antd';
import {
  SyncOutlined,
  ReloadOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  DownloadOutlined,
  UploadOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  WarningOutlined,
  ClockCircleOutlined,
  DatabaseOutlined,
  SettingOutlined,
  ExportOutlined,
  FileTextOutlined,
} from '@ant-design/icons';

const { Title, Text } = Typography;
const { TabPane } = Tabs;

interface WorkflowItem {
  id: number;
  workspaceId: string;
  workspaceName: string | null;
  system: 'story' | 'bug';
  statusKey: string;
  statusValue: string;
  sortOrder: number;
  isActive: boolean;
  version: string | null;
  syncedAt: string;
}

interface WorkspaceOverview {
  workspaceId: string;
  workspaceName: string | null;
  storyStatusCount: number;
  bugStatusCount: number;
  lastSyncedAt: string | null;
  isExpired: boolean;
}

interface SyncLogItem {
  id: number;
  workspaceId: string;
  action: string;
  status: string;
  recordsCount: number;
  errorMessage: string | null;
  durationMs: number | null;
  createdAt: string;
}

export default function TapdWorkflowPage() {
  const [loading, setLoading] = useState(false);
  const [initLoading, setInitLoading] = useState(false);
  const [refreshLoading, setRefreshLoading] = useState(false);

  // 数据状态
  const [workspaceList, setWorkspaceList] = useState<WorkspaceOverview[]>([]);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string>('');
  const [workflowData, setWorkflowData] = useState<WorkflowItem[]>([]);
  const [syncLogs, setSyncLogs] = useState<SyncLogItem[]>([]);

  // 编辑状态
  const [editingRecord, setEditingRecord] = useState<WorkflowItem | null>(null);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editFormValue, setEditFormValue] = useState('');

  // 统计信息
  const stats = useMemo(() => {
    const totalWorkspaces = workspaceList.length;
    const initializedWorkspaces = workspaceList.filter(w => w.storyStatusCount > 0).length;
    const expiredWorkspaces = workspaceList.filter(w => w.isExpired).length;

    return {
      totalWorkspaces,
      initializedWorkspaces,
      expiredWorkspaces,
      coverageRate: totalWorkspaces > 0 ? Math.round((initializedWorkspaces / totalWorkspaces) * 100) : 0,
    };
  }, [workspaceList]);

  // ============================================================
  // 数据加载
  // ============================================================

  const loadWorkspaceOverview = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/v1/tapd/workflow-status/list?action=overview');
      const result = await response.json();

      if (result.success) {
        setWorkspaceList(result.data || []);

        // 自动选择第一个项目
        if (result.data?.length > 0 && !selectedWorkspaceId) {
          setSelectedWorkspaceId(result.data[0].workspaceId);
        }
      } else {
        message.error('加载项目列表失败');
      }
    } catch (error) {
      console.error('加载失败:', error);
      message.error('加载项目列表失败');
    } finally {
      setLoading(false);
    }
  }, [selectedWorkspaceId]);

  const loadWorkflowDetails = useCallback(async (workspaceId: string) => {
    try {
      setLoading(true);
      
      const [detailsRes, logsRes] = await Promise.all([
        fetch(`/api/v1/tapd/workflow-status/list?action=details&workspaceId=${workspaceId}`),
        fetch(`/api/v1/tapd/workflow-status/list?action=logs&workspaceId=${workspaceId}&limit=20`),
      ]);

      const detailsResult = await detailsRes.json();
      const logsResult = await logsRes.json();

      if (detailsResult.success) {
        setWorkflowData(detailsResult.data || []);
      }

      if (logsResult.success) {
        setSyncLogs(logsResult.data || []);
      }
    } catch (error) {
      console.error('加载详情失败:', error);
      message.error('加载工作流详情失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadWorkspaceOverview();
  }, [loadWorkspaceOverview]);

  useEffect(() => {
    if (selectedWorkspaceId) {
      loadWorkflowDetails(selectedWorkspaceId);
    }
  }, [selectedWorkspaceId, loadWorkflowDetails]);

  // ============================================================
  // 操作处理
  // ============================================================

  const handleInitializeAll = async () => {
    setInitLoading(true);
    
    try {
      const response = await fetch('/api/v1/tapd/workflow-status/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceIds: [
            '37198579', '66690643', '49993684', '35153283', '37539133',
            '31751975', '20189291', '37748852', '20074131', '46422870',
            '48254671', '46357942', '48763054', '30668918', '37329286'
          ],
        }),
      });

      const result = await response.json();

      if (result.success) {
        message.success(`初始化完成！成功 ${result.data.success} 个项目`);
        
        // 刷新数据
        await loadWorkspaceOverview();
        if (selectedWorkspaceId) {
          await loadWorkflowDetails(selectedWorkspaceId);
        }
      } else {
        message.error(result.message || '初始化失败');
      }
    } catch (error) {
      console.error('初始化失败:', error);
      message.error('初始化请求失败');
    } finally {
      setInitLoading(false);
    }
  };

  const handleRefreshSelected = async () => {
    if (!selectedWorkspaceId) {
      message.warning('请先选择一个项目');
      return;
    }

    setRefreshLoading(true);

    try {
      const response = await fetch('/api/v1/tapd/workflow-status/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId: selectedWorkspaceId }),
      });

      const result = await response.json();

      if (result.success) {
        message.success('刷新成功！');
        await loadWorkspaceOverview();
        await loadWorkflowDetails(selectedWorkspaceId);
      } else {
        message.error(result.message || '刷新失败');
      }
    } catch (error) {
      console.error('刷新失败:', error);
      message.error('刷新请求失败');
    } finally {
      setRefreshLoading(false);
    }
  };

  const handleRefreshAll = async () => {
    setRefreshLoading(true);

    try {
      const response = await fetch('/api/v1/tapd/workflow-status/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      const result = await response.json();

      if (result.success) {
        message.success(`全部刷新完成！成功 ${result.data.success} 个项目`);
        await loadWorkspaceOverview();
        if (selectedWorkspaceId) {
          await loadWorkflowDetails(selectedWorkspaceId);
        }
      } else {
        message.error(result.message || '刷新失败');
      }
    } catch (error) {
      console.error('刷新失败:', error);
      message.error('刷新请求失败');
    } finally {
      setRefreshLoading(false);
    }
  };

  const handleEdit = (record: WorkflowItem) => {
    setEditingRecord(record);
    setEditFormValue(record.statusValue);
    setEditModalVisible(true);
  };

  const handleSaveEdit = async () => {
    if (!editingRecord || !editFormValue.trim()) {
      message.warning('状态值不能为空');
      return;
    }

    try {
      const response = await fetch('/api/v1/tapd/workflow-status/update', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingRecord.id,
          statusValue: editFormValue.trim(),
        }),
      });

      const result = await response.json();

      if (result.success) {
        message.success('更新成功');
        setEditModalVisible(false);
        await loadWorkflowDetails(selectedWorkspaceId);
      } else {
        message.error(result.message || '更新失败');
      }
    } catch (error) {
      console.error('更新失败:', error);
      message.error('更新请求失败');
    }
  };

  const handleDelete = async (id: number) => {
    try {
      const response = await fetch(
        `/api/v1/tapd/workflow-status/update?id=${id}`,
        { method: 'DELETE' }
      );

      const result = await response.json();

      if (result.success) {
        message.success('删除成功');
        await loadWorkflowDetails(selectedWorkspaceId);
      } else {
        message.error(result.message || '删除失败');
      }
    } catch (error) {
      console.error('删除失败:', error);
      message.error('删除请求失败');
    }
  };

  const handleExportConfig = async () => {
    try {
      const url = selectedWorkspaceId
        ? `/api/v1/tapd/workflow-status/list?action=export&workspaceId=${selectedWorkspaceId}`
        : '/api/v1/tapd/workflow-status/list?action=export';

      const response = await fetch(url);
      const result = await response.json();

      if (result.success) {
        const blob = new Blob([JSON.stringify(result.data, null, 2)], { type: 'application/json' });
        const downloadUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = `workflow-config-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(downloadUrl);
        
        message.success('导出成功');
      } else {
        message.error('导出失败');
      }
    } catch (error) {
      console.error('导出失败:', error);
      message.error('导出请求失败');
    }
  };

  // ============================================================
  // 表格列定义
  // ============================================================

  const columns = [
    {
      title: '#',
      dataIndex: 'sortOrder',
      key: 'sortOrder',
      width: 60,
      align: 'center' as const,
    },
    {
      title: '原始状态(英文)',
      dataIndex: 'statusKey',
      key: 'statusKey',
      width: 180,
      render: (text: string) => (
        <Tooltip title="TAPD API返回的原始值">
          <code style={{ 
            background: '#f5f5f5', 
            padding: '2px 6px', 
            borderRadius: 4,
            fontSize: 13,
          }}>
            {text}
          </code>
        </Tooltip>
      ),
    },
    {
      title: '中文显示名称',
      dataIndex: 'statusValue',
      key: 'statusValue',
      width: 150,
      render: (text: string) => <Text strong>{text}</Text>,
    },
    {
      title: '系统类型',
      dataIndex: 'system',
      key: 'system',
      width: 100,
      align: 'center' as const,
      render: (text: string) => (
        <Tag color={text === 'story' ? 'blue' : 'green'}>
          {text === 'story' ? '需求' : '缺陷'}
        </Tag>
      ),
    },
    {
      title: '启用状态',
      dataIndex: 'isActive',
      key: 'isActive',
      width: 100,
      align: 'center' as const,
      render: (active: boolean) => (
        <Tag color={active ? 'success' : 'default'}>
          {active ? '启用' : '禁用'}
        </Tag>
      ),
    },
    {
      title: '最后同步',
      dataIndex: 'syncedAt',
      key: 'syncedAt',
      width: 160,
      render: (time: string) =>
        time ? new Date(time).toLocaleString('zh-CN') : '-',
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      fixed: 'right' as const,
      render: (_: any, record: WorkflowItem) => (
        <Space size="small">
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          />
          <Popconfirm
            title="确定要删除这条映射吗？"
            onConfirm={() => handleDelete(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button type="link" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const logColumns = [
    {
      title: '操作时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 160,
      render: (time: string) => new Date(time).toLocaleString('zh-CN'),
    },
    {
      title: '操作类型',
      dataIndex: 'action',
      key: 'action',
      width: 100,
      render: (action: string) => {
        const map: Record<string, { color: string; label: string }> = {
          init: { color: 'blue', label: '初始化' },
          refresh: { color: 'green', label: '刷新' },
          force_refresh: { color: 'orange', label: '强制刷新' },
        };
        const config = map[action] || { color: 'default', label: action };
        return <Tag color={config.color}>{config.label}</Tag>;
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 80,
      render: (status: string) => {
        const iconMap: Record<string, React.ReactNode> = {
          success: <CheckCircleOutlined style={{ color: '#52c41a' }} />,
          failed: <CloseCircleOutlined style={{ color: '#ff4d4f' }} />,
          skipped: <WarningOutlined style={{ color: '#faad14' }} />,
        };
        return (
          <Space size={4}>
            {iconMap[status]}
            <span>{status === 'success' ? '成功' : status === 'failed' ? '失败' : '跳过'}</span>
          </Space>
        );
      },
    },
    {
      title: '记录数',
      dataIndex: 'recordsCount',
      key: 'recordsCount',
      width: 80,
      align: 'right' as const,
    },
    {
      title: '耗时',
      dataIndex: 'durationMs',
      key: 'durationMs',
      width: 80,
      align: 'right' as const,
      render: (ms: number | null) => ms ? `${Math.round(ms / 1000)}s` : '-',
    },
    {
      title: '错误信息',
      dataIndex: 'errorMessage',
      key: 'errorMessage',
      ellipsis: true,
      render: (msg: string | null) =>
        msg ? <Text type="danger">{msg}</Text> : '-',
    },
  ];

  // ============================================================
  // 渲染
  // ============================================================

  return (
    <div style={{ padding: '24px', background: '#f5f5f5', minHeight: '100vh' }}>
      {/* 页面标题 */}
      <Card style={{ marginBottom: 16 }} bordered={false}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <Title level={3} style={{ margin: 0 }}>
              <SettingOutlined /> TAPD 工作流状态管理
            </Title>
            <Text type="secondary">
              管理各TAPD项目的工作流配置，实现状态的自动转换和标准化显示
            </Text>
          </div>
          
          <Space>
            <Button
              icon={<DownloadOutlined />}
              onClick={handleExportConfig}
            >
              导出配置
            </Button>
            <Button
              type="primary"
              icon={<SyncOutlined spin={refreshLoading} />}
              loading={refreshLoading}
              onClick={handleRefreshAll}
            >
              全部刷新
            </Button>
            <Button
              type="primary"
              icon={<DatabaseOutlined />}
              loading={initLoading}
              onClick={handleInitializeAll}
            >
              初始化全部
            </Button>
          </Space>
        </div>
      </Card>

      {/* 统计卡片 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="总项目数"
              value={stats.totalWorkspaces}
              prefix={<DatabaseOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="已初始化"
              value={stats.initializedWorkspaces}
              prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="缓存过期"
              value={stats.expiredWorkspaces}
              prefix={<ClockCircleOutlined style={{ color: '#faad14' }} />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="覆盖率"
              value={stats.coverageRate}
              suffix="%"
              prefix={
                <Badge
                  count={`${stats.coverageRate}%`}
                  style={{
                    backgroundColor: stats.coverageRate >= 80 ? '#52c41a' : '#faad14',
                  }}
                />
              }
            />
          </Card>
        </Col>
      </Row>

      {/* 主内容区 */}
      <Card>
        {/* 项目选择器 */}
        <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
          <Text strong>选择项目：</Text>
          <Select
            style={{ width: 400 }}
            placeholder="请选择TAPD项目"
            value={selectedWorkspaceId}
            onChange={(value) => setSelectedWorkspaceId(value)}
            loading={loading}
            showSearch
            optionFilterProp="label"
          >
            {workspaceList.map((ws) => (
              <Select.Option
                key={ws.workspaceId}
                value={ws.workspaceId}
                label={`${ws.workspaceName || ws.workspaceId} (${ws.workspaceId})`}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', minWidth: 300 }}>
                  <div>
                    <Text strong style={{ fontSize: 14 }}>
                      {ws.workspaceName || '未命名项目'}
                    </Text>
                    <br />
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      ID: {ws.workspaceId}
                    </Text>
                  </div>
                  <div>
                    {ws.isExpired && (
                      <Tag color="warning" style={{ marginLeft: 4 }}>过期</Tag>
                    )}
                    {ws.storyStatusCount > 0 ? (
                      <Tag color="success" style={{ marginLeft: 4 }}>{ws.storyStatusCount}种</Tag>
                    ) : (
                      <Tag color="default" style={{ marginLeft: 4 }}>未配置</Tag>
                    )}
                  </div>
                </div>
              </Select.Option>
            ))}
          </Select>

          {selectedWorkspaceId && (
            <>
              <Button
                icon={<ReloadOutlined spin={refreshLoading} />}
                loading={refreshLoading}
                onClick={handleRefreshSelected}
              >
                刷新此项目
              </Button>
              
              {workspaceList.find(w => w.workspaceId === selectedWorkspaceId)?.lastSyncedAt && (
                <Text type="secondary">
                  最后同步：{new Date(
                    workspaceList.find(w => w.workspaceId === selectedWorkspaceId)?.lastSyncedAt || ''
                  ).toLocaleString('zh-CN')}
                </Text>
              )}
            </>
          )}
        </div>

        {/* 工作流详情表格 */}
        {selectedWorkspaceId ? (
          <Tabs defaultActiveKey="workflow">
            <TabPane tab={`工作流配置 (${workflowData.length})`} key="workflow">
              {workflowData.length > 0 ? (
                <Table
                  columns={columns}
                  dataSource={workflowData}
                  rowKey="id"
                  loading={loading}
                  pagination={false}
                  scroll={{ y: 500 }}
                  size="middle"
                />
              ) : (
                <Empty
                  description={
                    <Space direction="vertical">
                      <Text>该项目尚未初始化工作流配置</Text>
                      <Button type="primary" onClick={handleInitializeAll}>
                        立即初始化
                      </Button>
                    </Space>
                  }
                />
              )}
            </TabPane>

            <TabPane tab={`同步日志 (${syncLogs.length})`} key="logs">
              <Table
                columns={logColumns}
                dataSource={syncLogs}
                rowKey="id"
                loading={loading}
                pagination={{
                  pageSize: 10,
                  showSizeChanger: true,
                  showTotal: (total) => `共 ${total} 条日志`,
                }}
                size="small"
              />
            </TabPane>
          </Tabs>
        ) : (
          <Empty description="请从上方选择一个项目查看详情" />
        )}
      </Card>

      {/* 编辑弹窗 */}
      <Modal
        title="编辑状态映射"
        open={editModalVisible}
        onOk={handleSaveEdit}
        onCancel={() => setEditModalVisible(false)}
        okText="保存"
        cancelText="取消"
      >
        {editingRecord && (
          <div style={{ marginTop: 16 }}>
            <div style={{ marginBottom: 12 }}>
              <Text strong>原始状态：</Text>
              <code style={{ marginLeft: 8 }}>{editingRecord.statusKey}</code>
            </div>
            
            <div style={{ marginBottom: 12 }}>
              <Text strong>中文显示：</Text>
              <Input
                value={editFormValue}
                onChange={(e) => setEditFormValue(e.target.value)}
                placeholder="请输入中文状态名称"
                style={{ marginTop: 4 }}
              />
            </div>

            <Alert
              type="info"
              message="修改后将影响所有使用该项目的需求数据显示"
              showIcon
            />
          </div>
        )}
      </Modal>
    </div>
  );
}
