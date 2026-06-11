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
  Tabs,
  Typography,
  Empty,
} from 'antd';
import {
  SyncOutlined,
  SaveOutlined,
  TeamOutlined,
  UserOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';

const { Title, Text } = Typography;

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

interface ProjectRole {
  id: number;
  workspaceId: string;
  roleId: string;
  roleName: string;
  isSystem: boolean;
  isActive: boolean;
}

interface OwnerInfo {
  name: string;
  role: string;
}

// 4 大主角色（用于工作量计算）
const CORE_ROLES = ['后端', '前端', '移动端', '测试'];
// 辅助角色（不计工作量，但需映射）
const AUX_ROLES = ['PO', 'UED', 'UI', '借调人员', '运维', 'PM', 'HR', '其他'];

const RoleMappingPage: React.FC = () => {
  const [workspaceId, setWorkspaceId] = useState<string>('');
  const [workspaces, setWorkspaces] = useState<Array<{ id: string; name: string }>>([]);

  const [mappings, setMappings] = useState<Mapping[]>([]);
  const [owners, setOwners] = useState<OwnerInfo[]>([]);
  const [projectRoles, setProjectRoles] = useState<ProjectRole[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncingRoles, setSyncingRoles] = useState(false);
  const [loadingOwners, setLoadingOwners] = useState(false);
  const [inferringRoles, setInferringRoles] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingRow, setEditingRow] = useState<Record<string, string>>({});

  // 自动角色推断结果
  interface RoleSuggestion {
    memberName: string;
    suggestedRole: string;
    confidence: number;
    taskCount: number;
    matchedTaskCount: number;
  }
  const [suggestions, setSuggestions] = useState<RoleSuggestion[]>([]);

  // 加载项目列表
  useEffect(() => {
    fetch('/api/v1/tapd/workspaces')
      .then((r) => r.json())
      .then((res) => {
        if (res.success) {
          const list = res.data || res.projects || [];
          setWorkspaces(
            list.map((p: { id?: string; workspaceId?: string; workspace_id?: string; name?: string; workspaceName?: string }) => ({
              id: String(p.id || p.workspaceId || p.workspace_id),
              name: p.name || p.workspaceName || String(p.id),
            })),
          );
          const first = list[0];
          if (first) {
            setWorkspaceId(String(first.id || first.workspaceId || first.workspace_id));
          }
        }
      })
      .catch((e) => console.error('加载项目列表失败:', e));
  }, []);

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

  // 加载项目角色
  const loadProjectRoles = useCallback(async (refresh = false) => {
    if (!workspaceId) return;
    setSyncingRoles(true);
    try {
      const url = `/api/v1/tapd/project-roles?workspaceId=${workspaceId}${refresh ? '&refresh=true' : ''}`;
      const res = await fetch(url);
      const json = await res.json();
      if (json.success) {
        setProjectRoles(json.data || []);
        message.success(`已同步 ${json.data?.length || 0} 个角色${refresh ? '（强制刷新）' : ''}`);
      } else {
        message.error('同步角色失败: ' + json.message);
      }
    } catch (e) {
      console.error('加载项目角色异常:', e);
      message.error('同步项目角色异常，请检查网络或 TAPD 配置');
    } finally {
      setSyncingRoles(false);
    }
  }, [workspaceId]);

  // 自动从 Task 名称推断角色
  const inferRolesFromTasks = useCallback(async (wsId: string, iterId?: string) => {
    setInferringRoles(true);
    try {
      let url = `/api/v1/tapd/auto-assign-roles?workspaceId=${wsId}`;
      if (iterId) url += `&iterationId=${iterId}`;
      const res = await fetch(url);
      const json = await res.json();
      if (json.success && json.data?.suggestions) {
        setSuggestions(json.data.suggestions);
        if (json.data.suggestions.length > 0) {
          message.info(
            `已从 ${json.data.totalTasks} 个 Task 中推断出 ${json.data.matchedOwners} 人的角色建议`,
          );
        } else {
          message.info('未检测到含角色前缀的 Task（如【前端】、【后端】等），请手动分配');
        }
      }
    } catch (e) {
      console.warn('自动角色推断失败（可忽略）:', e);
    } finally {
      setInferringRoles(false);
    }
  }, []);

  // 一键应用所有推断结果
  const applyAllSuggestions = useCallback(() => {
    const next: Record<string, string> = { ...editingRow };
    for (const s of suggestions) {
      if (s.confidence >= 50) {
        next[s.memberName] = s.suggestedRole;
      }
    }
    setEditingRow(next);
    message.success(`已应用 ${suggestions.filter((s) => s.confidence >= 50).length} 条高置信度建议`);
  }, [suggestions, editingRow]);

  // 加载 owner 并自动推断角色（不强制依赖迭代）
  const loadOwners = useCallback(async () => {
    if (!workspaceId) return;
    setLoadingOwners(true);
    setSuggestions([]);
    try {
      let loadedOwners: Array<{ name: string; role: string }> = [];
      let iterId: string | undefined;

      // 步骤1：尝试获取迭代（用于限定范围，但非必须）
      try {
        const itersRes = await fetch(`/api/v1/tapd/iterations?workspaceId=${workspaceId}&limit=1`);
        if (itersRes.ok) {
          const itersJson = await itersRes.json();
          if (itersJson.success && itersJson.data?.length > 0) {
            iterId = itersJson.data[0].id;
          }
        }
      } catch (e) {
        console.warn('[loadOwners] 迭代查询跳过（非致命）:', e);
      }

      // 步骤2：获取 owner 列表（优先用迭代ID，否则用 workspaceId 直查）
      if (iterId) {
        // 有迭代 → 通过 sprints/owners 接口查
        const res = await fetch(`/api/v1/agile/sprints/${iterId}/owners`);
        if (res.ok) {
          const json = await res.json();
          if (json.success) {
            loadedOwners = json.data.owners || [];
          }
        }
      }

      // 步骤3：如果迭代方式没拿到 owner，直接从 Task 数据提取
      if (loadedOwners.length === 0) {
        message.info('未通过迭代获取到 owner，正在直接从 Task 数据中提取...');
        const inferRes = await fetch(
          `/api/v1/tapd/auto-assign-roles?workspaceId=${workspaceId}${iterId ? `&iterationId=${iterId}` : ''}`,
        );
        if (inferRes.ok) {
          const inferJson = await inferRes.json();
          if (inferJson.success && inferJson.data?.suggestions) {
            // 从推断结果反向构建 owner 列表
            const ownerSet = new Map<string, string>();
            for (const s of inferJson.data.suggestions) {
              if (!ownerSet.has(s.memberName)) {
                ownerSet.set(s.memberName, s.suggestedRole);
              }
            }
            loadedOwners = Array.from(ownerSet.entries()).map(([name, role]) => ({
              name,
              role,
            }));
            setSuggestions(inferJson.data.suggestions);
          }
        }
      }

      // 步骤4：设置结果
      if (loadedOwners.length > 0) {
        setOwners(loadedOwners);

        const mappedCount = loadedOwners.filter((o) => o.role).length;
        message.success(`已加载 ${loadedOwners.length} 个 owner（已映射 ${mappedCount} 个）`);

        // 如果还没触发过推断（即步骤3没走），则触发
        if (suggestions.length === 0 && iterId) {
          inferRolesFromTasks(workspaceId, iterId);
        }
      } else {
        message.warning(
          '未找到任何成员数据。请确认该项目在 TAPD 中有需求/Task 数据，或已通过「数据同步」同步过',
        );
      }
    } catch (e) {
      console.error('加载 owner 异常:', e);
      const msg = e instanceof Error ? e.message : '未知错误';
      message.error('加载 owner 异常: ' + msg);
    } finally {
      setLoadingOwners(false);
    }
  }, [workspaceId, inferRolesFromTasks, suggestions.length]);

  useEffect(() => {
    loadMappings();
    loadProjectRoles();
  }, [loadMappings, loadProjectRoles]);

  // 已映射成 Map: name -> role
  const mappingMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const mp of mappings) {
      m.set(mp.memberName, mp.role);
    }
    return m;
  }, [mappings]);

  // 待分配的 owner 列表（未映射的人员）
  const unmappedOwners = useMemo(
    () => owners.filter((o) => !mappingMap.has(o.name)),
    [owners, mappingMap],
  );

  // 保存映射
  const handleSave = async () => {
    if (!workspaceId) return;
    setSaving(true);
    try {
      const payload = {
        workspaceId,
        mappings: Object.entries(editingRow).map(([memberName, role]) => ({
          memberName,
          role,
        })),
      };
      const res = await fetch('/api/v1/tapd/role-mappings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (json.success) {
        message.success(json.message || '保存成功');
        setEditingRow({});
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

  // 批量分配角色（用于 owner 快速分配）
  const handleBatchAssign = (memberNames: string[], role: string) => {
    const newEditing = { ...editingRow };
    memberNames.forEach((name) => {
      newEditing[name] = role;
    });
    setEditingRow(newEditing);
    message.success(`已将 ${memberNames.length} 人暂存为「${role}」`);
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
      title: 'TAPD 角色ID',
      dataIndex: 'roleId',
      width: 180,
      render: (v) => (v ? <Text code style={{ fontSize: 11 }}>{v}</Text> : '-'),
    },
    {
      title: '备注',
      dataIndex: 'remark',
      ellipsis: true,
    },
    {
      title: '更新时间',
      dataIndex: 'updatedAt',
      width: 170,
      render: (v) => new Date(v).toLocaleString('zh-CN'),
    },
  ];

  // 待分配 owner 表格列（支持自动推断建议）
  const ownerColumns: ColumnsType<OwnerInfo & { _suggestion?: RoleSuggestion }> = [
    {
      title: '成员姓名',
      dataIndex: 'name',
      width: 140,
      render: (v, record) => (
        <Space>
          <Text strong>{v}</Text>
          {record._suggestion && (
            <Tag color={record._suggestion.confidence >= 80 ? 'green' : 'blue'} style={{ fontSize: 10 }}>
              AI {record._suggestion.confidence}%
            </Tag>
          )}
        </Space>
      ),
    },
    {
      title: '当前角色',
      dataIndex: 'role',
      width: 130,
      render: (v) =>
        v ? <Tag color="blue">{v}</Tag> : <Tag color="orange">未分配</Tag>,
    },
    {
      title: '快速分配',
      width: 300,
      render: (_, record) => {
        const suggestion = record._suggestion;
        const currentValue = editingRow[record.name] || record.role || undefined;
        const suggestedValue = suggestion?.suggestedRole;

        return (
          <Space size="small" wrap>
            <Select
              placeholder="选择角色"
              style={{ width: 160 }}
              allowClear
              value={currentValue}
              onChange={(value) => {
                setEditingRow((prev) => {
                  const next = { ...prev };
                  if (value) next[record.name] = value;
                  else delete next[record.name];
                  return next;
                });
              }}
            >
              {CORE_ROLES.map((r) => (
                <Select.Option key={r} value={r}>
                  <Tag color="blue">{r}</Tag>
                  {suggestedValue === r && <Text type="secondary" style={{ fontSize: 10 }}> ← AI</Text>}
                </Select.Option>
              ))}
              {AUX_ROLES.map((r) => (
                <Select.Option key={r} value={r}>
                  <Tag>{r}</Tag>
                  {suggestedValue === r && <Text type="secondary" style={{ fontSize: 10 }}> ← AI</Text>}
                </Select.Option>
              ))}
            </Select>
            {suggestion && !currentValue && (
              <Button
                size="small"
                type="link"
                icon={<ThunderboltOutlined />}
                onClick={() => {
                  setEditingRow((prev) => ({ ...prev, [record.name]: suggestion.suggestedRole }));
                }}
              >
                应用
              </Button>
            )}
          </Space>
        );
      },
    },
  ];

  return (
    <div style={{ padding: 24, background: '#f0f2f5', minHeight: '100vh' }}>
      <Card style={{ marginBottom: 16 }}>
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Title level={4} style={{ margin: 0 }}>
            <TeamOutlined /> TAPD 角色人员映射
          </Title>
          <Alert
            type="info"
            showIcon
            message="TAPD OpenAPI 不提供「成员↔角色」归属接口，本页用于维护本项目成员的角色归属"
            description={
              <ul style={{ marginBottom: 0, paddingLeft: 18 }}>
                <li>
                  配置完成后，在迭代工作台中，需求 owner 将自动归类到对应角色列（后端/前端/移动端/测试）
                </li>
                <li>配置按项目隔离，不同项目独立维护</li>
                <li>若未配置，则按&ldquo;全部进入测试&rdquo;或&ldquo;不计入&rdquo;处理（可在下方调整）</li>
              </ul>
            }
          />
          <Space wrap>
            <Select
              value={workspaceId}
              onChange={setWorkspaceId}
              style={{ width: 280 }}
              placeholder="选择 TAPD 项目"
            >
              {workspaces.map((w) => (
                <Select.Option key={w.id} value={w.id}>
                  {w.name} ({w.id})
                </Select.Option>
              ))}
            </Select>
            <Button icon={<SyncOutlined />} onClick={() => loadMappings()}>
              刷新
            </Button>
            <Button
              icon={<ThunderboltOutlined />}
              onClick={() => loadProjectRoles(true)}
              loading={syncingRoles}
            >
              从 TAPD 同步角色列表
            </Button>
            <Button
              icon={<SyncOutlined />}
              onClick={loadOwners}
              loading={loadingOwners}
              type="dashed"
            >
              加载最近迭代的 owner
            </Button>
            <Button
              type="primary"
              icon={<SaveOutlined />}
              loading={saving}
              onClick={handleSave}
              disabled={Object.keys(editingRow).length === 0}
            >
              保存修改 ({Object.keys(editingRow).length})
            </Button>
          </Space>
        </Space>
      </Card>

      <Tabs
        defaultActiveKey="owners"
        items={[
          {
            key: 'owners',
            label: (
              <Space>
                <UserOutlined />
                快速分配（按 owner）
                {unmappedOwners.length > 0 && (
                  <Tag color="orange">{unmappedOwners.length} 待分配</Tag>
                )}
              </Space>
            ),
            children: (
              <Card size="small">
                {owners.length === 0 ? (
                  <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description={
                      <Space direction="vertical" size="small" align="center">
                        <Text type="secondary">尚未加载项目成员</Text>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          点击上方「<ThunderboltOutlined /> 加载最近迭代的 owner」按钮
                        </Text>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          系统将自动拉取该项目最近迭代中的所有需求负责人（owner），并从 Task 名称自动推断角色
                        </Text>
                      </Space>
                    }
                  />
                ) : (
                  <>
                    {/* 自动推断结果面板 */}
                    {suggestions.length > 0 && (
                      <Alert
                        style={{ marginBottom: 12 }}
                        type="success"
                        showIcon
                        icon={<ThunderboltOutlined />}
                        message={`🤖 已从 Task 名称推断出 ${suggestions.length} 个角色建议`}
                        description={
                          <div>
                            <Space wrap size="small" style={{ marginBottom: 8 }}>
                              {suggestions.slice(0, 8).map((s) => (
                                <Tag
                                  key={s.memberName}
                                  color={s.confidence >= 80 ? 'green' : s.confidence >= 50 ? 'blue' : 'orange'}
                                >
                                  {s.memberName} → {s.suggestedRole} ({s.confidence}%)
                                </Tag>
                              ))}
                              {suggestions.length > 8 && (
                                <Tag>+{suggestions.length - 8} 更多</Tag>
                              )}
                            </Space>
                            <br />
                            <Button
                              size="small"
                              type="primary"
                              ghost
                              icon={<ThunderboltOutlined />}
                              loading={inferringRoles}
                              onClick={applyAllSuggestions}
                            >
                              一键应用所有高置信度建议 (≥50%)
                            </Button>
                            <Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>
                              推断依据：Task 名称前缀关键词，如【前端】、【后端】、【QA】、【Flutter】等
                            </Text>
                          </div>
                        }
                      />
                    )}

                    {inferringRoles && suggestions.length === 0 && (
                      <Alert style={{ marginBottom: 12 }} showIcon loading message="正在从 Task 名称分析角色..." />
                    )}

                    <Alert
                      style={{ marginBottom: 12 }}
                      showIcon
                      message={`共 ${owners.length} 个成员，${unmappedOwners.length} 个待分配`}
                      description={
                        <Space wrap size="small">
                          {unmappedOwners.length > 0 && (
                            <Text>批量分配：</Text>
                          )}
                          {CORE_ROLES.map((r) => (
                            <Button
                              key={r}
                              size="small"
                              disabled={unmappedOwners.length === 0}
                              onClick={() =>
                                handleBatchAssign(
                                  unmappedOwners.map((o) => o.name),
                                  r,
                                )
                              }
                            >
                              全部 → {r}
                            </Button>
                          ))}
                        </Space>
                      }
                    />
                    <Table
                      rowKey="name"
                      columns={ownerColumns}
                      dataSource={owners.map((o) => {
                        const suggestion = suggestions.find((s) => s.memberName === o.name);
                        return {
                          ...o,
                          _suggestion: suggestion,
                        };
                      })}
                      loading={loading}
                      size="small"
                      pagination={false}
                    />
                  </>
                )}
              </Card>
            ),
          },
          {
            key: 'mappings',
            label: (
              <Space>
                <TeamOutlined />
                全部映射（{mappings.length}）
              </Space>
            ),
            children: (
              <Card size="small">
                <Alert
                  style={{ marginBottom: 12 }}
                  showIcon
                  message={`当前项目共 ${mappings.length} 条映射记录`}
                  description={
                    mappings.length === 0
                      ? '请先在「快速分配」Tab 中加载成员并分配角色，或手动添加映射'
                      : '可在此查看/编辑所有成员的角色映射，修改后点击「保存修改」生效'
                  }
                  type={mappings.length === 0 ? 'warning' : 'info'}
                />
                {mappings.length > 0 && (
                  <Table
                    rowKey="id"
                    columns={columns}
                    dataSource={mappings}
                    loading={loading}
                    size="small"
                    pagination={{ pageSize: 50 }}
                  />
                )}
              </Card>
            ),
          },
          {
            key: 'roles',
            label: (
              <Space>
                <ThunderboltOutlined />
                TAPD 角色列表（{projectRoles.length}）
              </Space>
            ),
            children: (
              <Card size="small">
                {projectRoles.length === 0 ? (
                  <Empty description="点击上方「从 TAPD 同步角色列表」拉取" />
                ) : (
                  <>
                    <Alert
                      type="info"
                      showIcon
                      style={{ marginBottom: 12 }}
                      message="TAPD 项目角色定义（仅供参考）"
                      description="以下为该项目在 TAPD 中配置的角色，用于对照参考。实际工作量统计使用「后端/前端/移动端/测试」四大核心角色"
                    />
                    <Table
                      rowKey="id"
                      size="small"
                      pagination={false}
                      dataSource={projectRoles}
                      columns={[
                        {
                          title: '角色名称',
                          dataIndex: 'roleName',
                          width: 140,
                          render: (v) => {
                            const color = CORE_ROLES.includes(v)
                              ? 'green'
                              : AUX_ROLES.includes(v)
                                ? 'blue'
                                : undefined;
                            return <Tag color={color}>{v}</Tag>;
                          },
                        },
                        {
                          title: '角色ID',
                          dataIndex: 'roleId',
                          width: 200,
                          render: (v) => <Text code style={{ fontSize: 11 }}>{v}</Text>,
                        },
                        {
                          title: '类型',
                          dataIndex: 'isSystem',
                          width: 100,
                          render: (v) =>
                            v ? <Tag>系统角色</Tag> : <Tag color="purple">自定义</Tag>,
                        },
                      ]}
                    />
                  </>
                )}
              </Card>
            ),
          },
        ]}
      />
    </div>
  );
};

export default RoleMappingPage;
