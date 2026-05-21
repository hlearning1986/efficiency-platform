'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import {
  message,
  Tag,
  Input,
  Button,
  Spin,
  Switch,
  Modal,
  Checkbox,
  Popconfirm,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SearchOutlined,
  CheckOutlined,
} from '@ant-design/icons';

const TAPD_PROJECTS = [
  { id: '48763054', name: '高顿直播间' },
  { id: '46357942', name: 'Luca专项' },
  { id: '30668918', name: '小吉英语' },
  { id: '36005436', name: 'GDBot' },
  { id: '48254671', name: '中台项目' },
  { id: '37329286', name: '公职团队' },
  { id: '66690643', name: '高顿APP鸿蒙化' },
  { id: '37198579', name: '高顿数据' },
  { id: '20074131', name: 'OnePiece' },
  { id: '37748852', name: 'Sail团队_new' },
  { id: '46422870', name: 'Areteup' },
  { id: '20189291', name: 'CRM_销售' },
  { id: '31751975', name: 'MCRM_SCRM' },
  { id: '37539133', name: 'SCRM营销管理' },
  { id: '35153283', name: '小课新链路' },
  { id: '49993684', name: 'AI销售专项' },
  { id: '45361805', name: '上岸鸭' },
];

interface TeamConfigItem {
  id: string;
  name: string;
  tapdProjectIds: string[];
  enableTeamRanking: boolean;
  enableHrRanking: boolean;
}

export default function TeamConfigPage() {
  const [data, setData] = useState<TeamConfigItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');

  // 弹窗
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formProjects, setFormProjects] = useState<string[]>([]);
  const [formTeamRanking, setFormTeamRanking] = useState(true);
  const [formHrRanking, setFormHrRanking] = useState(true);

  // 项目选择下拉
  const [showProjectDropdown, setShowProjectDropdown] = useState(false);
  const [projectSearch, setProjectSearch] = useState('');
  const [tempSelected, setTempSelected] = useState<Set<string>>(new Set());
  const dropdownRef = useRef<HTMLDivElement>(null);

  // 加载数据
  const loadData = useCallback(async () => {
    try {
      const resp = await fetch('/api/v1/settings/team-config');
      const result = await resp.json();
      if (result.success) setData(result.data || []);
    } catch {
      message.error('加载团队配置失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 切换开关
  const handleToggle = async (
    id: string,
    field: 'enableTeamRanking' | 'enableHrRanking',
    value: boolean,
  ) => {
    setData((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item)),
    );
    try {
      const resp = await fetch('/api/v1/settings/team-config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, field, value }),
      });
      const result = await resp.json();
      if (!result.success) {
        message.error(result.message || '切换失败');
        loadData();
      }
    } catch {
      message.error('切换失败');
      loadData();
    }
  };

  // 删除
  const handleDelete = async (id: string) => {
    try {
      const resp = await fetch(`/api/v1/settings/team-config?id=${id}`, {
        method: 'DELETE',
      });
      const result = await resp.json();
      if (result.success) {
        message.success('删除成功');
        setData((prev) => prev.filter((item) => item.id !== id));
      } else {
        message.error(result.message || '删除失败');
      }
    } catch {
      message.error('删除失败');
    }
  };

  // 打开新增弹窗
  const openAddModal = () => {
    setEditingId(null);
    setFormName('');
    setFormProjects([]);
    setFormTeamRanking(true);
    setFormHrRanking(true);
    setTempSelected(new Set());
    setModalOpen(true);
  };

  // 打开编辑弹窗
  const openEditModal = (item: TeamConfigItem) => {
    setEditingId(item.id);
    setFormName(item.name);
    setFormProjects([...item.tapdProjectIds]);
    setFormTeamRanking(item.enableTeamRanking);
    setFormHrRanking(item.enableHrRanking);
    setTempSelected(new Set(item.tapdProjectIds));
    setModalOpen(true);
  };

  // 保存
  const handleSave = async () => {
    if (!formName.trim()) {
      message.warning('请输入团队名称');
      return;
    }

    const body = {
      name: formName.trim(),
      tapdProjectIds: formProjects,
      enableTeamRanking: formTeamRanking,
      enableHrRanking: formHrRanking,
    };

    try {
      const url = editingId
        ? '/api/v1/settings/team-config'
        : '/api/v1/settings/team-config';
      const method = editingId ? 'PUT' : 'POST';
      const payload = editingId ? { ...body, id: editingId } : body;

      const resp = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await resp.json();
      if (result.success) {
        message.success(editingId ? '更新成功' : '新增成功');
        setModalOpen(false);
        loadData();
      } else {
        message.error(result.message || '保存失败');
      }
    } catch {
      message.error('保存失败');
    }
  };

  // 项目下拉 - 确认多选
  const confirmProjectSelect = () => {
    setFormProjects(Array.from(tempSelected));
    setShowProjectDropdown(false);
    setProjectSearch('');
  };

  // 移除已选项目
  const removeProject = (pid: string) => {
    setFormProjects((prev) => prev.filter((p) => p !== pid));
    setTempSelected((prev) => {
      const next = new Set(prev);
      next.delete(pid);
      return next;
    });
  };

  // 过滤
  const filteredData = data.filter((item) =>
    item.name.toLowerCase().includes(searchText.toLowerCase()),
  );

  const filteredProjects = TAPD_PROJECTS.filter((p) =>
    !projectSearch || p.name.toLowerCase().includes(projectSearch.toLowerCase()) || p.id.includes(projectSearch),
  );

  // 点击外部关闭下拉
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowProjectDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>团队配置</h2>
          <p style={{ fontSize: 12, color: '#9ca3b4', margin: '4px 0 0' }}>
            自定义团队与 TAPD 项目的映射关系，以及排名参与开关
          </p>
        </div>
        <Input
          placeholder="搜索团队名称..."
          prefix={<SearchOutlined />}
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          style={{ width: 200 }}
          size="small"
          allowClear
        />
      </div>

      <Spin spinning={loading}>
        <div style={{ border: '1px solid #e8ecf1', borderRadius: 10, overflow: 'hidden', background: '#fff' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f8f9fb' }}>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, fontSize: 12, color: '#5f6577', borderBottom: '1px solid #e8ecf1', width: 130 }}>团队名称</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, fontSize: 12, color: '#5f6577', borderBottom: '1px solid #e8ecf1' }}>项目</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, fontSize: 12, color: '#5f6577', borderBottom: '1px solid #e8ecf1', width: 140 }}>参与团队排名</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, fontSize: 12, color: '#5f6577', borderBottom: '1px solid #e8ecf1', width: 140 }}>人力资源排名</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, fontSize: 12, color: '#5f6577', borderBottom: '1px solid #e8ecf1', width: 120 }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.map((item) => (
                <tr key={item.id} style={{ borderBottom: '1px solid #f0f2f5' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#fafbfc')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = '')}
                >
                  <td style={{ padding: '12px 16px', fontWeight: 600 }}>{item.name}</td>
                  <td style={{ padding: '12px 16px', verticalAlign: 'top' }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {item.tapdProjectIds.map((pid) => {
                        const proj = TAPD_PROJECTS.find((p) => p.id === pid);
                        return (
                          <Tag key={pid} style={{ margin: 0, fontSize: 11 }}>
                            {proj?.name || pid}
                          </Tag>
                        );
                      })}
                      {item.tapdProjectIds.length === 0 && (
                        <span style={{ fontSize: 12, color: '#9ca3b4' }}>-</span>
                      )}
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Switch
                        size="small"
                        checked={item.enableTeamRanking}
                        onChange={(v) => handleToggle(item.id, 'enableTeamRanking', v)}
                      />
                      <span style={{ fontSize: 12, color: item.enableTeamRanking ? '#22c55e' : '#ef4444' }}>
                        {item.enableTeamRanking ? '参与' : '不参与'}
                      </span>
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Switch
                        size="small"
                        checked={item.enableHrRanking}
                        onChange={(v) => handleToggle(item.id, 'enableHrRanking', v)}
                      />
                      <span style={{ fontSize: 12, color: item.enableHrRanking ? '#22c55e' : '#ef4444' }}>
                        {item.enableHrRanking ? '参与' : '不参与'}
                      </span>
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <Button type="primary" size="small" icon={<EditOutlined />} onClick={() => openEditModal(item)}>
                        编辑
                      </Button>
                      <Popconfirm title="确定删除该团队？" onConfirm={() => handleDelete(item.id)} okText="删除" cancelText="取消" okButtonProps={{ danger: true }}>
                        <Button danger size="small" icon={<DeleteOutlined />}>
                          删除
                        </Button>
                      </Popconfirm>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredData.length === 0 && !loading && (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: 40, color: '#9ca3b4' }}>
                    暂无团队配置，点击下方按钮新增
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          <div style={{ padding: 16, borderTop: '1px solid #f0f2f5' }}>
            <Button type="primary" icon={<PlusOutlined />} onClick={openAddModal}>
              新增团队
            </Button>
          </div>
        </div>
      </Spin>

      {/* 新增/编辑弹窗 */}
      <Modal
        title={editingId ? '编辑团队' : '新增团队'}
        open={modalOpen}
        onOk={handleSave}
        onCancel={() => setModalOpen(false)}
        okText="保存"
        cancelText="取消"
        width={520}
      >
        <div style={{ marginBottom: 18 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>
            团队名称 <span style={{ color: '#ef4444' }}>*</span>
          </label>
          <Input
            placeholder="请输入团队名称"
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
          />
        </div>

        <div style={{ marginBottom: 18 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>
            关联项目 <span style={{ fontSize: 12, fontWeight: 400, color: '#9ca3b4', marginLeft: 6 }}>
              （从 TAPD 项目列表中选择，支持多选）
            </span>
          </label>
          <div
            style={{
              minHeight: 38,
              padding: '6px 8px',
              border: '1px solid #e8ecf1',
              borderRadius: 6,
              display: 'flex',
              flexWrap: 'wrap',
              gap: 4,
              alignItems: 'center',
              cursor: 'text',
            }}
            onClick={() => {
              setTempSelected(new Set(formProjects));
              setShowProjectDropdown(true);
            }}
          >
            {formProjects.map((pid) => {
              const proj = TAPD_PROJECTS.find((p) => p.id === pid);
              return (
                <Tag key={pid} closable onClose={() => removeProject(pid)} style={{ margin: 0, fontSize: 11 }}>
                  {proj?.name || pid}
                </Tag>
              );
            })}
            <span
              style={{
                padding: '2px 8px',
                border: '1px dashed #e8ecf1',
                borderRadius: 4,
                fontSize: 11,
                color: '#9ca3b4',
                cursor: 'pointer',
              }}
            >
              + 添加项目
            </span>
          </div>

          {/* 项目选择下拉 */}
          {showProjectDropdown && (
            <div
              ref={dropdownRef}
              style={{
                position: 'relative',
                zIndex: 100,
                marginTop: 4,
                background: '#fff',
                border: '1px solid #e8ecf1',
                borderRadius: 6,
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                maxHeight: 320,
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <div style={{ padding: 8, borderBottom: '1px solid #f0f2f5' }}>
                <Input
                  placeholder="搜索TAPD项目..."
                  size="small"
                  value={projectSearch}
                  onChange={(e) => setProjectSearch(e.target.value)}
                  autoFocus
                />
              </div>
              <div style={{ overflowY: 'auto', maxHeight: 220 }}>
                {filteredProjects.map((proj) => {
                  const isChecked = tempSelected.has(proj.id);
                  return (
                    <div
                      key={proj.id}
                      onClick={() => {
                        setTempSelected((prev) => {
                          const next = new Set(prev);
                          if (next.has(proj.id)) next.delete(proj.id);
                          else next.add(proj.id);
                          return next;
                        });
                      }}
                      style={{
                        padding: '6px 12px',
                        fontSize: 12,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        background: isChecked ? '#eef1fe' : undefined,
                      }}
                      onMouseEnter={(e) => { if (!isChecked) e.currentTarget.style.background = '#f5f7fb'; }}
                      onMouseLeave={(e) => { if (!isChecked) e.currentTarget.style.background = ''; }}
                    >
                      <Checkbox checked={isChecked} />
                      <span style={{ flex: 1 }}>{proj.name}</span>
                      <span style={{ fontSize: 10, color: '#9ca3b4' }}>{proj.id}</span>
                    </div>
                  );
                })}
              </div>
              <div
                style={{
                  padding: '8px 12px',
                  borderTop: '1px solid #f0f2f5',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: '#fafbfc',
                  borderRadius: '0 0 6px 6px',
                }}
              >
                <span style={{ fontSize: 11, color: '#5f6577' }}>已选 {tempSelected.size} 项</span>
                <Button type="primary" size="small" disabled={tempSelected.size === 0} onClick={confirmProjectSelect} icon={<CheckOutlined />}>
                  确认
                </Button>
              </div>
            </div>
          )}
        </div>

        <div style={{ marginBottom: 18 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>
            排名配置
          </label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0' }}>
              <span style={{ fontSize: 13, minWidth: 100 }}>参与团队排名</span>
              <Switch size="small" checked={formTeamRanking} onChange={setFormTeamRanking} />
              <span style={{ fontSize: 12, color: formTeamRanking ? '#22c55e' : '#ef4444' }}>
                {formTeamRanking ? '参与' : '不参与'}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0' }}>
              <span style={{ fontSize: 13, minWidth: 100 }}>人力资源排名</span>
              <Switch size="small" checked={formHrRanking} onChange={setFormHrRanking} />
              <span style={{ fontSize: 12, color: formHrRanking ? '#22c55e' : '#ef4444' }}>
                {formHrRanking ? '参与' : '不参与'}
              </span>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
