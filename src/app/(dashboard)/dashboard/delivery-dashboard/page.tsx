'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Button,
  Card,
  DatePicker,
  message,
  Modal,
  Select,
  Spin,
  Table,
  Tabs,
} from 'antd';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import type { PieLabelRenderProps } from 'recharts';
import {
  SearchOutlined,
  TeamOutlined,
  ProjectOutlined,
  UserOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useTapdConfigStore } from '@/stores/tapd-config.store';

const { RangePicker } = DatePicker;
const { TabPane } = Tabs;

// 默认 TAPD 项目列表（当本地数据库没有时作为 fallback）
const DEFAULT_TAPD_PROJECTS = [
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

const STORY_STATUSES = [
  { value: '已发布', label: '已发布' },
  { value: '已实现', label: '已实现' },
  { value: '已关闭', label: '已关闭' },
  { value: '规划中', label: '规划中' },
  { value: '开发中', label: '开发中' },
  { value: '测试中', label: '测试中' },
];

const COLORS = ['#4f6ef7', '#52c41a', '#fa8c16', '#eb2f96', '#722ed1', '#13c2c2', '#faad14', '#2f54eb'];

interface StoryItem {
  id: string;
  name: string;
  status: string;
  owner: string;
  creator: string;
  created: string;
  completed?: string;
  workspace_id: string;
  workspace_name: string;
  iteration_id?: string;
  iteration_name?: string;
  // 工时字段
  effort?: string;
  effort_completed?: string;
  // 状态停留时长字段（从 life_times API 计算）
  duration_planning?: string;
  duration_developing?: string;
  duration_testing?: string;
  // 其他自定义字段
  custom_field_11?: string;
  custom_field_13?: string;
}

interface DeliveryData {
  totalStories: number;
  projectCount: number;
  personCount: number;
  avgPerPerson: number;
  avgCycle: number;
  avgDevCycle: number;
  teamDelivery: { name: string; value: number; cycle: number; devCycle: number }[];
  subTeamDelivery: Record<string, { name: string; value: number }[]>;
  teamCycles: Record<string, { avgCycle: number; avgDevCycle: number }>;
  stories: StoryItem[];
}

export default function DeliveryDashboardPage() {
  const { loadFromDB } = useTapdConfigStore();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<DeliveryData | null>(null);

  // 弹窗状态
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [detailSearch, setDetailSearch] = useState('');

  // 从本地数据库获取项目列表
  const [projectList, setProjectList] = useState<{ id: string; name: string }[]>([]);

  // 页面加载时从数据库恢复 TAPD 配置和项目列表
  useEffect(() => {
    loadFromDB();
    // 从本地数据库获取已同步的 TAPD 项目列表
    fetch('/api/v1/tapd/workspaces')
      .then(r => r.json())
      .then(res => {
        if (res.success && res.projects && res.projects.length > 0) {
          setProjectList(res.projects.map((p: { id: string; name: string }) => ({
            id: p.id,
            name: p.name,
          })));
        } else {
          // 本地数据库没有项目，使用默认列表
          setProjectList(DEFAULT_TAPD_PROJECTS);
        }
      })
      .catch(() => {
        // API 失败，使用默认列表
        setProjectList(DEFAULT_TAPD_PROJECTS);
      });
  }, [loadFromDB]);

  // 筛选条件
  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);
  const [createdRange, setCreatedRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null] | null>(
    () => [dayjs().subtract(3, 'month').startOf('day'), dayjs().endOf('day')]
  );
  const [completedRange, setCompletedRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null] | null>(null);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>(['已发布', '已实现', '已关闭']);

  // 查询数据
  const handleQuery = useCallback(async () => {
    if (selectedProjects.length === 0) {
      message.warning('请至少选择一个 TAPD 项目');
      return;
    }

    setLoading(true);
    try {
      // 直接查询本地数据库（毫秒级响应，不再逐项目循环）
      const resp = await fetch('/api/v1/dashboard/delivery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceIds: selectedProjects,
          createdBegin: createdRange?.[0]?.format('YYYY-MM-DD HH:mm:ss'),
          createdEnd: createdRange?.[1]?.format('YYYY-MM-DD HH:mm:ss'),
          completedBegin: completedRange?.[0]?.format('YYYY-MM-DD HH:mm:ss'),
          completedEnd: completedRange?.[1]?.format('YYYY-MM-DD HH:mm:ss'),
          status: selectedStatuses,
        }),
      });

      const result = await resp.json();
      if (result.success) {
        setData(result.data as unknown as DeliveryData);
      } else {
        message.error(result.message || '查询失败');
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : '查询异常，请稍后重试';
      message.error(errorMsg);
    } finally {
      setLoading(false);
    }
  }, [selectedProjects, createdRange, completedRange, selectedStatuses]);

  // 重置筛选
  const handleReset = () => {
    setSelectedProjects([]);
    setCreatedRange(null);
    setCompletedRange(null);
    setSelectedStatuses(['已发布', '已实现', '已关闭']);
    setData(null);
  };

  // 子团队数据转换
  const subTeamChartData = useMemo(() => {
    if (!data?.subTeamDelivery) return [];
    const teams = Object.keys(data.subTeamDelivery);
    const allProjects = Array.from(new Set(Object.values(data.subTeamDelivery).flat().map(p => p.name)));
    
    return teams.map(team => {
      const item: Record<string, string | number> = { name: team };
      const projects = data.subTeamDelivery[team] || [];
      allProjects.forEach(p => {
        item[p] = projects.find(proj => proj.name === p)?.value || 0;
      });
      return item;
    });
  }, [data]);

  const projectNames = useMemo(() => {
    if (!data?.subTeamDelivery) return [];
    return Array.from(new Set(Object.values(data.subTeamDelivery).flat().map(p => p.name)));
  }, [data]);

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>需求交付大盘</h2>
        <p style={{ fontSize: 12, color: '#9ca3b4', margin: '4px 0 0' }}>
          基于 TAPD 需求数据，按团队聚合分析交付情况
        </p>
      </div>

      {/* 筛选区域 */}
      <Card style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-end' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 13, fontWeight: 500, color: '#5f6577' }}>
              TAPD 项目 <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <Select
              mode="multiple"
              placeholder="选择 TAPD 项目"
              value={selectedProjects}
              onChange={setSelectedProjects}
              options={projectList.map(p => ({ value: p.id, label: `${p.name} (${p.id})` }))}
              style={{ minWidth: 320 }}
              maxTagCount={3}
              allowClear
              showSearch
              filterOption={(input, option) =>
                (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
              dropdownRender={(menu) => (
                <>
                  <div style={{ padding: '8px 12px', borderBottom: '1px solid #f0f0f0', display: 'flex', gap: 8 }}>
                    <Button size="small" onClick={() => setSelectedProjects(projectList.map(p => p.id))}>
                      全选
                    </Button>
                    <Button size="small" onClick={() => setSelectedProjects([])}>
                      全不选
                    </Button>
                  </div>
                  {menu}
                  <div style={{ padding: '4px 8px', borderTop: '1px solid #f0f0f0', fontSize: 12, color: '#999' }}>
                    共 {projectList.length} 个项目 · 已选 {selectedProjects.length} 个
                  </div>
                </>
              )}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 13, fontWeight: 500, color: '#5f6577' }}>需求创建时间</label>
            <RangePicker
              showTime
              value={createdRange}
              onChange={setCreatedRange}
              style={{ width: 400 }}
              placeholder={['开始时间', '结束时间']}
              getPopupContainer={(triggerNode) => triggerNode.parentNode as HTMLElement || document.body}
              ranges={{
                '最近一周': [dayjs().subtract(7, 'day'), dayjs()],
                '最近一个月': [dayjs().subtract(1, 'month'), dayjs()],
                '最近三个月': [dayjs().subtract(3, 'month'), dayjs()],
                '本月': [dayjs().startOf('month'), dayjs().endOf('month')],
                '上月': [dayjs().subtract(1, 'month').startOf('month'), dayjs().subtract(1, 'month').endOf('month')],
              }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 13, fontWeight: 500, color: '#5f6577' }}>需求完成时间</label>
            <RangePicker
              showTime
              value={completedRange}
              onChange={setCompletedRange}
              style={{ width: 400 }}
              placeholder={['开始时间', '结束时间']}
              getPopupContainer={(triggerNode) => triggerNode.parentNode as HTMLElement || document.body}
              ranges={{
                '最近一周': [dayjs().subtract(7, 'day'), dayjs()],
                '最近一个月': [dayjs().subtract(1, 'month'), dayjs()],
                '最近三个月': [dayjs().subtract(3, 'month'), dayjs()],
                '本月': [dayjs().startOf('month'), dayjs().endOf('month')],
                '上月': [dayjs().subtract(1, 'month').startOf('month'), dayjs().subtract(1, 'month').endOf('month')],
              }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 13, fontWeight: 500, color: '#5f6577' }}>需求状态</label>
            <Select
              mode="multiple"
              placeholder="选择需求状态"
              value={selectedStatuses}
              onChange={setSelectedStatuses}
              options={STORY_STATUSES}
              style={{ minWidth: 200 }}
              maxTagCount={2}
            />
          </div>

          <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
            <Button onClick={handleReset}>重置条件</Button>
            <Button type="primary" icon={<SearchOutlined />} onClick={handleQuery} loading={loading}>
              查询数据
            </Button>
          </div>
          <div style={{ marginTop: 8, fontSize: 13, color: '#666' }}>
            💡 提示: 数据来源于本地数据库。如需最新数据，请前往 
            <a href="/tapd/data-manager" style={{ color: '#1890ff', marginLeft: 4 }}>TAPD 数据管理</a> 
            页面进行同步
          </div>
        </div>
      </Card>

      <Spin 
        spinning={loading}
        tip={
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: 16, fontWeight: 500, marginBottom: 8 }}>正在查询数据，请耐心等待...</p>
            <p style={{ fontSize: 13, color: '#9ca3b4' }}>数据量较大时可能需要数分钟，请勿重复点击查询</p>
          </div>
        }
        size="large"
      >
        {data && (
          <Tabs defaultActiveKey="delivery" type="card">
            {/* Tab 1: 交付需求数 */}
            <TabPane tab="交付需求数" key="delivery">
              {/* KPI 卡片 */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 20 }}>
                <KpiCard
                  title="交付需求数"
                  value={data.totalStories.toLocaleString()}
                  icon={<ProjectOutlined style={{ color: '#fa8c16' }} />}
                  color="#fa8c16"
                  desc="筛选条件下的需求总数"
                  clickable
                  onClick={() => setDetailModalOpen(true)}
                />
                <KpiCard
                  title="涉及项目数"
                  value={data.projectCount}
                  icon={<TeamOutlined style={{ color: '#4f6ef7' }} />}
                  color="#4f6ef7"
                  desc="TAPD 项目数量"
                />
                <KpiCard
                  title="参与人数"
                  value={data.personCount}
                  icon={<UserOutlined style={{ color: '#52c41a' }} />}
                  color="#52c41a"
                  desc="需求处理人数量"
                />
                <KpiCard
                  title="平均每人需求数"
                  value={data.avgPerPerson}
                  icon={<ClockCircleOutlined style={{ color: '#eb2f96' }} />}
                  color="#eb2f96"
                  desc="人均交付需求"
                />
              </div>

              {/* 图表行 1 */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                <Card title="各团队交付需求数统计">
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={data.teamDelivery}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={15} textAnchor="start" height={60} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Bar dataKey="value" fill="#4f6ef7" radius={[4, 4, 0, 0]} label={{ position: 'top', fontSize: 11 }} />
                    </BarChart>
                  </ResponsiveContainer>
                </Card>

                <Card title="各团队交付需求占比">
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={data.teamDelivery}
                        cx="40%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={2}
                        dataKey="value"
                        label={(props: PieLabelRenderProps) => `${props.name} ${(((props.percent || 0)) * 100).toFixed(0)}%`}
                      >
                        {data.teamDelivery.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Legend layout="vertical" align="right" verticalAlign="middle" />
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </Card>
              </div>

              {/* 子团队分组柱状图 */}
              <Card title="各团队中子项目交付需求数">
                <ResponsiveContainer width="100%" height={380}>
                  <BarChart data={subTeamChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend />
                    {projectNames.map((name, index) => (
                      <Bar key={name} dataKey={name} stackId="a" fill={COLORS[index % COLORS.length]} />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            </TabPane>

            {/* Tab 2: 交付周期 */}
            <TabPane tab="交付周期" key="cycle">
              {/* KPI 卡片 */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 20 }}>
                <KpiCard
                  title="需求平均交付周期"
                  value={`${data.avgCycle} 天`}
                  icon={<ClockCircleOutlined style={{ color: '#4f6ef7' }} />}
                  color="#4f6ef7"
                  desc="从创建到完成平均天数"
                />
                <KpiCard
                  title="需求开发平均交付周期"
                  value={`${data.avgDevCycle} 天`}
                  icon={<ClockCircleOutlined style={{ color: '#eb2f96' }} />}
                  color="#eb2f96"
                  desc="开发阶段平均天数"
                />
                <KpiCard
                  title="最快交付团队"
                  value={data.teamDelivery.reduce((min, t) => t.cycle < min.cycle && t.cycle > 0 ? t : min, data.teamDelivery[0])?.name || '-'}
                  icon={<TeamOutlined style={{ color: '#52c41a' }} />}
                  color="#52c41a"
                  desc={`平均 ${data.teamDelivery.reduce((min, t) => t.cycle < min.cycle && t.cycle > 0 ? t : min, data.teamDelivery[0])?.cycle || 0} 天`}
                />
                <KpiCard
                  title="最慢交付团队"
                  value={data.teamDelivery.reduce((max, t) => t.cycle > max.cycle ? t : max, data.teamDelivery[0])?.name || '-'}
                  icon={<TeamOutlined style={{ color: '#fa8c16' }} />}
                  color="#fa8c16"
                  desc={`平均 ${data.teamDelivery.reduce((max, t) => t.cycle > max.cycle ? t : max, data.teamDelivery[0])?.cycle || 0} 天`}
                />
              </div>

              {/* 周期图表 */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <Card title="各团队需求交付周期（天）">
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={data.teamDelivery}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={15} textAnchor="start" height={60} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(value) => [`${value} 天`, '交付周期']} />
                      <Bar dataKey="cycle" fill="#4f6ef7" radius={[4, 4, 0, 0]} label={{ position: 'top', fontSize: 11, formatter: (v) => `${v}天` }} />
                    </BarChart>
                  </ResponsiveContainer>
                </Card>

                <Card title="各团队需求开发交付周期（天）">
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={data.teamDelivery}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={15} textAnchor="start" height={60} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(value) => [`${value} 天`, '开发周期']} />
                      <Bar dataKey="devCycle" fill="#eb2f96" radius={[4, 4, 0, 0]} label={{ position: 'top', fontSize: 11, formatter: (v) => `${v}天` }} />
                    </BarChart>
                  </ResponsiveContainer>
                </Card>
              </div>
            </TabPane>
          </Tabs>
        )}

        {!data && !loading && (
          <Card style={{ textAlign: 'center', padding: 60 }}>
            <p style={{ color: '#9ca3b4' }}>请选择筛选条件并点击「查询数据」查看大盘</p>
          </Card>
        )}
      </Spin>

      {/* 需求明细弹窗 */}
      <Modal
        title="需求明细"
        open={detailModalOpen}
        onCancel={() => setDetailModalOpen(false)}
        footer={null}
        width={1200}
      >
        <div style={{ marginBottom: 16 }}>
          <Select
            showSearch
            placeholder="搜索需求标题、ID、处理人..."
            style={{ width: 400 }}
            allowClear
            onSearch={(value) => setDetailSearch(value)}
            onChange={(value) => setDetailSearch(value || '')}
            filterOption={false}
            notFoundContent={null}
          />
        </div>
        <Table
          dataSource={data?.stories?.filter(s => 
            !detailSearch || 
            s.name?.toLowerCase().includes(detailSearch.toLowerCase()) ||
            s.id?.includes(detailSearch) ||
            s.owner?.toLowerCase().includes(detailSearch.toLowerCase())
          ) || []}
          rowKey="id"
          scroll={{ x: 2800, y: 500 }}
          pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (total) => `共 ${total} 条` }}
          columns={[
            { title: 'ID', dataIndex: 'id', width: 100, fixed: 'left' },
            { title: '标题', dataIndex: 'name', width: 200, ellipsis: true },
            { title: '项目', dataIndex: 'workspace_name', width: 120 },
            { title: '迭代', dataIndex: 'iteration_name', width: 120, render: (v) => v || '-' },
            { title: '状态', dataIndex: 'status', width: 100 },
            { title: '处理人', dataIndex: 'owner', width: 100 },
            { title: '创建人', dataIndex: 'creator', width: 100 },
            { title: '创建时间', dataIndex: 'created', width: 160 },
            { title: '完成时间', dataIndex: 'completed', width: 160, render: (v) => v || '-' },
            // 工时字段
            { title: '预估工时', dataIndex: 'effort', width: 90, render: (v) => v || '-' },
            { title: '完成工时', dataIndex: 'effort_completed', width: 90, render: (v) => v || '-' },
            // 状态停留时长（小时）- 从 life_times API 计算
            { title: '规划中(人天)', dataIndex: 'duration_planning', width: 110, render: (v) => v || '-' },
            { title: '开发中(人天)', dataIndex: 'duration_developing', width: 110, render: (v) => v || '-' },
            { title: '测试中(人天)', dataIndex: 'duration_testing', width: 110, render: (v) => v || '-' },
            // 自定义字段
            { title: '成本中心', dataIndex: 'custom_field_11', width: 200, render: (v) => v || '-' },
            { title: '项目类型', dataIndex: 'custom_field_13', width: 150, render: (v) => v || '-' },
          ]}
        />
      </Modal>
    </div>
  );
}

// KPI 卡片组件
function KpiCard({ title, value, icon, color, desc, clickable, onClick }: { title: string; value: string | number; icon: React.ReactNode; color: string; desc: string; clickable?: boolean; onClick?: () => void }) {
  return (
    <Card
      style={clickable ? { cursor: 'pointer', transition: 'all 0.2s' } : undefined}
      hoverable={clickable}
      onClick={onClick}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
        <div style={{ width: 40, height: 40, borderRadius: 8, background: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
          {icon}
        </div>
        <div style={{ fontSize: 13, color: '#5f6577', fontWeight: 500 }}>{title}</div>
      </div>
      <div style={{ fontSize: 32, fontWeight: 700, color, lineHeight: 1.2, marginBottom: 4 }}>{value}</div>
      <div style={{ fontSize: 12, color: '#9ca3b4' }}>{desc}</div>
    </Card>
  );
}
