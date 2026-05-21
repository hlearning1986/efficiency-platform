'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Card,
  Form,
  Input,
  Button,
  Typography,
  message,
  Alert,
  Space,
  Divider,
  Tag,
  Spin,
} from 'antd';
import {
  ApiOutlined,
  SettingOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  CloudSyncOutlined,
  EyeOutlined,
  EyeInvisibleOutlined,
  SaveOutlined,
  DeleteOutlined,
  DatabaseOutlined,
} from '@ant-design/icons';
import { useTapdConfigStore } from '@/stores/tapd-config.store';

const { Title, Text } = Typography;

type ConnectionStatus = 'idle' | 'testing' | 'connected' | 'failed';

export default function TapdSettingsPage() {
  const {
    config,
    isConfigured,
    loading,
    setConfig,
    loadFromDB,
    saveToDB,
    clearConfig,
  } = useTapdConfigStore();

  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('idle');
  const [connectionError, setConnectionError] = useState('');
  const [saving, setSaving] = useState(false);

  // 页面加载时从数据库恢复配置
  useEffect(() => {
    loadFromDB();
  }, [loadFromDB]);

  // 通过后端代理测试 TAPD API 连接
  const handleTestConnection = useCallback(async () => {
    if (!config.apiUser || !config.apiPassword) {
      message.warning('请填写 API User 和 API Password');
      return;
    }

    setConnectionStatus('testing');
    setConnectionError('');
    try {
      const res = await fetch('/api/v1/resources/tapd/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiUser: config.apiUser,
          apiPassword: config.apiPassword,
          action: 'test-auth',
        }),
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.message || '连接失败');
      }

      setConnectionStatus('connected');
      message.success('TAPD API 连接成功');
    } catch (err) {
      setConnectionStatus('failed');
      const errorMsg = err instanceof Error ? err.message : '连接失败';
      message.error(errorMsg);
      setConnectionError(errorMsg);
    }
  }, [config]);

  // 保存配置到数据库
  const handleSave = useCallback(async () => {
    if (!config.apiUser || !config.apiPassword) {
      message.warning('请填写完整的 API 凭据');
      return;
    }
    setSaving(true);
    const ok = await saveToDB();
    setSaving(false);
    if (ok) {
      message.success('配置已保存到数据库');
    } else {
      message.error('保存失败');
    }
  }, [config, saveToDB]);

  // 清除配置
  const handleClear = useCallback(async () => {
    await clearConfig();
    setConnectionStatus('idle');
    setConnectionError('');
    message.info('配置已清除');
  }, [clearConfig]);

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      <Title level={4} style={{ marginBottom: 24 }}>
        <SettingOutlined style={{ marginRight: 8 }} />
        TAPD API 全局配置
      </Title>

      <Spin spinning={loading}>
        <Card>
          <Alert
            type="info"
            showIcon
            icon={<DatabaseOutlined />}
            style={{ marginBottom: 24 }}
            message="全局配置说明"
            description="此处配置的 TAPD API 凭据将在所有功能模块中共享使用（如数据同步、效能分析等），无需重复配置。配置信息保存在数据库中，所有用户共享。"
          />

          <Form layout="vertical" style={{ maxWidth: 480 }}>
            <Form.Item
              label="API User"
              required
              extra={
                <span style={{ fontSize: 12, color: '#999' }}>
                  TAPD 开放平台的 API 账号（通常 wb 开头）
                </span>
              }
            >
              <Input
                prefix={<ApiOutlined />}
                placeholder="请输入 TAPD API User"
                value={config.apiUser}
                onChange={(e) =>
                  setConfig({ ...config, apiUser: e.target.value })
                }
              />
            </Form.Item>

            <Form.Item
              label="API Password"
              required
              extra={
                <span style={{ fontSize: 12, color: '#999' }}>
                  API 密钥（非网页登录密码），获取路径：TAPD 网页 → 公司管理 → 开放平台 → API 账号管理
                </span>
              }
            >
              <Input.Password
                prefix={<SettingOutlined />}
                placeholder="请输入 TAPD API Password"
                value={config.apiPassword}
                onChange={(e) =>
                  setConfig({ ...config, apiPassword: e.target.value.trim() })
                }
                iconRender={(visible) =>
                  visible ? <EyeOutlined /> : <EyeInvisibleOutlined />
                }
                visibilityToggle
              />
            </Form.Item>

            <Form.Item>
              <Space>
                <Button
                  type="primary"
                  icon={<CloudSyncOutlined />}
                  loading={connectionStatus === 'testing'}
                  onClick={handleTestConnection}
                >
                  测试连接
                </Button>
                <Button
                  type="primary"
                  icon={<SaveOutlined />}
                  loading={saving}
                  onClick={handleSave}
                >
                  保存配置
                </Button>
                {isConfigured && (
                  <Button
                    danger
                    icon={<DeleteOutlined />}
                    onClick={handleClear}
                  >
                    清除配置
                  </Button>
                )}
              </Space>
            </Form.Item>
          </Form>

          {/* 连接状态 */}
          {connectionStatus === 'connected' && (
            <div
              style={{
                padding: '12px 16px',
                background: '#f6ffed',
                border: '1px solid #b7eb8f',
                borderRadius: 8,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 18 }} />
              <Text style={{ color: '#52c41a', fontWeight: 500 }}>
                连接成功 - API 凭据有效，请保存配置
              </Text>
            </div>
          )}

          {connectionStatus === 'failed' && (
            <div
              style={{
                padding: '12px 16px',
                background: '#fff2f0',
                border: '1px solid #ffccc7',
                borderRadius: 8,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <CloseCircleOutlined style={{ color: '#ff4d4f', fontSize: 18 }} />
                <Text style={{ color: '#ff4d4f', fontWeight: 500 }}>连接失败，请检查 API 凭据</Text>
              </div>
              {connectionError && (
                <div style={{ fontSize: 12, color: '#999', marginBottom: 8, paddingLeft: 26 }}>
                  错误详情：{connectionError}
                </div>
              )}
              <div style={{
                fontSize: 12,
                color: '#666',
                background: '#fff',
                padding: '10px 14px',
                borderRadius: 6,
                border: '1px solid #ffe7e7',
                lineHeight: 1.8,
              }}>
                <div style={{ fontWeight: 600, marginBottom: 4, color: '#333' }}>🔍 TAPD 401 错误排查建议：</div>
                <div>1. 确认 <strong>API User</strong> 是 TAPD 开放平台的 API 账号（通常 wb 开头），而非登录用户名</div>
                <div>2. 确认 <strong>API Password</strong> 是 API 密钥（非网页登录密码），获取路径：</div>
                <div style={{ paddingLeft: 16, color: '#999' }}>TAPD 网页 → 公司管理 → 开放平台 → API 账号管理</div>
                <div>3. 确认 API 账号状态为<strong>「已启用」</strong>，且未过期</div>
                <div>4. 确认 API 账号有权限访问目标项目空间</div>
                <div>5. 如仍无法解决，请联系 TAPD 管理员确认账号状态</div>
              </div>
            </div>
          )}
        </Card>

        <Card style={{ marginTop: 16 }}>
          <Title level={5}>配置状态</Title>
          <Divider style={{ margin: '12px 0 16px' }} />
          <Space size="large">
            <div>
              <Text type="secondary">API User：</Text>
              {config.apiUser ? (
                <Tag color="blue">{config.apiUser}</Tag>
              ) : (
                <Tag>未配置</Tag>
              )}
            </div>
            <div>
              <Text type="secondary">API Password：</Text>
              {config.apiPassword ? (
                <Tag color="green">已设置</Tag>
              ) : (
                <Tag>未设置</Tag>
              )}
            </div>
            <div>
              <Text type="secondary">存储位置：</Text>
              <Tag color="blue" icon={<DatabaseOutlined />}>数据库</Tag>
            </div>
            <div>
              <Text type="secondary">状态：</Text>
              <Tag color={isConfigured ? 'success' : 'default'}>
                {isConfigured ? '已持久化' : '未保存'}
              </Tag>
            </div>
          </Space>
        </Card>
      </Spin>
    </div>
  );
}
