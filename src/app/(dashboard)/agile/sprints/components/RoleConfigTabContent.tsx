'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Card,
  Table,
  Select,
  Button,
  Space,
  Tag,
  message,
  Alert,
  Typography,
  Empty,
  Spin,
} from 'antd';
import {
  TeamOutlined,
  UserOutlined,
  SaveOutlined,
  SyncOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';

const { Title, Text } = Typography;

interface RoleConfigTabContentProps {
  workspaceId: string;
}

interface Mapping {
  id: number;
  workspaceId: string;
  memberName: string;
  role: string;
  roleId: string | null;
  isActive: boolean;
  remark: string | null;
  createdAt: string;
  updatedAt: string;
}

interface OwnerInfo {
  name: string;
  role: string;
}

// 4 大主角色（用于工作量计算）
const CORE_ROLES = ['后端', '前端', '移动端', '测试'];
// 辅助角色（不计工作量，但需映射）
const AUX_ROLES = ['PO', 'UED', 'UI', '借调人员', '运维', 'PM', 'HR', '其他'];

const RoleConfigTabContent: React.FC<RoleConfigTabContentProps> = ({ workspaceId }) => {
  const [mappings, setMappings] = useState<Mapping[]>([]);
  const [owners, setOwners] = useState<OwnerInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingOwners, setLoadingOwners] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingRow, setEditingRow] = useState<Record<string, string[]>>({});
  // 多选：批量角色分配（支持多人+多角色）
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [batchRoles, setBatchRoles] = useState<string[]>([]);

  // 加载映射表
  const loadMappings = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/tapd/role-mappings?workspaceId=${workspaceId}`);
      const json = await res.json();
      if (json.success) {
        setMappings(json.data || []);
      } else {
        message.error('加载映射失败: ' + json.message);
      }
    } catch {
      message.error('加载映射异常');
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  // 加载 owner 列表（增强版：支持TAPD实时数据，不依赖本地DB）
  const loadOwners = useCallback(async () => {
    if (!workspaceId) return;
    setLoadingOwners(true);
    try {
      let ownersList: OwnerInfo[] = [];

      // 策略1：直接从TAPD实时API获取项目成员（推荐，最可靠）
      try {
        const res = await fetch(`/api/v1/tapd/realtime?workspace_id=${workspaceId}&action=get_workspace_members&limit=100`);
        if (res.ok) {
          const json = await res.json();
          if (json.success && json.data?.members) {
            ownersList = json.data.members.map((m: any) => ({
              name: m.name || m.user || '',
              role: m.role || '',
            }));
            console.log(`[RoleConfigTab] 从TAPD实时API加载 ${ownersList.length} 个成员`);
          }
        }
      } catch (e) {
        console.warn('[RoleConfigTab] TAPD实时API失败，尝试其他方式:', e);
      }

      // 策略2：如果策略1失败，尝试通过迭代获取owner（兼容旧逻辑）
      if (ownersList.length === 0) {
        let iterId: string | undefined;

        // 尝试获取迭代ID（使用realtime API）
        try {
          const itersRes = await fetch(`/api/v1/tapd/realtime?workspace_id=${workspaceId}&action=get_iterations&limit=1`);
          if (itersRes.ok) {
            const itersJson = await itersRes.json();
            if (itersJson.success && itersJson.data?.iterations?.length > 0) {
              iterId = itersJson.data.iterations[0].id;
            }
          }
        } catch (e) {
          console.warn('[RoleConfigTab] 迭代查询跳过:', e);
        }

        // 通过迭代获取owner
        if (iterId) {
          const res = await fetch(`/api/v1/agile/sprints/${iterId}/owners`);
          if (res.ok) {
            const json = await res.json();
            if (json.success) {
              ownersList = json.data.owners || [];
              console.log(`[RoleConfigTab] 通过迭代加载 ${ownersList.length} 个成员`);
            }
          }
        }

        if (!iterId && ownersList.length === 0) {
          message.warning('该暂无迭代数据，尝试从需求数据中提取成员...');
        }
      }

      // 策略3：如果前两个策略都失败，直接从最近的需求中提取owner
      if (ownersList.length === 0) {
        try {
          const storiesRes = await fetch(`/api/v1/tapd/debug/story-full-data?workspaceId=${workspaceId}&limit=50`);
          if (storiesRes.ok) {
            const storiesJson = await storiesRes.json();
            if (storiesJson.stories && Array.isArray(storiesJson.stories)) {
              // 提取所有owner并去重
              const ownerSet = new Set<string>();
              for (const story of storiesJson.stories) {
                if (story.owner) {
                  // 支持多人（分号、逗号分隔）
                  const names = story.owner.split(/[;,、]/).map((s: string) => s.trim()).filter(Boolean);
                  names.forEach((name: string) => ownerSet.add(name));
                }
                // 也提取creator
                if (story.creator) {
                  ownerSet.add(story.creator.trim());
                }
              }

              ownersList = Array.from(ownerSet).map(name => ({ name, role: '' }));
              console.log(`[RoleConfigTab] 从需求中提取 ${ownersList.length} 个成员`);
            }
          }
        } catch (e) {
          console.error('[RoleConfigTab] 从需求提取成员失败:', e);
        }
      }

      // 设置结果
      setOwners(ownersList);

      if (ownersList.length === 0) {
        message.warning('未找到项目成员，请确认项目ID是否正确或联系管理员');
      } else {
        message.success(`成功加载 ${ownersList.length} 个成员`);
      }
    } catch (e) {
      console.error('[RoleConfigTab] 加载 owner 异常:', e);
      message.error('加载成员异常');
    } finally {
      setLoadingOwners(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    loadMappings();
  }, [loadMappings]);

  // 已映射成 Map: name -> role
  const mappingMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const mp of mappings) {
      m.set(mp.memberName, mp.role);
    }
    return m;
  }, [mappings]);

  // 待分配的 owner 列表
  const unmappedOwners = useMemo(
    () => owners.filter((o) => !mappingMap.has(o.name)),
    [owners, mappingMap],
  );

  // 保存映射
  const handleSave = async () => {
    if (!workspaceId) return;
    setSaving(true);
    try {
      // 合并单行编辑 + 批量分配
      const batchMappings: Array<{ memberName: string; role: string }> = [];

      // 单行编辑的映射（每人可能有多个角色）
      for (const [memberName, roles] of Object.entries(editingRow)) {
        for (const role of roles) {
          if (role) batchMappings.push({ memberName, role });
        }
      }

      // 批量选择的映射（优先级高于单行编辑，会覆盖）
      if (batchRoles.length > 0 && selectedRowKeys.length > 0) {
        for (const key of selectedRowKeys) {
          const name = String(key);
          for (const role of batchRoles) {
            batchMappings.push({ memberName: name, role });
          }
        }
      }

      if (batchMappings.length === 0) {
        message.warning('请先选择成员并分配角色');
        setSaving(false);
        return;
      }

      const payload = {
        workspaceId,
        mappings: batchMappings,
      };
      const res = await fetch('/api/v1/tapd/role-mappings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (json.success) {
        message.success(json.message || `保存成功 (${batchMappings.length}条)`);
        setEditingRow({});
        setSelectedRowKeys([]);
        setBatchRoles([]);
        await loadMappings();
      } else {
        message.error('保存失败: ' + json.message);
      }
    } catch {
      message.error('保存异常');
    } finally {
      setSaving(false);
    }
  };

  // 批量分配：选中成员后一键分配多个角色
  const handleBatchAssign = (roles: string[]) => {
    setBatchRoles(roles);
    // 立即写入 editingRow，让用户看到预览效果
    setEditingRow((prev) => {
      const next = { ...prev };
      for (const key of selectedRowKeys) {
        next[String(key)] = roles;
      }
      return next;
    });
  };

  // 表格列定义
  const columns: ColumnsType<Mapping> = [
    {
      title: '成员姓名',
      dataIndex: 'memberName',
      width: 140,
      render: (v) => (
        <Space>
          <UserOutlined />
          <Text strong>{v}</Text>
        </Space>
      ),
    },
    {
      title: '当前角色',
      dataIndex: 'role',
      width: 130,
      render: (v) => {
        const isCore = CORE_ROLES.includes(v);
        const color = isCore ? 'blue' : 'default';
        return <Tag color={color}>{v}</Tag>;
      },
    },
    {
      title: '更新时间',
      dataIndex: 'updatedAt',
      width: 170,
      render: (v) => new Date(v).toLocaleString('zh-CN'),
    },
  ];

  // 待分配 owner 表格列
  const ownerColumns: ColumnsType<OwnerInfo> = [
    {
      title: '成员姓名',
      dataIndex: 'name',
      width: 140,
      render: (v) => (
        <Space>
          <Text strong>{v}</Text>
        </Space>
      ),
    },
    {
      title: '当前角色',
      dataIndex: 'role',
      width: 180,
      render: (_, record) => {
        // 优先显示批量分配/单行编辑的预览值（多角色数组）
        const previewValues = editingRow[record.name];
        const displayValues = (previewValues && previewValues.length > 0)
          ? previewValues
          : (record.role ? [record.role] : []);
        if (displayValues.length === 0) return <Tag color="orange">未分配</Tag>;
        return (
          <Space size={2} wrap>
            {displayValues.map((r) => {
              const isCore = CORE_ROLES.includes(r);
              return <Tag key={r} color={isCore ? 'blue' : 'default'}>{r}</Tag>;
            })}
          </Space>
        );
      },
    },
    {
      title: '快速分配',
      width: 240,
      render: (_, record) => {
        const currentValue = editingRow[record.name]
          || (record.role ? [record.role] : []);

        return (
          <Select
            placeholder="选择角色（可多选）"
            style={{ width: 220 }}
            size="small"
            mode="multiple"
            value={currentValue}
            onChange={(value: string[]) => {
              setEditingRow((prev) => ({ ...prev, [record.name]: value }));
              // 如果该行在选中列表中，同步更新批量角色
              if (selectedRowKeys.includes(record.name)) {
                setBatchRoles(value);
              }
            }}
          >
            {CORE_ROLES.map((r) => (
              <Select.Option key={r} value={r}>
                <Tag color="blue" style={{ margin: 0 }}>{r}</Tag>
              </Select.Option>
            ))}
            {AUX_ROLES.map((r) => (
              <Select.Option key={r} value={r}>
                <Tag style={{ margin: 0 }}>{r}</Tag>
              </Select.Option>
            ))}
          </Select>
        );
      },
    },
  ];

  // 行选择配置
  const rowSelection = {
    selectedRowKeys,
    onChange: (newSelectedRowKeys: React.Key[]) => {
      setSelectedRowKeys(newSelectedRowKeys);
      // 清空批量角色（重新选择时重置）
      if (newSelectedRowKeys.length === 0) {
        setBatchRole(undefined);
      }
    },
    // 只允许选择未映射的成员
    getCheckboxProps: (record: OwnerInfo) => ({
      disabled: mappingMap.has(record.name),
      name: record.name,
    }),
  };

  if (!workspaceId) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <Alert
          message="请先选择TAPD项目"
          description="选择项目后可在此配置该项目的成员角色映射"
          type="info"
          showIcon
        />
      </div>
    );
  }

  return (
    <div style={{ padding: '16px' }}>
      <Card style={{ marginBottom: 16 }}>
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Title level={4} style={{ margin: 0 }}>
            <TeamOutlined /> 角色配置 - 当前项目
          </Title>

          <Alert
            type="info"
            showIcon
            message="配置成员角色映射后，迭代计划中的工时将按角色自动分配"
            description={
              <ul style={{ marginBottom: 0, paddingLeft: 18 }}>
                <li>核心角色：后端、前端、移动端、测试（参与工时统计）</li>
                <li>辅助角色：PO、UED、UI等（不参与工时统计）</li>
                <li>未配置角色的成员，系统将尝试自动推断或均分到所有角色</li>
              </ul>
            }
          />

          <Space wrap>
            <Button icon={<SyncOutlined />} onClick={loadMappings} loading={loading}>
              刷新映射列表
            </Button>
            <Button
              icon={<SyncOutlined />}
              onClick={loadOwners}
              loading={loadingOwners}
              type="dashed"
            >
              加载最近迭代的成员
            </Button>
            <Button
              type="primary"
              icon={<SaveOutlined />}
              loading={saving}
              onClick={handleSave}
              disabled={Object.keys(editingRow).length === 0}
            >
              保存修改 ({Object.values(editingRow).flat().length + batchRoles.length * selectedRowKeys.length})
            </Button>
          </Space>
        </Space>
      </Card>

      {/* 已配置的映射列表 */}
      <Card
        size="small"
        title={
          <Space>
            <span>已配置的映射</span>
            <Tag color="blue">{mappings.length}</Tag>
          </Space>
        }
        style={{ marginBottom: 16 }}
      >
        <Table
          dataSource={mappings}
          columns={columns}
          rowKey="id"
          pagination={{ pageSize: 10 }}
          size="small"
          loading={loading}
        />
      </Card>

      {/* 待分配的成员 */}
      <Card
        size="small"
        title={
          <Space>
            <UserOutlined />
            <span>待分配成员</span>
            {unmappedOwners.length > 0 && (
              <Tag color="orange">{unmappedOwners.length} 待分配</Tag>
            )}
          </Space>
        }
        extra={
          selectedRowKeys.length > 0 ? (
            <Space size="small">
              <Text type="secondary" style={{ fontSize: 12 }}>
                已选 {selectedRowKeys.length} 人
              </Text>
              <Select
                placeholder="批量分配角色（可多选）"
                style={{ width: 200 }}
                size="small"
                mode="multiple"
                value={batchRoles}
                allowClear
                onChange={handleBatchAssign}
              >
                {CORE_ROLES.map((r) => (
                  <Select.Option key={r} value={r}>
                    <Tag color="blue" style={{ margin: 0 }}>{r}</Tag>
                  </Select.Option>
                ))}
                {AUX_ROLES.map((r) => (
                  <Select.Option key={r} value={r}>
                    <Tag style={{ margin: 0 }}>{r}</Tag>
                  </Select.Option>
                ))}
              </Select>
              <Button
                size="small"
                type="link"
                danger
                onClick={() => {
                  setSelectedRowKeys([]);
                  setBatchRoles([]);
                  // 清除选中行的编辑状态
                  const next = { ...editingRow };
                  for (const key of selectedRowKeys) {
                    delete next[String(key)];
                  }
                  setEditingRow(next);
                }}
              >
                取消选择
              </Button>
            </Space>
          ) : null
        }
      >
        {owners.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              <Space direction="vertical" size="small" align="center">
                <Text type="secondary">尚未加载项目成员</Text>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  点击上方「加载最近迭代的成员」按钮
                </Text>
              </Space>
            }
          />
        ) : (
          <Table
            dataSource={owners}
            columns={ownerColumns}
            rowKey="name"
            rowSelection={rowSelection}
            pagination={{ pageSize: 10 }}
            size="small"
            loading={loadingOwners}
          />
        )}
      </Card>

      {/* 提示信息 */}
      {mappings.length === 0 && owners.length === 0 && (
        <Alert
          style={{ marginTop: 16 }}
          type="warning"
          showIcon
          message="尚未配置任何角色映射"
          description={
            <div>
              <p>当前项目的迭代计划中工时可能显示为0.00，原因：</p>
              <ol style={{ marginBottom: 0, paddingLeft: 20 }}>
                <li>未配置成员 → 角色映射关系</li>
                <li>项目没有Task数据</li>
                <li>TAPD需求中没有填写预估工时</li>
              </ol>
              <p style={{ marginTop: 8 }}>
                请点击「加载最近迭代的成员」按钮开始配置。
              </p>
            </div>
          }
        />
      )}
    </div>
  );
};

export default RoleConfigTabContent;
