'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { message, Tag, Input, Select, Button, Spin, Checkbox } from 'antd';
import {
  SyncOutlined,
  SaveOutlined,
  PlusOutlined,
  SearchOutlined,
  CheckOutlined,
} from '@ant-design/icons';
import { useTapdConfigStore } from '@/stores/tapd-config.store';

const TAPD_PROJECTS = [
  { id: '48763054', name: '高顿直播间' },
  { id: '46357942', name: 'Luca专项' },
  { id: '30668918', name: '小吉英语' },
  { id: '36005436', name: 'GDbot' },
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

const CATEGORY_MAP: Record<string, { label: string; color: string }> = {
  STRATEGIC: { label: '战略项目', color: 'red' },
  REGULAR: { label: '常规项目', color: 'blue' },
  TECHNICAL: { label: '技术项目', color: 'green' },
};

interface MappingRow {
  projectId: string;
  name: string;
  category: string;
  okrName: string;
  tapdBelongings: string[];
}

interface TapdBelongingItem {
  value: string;
  source: string;
}

export default function ProjectMappingPage() {
  const { config: apiConfig, isConfigured } = useTapdConfigStore();
  const [data, setData] = useState<MappingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [searchText, setSearchText] = useState('');

  // TAPD 归属值池
  const [tapdPool, setTapdPool] = useState<TapdBelongingItem[]>([]);
  const [poolSearch, setPoolSearch] = useState('');
  const [showPool, setShowPool] = useState(false);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  // 多选临时勾选
  const [tempSelected, setTempSelected] = useState<Set<string>>(new Set());
  const poolRef = useRef<HTMLDivElement>(null);

  // 加载映射数据
  const loadData = useCallback(async () => {
    try {
      const resp = await fetch('/api/v1/settings/project-mapping');
      const result = await resp.json();
      if (result.success) {
        setData(result.data || []);
      }
    } catch {
      message.error('加载映射数据失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 同步 TAPD 归属值
  const handleSync = async () => {
    if (!isConfigured) {
      message.warning('请先在 TAPD 配置中填写 API 凭据');
      return;
    }
    setSyncing(true);
    try {
      const workspaceIds = TAPD_PROJECTS.map((p) => p.id);
      const resp = await fetch('/api/v1/settings/project-mapping/sync-tapd', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiUser: apiConfig.apiUser,
          apiPassword: apiConfig.apiPassword,
          workspaceIds,
        }),
      });
      const result = await resp.json();
      if (result.success) {
        setTapdPool(result.data || []);
        message.success(result.message || '同步成功');
      } else {
        message.error(result.message || '同步失败');
      }
    } catch {
      message.error('同步失败');
    } finally {
      setSyncing(false);
    }
  };

  // 保存全部
  const handleSave = async () => {
    setSaving(true);
    try {
      const resp = await fetch('/api/v1/settings/project-mapping', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mappings: data }),
      });
      const result = await resp.json();
      if (result.success) {
        message.success(result.message || '保存成功');
      } else {
        message.error(result.message || '保存失败');
      }
    } catch {
      message.error('保存失败');
    } finally {
      setSaving(false);
    }
  };

  // 批量添加选中的 TAPD 归属到项目
  const handleConfirmMultiSelect = (projectId: string) => {
    if (tempSelected.size === 0) return;
    setData((prev) =>
      prev.map((row) => {
        if (row.projectId !== projectId) return row;
        const newBelongings = [...row.tapdBelongings];
        for (const val of Array.from(tempSelected)) {
          if (!newBelongings.includes(val)) {
            newBelongings.push(val);
          }
        }
        return { ...row, tapdBelongings: newBelongings };
      }),
    );
    const count = tempSelected.size;
    message.success(`已添加 ${count} 条映射`);
    setShowPool(false);
    setTempSelected(new Set());
    setPoolSearch('');
  };

  // 切换多选勾选
  const toggleTempSelect = (value: string) => {
    setTempSelected((prev) => {
      const next = new Set(prev);
      if (next.has(value)) {
        next.delete(value);
      } else {
        next.add(value);
      }
      return next;
    });
  };

  // 移除 TAPD 归属
  const handleRemoveBelonging = (projectId: string, value: string) => {
    setData((prev) =>
      prev.map((row) => {
        if (row.projectId !== projectId) return row;
        return {
          ...row,
          tapdBelongings: row.tapdBelongings.filter((b) => b !== value),
        };
      }),
    );
  };

  // 过滤
  const filteredData = data.filter((row) => {
    if (filterCategory !== 'all' && row.category !== filterCategory)
      return false;
    if (searchText && !row.name.toLowerCase().includes(searchText.toLowerCase()))
      return false;
    return true;
  });

  // TAPD 归属值池过滤
  const filteredPool = tapdPool.filter((item) => {
    if (!poolSearch) return true;
    return item.value.toLowerCase().includes(poolSearch.toLowerCase());
  });

  // 打开下拉时初始化临时选中为已添加的值
  const handleOpenPool = (projectId: string) => {
    const row = data.find((r) => r.projectId === projectId);
    setActiveProjectId(projectId);
    setTempSelected(new Set(row?.tapdBelongings || []));
    setPoolSearch('');
    setShowPool(true);
  };

  // 点击外部关闭下拉
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (poolRef.current && !poolRef.current.contains(e.target as Node)) {
        setShowPool(false);
        setTempSelected(new Set());
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const totalMappings = data.reduce(
    (sum, row) => sum + row.tapdBelongings.length,
    0,
  );

  // 获取当前活跃行
  const activeRow = data.find((r) => r.projectId === activeProjectId);

  return (
    <div style={{ padding: 24 }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
        }}
      >
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>
            项目归属映射配置
          </h2>
          <p
            style={{
              fontSize: 12,
              color: '#9ca3b4',
              margin: '4px 0 0',
            }}
          >
            建立平台项目与 TAPD 项目归属值的多对多映射关系
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button
            icon={<SyncOutlined spin={syncing} />}
            onClick={handleSync}
            loading={syncing}
            size="small"
          >
            同步TAPD归属
          </Button>
          <Button
            type="primary"
            icon={<SaveOutlined />}
            onClick={handleSave}
            loading={saving}
            size="small"
          >
            保存全部
          </Button>
        </div>
      </div>

      {/* Toolbar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Select
            value={filterCategory}
            onChange={setFilterCategory}
            style={{ width: 120 }}
            size="small"
            options={[
              { label: '全部分类', value: 'all' },
              { label: '战略项目', value: 'STRATEGIC' },
              { label: '常规项目', value: 'REGULAR' },
              { label: '技术项目', value: 'TECHNICAL' },
            ]}
          />
          <Input
            placeholder="搜索项目名称..."
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ width: 200 }}
            size="small"
            allowClear
          />
        </div>
        <span style={{ fontSize: 12, color: '#9ca3b4' }}>
          共 {data.length} 个项目 · {totalMappings} 条映射
        </span>
      </div>

      {/* Table */}
      <Spin spinning={loading}>
        <div
          style={{
            border: '1px solid #e8ecf1',
            borderRadius: 10,
            overflow: 'hidden',
            background: '#fff',
          }}
        >
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: 13,
            }}
          >
            <thead>
              <tr style={{ background: '#f8f9fb' }}>
                <th
                  style={{
                    padding: '10px 14px',
                    textAlign: 'left',
                    fontWeight: 600,
                    fontSize: 12,
                    color: '#5f6577',
                    borderBottom: '1px solid #e8ecf1',
                    width: 90,
                  }}
                >
                  项目分类
                </th>
                <th
                  style={{
                    padding: '10px 14px',
                    textAlign: 'left',
                    fontWeight: 600,
                    fontSize: 12,
                    color: '#5f6577',
                    borderBottom: '1px solid #e8ecf1',
                    width: 130,
                  }}
                >
                  项目名称
                </th>
                <th
                  style={{
                    padding: '10px 14px',
                    textAlign: 'left',
                    fontWeight: 600,
                    fontSize: 12,
                    color: '#5f6577',
                    borderBottom: '1px solid #e8ecf1',
                    width: 200,
                  }}
                >
                  OKR
                </th>
                <th
                  style={{
                    padding: '10px 14px',
                    textAlign: 'left',
                    fontWeight: 600,
                    fontSize: 12,
                    color: '#5f6577',
                    borderBottom: '1px solid #e8ecf1',
                  }}
                >
                  TAPD 项目归属
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredData.map((row) => {
                const cat = CATEGORY_MAP[row.category] || {
                  label: row.category,
                  color: 'default',
                };
                return (
                  <tr
                    key={row.projectId}
                    style={{ borderBottom: '1px solid #f0f2f5' }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.background = '#fafbfc')
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.background = '')
                    }
                  >
                    <td style={{ padding: '10px 14px' }}>
                      <Tag color={cat.color}>{cat.label}</Tag>
                    </td>
                    <td
                      style={{
                        padding: '10px 14px',
                        fontWeight: 600,
                      }}
                    >
                      {row.name}
                    </td>
                    <td
                      style={{
                        padding: '10px 14px',
                        fontSize: 12,
                        color: '#5f6577',
                      }}
                    >
                      {row.okrName || '-'}
                    </td>
                    <td style={{ padding: '10px 14px', verticalAlign: 'top' }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {row.tapdBelongings.map((b) => (
                          <Tag
                            key={b}
                            closable
                            onClose={() =>
                              handleRemoveBelonging(row.projectId, b)
                            }
                            style={{ margin: 0, fontSize: 11 }}
                          >
                            {b}
                          </Tag>
                        ))}
                        <div style={{ position: 'relative', display: 'inline-block' }}>
                          <Tag
                            style={{
                              margin: 0,
                              cursor: 'pointer',
                              borderStyle: 'dashed',
                              fontSize: 11,
                            }}
                            onClick={() => handleOpenPool(row.projectId)}
                          >
                            <PlusOutlined /> 添加
                          </Tag>
                          {showPool &&
                            activeProjectId === row.projectId && (
                              <div
                                ref={poolRef}
                                style={{
                                  position: 'absolute',
                                  top: '100%',
                                  left: 0,
                                  zIndex: 100,
                                  background: '#fff',
                                  border: '1px solid #e8ecf1',
                                  borderRadius: 6,
                                  boxShadow:
                                    '0 4px 12px rgba(0,0,0,0.1)',
                                  width: 420,
                                  maxHeight: 360,
                                  display: 'flex',
                                  flexDirection: 'column',
                                }}
                              >
                                {/* 搜索栏 */}
                                <div
                                  style={{
                                    padding: 8,
                                    borderBottom: '1px solid #f0f2f5',
                                  }}
                                >
                                  <Input
                                    placeholder="搜索TAPD归属值..."
                                    size="small"
                                    value={poolSearch}
                                    onChange={(e) =>
                                      setPoolSearch(e.target.value)
                                    }
                                    autoFocus
                                  />
                                </div>

                                {/* 列表 */}
                                <div
                                  style={{
                                    overflowY: 'auto',
                                    maxHeight: 260,
                                  }}
                                >
                                  {tapdPool.length === 0 ? (
                                    <div
                                      style={{
                                        padding: '16px 12px',
                                        textAlign: 'center',
                                        color: '#9ca3b4',
                                        fontSize: 12,
                                      }}
                                    >
                                      暂无数据，请先点击「同步TAPD归属」
                                    </div>
                                  ) : filteredPool.length === 0 ? (
                                    <div
                                      style={{
                                        padding: '16px 12px',
                                        textAlign: 'center',
                                        color: '#9ca3b4',
                                        fontSize: 12,
                                      }}
                                    >
                                      无匹配结果
                                    </div>
                                  ) : (
                                    filteredPool.map((item) => {
                                      const alreadyAdded =
                                        activeRow?.tapdBelongings.includes(
                                          item.value,
                                        ) ?? false;
                                      const isChecked =
                                        tempSelected.has(item.value);
                                      const wsName =
                                        TAPD_PROJECTS.find(
                                          (p) => p.id === item.source,
                                        )?.name || item.source;

                                      // 解析层级路径，高亮最后一层
                                      const parts = item.value.split('/');
                                      const leafName =
                                        parts[parts.length - 1];
                                      const parentPath =
                                        parts.length > 1
                                          ? parts.slice(0, -1).join('/')
                                          : '';

                                      return (
                                        <div
                                          key={item.value}
                                          onClick={() =>
                                            toggleTempSelect(item.value)
                                          }
                                          style={{
                                            padding: '6px 12px',
                                            fontSize: 12,
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 8,
                                            opacity: alreadyAdded && !isChecked
                                              ? 0.5
                                              : 1,
                                            background: isChecked
                                              ? '#eef1fe'
                                              : undefined,
                                          }}
                                          onMouseEnter={(e) => {
                                            if (!isChecked)
                                              e.currentTarget.style.background =
                                                '#f5f7fb';
                                          }}
                                          onMouseLeave={(e) => {
                                            if (!isChecked)
                                              e.currentTarget.style.background =
                                                '';
                                          }}
                                        >
                                          <Checkbox
                                            checked={isChecked}
                                          />
                                          <div
                                            style={{
                                              flex: 1,
                                              minWidth: 0,
                                            }}
                                          >
                                            <div
                                              style={{
                                                fontWeight: 500,
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                whiteSpace: 'nowrap',
                                              }}
                                            >
                                              {leafName}
                                            </div>
                                            {parentPath && (
                                              <div
                                                style={{
                                                  fontSize: 10,
                                                  color: '#9ca3b4',
                                                  overflow: 'hidden',
                                                  textOverflow:
                                                    'ellipsis',
                                                  whiteSpace: 'nowrap',
                                                }}
                                              >
                                                {parentPath}
                                              </div>
                                            )}
                                          </div>
                                          <span
                                            style={{
                                              fontSize: 10,
                                              color: '#9ca3b4',
                                              flexShrink: 0,
                                              backgroundColor: '#f8f9fb',
                                              padding: '1px 6px',
                                              borderRadius: 3,
                                            }}
                                          >
                                            {wsName}
                                          </span>
                                        </div>
                                      );
                                    })
                                  )}
                                </div>

                                {/* 底部确认栏 */}
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
                                  <span
                                    style={{
                                      fontSize: 11,
                                      color: '#5f6577',
                                    }}
                                  >
                                    已选 {tempSelected.size} 项
                                  </span>
                                  <Button
                                    type="primary"
                                    size="small"
                                    disabled={tempSelected.size === 0}
                                    onClick={() =>
                                      handleConfirmMultiSelect(
                                        activeProjectId!,
                                      )
                                    }
                                    icon={<CheckOutlined />}
                                  >
                                    确认添加
                                  </Button>
                                </div>
                              </div>
                            )}
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredData.length === 0 && !loading && (
                <tr>
                  <td
                    colSpan={4}
                    style={{
                      textAlign: 'center',
                      padding: 40,
                      color: '#9ca3b4',
                    }}
                  >
                    暂无项目数据，请先在「项目管理」中创建项目
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Spin>

      {/* 说明 */}
      <div
        style={{
          border: '2px dashed #4f6ef7',
          borderRadius: 10,
          padding: 14,
          marginTop: 20,
          background: 'rgba(79,110,247,0.02)',
        }}
      >
        <Tag
          color="blue"
          style={{ marginBottom: 8, borderRadius: 10 }}
        >
          说明
        </Tag>
        <div
          style={{
            fontSize: 12,
            color: '#5f6577',
            lineHeight: 1.8,
          }}
        >
          ① <strong>项目分类 + 项目名称 + OKR</strong>
          ：自动从「项目管理」模块读取，不可编辑
          <br />
          ② <strong>TAPD 项目归属</strong>
          ：先点击「同步TAPD归属」从 TAPD API 获取可选值，然后点击「+ 添加」勾选多个后确认
          <br />
          ③ 下拉列表显示完整层级路径（如「战略项目/AI销售」），方便识别所属分类
          <br />
          ④ 多对多关系：一个平台项目可关联多个 TAPD 归属值，同一个 TAPD
          归属值也可被多个项目关联
          <br />⑤ 修改后点击「保存全部」生效
        </div>
      </div>
    </div>
  );
}
