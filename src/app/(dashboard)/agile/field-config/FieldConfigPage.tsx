'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  Select,
  InputNumber,
  Switch,
  message,
  Popconfirm,
  Tag,
  Space,
  Card,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SettingOutlined,
  ToolOutlined,
} from '@ant-design/icons';
import type {
  FieldConfig,
  FieldConfigFormData,
} from './types/field-config.types';
import {
  FIELD_TYPE_OPTIONS,
  DATA_TYPE_OPTIONS,
  FIELD_TYPE_LABELS,
  FIELD_TYPE_COLORS,
  DATA_TYPE_LABELS,
} from './types/field-config.types';

interface TapdProject {
  id: string;
  name: string;
}

const FieldConfigPage: React.FC = () => {
  const [fieldConfigs, setFieldConfigs] = useState<FieldConfig[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingField, setEditingField] = useState<FieldConfig | null>(null);
  const [quickSetupModalVisible, setQuickSetupModalVisible] = useState(false);
  const [form] = Form.useForm();

  // TAPD项目相关状态
  const [projects, setProjects] = useState<TapdProject[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');

  // 加载TAPD项目列表
  const fetchProjects = useCallback(async () => {
    try {
      const response = await fetch('/api/v1/tapd/workspaces');
      const result = await response.json();
      
      if (result.success && result.data) {
        setProjects(result.data);
        // 如果有项目且未选择，默认选择第一个
        if (result.data.length > 0 && !selectedProjectId) {
          setSelectedProjectId(result.data[0].id);
        }
      }
    } catch (error) {
      console.error('Error fetching projects:', error);
    }
  }, [selectedProjectId]);

  // 加载字段配置列表
  const fetchFieldConfigs = useCallback(async (projectId?: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      const targetProjectId = projectId || selectedProjectId;
      
      if (targetProjectId) {
        params.append('teamConfigId', targetProjectId);
      }
      
      const url = `/api/v1/agile/field-configs${params.toString() ? `?${params}` : ''}`;
      const response = await fetch(url);
      const result = await response.json();
      
      if (result.success) {
        setFieldConfigs(result.data);
      } else {
        message.error('获取字段配置失败');
      }
    } catch (error) {
      console.error('Error fetching field configs:', error);
      message.error('获取字段配置失败');
    } finally {
      setLoading(false);
    }
  }, [selectedProjectId]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  useEffect(() => {
    if (selectedProjectId) {
      fetchFieldConfigs();
    }
  }, [selectedProjectId, fetchFieldConfigs]);

  // 项目切换处理
  const handleProjectChange = (value: string) => {
    setSelectedProjectId(value);
  };

  // 打开新增/编辑模态框
  const openModal = (field?: FieldConfig) => {
    setEditingField(field || null);
    
    if (field) {
      form.setFieldsValue({
        name: field.name,
        fieldKey: field.fieldKey,
        fieldType: field.fieldType,
        dataType: field.dataType,
        tapdField: field.tapdField,
        isEditable: field.isEditable,
        sortOrder: field.sortOrder,
        width: field.width,
      });
    } else {
      form.resetFields();
      form.setFieldsValue({
        fieldType: 'CUSTOM',
        dataType: 'TEXT',
        isEditable: false,
        sortOrder: Math.max(...(fieldConfigs.length > 0 ? fieldConfigs.map(f => f.sortOrder) : [0]), 0) + 10,
      });
    }
    
    setModalVisible(true);
  };

  // 关闭模态框
  const closeModal = () => {
    setModalVisible(false);
    setEditingField(null);
    form.resetFields();
  };

  // 保存字段配置
  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      const formData: FieldConfigFormData = {
        ...values,
        teamConfigId: selectedProjectId || undefined,
      };
      
      let response;
      if (editingField) {
        // 更新
        response = await fetch(`/api/v1/agile/field-configs/${editingField.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });
      } else {
        // 新增
        response = await fetch('/api/v1/agile/field-configs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });
      }
      
      const result = await response.json();
      
      if (result.success) {
        message.success(editingField ? '更新成功' : '创建成功');
        closeModal();
        fetchFieldConfigs();
      } else {
        message.error(result.message || '操作失败');
      }
    } catch (error) {
      console.error('Error saving field config:', error);
      message.error('保存失败');
    }
  };

  // 删除字段配置
  const handleDelete = async (id: string) => {
    try {
      const response = await fetch(`/api/v1/agile/field-configs/${id}`, {
        method: 'DELETE',
      });
      
      const result = await response.json();
      
      if (result.success) {
        message.success('删除成功');
        fetchFieldConfigs();
      } else {
        message.error(result.message || '删除失败');
      }
    } catch (error) {
      console.error('Error deleting field config:', error);
      message.error('删除失败');
    }
  };

  // 一键配置
  const handleQuickSetup = async () => {
    try {
      setQuickSetupModalVisible(false);
      message.loading('正在配置默认字段...', 0);
      
      const response = await fetch('/api/v1/agile/field-configs/quick-setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          teamConfigId: selectedProjectId || undefined 
        }),
      });
      
      const result = await response.json();
      message.destroy();
      
      if (result.success) {
        message.success(result.message);
        fetchFieldConfigs();
      } else {
        message.error(result.message || '一键配置失败');
      }
    } catch (error) {
      console.error('Error in quick setup:', error);
      message.destroy();
      message.error('一键配置失败');
    }
  };

  // 表格列定义
  const columns: ColumnsType<FieldConfig> = [
    {
      title: '序号',
      key: 'index',
      width: 60,
      render: (_text, _record, index) => index + 1,
    },
    {
      title: '字段名称',
      dataIndex: 'name',
      width: 120,
      render: (value) => <strong>{value}</strong>,
    },
    {
      title: '字段类型',
      dataIndex: 'fieldType',
      width: 130,
      render: (value) => (
        <Tag color={FIELD_TYPE_COLORS[value]}>
          {FIELD_TYPE_LABELS[value]}
        </Tag>
      ),
    },
    {
      title: '数据类型',
      dataIndex: 'dataType',
      width: 100,
      render: (value) => <Tag>{DATA_TYPE_LABELS[value]}</Tag>,
    },
    {
      title: '可编辑',
      dataIndex: 'isEditable',
      width: 80,
      align: 'center',
      render: (value) =>
        value ? (
          <strong style={{ color: '#00b42a' }}>是 ✅</strong>
        ) : (
          <span style={{ color: '#86909c' }}>否</span>
        ),
    },
    {
      title: 'TAPD字段',
      dataIndex: 'tapdField',
      width: 150,
      render: (value) =>
        value ? (
          <code style={{ color: '#86909c', fontFamily: 'monospace', fontSize: 12 }}>
            {value}
          </code>
        ) : (
          <span style={{ color: '#c9cdd4' }}>—</span>
        ),
    },
    {
      title: '排序值',
      dataIndex: 'sortOrder',
      width: 80,
      align: 'center',
      render: (value) => <code>{value}</code>,
    },
    {
      title: '操作',
      key: 'action',
      width: 160,
      fixed: 'right' as const,
      render: (_, record) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => openModal(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定要删除此字段吗？"
            onConfirm={() => handleDelete(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button
              type="link"
              size="small"
              danger
              icon={<DeleteOutlined />}
            />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: '16px 24px' }}>
      {/* 工具栏 */}
      <Card
        style={{
          marginBottom: 16,
          background: '#fafafa',
          borderRadius: 4,
        }}
        styles={{ body: { padding: '12px 20px' } }}
      >
        <Space size="middle" wrap>
          {/* TAPD项目选择器 */}
          <Space>
            <label style={{ fontSize: 13, fontWeight: 500, color: '#1f2329' }}>
              选择TAPD项目：
            </label>
            <Select
              value={selectedProjectId}
              onChange={handleProjectChange}
              style={{ width: 200 }}
              placeholder="请选择TAPD项目"
              showSearch
              optionFilterProp="children"
              loading={projects.length === 0}
            >
              {projects.map((project) => (
                <Select.Option key={project.id} value={project.id}>
                  {project.name}
                </Select.Option>
              ))}
            </Select>
          </Space>

          {/* 操作按钮 */}
          <Button
            type="primary"
            icon={<ToolOutlined />}
            onClick={() => setQuickSetupModalVisible(true)}
            style={{ backgroundColor: '#00b42a' }}
            disabled={!selectedProjectId}
          >
            一键配置
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => openModal()}
            disabled={!selectedProjectId}
          >
            新增字段
          </Button>
        </Space>

        {selectedProjectId && (
          <div style={{ marginTop: 8, fontSize: 12, color: '#86909c' }}>
            当前正在为「<strong>{projects.find(p => p.id === selectedProjectId)?.name || selectedProjectId}</strong>」配置字段展示
          </div>
        )}
      </Card>

      {/* 字段列表表格 */}
      <Card bordered={false}>
        <Table
          columns={columns}
          dataSource={fieldConfigs}
          rowKey="id"
          loading={loading}
          pagination={false}
          scroll={{ y: 'calc(100vh - 320px)', x: 1000 }}
          size="small"
          bordered
          locale={{
            emptyText: selectedProjectId 
              ? '暂无字段配置，点击"一键配置"快速初始化' 
              : '请先选择TAPD项目'
          }}
        />
      </Card>

      {/* 新增/编辑字段模态框 */}
      <Modal
        title={
          editingField ? (
            <>
              <EditOutlined style={{ color: '#1677ff', marginRight: 8 }} />
              编辑字段
            </>
          ) : (
            <>
              <PlusOutlined style={{ color: '#1677ff', marginRight: 8 }} />
              新增字段
            </>
          )
        }
        open={modalVisible}
        onOk={handleSave}
        onCancel={closeModal}
        width={600}
        okText="保存"
        cancelText="取消"
      >
        <Form
          form={form}
          layout="vertical"
          style={{ marginTop: 20 }}
        >
          <Form.Item
            label="字段名称"
            name="name"
            rules={[{ required: true, message: '请输入字段名称' }]}
          >
            <Input placeholder="如：后端、优先级、提测时间" />
            <div style={{ color: '#86909c', fontSize: 12, marginTop: 4 }}>
              用于在迭代计划表头展示的中文名称
            </div>
          </Form.Item>

          <Form.Item
            label="字段标识符"
            name="fieldKey"
            rules={[{ required: true, message: '请输入字段标识符' }]}
          >
            <Input placeholder="如：tapdId、title、priority" disabled={!!editingField} />
            <div style={{ color: '#86909c', fontSize: 12, marginTop: 4 }}>
              英文标识，用于数据映射（不可修改）
            </div>
          </Form.Item>

          <Form.Item
            label="字段类型"
            name="fieldType"
            rules={[{ required: true, message: '请选择字段类型' }]}
          >
            <Select options={FIELD_TYPE_OPTIONS} />
          </Form.Item>

          <Form.Item
            label="数据类型"
            name="dataType"
            rules={[{ required: true, message: '请选择数据类型' }]}
          >
            <Select options={DATA_TYPE_OPTIONS} />
          </Form.Item>

          <Form.Item label="TAPD字段映射" name="tapdField">
            <Input placeholder="对应的TAPD字段名（可选）" />
          </Form.Item>

          <Form.Item label="是否可编辑" name="isEditable" valuePropName="checked">
            <Switch />
          </Form.Item>

          <Form.Item label="排序值" name="sortOrder">
            <InputNumber min={0} max={999} style={{ width: '100%' }} />
            <div style={{ color: '#86909c', fontSize: 12, marginTop: 4 }}>
              数值越小越靠前显示
            </div>
          </Form.Item>

          <Form.Item label="列宽（可选）" name="width">
            <InputNumber min={50} max={500} style={{ width: '100%' }} placeholder="不填则使用默认宽度" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 一键配置确认模态框 */}
      <Modal
        title={
          <>
            <ToolOutlined style={{ color: '#00b42a', marginRight: 8 }} />
            一键配置
          </>
        }
        open={quickSetupModalVisible}
        onOk={handleQuickSetup}
        onCancel={() => setQuickSetupModalVisible(false)}
        width={480}
        okText="开始配置"
        cancelText="取消"
      >
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <ToolOutlined style={{ fontSize: 48, color: '#1677ff', marginBottom: 16 }} />
          <h3 style={{ marginBottom: 10 }}>自动拉取默认字段集</h3>
          <p style={{ color: '#86909c', lineHeight: 1.8, fontSize: 13 }}>
            将从当前团队关联的 TAPD 项目中<br />
            自动获取常用字段配置，快速初始化<br /><br />
            <strong style={{ color: '#1f2329' }}>预计新增约 14 个字段：</strong><br />
            <span style={{ color: '#4e5969' }}>
              ID、标题、产品、状态、优先级、处理人、<br />
              后端、前端、移动端、测试、<br />
              提测时间、发布计划、备注 等
            </span>
          </p>
          {selectedProjectId && (
            <div style={{ 
              marginTop: 16, 
              padding: '8px 12px', 
              background: '#fff7e6', 
              border: '1px solid #ffd591',
              borderRadius: 4,
              fontSize: 13,
              color: '#ad6800'
            }}>
              📌 配置将应用于：{projects.find(p => p.id === selectedProjectId)?.name || selectedProjectId}
            </div>
          )}
        </div>
        <div
          style={{
            marginTop: 12,
            padding: '12px 16px',
            background: '#e6f7ff',
            border: '1px solid #91d5ff',
            borderRadius: 4,
            fontSize: 13,
            color: '#1677ff',
          }}
        >
          💡 已有字段不会被覆盖，仅新增缺失的字段
        </div>
      </Modal>
    </div>
  );
};

export default FieldConfigPage;
