'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Card, Button, Select, DatePicker, Checkbox, Radio, Table, Tag, message, Progress, Statistic, Row, Col, Tabs, Form, Tooltip, Switch, TimePicker, InputNumber, Divider, Space, Modal } from 'antd';
import { SyncOutlined, ReloadOutlined, HistoryOutlined, DatabaseOutlined, CheckCircleOutlined, CloseCircleOutlined, FilterOutlined, ClearOutlined, SettingOutlined, BellOutlined, ClockCircleOutlined, InfoCircleOutlined, PlusOutlined, SaveOutlined, UpOutlined, DownOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';

const { RangePicker } = DatePicker;

interface SyncJob {
  id: string;
  syncType: string;
  workspaceIds: string[];
  dataTypes: string[];
  status: string;
  progress: number;
  storyCount: number;
  taskCount: number;
  iterationCount: number;
  bugCount: number;
  timesheetCount: number;
  errorMsg?: string;
  startedAt: string;
  finishedAt?: string;
  createdBy?: string;
}

interface DataStats {
  storyCount: number;
  taskCount: number;
  iterationCount: number;
  bugCount: number;
  timesheetCount: number;
  workspaceCount: number;
  estimatedEffort?: number; // 预估工时
  actualEffort?: number;    // 实际工时
  lastSyncAt?: string;
  lastSyncStatus?: string;
  filters?: {
    projects: Array<{ value: string; label: string }>;
    iterations: Array<{ value: string; label: string; workspaceId: string }>;
    owners: Array<{ value: string; label: string }>;
    statuses: Array<{
      value: string;
      label: string;
      allValues?: string[];       // 🎯 所有对应的原始值（用于筛选）
      isFromWorkflow?: boolean;   // 🎯 是否来自工作流配置
    }>;
    workflowMapping?: {          // 🎯 工作流映射信息
      keyToChinese: Record<string, string>;
      knownChineseValues: string[];
      totalMappings: number;
      hasWorkflowConfig: boolean;
    };
  };
}

interface Workspace {
  id: string;
  name: string;
}

// TAPD 状态值到中文和颜色的完整映射
// 支持多种格式：英文、TAPD状态码、中文、自定义状态
// @param workflowStatusMap 动态获取的工作流状态映射（可选），优先级高于硬编码
const getStatusConfig = (status: string, workflowStatusMap?: Record<string, string>): { color: string; text: string } => {
  if (!status) return { color: 'default', text: '未知' };
  
  const statusLower = status.toLowerCase().trim();
  
  // 🎯 0. 优先检查是否已经是中文（API已转换）
  if (/[\u4e00-\u9fa5]/.test(status) && status.length <= 8) {
    console.log(`🎯 使用API转换后的中文状态: "${status}"`);
    return { color: getStatusColor(status), text: status };
  }
  
  // 🎯 1. 优先使用动态工作流状态映射（来自 TAPD API）
  if (workflowStatusMap && Object.keys(workflowStatusMap).length > 0) {
    // 精确匹配（包括原始值和大小写不敏感）
    const dynamicText = workflowStatusMap[status] || 
                       workflowStatusMap[statusLower] ||
                       Object.entries(workflowStatusMap)
                         .find(([key]) => key.toLowerCase() === statusLower)?.[1];
    
    if (dynamicText) {
      console.log(`🎯 使用动态状态映射: "${status}" → "${dynamicText}"`);
      return { color: getStatusColor(dynamicText), text: dynamicText };
    }
  }
  
  // ===== 完整状态映射表（包含颜色配置）=====
  const statusMap: Record<string, { color: string; text: string }> = {
    // ---- 新建阶段 ----
    'new': { color: 'cyan', text: '新建' },
    'status_1': { color: 'cyan', text: '新建' },
    '新建': { color: 'cyan', text: '新建' },
    
    // ---- 规划/计划阶段 ----
    'planning': { color: 'purple', text: '规划中' },
    'planned': { color: 'geekblue', text: '计划中' },
    'status_2': { color: 'purple', text: '规划中' },
    '规划中': { color: 'purple', text: '规划中' },
    '计划中': { color: 'geekblue', text: '计划中' },
    
    // ---- 开发阶段 ----
    'developing': { color: 'blue', text: '开发中' },
    'in_progress': { color: 'blue', text: '进行中' },
    'status_3': { color: 'blue', text: '开发中' },
    '开发中': { color: 'blue', text: '开发中' },
    '进行中': { color: 'blue', text: '进行中' },
    
    // ---- 测试阶段（拆分为多个子状态）----
    'testing': { color: 'magenta', text: '测试中' },
    'status_4': { color: 'magenta', text: '测试中' },
    'test_ready': { color: 'orange', text: '待测试' },
    'ready_for_test': { color: 'orange', text: '待测试' },
    '待测试': { color: 'orange', text: '待测试' },
    'test_in_progress': { color: 'magenta', text: '测试中' },
    '测试中': { color: 'magenta', text: '测试中' },
    't_test_complete': { color: 'green', text: 'T测试完成' },
    't_test_completed': { color: 'green', text: 'T测试完成' },
    'test_completed': { color: 'lime', text: '测试完成' },
    'test_passed': { color: 'success', text: '测试通过' },
    'qa_testing': { color: 'processing', text: 'QA测试中' },
    'uat_testing': { color: 'processing', text: 'UAT测试中' },
    
    // ---- 验收阶段 ----
    'accepted': { color: 'green', text: '已验收' },
    'verified': { color: 'success', text: '已验证' },
    'status_5': { color: 'green', text: '已验收' },
    '已验收': { color: 'green', text: '已验收' },
    '已验证': { color: 'success', text: '已验证' },
    
    // ---- 发布阶段（修正：closed → 待发布）----
    'closed': { color: 'gold', text: '待发布' },           // ← 关键修正！
    'status_6': { color: 'gold', text: '待发布' },         // ← 关键修正！
    'ready_to_release': { color: 'gold', text: '待发布' },
    '待发布': { color: 'gold', text: '待发布' },
    'release_pending': { color: 'gold', text: '待发布' },
    'pending_release': { color: 'gold', text: '待发布' },
    
    // ---- 已完成/已实现 ----
    'resolved': { color: 'green', text: '已实现' },
    'done': { color: 'green', text: '已完成' },
    'status_9': { color: 'green', text: '已实现' },
    'completed': { color: 'green', text: '已完成' },
    '已实现': { color: 'green', text: '已实现' },
    '已完成': { color: 'green', text: '已完成' },
    'finished': { color: 'green', text: '已完成' },
    
    // ---- 重新打开/返工 ----
    'reopened': { color: 'orange', text: '重新打开' },
    'status_7': { color: 'orange', text: '重新打开' },
    'rework': { color: 'volcano', text: '返工中' },
    '重新打开': { color: 'orange', text: '重新打开' },
    '返工中': { color: 'volcano', text: '返工中' },
    
    // ---- 暂停/挂起/需求暂停 ----
    'on_hold': { color: 'warning', text: '暂停' },
    'postponed': { color: 'warning', text: '需求暂停' },      // ✅ 新增
    'status_8': { color: 'warning', text: '需求暂停' },        // ✅ 修正：从"挂起"改为"需求暂停"
    'status_10': { color: 'warning', text: '需求暂停' },       // ✅ 新增
    'paused': { color: 'warning', text: '暂停' },
    'suspended': { color: 'default', text: '挂起' },
    '暂停': { color: 'warning', text: '暂停' },
    '挂起': { color: 'default', text: '挂起' },
    '需求暂停': { color: 'warning', text: '需求暂停' },        // ✅ 新增
    
    // ---- 其他状态 ----
    'pending': { color: 'gold', text: '待处理' },
    'active': { color: 'processing', text: '活跃' },
    'inactive': { color: 'default', text: '非活跃' },
    'archived': { color: 'default', text: '已归档' },
    'deleted': { color: 'error', text: '已删除' },
    'cancelled': { color: 'error', text: '已取消' },
    'rejected': { color: 'red', text: '已拒绝' },
    'blocked': { color: 'red', text: '阻塞' },
    'waiting': { color: 'gold', text: '等待中' },
    'reviewing': { color: 'geekblue', text: '评审中' },
    'designing': { color: 'purple', text: '设计中' },
    'analyzing': { color: 'geekblue', text: '分析中' },
    
    // ---- 自定义状态（TAPD工作流配置）----
    '待研发': { color: 'blue', text: '待研发' },
    '待开发': { color: 'blue', text: '待开发' },
    '待评审': { color: 'geekblue', text: '待评审' },
    '待PRE': { color: 'orange', text: '待PRE' },
    '前端联调中': { color: 'processing', text: '前端联调中' },
  };
  
  // 1. 精确匹配（包括大小写不敏感）
  if (statusMap[statusLower]) {
    return statusMap[statusLower];
  }
  
  // 2. 精确匹配原始值（保留大小写）
  if (statusMap[status]) {
    return statusMap[status];
  }
  
  // 3. 模糊匹配（处理带空格、下划线、连字符的变体）
  const normalizedStatus = statusLower.replace(/[\s_-]/g, '');
  for (const [key, value] of Object.entries(statusMap)) {
    if (key.replace(/[\s_-]/g, '') === normalizedStatus) {
      return value;
    }
  }
  
  // 4. 如果本身就是中文且不在映射表中，直接返回（可能是自定义状态）
  if (/[\u4e00-\u9fa5]/.test(status)) {
    return { color: 'blue', text: status };  // 中文自定义状态用蓝色显示
  }
  
  // 5. 尝试智能解析 TAPD 状态码（status_N 格式）
  const tapdStatusMatch = status.match(/^status_(\d+)$/);
  if (tapdStatusMatch) {
    const code = parseInt(tapdStatusMatch[1], 10);
    const tapdCodeMap: Record<number, { color: string; text: string }> = {
      1: { color: 'cyan', text: '新建' },
      2: { color: 'purple', text: '规划中' },
      3: { color: 'blue', text: '开发中' },
      4: { color: 'magenta', text: '测试中' },
      5: { color: 'green', text: '已验收' },
      6: { color: 'gold', text: '待发布' },     // ← 修正！
      7: { color: 'orange', text: '重新打开' },
      8: { color: 'warning', text: '需求暂停' }, // ✅ 修正：从"挂起"改为"需求暂停"
      9: { color: 'green', text: '已实现' },
      10: { color: 'warning', text: '需求暂停' },// ✅ 新增
    };
    
    if (tapdCodeMap[code]) {
      return tapdCodeMap[code];
    }
  }
  
  // 6. 最终回退：返回原始值（可能是未知的自定义状态）
  return { color: 'blue', text: status };
};

// 🎯 根据中文状态名称返回对应的颜色
const getStatusColor = (chineseStatus: string): string => {
  const colorMap: Record<string, string> = {
    // 新建阶段
    '新建': 'cyan',
    '新': 'cyan',  // 兼容
    
    // 规划/计划阶段
    '规划中': 'purple',
    '计划中': 'geekblue',
    
    // 开发阶段
    '开发中': 'blue',
    '进行中': 'blue',
    
    // 测试阶段
    '测试中': 'magenta',
    '待测试': 'orange',
    'T测试完成': 'green',
    '测试完成': 'lime',
    '测试通过': 'success',
    'QA测试中': 'processing',
    'UAT测试中': 'processing',
    
    // 验收阶段
    '已验收': 'green',
    '已验证': 'success',
    
    // 发布阶段
    '待发布': 'gold',
    
    // 已完成/已实现
    '已实现': 'green',
    '已完成': 'green',
    
    // 重新打开/返工
    '重新打开': 'orange',
    '返工中': 'volcano',
    
    // 暂停/挂起/需求暂停
    '需求暂停': 'warning',
    '暂停': 'warning',
    '挂起': 'default',
    
    // 其他状态
    '待处理': 'gold',
    '活跃': 'processing',
    '非活跃': 'default',
    '已归档': 'default',
    '已删除': 'error',
    '已取消': 'error',
    '已拒绝': 'red',
    '阻塞': 'red',
    '等待中': 'gold',
    '评审中': 'geekblue',
    '设计中': 'purple',
    '分析中': 'geekblue',
    '未开始': 'default',
    '前端联调中': 'orange',
    '待PRE': 'gold',
    '待评审': 'geekblue',
    'BUG修复中': 'red',
    '当前迭代完成': 'green',
  };
  
  return colorMap[chineseStatus] || 'blue';  // 默认蓝色
};

// 生成 TAPD 需求链接
const getTapdStoryUrl = (record: { id: string; workspaceId?: string }) => {
  const workspaceId = record.workspaceId || '';
  return `https://www.tapd.cn/${workspaceId}/prong/stories/view/${record.id}`;
};

// 🆕 Task专用TAPD链接生成函数
const getTapdTaskUrl = (record: { id: string; workspaceId?: string }) => {
  const workspaceId = record.workspaceId || '';
  return `https://www.tapd.cn/${workspaceId}/prong/tasks/view/${record.id}`;
};

// 表格列定义基础配置（静态部分）
const storyColumnsBase = [
  { 
    title: 'ID', 
    dataIndex: 'id', 
    key: 'id', 
    width: 100, 
    ellipsis: true, 
    fixed: 'left' as const,
    render: (v: string, record: { id: string; workspaceId?: string }) => (
      <a href={getTapdStoryUrl(record)} target="_blank" rel="noopener noreferrer" title="点击跳转到TAPD">
        {v}
      </a>
    )
  },
  { 
    title: '标题', 
    dataIndex: 'name', 
    key: 'name', 
    width: 280, 
    ellipsis: true, 
    fixed: 'left' as const,
    render: (v: string, record: { id: string; workspaceId?: string }) => (
      <a href={getTapdStoryUrl(record)} target="_blank" rel="noopener noreferrer" title="点击跳转到TAPD">
        {v}
      </a>
    )
  },
  { title: '所属项目', dataIndex: 'workspaceName', key: 'workspaceName', width: 140, ellipsis: true },
  // 状态列将在组件内部动态生成（依赖 workflowStatusMap）
  { 
    title: 'CF-11 (成本归属/项目归属)', 
    dataIndex: 'customField11', 
    key: 'customField11', 
    width: 220, 
    ellipsis: true,
    render: (v: string) => v || '-'
  },
  { 
    title: 'CF-13 (项目归属/成本归属)', 
    dataIndex: 'customField13', 
    key: 'customField13', 
    width: 220, 
    ellipsis: true,
    render: (v: string) => v || '-'
  },
  { title: '迭代', dataIndex: 'iterationName', key: 'iterationName', width: 120, ellipsis: true },
  { title: '处理人', dataIndex: 'owner', key: 'owner', width: 100, ellipsis: true },
  { title: '创建人', dataIndex: 'creator', key: 'creator', width: 100, ellipsis: true },
  { title: '预估工时', dataIndex: 'effort', key: 'effort', width: 80, align: 'right' as const,
    render: (v: number) => v ? `${v}h` : '-'
  },
  { title: '完成工时', dataIndex: 'effortCompleted', key: 'effortCompleted', width: 80, align: 'right' as const,
    render: (v: number) => v ? `${v}h` : '-'
  },
  { title: '创建时间', dataIndex: 'created', key: 'created', width: 150, 
    render: (v: string) => v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '-' 
  },
  { title: '完成时间', dataIndex: 'completed', key: 'completed', width: 150, 
    render: (v: string) => v ? dayjs(v).format('YYYY-MM-DD') : '-' 
  },
  { 
    title: '按时提测', 
    dataIndex: 'customField10', 
    key: 'onTimeTest',
    width: 85,
    align: 'center' as const,
    render: (v: string) => {
      if (!v) return <span style={{color: '#999'}}>-</span>;
      return v === '是' || v.toLowerCase() === 'yes'
        ? <Tag color="green">是</Tag> 
        : <Tag color="red">否</Tag>;
    }
  }, 
  { 
    title: '是否插入需求', 
    dataIndex: 'customFieldSix', 
    key: 'isInserted',
    width: 100,
    align: 'center' as const,
    render: (v: string) => {
      if (!v) return <span style={{color: '#999'}}>-</span>;
      return v === '是' || v.toLowerCase() === 'yes'
        ? <Tag color="orange">是</Tag> 
        : <Tag>否</Tag>;
    }
  },
];

const taskColumns = [
  {
    title: 'ID',
    dataIndex: 'id',
    key: 'id',
    width: 140,
    fixed: 'left' as const,
    ellipsis: true,
    render: (v: string, record: any) => (
      <a
        href={getTapdTaskUrl(record)}
        target="_blank"
        rel="noopener noreferrer"
        title={`点击跳转到TAPD任务 #${v}`}
      >
        {v}
      </a>
    )
  },
  {
    title: '名称',
    dataIndex: 'name',
    key: 'name',
    width: 320,
    fixed: 'left' as const,
    ellipsis: true,
    render: (v: string, record: any) => (
      <a
        href={getTapdTaskUrl(record)}
        target="_blank"
        rel="noopener noreferrer"
        title={v}
      >
        {v}
      </a>
    )
  },
  {
    title: '所属项目',
    dataIndex: ['workspace', 'name'],
    key: 'workspaceName',
    width: 150,
    ellipsis: true,
    render: (v: string, record: any) => {
      const name = record.workspace?.name;
      const wsId = record.workspaceId;

      if (!wsId) return <span style={{color: '#999'}}>-</span>;

      // ✅ 有项目名称
      if (name) return name;

      // ⚠️ 只有workspaceId（说明项目未同步到数据库）
      return (
        <Tooltip title={`项目ID: ${wsId}（请重新同步该项目以获取名称）`}>
          <span style={{color: '#faad14', cursor: 'help'}}>
            项目{wsId}
          </span>
        </Tooltip>
      );
    }
  },
  { title: '状态', dataIndex: 'status', key: 'status', width: 80, render: (v: string) => <Tag color={v === 'done' ? 'green' : 'blue'}>{v}</Tag> },
  {
    title: '关联需求',
    key: 'storyInfo',
    width: 220,
    ellipsis: true,
    render: (_: unknown, record: any) => {
      if (!record.story?.id) {
        return <span style={{color: '#999'}}>-</span>;
      }

      const story = record.story;
      const displayName = story.name || story.id;

      return (
        <a
          href={getTapdStoryUrl(story)}
          target="_blank"
          rel="noopener noreferrer"
          title={`需求: ${displayName}`}
        >
          {displayName}
        </a>
      );
    }
  },
  { title: '处理人', dataIndex: 'owner', key: 'owner', width: 100 },
  {
    title: '预估工时',
    dataIndex: 'effort',
    key: 'effort',
    width: 90,
    align: 'right' as const,
    render: (v: number | null) => {
      if (v === null || v === undefined || v === 0) {
        return <span style={{color: '#999'}}>-</span>;
      }
      return <span style={{color: '#1890ff', fontWeight: 500}}>{v}h</span>;
    }
  },
  {
    title: '实际工时',
    dataIndex: 'effortCompleted',
    key: 'effortCompleted',
    width: 90,
    align: 'right' as const,
    render: (v: number | null) => {
      if (v === null || v === undefined || v === 0) {
        return <span style={{color: '#999'}}>-</span>;
      }
      return <span style={{color: '#52c41a', fontWeight: 500}}>{v}h</span>;
    }
  },
  {
    title: '完成时间',
    dataIndex: 'completed',
    key: 'completed',
    width: 120,
    render: (v: string | null) => {
      if (!v) {
        return <span style={{color: '#999'}}>-</span>;
      }

      try {
        const date = dayjs(v);
        if (!date.isValid()) return '-';

        return date.format('YYYY-MM-DD');
      } catch {
        return '-';
      }
    }
  },
  { title: '创建时间', dataIndex: 'created', key: 'created', width: 150, render: (v: string) => v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '-' },
];

const iterationColumns = [
  { title: 'ID', dataIndex: 'id', key: 'id', width: 120 },
  { title: '名称', dataIndex: 'name', key: 'name', width: 200 },
  { title: '状态', dataIndex: 'status', key: 'status', width: 80, render: (v: string) => <Tag color={v === 'done' ? 'green' : 'blue'}>{v}</Tag> },
  { title: '开始时间', dataIndex: 'startDate', key: 'startDate', width: 120, render: (v: string) => v ? dayjs(v).format('YYYY-MM-DD') : '-' },
  { title: '结束时间', dataIndex: 'endDate', key: 'endDate', width: 120, render: (v: string) => v ? dayjs(v).format('YYYY-MM-DD') : '-' },
];

const bugColumns = [
  { title: 'ID', dataIndex: 'id', key: 'id', width: 120, ellipsis: true },
  { title: '标题', dataIndex: 'title', key: 'title', width: 300, ellipsis: true },
  { title: '状态', dataIndex: 'status', key: 'status', width: 80, render: (v: string) => <Tag color={v === 'closed' ? 'green' : v === 'resolved' ? 'blue' : 'orange'}>{v}</Tag> },
  { title: '严重程度', dataIndex: 'severity', key: 'severity', width: 80 },
  { title: '处理人', dataIndex: 'currentOwner', key: 'currentOwner', width: 100 },
  { title: '创建时间', dataIndex: 'created', key: 'created', width: 150, render: (v: string) => v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '-' },
  { title: '解决时间', dataIndex: 'resolved', key: 'resolved', width: 150, render: (v: string) => v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '-' },
];

const timesheetColumns = [
  { title: 'ID', dataIndex: 'id', key: 'id', width: 120, ellipsis: true },
  { title: '关联类型', dataIndex: 'entityType', key: 'entityType', width: 100, render: (v: string) => <Tag>{v}</Tag> },
  { title: '关联ID', dataIndex: 'entityId', key: 'entityId', width: 120 },
  { title: '填写人', dataIndex: 'owner', key: 'owner', width: 100 },
  { title: '工时(h)', dataIndex: 'timespent', key: 'timespent', width: 80 },
  { title: '日期', dataIndex: 'spentdate', key: 'spentdate', width: 120, render: (v: string) => v ? dayjs(v).format('YYYY-MM-DD') : '-' },
  { title: '备注', dataIndex: 'memo', key: 'memo', width: 200, ellipsis: true },
];

export default function TapdDataManagerPage() {
  const [form] = Form.useForm();
  
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);
  const [syncMsg, setSyncMsg] = useState('');
  
  // 同步操作筛选条件
  const [selectedWorkspaces, setSelectedWorkspaces] = useState<string[]>([]);
  const [dataTypes, setDataTypes] = useState<string[]>(['story', 'task', 'iteration']);
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([
    dayjs().subtract(3, 'month'),
    dayjs(),
  ]);
  const [updatePolicy, setUpdatePolicy] = useState<'upsert' | 'incremental'>('upsert');
  
  // 数据明细筛选条件
  const [filterWorkspaceId, setFilterWorkspaceId] = useState<string[]>([]);  // 🛠️ 改为数组，支持多选
  const [filterStatus, setFilterStatus] = useState<string[]>([]);  // 🛠️ 改为数组，支持多选
  const [filterIterationId, setFilterIterationId] = useState<string[]>([]);  // 🛠️ 改为数组
  const [filterOwner, setFilterOwner] = useState<string[]>([]);  // 🛠️ 改为数组
  const [filterCreatedRange, setFilterCreatedRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);
  const [filterCompletedRange, setFilterCompletedRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);

  // 🛠️ 使用ref存储最新的筛选参数，避免闭包陷阱
  const filterParamsRef = useRef({
    workspaceId: filterWorkspaceId,
    status: filterStatus,
    iterationId: filterIterationId,
    owner: filterOwner,
    createdRange: filterCreatedRange,
    completedRange: filterCompletedRange,
  });

  // 🛠️ 修复Bug1: 防抖定时器ref
  const filterDebounceRef = useRef<NodeJS.Timeout | null>(null);

  // 🛠️ 修复Bug3: 项目切换标志位（避免useEffect重复请求）
  const isProjectSwitchingRef = useRef(false);

  // 🛠️ 同步ref与state（在每次渲染时更新）
  useEffect(() => {
    filterParamsRef.current = {
      workspaceId: filterWorkspaceId,
      status: filterStatus,
      iterationId: filterIterationId,
      owner: filterOwner,
      createdRange: filterCreatedRange,
      completedRange: filterCompletedRange,
    };
  }, [filterWorkspaceId, filterStatus, filterIterationId, filterOwner, filterCreatedRange, filterCompletedRange]);
  
  // 数据
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [dataStats, setDataStats] = useState<DataStats | null>(null);
  const [syncHistory, setSyncHistory] = useState<SyncJob[]>([]);
  const [currentJob, setCurrentJob] = useState<SyncJob | null>(null);
  const [workspaceNameMap, setWorkspaceNameMap] = useState<Record<string, string>>({});
  
  // 自定义字段映射（动态）
  // keyToName: { "custom_field_11": "项目归属", ... }
  // nameToKey: { "项目归属": "custom_field_11", ... }
  const [customFieldMapping, setCustomFieldMapping] = useState<Record<string, string>>({});
  
  // 🔴 关键状态：字段映射是否已加载完成
  const [mappingLoaded, setMappingLoaded] = useState(false);
  
  // 🎯 工作流状态映射（动态获取，优先级高于硬编码）
  const [workflowStatusMap, setWorkflowStatusMap] = useState<Record<string, string>>({});
  
  // 🎯 动态生成 storyColumns（包含工作流状态映射）
  const storyColumns = useMemo(() => {
    // 在基础列配置中插入状态列（索引2，在"所属项目"之后）
    const statusColumn = {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 90,
      render: (v: string) => {
        const config = getStatusConfig(v, workflowStatusMap);
        return <Tag color={config.color}>{config.text}</Tag>;
      }
    };
    
    const columns = [...storyColumnsBase];
    columns.splice(3, 0, statusColumn); // 在第4个位置插入状态列
    
    return columns;
  }, [workflowStatusMap]);
  
  // 数据明细
  const [activeTab, setActiveTab] = useState('story');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [tableData, setTableData] = useState<any[]>([]);
  const [tableLoading, setTableLoading] = useState(false);
  const [tablePagination, setTablePagination] = useState({ current: 1, pageSize: 20, total: 0 });
  
  // 防止重复提示消息
  const [syncNotified, setSyncNotified] = useState(false);
  // 🛠️ 使用 ref 避免闭包陷阱（setInterval 中读取最新值）
  const syncNotifiedRef = useRef(false);
  
  // 自动同步配置相关状态
  const [autoSyncConfig, setAutoSyncConfig] = useState<any>(null);
  const [autoSyncEnabled, setAutoSyncEnabled] = useState<boolean>(true);
  const [syncTimes, setSyncTimes] = useState<Dayjs[]>([dayjs('02:00', 'HH:mm')]);
  const [daysBack, setDaysBack] = useState<number>(90);
  const [syncStrategy, setSyncStrategy] = useState<string>('incremental');
  const [autoSyncDataTypes, setAutoSyncDataTypes] = useState<string[]>(['story', 'task', 'iteration']);
  const [notifyOnComplete, setNotifyOnComplete] = useState<boolean>(false);
  const [notifyOnError, setNotifyOnError] = useState<boolean>(true);
  const [savingConfig, setSavingConfig] = useState<boolean>(false);
  const [executingAutoSync, setExecutingAutoSync] = useState<boolean>(false);
  const [loadingConfig, setLoadingConfig] = useState<boolean>(true);
  const [autoSyncCollapsed, setAutoSyncCollapsed] = useState<boolean>(false);

  
  /**
   * 根据业务名称获取字段键名（如"项目归属" → "custom_field_11" 或 "custom_field_13"）
   */
  const getFieldKeyByBusinessName = useCallback((businessName: string): string => {
    // 反向查找：找到名称匹配的字段键
    for (const [key, name] of Object.entries(customFieldMapping)) {
      if (name === businessName) {
        return key; // 找到返回字段键
      }
    }
    return ''; // 未找到
  }, [customFieldMapping]);
  
  /**
   * 根据字段键获取数据值（支持动态字段位置）
   */
  const getFieldValue = useCallback((record: any, businessName: string): string => {
    // #region debug-point getFieldValue
    console.group(`[DEBUG] getFieldValue("${businessName}")`);
    
    // 🔴 策略1：优先从 mapping 查找
    let fieldKey = getFieldKeyByBusinessName(businessName);
    
    if (fieldKey) {
      console.log('✅ 从 mapping 找到 fieldKey:', fieldKey);
      
      // 转换为 camelCase
      const camelCaseKey = fieldKey
        .toLowerCase()
        .split('_')
        .map((word, index) => {
          if (index === 0) return word;
          if (/^\d+$/.test(word)) return word;
          return word.charAt(0).toUpperCase() + word.slice(1);
        })
        .join('');
      
      const value = record[camelCaseKey];
      console.log('📦 camelCaseKey:', camelCaseKey, '→ value:', value);
      console.groupEnd();
      return value || '-';
    }
    
    // 🔴 策略2：Fallback - 当 mapping 为空时，直接从 record 推断
    console.warn('⚠️ mapping 为空，使用 fallback 策略...');
    
    const customKeys = Object.keys(record).filter(k => 
      k.toLowerCase().includes('custom') && record[k]
    );
    
    console.log('🔍 record 中的自定义字段:', customKeys);
    
    // 根据业务名称特征推断（使用精确匹配避免误判）
    for (const key of customKeys) {
      const value = String(record[key]);
      const valueLower = value.toLowerCase();
      
      if (businessName === '项目归属') {
        // ✅ 项目归属的精确特征（避免与成本归属混淆）:
        // 1. 以"常规项目"、"技术项目"、"直播"开头
        // 2. 包含"/bi"、"/数据"、"/app"、"/鸿蒙"等项目标识
        // 3. ❌ 排除包含"成本"、"平摊"、"研发中心"、"职能部门"等的值
        
        const isProjectField = (
          // 正面特征：明确的项目标识
          /^(常规项目|技术项目|直播|点播)/.test(value) ||
          /\/(bi|数据|app|鸿蒙|直播|点播)/i.test(value) ||
          
          // 备用特征（需排除成本相关词汇）
          (value.includes('项目') && 
           !value.includes('成本') && 
           !value.includes('平摊') &&
           !value.includes('研发中心') &&
           !value.includes('职能部门') &&
           !value.includes('事业群') &&
           !value.includes('品牌'))
        );
        
        if (isProjectField) {
          console.log(`🎯 Fallback 成功 [项目归属]: ${key} → "${value}"`);
          console.groupEnd();
          return value;
        }
      }
      
      if (businessName === '成本归属') {
        // ✅ 成本归属的精确特征:
        // 1. 包含"成本"、"平摊"
        // 2. 包含部门名称："研发中心"、"职能部门"、"事业群"、"品牌"
        
        const isCostField = (
          value.includes('成本') ||
          value.includes('平摊') ||
          /研发中心|职能部门|事业群|品牌/.test(value) ||
          /^科技研发中心/.test(value)
        );
        
        if (isCostField) {
          console.log(`🎯 Fallback 成功 [成本归属]: ${key} → "${value}"`);
          console.groupEnd();
          return value;
        }
      }
      
      // 其他字段的简单推断
      if (businessName === '按时提测' && 
          (valueLower === '是' || valueLower === '否' || valueLower === 'yes' || valueLower === 'no')) {
        console.log(`🎯 Fallback 成功 [按时提测]: ${key} → "${value}"`);
        console.groupEnd();
        return value;
      }
    }
    
    console.warn('❌ Fallback 也失败，返回 "-"');
    console.groupEnd();
    // #endregion
    
    return '-';
  }, [getFieldKeyByBusinessName, customFieldMapping]);
  
  // 自动同步配置相关函数
  const loadAutoSyncConfig = useCallback(async () => {
    try {
      setLoadingConfig(true);
      const response = await fetch('/api/v1/tapd/auto-sync/config');
      const result = await response.json();
      
      if (result.success && result.data && result.data.length > 0) {
        const config = result.data[0];
        setAutoSyncConfig(config);
        setAutoSyncEnabled(config.isEnabled);
        setSyncTimes(config.syncTimes.map((t: string) => dayjs(t, 'HH:mm')));
        setDaysBack(config.defaultDaysBack);
        setSyncStrategy(config.syncStrategy);
        setAutoSyncDataTypes(config.dataTypes);
        setNotifyOnComplete(config.notifyOnComplete);
        setNotifyOnError(config.notifyOnError);
      } else {
        setAutoSyncConfig(null);
      }
    } catch (error) {
      console.error('Failed to load auto-sync config:', error);
      message.error('加载自动同步配置失败');
    } finally {
      setLoadingConfig(false);
    }
  }, []);

  const saveAutoSyncConfig = async () => {
    try {
      setSavingConfig(true);
      
      const configData = {
        isEnabled: autoSyncEnabled,
        name: 'TAPD 自动同步',
        syncTimes: syncTimes.map(t => t.format('HH:mm')),
        defaultDaysBack: daysBack,
        dataTypes: autoSyncDataTypes,
        syncStrategy,
        notifyOnComplete,
        notifyOnError,
      };
      
      let response;
      if (autoSyncConfig?.id) {
        response = await fetch(`/api/v1/tapd/auto-sync/config/${autoSyncConfig.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(configData),
        });
      } else {
        response = await fetch('/api/v1/tapd/auto-sync/config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(configData),
        });
      }
      
      const result = await response.json();
      
      if (result.success) {
        message.success('✅ 自动同步配置保存成功');
        setAutoSyncConfig(result.data);
        
        try {
          await fetch('/api/v1/tapd/auto-sync/reload-scheduler', { method: 'POST' });
        } catch (e) {
          console.warn('Failed to reload scheduler:', e);
        }
      } else {
        message.error(`❌ 保存失败: ${result.message}`);
      }
    } catch (error) {
      console.error('Failed to save auto-sync config:', error);
      message.error('❌ 保存自动同步配置失败');
    } finally {
      setSavingConfig(false);
    }
  };

  // 立即执行自动同步
  const handleExecuteAutoSync = async () => {
    if (!autoSyncConfig?.id) {
      message.warning('请先保存自动同步配置');
      return;
    }

    try {
      setExecutingAutoSync(true);
      
      // 显示确认对话框
      const confirmed = await new Promise<boolean>((resolve) => {
        modal.confirm({
          title: '确认执行同步',
          content: `确定要立即执行一次自动同步吗？\n\n配置信息：\n- 同步策略: ${syncStrategy === 'incremental' ? '增量同步' : syncStrategy === 'full' ? '全量同步' : '智能同步'}\n- 数据类型: ${autoSyncDataTypes.join(', ')}`,
          okText: '开始执行',
          cancelText: '取消',
          onOk: () => resolve(true),
          onCancel: () => resolve(false),
        });
      });

      if (!confirmed) return;

      message.loading('正在执行自动同步，请稍候...', 0);

      // 调用执行API
      const response = await fetch('/api/v1/tapd/auto-sync/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          configId: autoSyncConfig.id,
        }),
      });

      const result = await response.json();

      // 关闭loading
      message.destroy();

      if (result.success) {
        message.success(`✅ 自动同步执行成功！同步了 ${result.stats?.recordsCount || 0} 条数据`);
        
        // 刷新配置和统计数据
        await loadAutoSyncConfig();
        await loadDataStats();
        await loadSyncHistory();
        
        // 显示详细结果
        modal.success({
          title: '同步完成',
          content: (
            <div>
              <p>✅ 自动同步已成功执行</p>
              <p>📊 统计信息：</p>
              <ul style={{ paddingLeft: 20, margin: '10px 0' }}>
                {result.stats && Object.entries(result.stats).map(([key, value]) => (
                  <li key={key}>{key}: {value}</li>
                ))}
                {result.duration && <li>⏱️ 执行耗时: {result.duration}秒</li>}
              </ul>
              <p style={{ color: '#8c8c8c', fontSize: 12 }}>⏰ 执行时间: {result.executedAt ? new Date(result.executedAt).toLocaleString() : '-'}</p>
            </div>
          ),
        });
      } else {
        // 显示详细的错误信息
        const errorMsg = result.error || result.message || '未知错误';
        console.error('[AutoSync] 执行失败详情:', result);
        
        message.error({
          content: (
            <span>
              ❌ 同步失败: {errorMsg}
              {result.duration && <span style={{ marginLeft: 8, color: '#8c8c8c' }}>({result.duration}秒)</span>}
            </span>
          ),
          duration: 5,
        });
        
        // 显示详细的错误弹窗
        modal.error({
          title: '同步失败',
          width: 600,
          content: (
            <div style={{ maxHeight: 400, overflowY: 'auto' }}>
              <p><strong>错误信息：</strong></p>
              <p style={{ color: '#ff4d4f', background: '#fff2f0', padding: 10, borderRadius: 4, marginBottom: 16 }}>
                {errorMsg}
              </p>
              
              {result.error && result.error.includes('data is not iterable') && (
                <div style={{ background: '#fffbe6', padding: 12, borderRadius: 4, marginBottom: 16 }}>
                  <p style={{ margin: 0, fontWeight: 'bold', color: '#d48806' }}>⚠️ 可能的原因：</p>
                  <ul style={{ margin: '8px 0 0 20px', color: '#595959' }}>
                    <li>TAPD API返回数据格式异常</li>
                    <li>TAPD服务暂时不可用</li>
                    <li>网络连接问题</li>
                    <li>API凭证过期或权限不足</li>
                  </ul>
                </div>
              )}
              
              <details style={{ marginTop: 12 }}>
                <summary style={{ cursor: 'pointer', color: '#1677ff' }}>查看技术详情</summary>
                <pre style={{ 
                  background: '#f5f5f5', 
                  padding: 12, 
                  borderRadius: 4, 
                  marginTop: 8, 
                  fontSize: 11,
                  overflowX: 'auto',
                  whiteSpace: 'pre-wrap'
                }}>
                  {JSON.stringify(result, null, 2)}
                </pre>
              </details>
              
              <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #f0f0f0' }}>
                <p style={{ margin: 0, fontSize: 13, color: '#595959' }}>💡 建议操作：</p>
                <ol style={{ margin: '8px 0 0 20px', fontSize: 13, color: '#595959' }}>
                  <li>检查TAPD API配置（用户名、密码、公司名称）</li>
                  <li>确认TAPD服务器可访问</li>
                  <li>稍后重试或联系技术支持</li>
                </ol>
              </div>
            </div>
          ),
          okText: '我知道了',
        });
        
        // 刷新配置以更新状态
        await loadAutoSyncConfig();
      }
    } catch (error) {
      console.error('Failed to execute auto-sync:', error);
      message.destroy();
      message.error('❌ 执行自动同步时发生错误');
    } finally {
      setExecutingAutoSync(false);
    }
  };

  const toggleAutoSync = async () => {
    if (!autoSyncConfig?.id) return;
    
    try {
      const response = await fetch(`/api/v1/tapd/auto-sync/config/${autoSyncConfig.id}/toggle`, {
        method: 'PATCH',
      });
      const result = await response.json();
      
      if (result.success) {
        setAutoSyncEnabled(result.data.isEnabled);
        setAutoSyncConfig(result.data);
        message.success(`✅ 自动同步已${result.data.isEnabled ? '启用' : '禁用'}`);
      }
    } catch (error) {
      console.error('Failed to toggle auto-sync:', error);
      message.error('❌ 操作失败');
    }
  };

  const addSyncTime = () => {
    if (syncTimes.length >= 5) {
      message.warning('最多只能添加 5 个时间点');
      return;
    }
    setSyncTimes([...syncTimes, dayjs('12:00', 'HH:mm')]);
  };

  const removeSyncTime = (index: number) => {
    if (syncTimes.length <= 1) {
      message.warning('至少需要保留一个时间点');
      return;
    }
    setSyncTimes(syncTimes.filter((_, i) => i !== index));
  };

  useEffect(() => {
    loadAutoSyncConfig();
  }, [loadAutoSyncConfig]);
  
  // 🔴 关键修复：监听 customFieldMapping 变化，确保映射加载后再刷新数据
  // 解决 React 异步状态更新导致的时序竞态问题
  const prevMappingRef = useRef<Record<string, string>>({});
  
  useEffect(() => {
    // #region debug-point mapping-watcher
    console.group('[DEBUG] customFieldMapping Watcher');
    console.log('1️⃣ prevMapping:', Object.keys(prevMappingRef.current).length, 'keys');
    console.log('2️⃣ current mapping:', Object.keys(customFieldMapping).length, 'keys');
    // #endregion
    
    const prevKeys = Object.keys(prevMappingRef.current);
    const currKeys = Object.keys(customFieldMapping);
    
    // 检测到映射从空变为有值（说明刚加载完成）
    if (prevKeys.length === 0 && currKeys.length > 0 && filterWorkspaceId) {
      console.log('🎯 检测到 fieldMapping 刚加载完成！自动刷新表格数据...');

      // 延迟一帧确保 React 完成状态更新
      setTimeout(() => {
        triggerFilterChange(100);
      }, 100);
    }
    
    // 更新上一次的引用
    prevMappingRef.current = customFieldMapping;
    
    // #region debug-point mapping-watcher-end
    console.groupEnd();
    // #endregion
  }, [customFieldMapping, filterWorkspaceId]);
  
  // 加载项目列表
  useEffect(() => {
    loadWorkspaces();
    loadDataStats();
    loadSyncHistory();
    
    // 🎯 新增：页面初始化时也尝试加载工作流状态映射
    // 如果URL参数或默认值中有 workspaceId，立即加载
    const initWorkflowMapping = async () => {
      try {
        // 从当前筛选条件或URL获取初始workspaceId
        const urlParams = new URLSearchParams(window.location.search);
        const urlWorkspaceId = urlParams.get('workspaceId');

        // 🛠️ 修复：正确处理数组和字符串类型
        let initialWorkspaceId: string | null = null;

        if (urlWorkspaceId) {
          // URL参数优先
          initialWorkspaceId = urlWorkspaceId;
        } else if (Array.isArray(filterWorkspaceId) && filterWorkspaceId.length > 0) {
          // 从state取第一个项目（多选时取第一个）
          initialWorkspaceId = filterWorkspaceId[0];
        }

        if (initialWorkspaceId) {
          console.log('🌐 页面初始化：开始加载工作流状态映射, workspaceId:', initialWorkspaceId);
          await loadWorkflowStatusMap(initialWorkspaceId);
        } else {
          console.log('⚠️ 页面初始化：未找到初始workspaceId，等待用户选择项目');
        }
      } catch (error) {
        console.error('❌ 初始化工作流状态映射失败:', error);
      }
    };
    
    initWorkflowMapping();
  }, []);
  
  const loadWorkspaces = async () => {
    try {
      const resp = await fetch('/api/v1/tapd/workspaces');
      const result = await resp.json();
      if (result.success) {
        setWorkspaces(result.projects || []);
      }
    } catch (error) {
      console.error('加载项目列表失败:', error);
    }
  };
  
  // 加载项目的自定义字段配置
  const loadCustomFieldMapping = async (workspaceId: string | undefined) => {
    // #region debug-point loadCustomFieldMapping
    console.group(`[DEBUG] 🚀 loadCustomFieldMapping()`);
    console.log('📥 接收参数 workspaceId:', workspaceId);
    console.log('📥 参数类型:', typeof workspaceId);
    console.log('📥 参数是否为空:', !workspaceId);
    // #endregion
    
    if (!workspaceId) {
      console.warn('⚠️ workspaceId 为空，设置 mapping 为 {} 并返回');
      setCustomFieldMapping({});
      console.groupEnd();
      return;
    }
    
    try {
      console.log(`🌐 开始请求 API: /api/v1/tapd/custom-fields?workspaceId=${workspaceId}`);
      
      const resp = await fetch(`/api/v1/tapd/custom-fields?workspaceId=${workspaceId}`);
      const result = await resp.json();
      
      // #region debug-point loadCustomFieldMapping-response
      console.log('✅ API 请求成功');
      console.log('📡 HTTP 状态:', resp.status);
      console.log('📡 API Response:', result);
      console.log('📡 result.success:', result.success);
      console.log('📡 result.data:', result.data);
      console.log('📡 result.data?.fieldMapping:', result.data?.fieldMapping);
      // #endregion
      
      if (result.success && result.data?.fieldMapping) {
        const newMapping = result.data.fieldMapping;
        console.log(`🎯 准备更新 state: ${Object.keys(newMapping).length} 个字段映射`);
        console.log('🎯 新映射内容:', newMapping);
        
        setCustomFieldMapping(newMapping);
        
        // 🔴 关键：标记映射已加载完成
        setMappingLoaded(true);
        console.log('✅✅✅ mappingLoaded 已设置为 true！');
        
        console.log('[Field Mapping] ✅✅✅ 已成功调用 setCustomFieldMapping()！');
        console.log('[Field Mapping] 映射内容:', newMapping);
      } else {
        console.warn('[Field Mapping] ❌ API 返回异常或无 fieldMapping');
        console.warn('[Field Mapping]   result.success:', result.success);
        console.warn('[Field Mapping]   result.data:', result.data);
      }
    } catch (error) {
      console.error('❌❌❌ loadCustomFieldMapping 异常:', error);
      console.error('错误信息:', error.message);
      console.error('错误堆栈:', error.stack);
      setCustomFieldMapping({});
    }
    
    // #region debug-point loadCustomFieldMapping-end
    console.log('🏁 loadCustomFieldMapping() 执行完毕');
    console.groupEnd();
    // #endregion
  };

  // 🛠️ 关键修复：监听项目选择变化，自动加载自定义字段映射
  // 解决：loadCustomFieldMapping 从未被调用导致 mappingLoaded 永远为 false
  useEffect(() => {
    const loadMappingForSelectedProjects = async () => {
      // 如果选择了项目，加载第一个项目的字段映射和工作流状态映射
      if (Array.isArray(filterWorkspaceId) && filterWorkspaceId.length > 0) {
        const firstProjectId = filterWorkspaceId[0];
        console.log('🔄 项目选择变化，开始加载配置, workspaceId:', firstProjectId);

        // 🛠️ 重置 mappingLoaded 状态（正在加载中）
        setMappingLoaded(false);

        // 🎯 并行加载：自定义字段映射 + 工作流状态映射
        await Promise.all([
          loadCustomFieldMapping(firstProjectId),
          loadWorkflowStatusMap(firstProjectId),  // 🆕 关键修复：同时加载工作流状态映射
        ]);
        
        console.log(`✅ 项目 ${firstProjectId} 的所有配置已加载完成`);
      } else {
        // 未选择项目时，标记为已加载（不需要显示 loading）
        console.log('⚠️ 未选择项目，跳过配置加载');
        setMappingLoaded(true);
        setCustomFieldMapping({});
        setWorkflowStatusMap({});  // 🆕 清空工作流状态映射
      }
    };

    loadMappingForSelectedProjects();
  }, [filterWorkspaceId]);  // 🎯 监听项目变化

  // 🎯 加载工作流状态映射（动态获取真实状态名称）
  const loadWorkflowStatusMap = async (workspaceId: string | undefined) => {
    if (!workspaceId) {
      console.warn('⚠️ workspaceId 为空，不加载工作流状态映射');
      return;
    }
    
    try {
      console.log(`🌐 开始请求工作流状态映射 API: /api/v1/tapd/workflow-status-map?workspace_id=${workspaceId}&system=story`);
      
      const resp = await fetch(`/api/v1/tapd/workflow-status-map?workspace_id=${workspaceId}&system=story`);
      const result = await resp.json();
      
      if (result.success && result.data?.statusMap) {
        const newStatusMap = result.data.statusMap;
        console.log(`✅ 工作流状态映射加载成功: ${Object.keys(newStatusMap).length} 个状态`);
        console.log('📋 状态映射内容:', newStatusMap);
        
        setWorkflowStatusMap(newStatusMap);
      } else {
        console.warn('⚠️ 工作流状态映射 API 返回异常:', result);
        // 🎯 增强fallback：使用内置的完整映射作为备选
        console.log('🔄 使用内置fallback映射...');
        setWorkflowStatusMap(getFallbackStatusMapping());
      }
    } catch (error) {
      console.error('❌ 加载工作流状态映射失败:', error);
      // 🎯 增强失败处理：使用内置的完整映射作为备选
      console.log('🔄 API调用失败，使用内置fallback映射...');
      setWorkflowStatusMap(getFallbackStatusMapping());
    }
  };
  
  /**
   * 内置的状态映射fallback（覆盖所有常见TAPD状态）
   * 当API调用失败或返回异常时使用
   */
  const getFallbackStatusMapping = (): Record<string, string> => ({
    // 英文状态 → 中文
    'planning': '规划中',
    'developing': '开发中',
    'resolved': '已发布',
    'rejected': '已拒绝',
    'closed': '已关闭',
    
    // TAPD状态码（status_1 ~ status_8）
    'status_1': '新建',
    'status_2': '测试中',
    'status_3': '待测试',
    'status_4': '待评审',
    'status_5': '待研发',
    'status_6': '待发布',
    'status_7': 'T测试完成',
    'status_8': '需求暂停',
    
    // 其他常见状态
    'new': '新建',
    'done': '已完成',
    'testing': '测试中',
  });
  
  const loadDataStats = async (filters?: {
    workspaceId?: string | string[];  // 🛠️ 支持数组
    status?: string | string[];  // 🛠️ 支持数组
    iterationId?: string | string[];  // 🛠️ 支持数组
    owner?: string | string[];  // 🛠️ 支持数组
  }) => {
    try {
      const params = new URLSearchParams();

      // 🛠️ 处理可能为数组的参数
      if (filters?.workspaceId) {
        const value = Array.isArray(filters.workspaceId)
          ? filters.workspaceId.join(',')
          : filters.workspaceId;
        params.append('workspaceId', value);
      }
      if (filters?.status) {
        const value = Array.isArray(filters.status)
          ? filters.status.join(',')
          : filters.status;
        params.append('status', value);
      }
      if (filters?.iterationId) {
        const value = Array.isArray(filters.iterationId)
          ? filters.iterationId.join(',')
          : filters.iterationId;
        params.append('iterationId', value);
      }
      if (filters?.owner) {
        const value = Array.isArray(filters.owner)
          ? filters.owner.join(',')
          : filters.owner;
        params.append('owner', value);
      }
      
      const url = `/api/v1/tapd/data/stats${params.toString() ? `?${params.toString()}` : ''}`;
      const resp = await fetch(url);
      const result = await resp.json();
      if (result.success) {
        setDataStats(result.data);
        
        // 🎯 同步更新 workflowStatusMap（用于表格状态列的中文显示）
        if (result.data?.filters?.workflowMapping?.keyToChinese) {
          setWorkflowStatusMap(result.data.filters.workflowMapping.keyToChinese);
          console.log('✅ [数据统计] 已同步更新 workflowStatusMap:', 
            Object.keys(result.data.filters.workflowMapping.keyToChinese).length, '个映射');
        }
        
        // 🎯 输出工作流映射信息（调试用）
        if (result.data?.filters?.workflowMapping) {
          const wm = result.data.filters.workflowMapping;
          console.log(`\n📊 [数据统计] ✅ 工作流状态映射已加载:`);
          console.log(`   - 总映射数: ${wm.totalMappings}`);
          console.log(`   - 工作流已配置: ${wm.hasWorkflowConfig ? '✅ 是' : '❌ 否'}`);
          console.log(`   - 中文状态值 (${wm.knownChineseValues?.length || 0}个):`, wm.knownChineseValues?.slice(0, 5));
          
          if (result.data?.filters?.statuses) {
            console.log(`\n   状态筛选选项 (${result.data.filters.statuses.length}个):`);
            result.data.filters.statuses.slice(0, 10).forEach((s: { label: string; value: string; isFromWorkflow?: boolean }) => {
              const mark = s.isFromWorkflow ? '✓' : ' ';
              console.log(`     ${mark} "${s.label}" (${s.value})`);
            });
          }
        }
      }
    } catch (error) {
      console.error('加载数据统计失败:', error);
    }
  };
  
  const loadSyncHistory = async () => {
    try {
      const resp = await fetch('/api/v1/tapd/sync/jobs?limit=10');
      const result = await resp.json();
      if (result.success) {
        setSyncHistory(result.data || []);

        // 收集所有workspace ID
        const allWorkspaceIds = new Set<string>();
        (result.data || []).forEach((job: SyncJob) => {
          job.workspaceIds?.forEach(id => allWorkspaceIds.add(id));
        });

        if (allWorkspaceIds.size > 0) {
          try {
            const workspaceResp = await fetch(`/api/v1/tapd/workspaces?ids=${Array.from(allWorkspaceIds).join(',')}`);
            const workspaceResult = await workspaceResp.json();
            if (workspaceResult.success && workspaceResult.data) {
              const nameMap: Record<string, string> = {};
              (workspaceResult.data as Array<{ id: string; name: string }>).forEach(ws => {
                nameMap[ws.id] = ws.name;
              });
              setWorkspaceNameMap(nameMap);
            }
          } catch (e) {
            console.warn('加载项目名称失败:', e);
          }
        }
      }
    } catch (error) {
      console.error('加载同步历史失败:', error);
    }
  };
  
  // 开始同步
  const handleSync = useCallback(async () => {
    if (selectedWorkspaces.length === 0) {
      message.warning('请选择至少一个项目');
      return;
    }
    if (dataTypes.length === 0) {
      message.warning('请选择至少一种数据类型');
      return;
    }
    
    setSyncing(true);
    setSyncProgress(0);
    setSyncMsg('正在创建同步任务...');
    setSyncNotified(false);
    syncNotifiedRef.current = false;  // 🛠️ 同步重置 ref
    
    try {
      // 创建同步任务
      const resp = await fetch('/api/v1/tapd/sync/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceIds: selectedWorkspaces,
          dataTypes,
          timeRange: {
            begin: dateRange[0].format('YYYY-MM-DD'),
            end: dateRange[1].format('YYYY-MM-DD'),
          },
          updatePolicy,
        }),
      });
      
      const result = await resp.json();
      if (!result.success) {
        throw new Error(result.message || '创建同步任务失败');
      }
      
      const jobId = result.jobId;
      setSyncMsg('同步任务已启动，正在同步数据...');
      
      // 轮询任务状态
      const pollInterval = setInterval(async () => {
        try {
          const statusResp = await fetch(`/api/v1/tapd/sync/jobs/${jobId}`);
          
          if (!statusResp.ok) {
            console.warn('查询同步状态返回异常:', statusResp.status, statusResp.statusText);
            return;
          }
          
          const contentType = statusResp.headers.get('content-type');
          if (!contentType || !contentType.includes('application/json')) {
            console.warn('查询同步状态返回非JSON格式，等待路由编译完成...');
            return;
          }
          
          const statusResult = await statusResp.json();
          
          if (statusResult.success) {
            const job = statusResult.data;
            setCurrentJob(job);
            setSyncProgress(job.progress || 0);
            
            if (job.status === 'completed') {
              clearInterval(pollInterval);
              setSyncing(false);
              setSyncMsg(`同步完成！需求 ${job.storyCount || 0} 条，任务 ${job.taskCount || 0} 条，迭代 ${job.iterationCount || 0} 条`);
              
              // 🛠️ 使用 ref 避免闭包陷阱（读取最新值）
              if (!syncNotifiedRef.current) {
                syncNotifiedRef.current = true;  // 立即更新 ref
                setSyncNotified(true);  // 同步更新 state
                message.success('数据同步成功');
              }
              loadDataStats(getCurrentFilters());
              loadSyncHistory();
            } else if (job.status === 'failed') {
              clearInterval(pollInterval);
              setSyncing(false);
              setSyncMsg(`同步失败: ${job.errorMsg || '未知错误'}`);
              // 🛠️ 失败也使用 ref
              if (!syncNotifiedRef.current) {
                syncNotifiedRef.current = true;
                setSyncNotified(true);
                message.error('数据同步失败');
              }
            }
          }
        } catch (e) {
          console.error('查询同步状态失败:', e);
        }
      }, 3000);
      
    } catch (error) {
      setSyncing(false);
      const msg = error instanceof Error ? error.message : '同步失败';
      setSyncMsg(`同步失败: ${msg}`);
      message.error(msg);
    }
  }, [selectedWorkspaces, dataTypes, dateRange, updatePolicy]);

  // 重试失败的同步任务
  const handleRetry = useCallback(async (job: SyncJob) => {
    if (!job.workspaceIds?.length) {
      message.warning('该任务没有项目信息，无法重试');
      return;
    }

    setSyncing(true);
    setSyncProgress(0);
    setSyncMsg('正在创建重试同步任务...');
    setSyncNotified(false);
    syncNotifiedRef.current = false;

    try {
      const resp = await fetch('/api/v1/tapd/sync/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceIds: job.workspaceIds,
          dataTypes: job.dataTypes || ['story', 'task', 'iteration'],
          timeRange: {
            begin: dayjs().subtract(3, 'month').format('YYYY-MM-DD'),
            end: dayjs().format('YYYY-MM-DD'),
          },
          updatePolicy,
        }),
      });

      const result = await resp.json();
      if (!result.success) {
        throw new Error(result.message || '创建重试同步任务失败');
      }

      const jobId = result.jobId;
      setSyncMsg('重试同步任务已启动，正在同步数据...');

      const pollInterval = setInterval(async () => {
        try {
          const statusResp = await fetch(`/api/v1/tapd/sync/jobs/${jobId}`);

          if (!statusResp.ok) return;

          const statusResult = await statusResp.json();

          if (statusResult.success) {
            const retryJob = statusResult.data;
            setCurrentJob(retryJob);
            setSyncProgress(retryJob.progress || 0);

            if (retryJob.status === 'completed') {
              clearInterval(pollInterval);
              setSyncing(false);
              setSyncMsg(`重试同步完成！需求 ${retryJob.storyCount || 0} 条，任务 ${retryJob.taskCount || 0} 条`);
              if (!syncNotifiedRef.current) {
                syncNotifiedRef.current = true;
                setSyncNotified(true);
                message.success('重试同步成功');
              }
              loadDataStats(getCurrentFilters());
              loadSyncHistory();
            } else if (retryJob.status === 'failed') {
              clearInterval(pollInterval);
              setSyncing(false);
              setSyncMsg(`重试同步失败: ${retryJob.errorMsg || '未知错误'}`);
              if (!syncNotifiedRef.current) {
                syncNotifiedRef.current = true;
                setSyncNotified(true);
                message.error('重试同步失败');
              }
            }
          }
        } catch (e) {
          console.error('查询重试同步状态失败:', e);
        }
      }, 3000);

    } catch (error) {
      setSyncing(false);
      const msg = error instanceof Error ? error.message : '重试同步失败';
      setSyncMsg(`重试失败: ${msg}`);
      message.error(msg);
    }
  }, [updatePolicy]);
  
  // 获取当前筛选条件
  const getCurrentFilters = () => ({
    workspaceId: filterWorkspaceId,
    status: filterStatus,
    iterationId: filterIterationId,
    owner: filterOwner,
  });
  
  // 加载数据明细
  // 🛠️ 支持多选：从 ref 读取最新筛选参数，避免 stale closure 问题
  const loadTableData = useCallback(async (page = 1, pageSize = 20, overrideParams?: {
    workspaceId?: string;
    status?: string[];  // 🛠️ 改为数组，支持多选
    iterationId?: string[];  // 🛠️ 改为数组
    owner?: string[];  // 🛠️ 改为数组
    createdRange?: [dayjs.Dayjs, dayjs.Dayjs] | null;
    completedRange?: [dayjs.Dayjs, dayjs.Dayjs] | null;
  }) => {
    setTableLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('type', activeTab);
      params.append('page', String(page));
      params.append('pageSize', String(pageSize));

      // 🎯 关键修复：优先使用传入的参数，否则从 ref 读取最新值
      const currentParams = overrideParams || filterParamsRef.current;

      // 🛠️ 支持多选：workspaceId 也可能是数组
      if (Array.isArray(currentParams.workspaceId) && currentParams.workspaceId.length > 0) {
        params.append('workspaceId', currentParams.workspaceId.join(','));
      } else if (currentParams.workspaceId && !Array.isArray(currentParams.workspaceId)) {
        params.append('workspaceId', currentParams.workspaceId);
      }

      // 🎯 状态筛选：直接发送中文标签，后端会做精确匹配
      if (Array.isArray(currentParams.status) && currentParams.status.length > 0) {
        const chineseLabels = currentParams.status.filter(s => s && s.trim() !== '');
        console.log(`✅ 状态筛选（中文标签）: [${chineseLabels.join(', ')}]`);
        params.append('status', chineseLabels.join(','));
      }
      
      if (Array.isArray(currentParams.iterationId) && currentParams.iterationId.length > 0) {
        params.append('iterationId', currentParams.iterationId.join(','));
      }
      if (Array.isArray(currentParams.owner) && currentParams.owner.length > 0) {
        params.append('owner', currentParams.owner.join(','));
      }

      if (currentParams.createdRange) {
        params.append('createdStart', currentParams.createdRange[0].format('YYYY-MM-DD'));
        params.append('createdEnd', currentParams.createdRange[1].format('YYYY-MM-DD'));
      }
      if (currentParams.completedRange) {
        params.append('completedStart', currentParams.completedRange[0].format('YYYY-MM-DD'));
        params.append('completedEnd', currentParams.completedRange[1].format('YYYY-MM-DD'));
      }

      console.log('📡 loadTableData 请求参数:', {
        type: activeTab,
        page,
        workspaceId: currentParams.workspaceId,
        status: currentParams.status,
        iterationId: currentParams.iterationId,
        owner: currentParams.owner,
      });

      const resp = await fetch(`/api/v1/tapd/data/query?${params.toString()}`);
      const result = await resp.json();
      if (result.success) {
        setTableData(result.data || []);
        setTablePagination(prev => ({ 
          ...prev, 
          current: page, 
          pageSize,
          total: result.total || 0 
        }));
        console.log(`✅ 数据加载成功: ${result.data?.length || 0} 条记录, 总计 ${result.total || 0} 条`);
      }
    } catch (error) {
      console.error('加载数据明细失败:', error);
    } finally {
      setTableLoading(false);
    }
  }, [activeTab, dataStats]);  // 🛠️ 依赖 activeTab 和 dataStats（用于状态转换）

  // 🛠️ 修复Bug2: 完善的useEffect - 监听所有筛选条件变化并自动加载数据
  useEffect(() => {
    // 🛠️ 修复Bug3: 如果正在切换项目，跳过自动加载（由triggerFilterChange处理）
    if (isProjectSwitchingRef.current) {
      console.log('⏭️ 跳过自动加载（项目切换中）');
      return;
    }

    // 使用ref中的最新值，避免闭包陷阱
    const params = filterParamsRef.current;

    console.log('🔄 筛选条件变化，自动触发数据加载:', {
      workspaceId: params.workspaceId,
      status: params.status,
      iterationId: params.iterationId,
      owner: params.owner,
    });

    loadTableData();
    loadDataStats({
      workspaceId: params.workspaceId,
      status: params.status,
      iterationId: params.iterationId,
      owner: params.owner,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, filterWorkspaceId, filterStatus, filterIterationId, filterOwner, filterCreatedRange, filterCompletedRange]);

  // 🛠️ 修复Bug1+2: 防抖的筛选触发函数（用于手动调用场景）
  const triggerFilterChange = useCallback((debounceMs = 300) => {
    // 清除之前的定时器
    if (filterDebounceRef.current) {
      clearTimeout(filterDebounceRef.current);
    }

    // 设置新的防抖定时器
    filterDebounceRef.current = setTimeout(() => {
      console.log('⏰ 防抖触发 - 执行筛选');
      const params = filterParamsRef.current;
      loadTableData(1, tablePagination.pageSize);
      loadDataStats({
        workspaceId: params.workspaceId,
        status: params.status,
        iterationId: params.iterationId,
        owner: params.owner,
      });
    }, debounceMs);
  }, [loadTableData, loadDataStats, tablePagination.pageSize]);

  // 🛠️ 辅助函数：处理多选组件的全选逻辑
  const handleMultiSelectChange = (
    selectedValues: string[],
    allOptions: { value: string; label?: string }[],
    setter: (values: string[]) => void,
    debounceMs = 200
  ) => {
    // 检查是否选择了"全选"选项
    const hasSelectAll = selectedValues.includes('__ALL__');

    if (hasSelectAll) {
      // 选择全选：选中所有选项（除了全选本身）
      const allValues = allOptions.map(opt => opt.value).filter(v => v !== '__ALL__');
      setter(allValues);
      console.log('📝 全选触发，选中所有:', allValues.length, '项');
    } else {
      // 正常选择
      setter(selectedValues);
      console.log('📝 多选变更，选中:', selectedValues.length, '项');
    }

    // 触发筛选
    triggerFilterChange(debounceMs);
  };

  // 🛠️ 为选项列表添加全选选项
  const addSelectAllOption = (options: { value: string; label?: string }[]) => {
    if (!options || options.length === 0) return [];
    return [
      { value: '__ALL__', label: '✅ 全选' },
      ...options
    ];
  };
  const handleResetFilters = () => {
    // 清除防抖定时器
    if (filterDebounceRef.current) {
      clearTimeout(filterDebounceRef.current);
    }

    setFilterWorkspaceId([]);  // 🛠️ 改为空数组
    setFilterStatus([]);  // 🛠️ 改为空数组
    setFilterIterationId([]);  // 🛠️ 改为空数组
    setFilterOwner([]);  // 🛠️ 改为空数组
    setFilterCreatedRange(null);
    setFilterCompletedRange(null);

    // 🛠️ 不需要手动调用loadDataStats，useEffect会自动触发
    console.log('🔄 筛选条件已重置');
  };
  
  // 根据 activeTab 获取对应列（动态字段映射）
  const columns = useMemo(() => {
    if (activeTab === 'story') {
      // 基础列定义
      const baseColumns = [
        { 
          title: 'ID', 
          dataIndex: 'id', 
          key: 'id', 
          width: 100, 
          ellipsis: true, 
          fixed: 'left' as const,
          render: (v: string, record: { id: string; workspaceId?: string }) => (
            <a href={getTapdStoryUrl(record)} target="_blank" rel="noopener noreferrer" title="点击跳转到TAPD">
              {v}
            </a>
          )
        },
        { 
          title: '标题', 
          dataIndex: 'name', 
          key: 'name', 
          width: 280, 
          ellipsis: true, 
          fixed: 'left' as const,
          render: (v: string, record: { id: string; workspaceId?: string }) => (
            <a href={getTapdStoryUrl(record)} target="_blank" rel="noopener noreferrer" title="点击跳转到TAPD">
              {v}
            </a>
          )
        },
        { title: '所属项目', dataIndex: 'workspaceName', key: 'workspaceName', width: 140, ellipsis: true },
        { 
          title: '状态', 
          dataIndex: 'status', 
          key: 'status', 
          width: 90,
          render: (v: string) => {
            const config = getStatusConfig(v, workflowStatusMap);
            return <Tag color={config.color}>{config.text}</Tag>;
          }
        },
        { 
          title: '成本归属', 
          key: 'costAttribution', 
          width: 220, 
          ellipsis: true,
          render: (_: any, record: any) => {
            const value = getFieldValue(record, '成本归属');
            return value === '-' ? <span style={{color: '#999'}}>-</span> : value;
          }
        },
        { 
          title: '项目归属', 
          key: 'projectAttribution', 
          width: 220, 
          ellipsis: true,
          render: (_: any, record: any) => {
            const value = getFieldValue(record, '项目归属');
            return value === '-' ? <span style={{color: '#999'}}>-</span> : value;
          }
        },
        { title: '迭代', dataIndex: 'iterationName', key: 'iterationName', width: 120, ellipsis: true },
        { title: '处理人', dataIndex: 'owner', key: 'owner', width: 100, ellipsis: true },
        { title: '创建人', dataIndex: 'creator', key: 'creator', width: 100, ellipsis: true },
        { title: '预估工时', dataIndex: 'effort', key: 'effort', width: 80, align: 'right' as const,
          render: (v: number) => v ? `${v}h` : '-'
        },
        { title: '完成工时', dataIndex: 'effortCompleted', key: 'effortCompleted', width: 80, align: 'right' as const,
          render: (v: number) => v ? `${v}h` : '-'
        },
        { title: '创建时间', dataIndex: 'created', key: 'created', width: 150, 
          render: (v: string) => v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '-' 
        },
        { title: '完成时间', dataIndex: 'completed', key: 'completed', width: 150, 
          render: (v: string) => v ? dayjs(v).format('YYYY-MM-DD') : '-' 
        },
        { 
          title: '按时提测', 
          key: 'onTimeTest',
          width: 85,
          align: 'center' as const,
          render: (_: any, record: any) => {
            const value = getFieldValue(record, '按时提测');
            if (!value || value === '-') return <span style={{color: '#999'}}>-</span>;
            return value === '是' || value.toLowerCase() === 'yes'
              ? <Tag color="green">是</Tag> 
              : <Tag color="red">否</Tag>;
          }
        }, 
        { 
          title: '是否插入需求', 
          dataIndex: 'customFieldSix', 
          key: 'isInserted',
          width: 100,
          align: 'center' as const,
          render: (v: string) => {
            if (!v) return <span style={{color: '#999'}}>-</span>;
            return v === '是' || v.toLowerCase() === 'yes'
              ? <Tag color="orange">是</Tag> 
              : <Tag>否</Tag>;
          }
        },
      ];
      return baseColumns;
    }
    
    switch (activeTab) {
      case 'task': return taskColumns;
      case 'bug': return bugColumns;
      case 'timesheet': return timesheetColumns;
      case 'iteration': return iterationColumns;
      default: return storyColumns;
    }
  }, [activeTab, customFieldMapping]);
  
  // 根据选中的项目过滤迭代列表
  // 🛠️ 支持多项目：根据选中的项目列表过滤迭代
  const filteredIterations = useMemo(() => {
    if (!dataStats?.filters?.iterations) return [];
    // 如果没有选择项目，返回所有迭代
    if (!filterWorkspaceId || filterWorkspaceId.length === 0) return dataStats.filters.iterations;
    // 🎯 支持多项目：迭代属于任一选中项目即可
    return dataStats.filters.iterations.filter((i) =>
      filterWorkspaceId.includes(i.workspaceId)
    );
  }, [dataStats?.filters?.iterations, filterWorkspaceId]);
  
  // 同步历史状态渲染
  const renderSyncStatus = (status: string) => {
    switch (status) {
      case 'success':
        return <Tag icon={<CheckCircleOutlined />} color="success">成功</Tag>;
      case 'failed':
        return <Tag icon={<CloseCircleOutlined />} color="error">失败</Tag>;
      case 'running':
        return <Tag icon={<SyncOutlined spin />} color="processing">进行中</Tag>;
      default:
        return <Tag>{status}</Tag>;
    }
  };
  
  return (
    <div className="tapd-data-manager">
      {/* 页面标题栏 */}
      <div className="page-header-linear">
        <div className="header-left">
          <DatabaseOutlined className="header-icon" />
          <h1 className="header-title">TAPD 数据管理</h1>
        </div>
        <Button icon={<ReloadOutlined />} onClick={() => { loadDataStats(); loadSyncHistory(); }} size="middle">
          刷新数据
        </Button>
      </div>

      {/* 同步操作区 */}
      <div className="section-linear">
        <div className="section-title">同步操作</div>
        <div className="form-grid">
          <div className="form-item">
            <label className="form-label">TAPD项目</label>
            <Select
              mode="multiple"
              placeholder="请选择项目"
              value={selectedWorkspaces}
              onChange={setSelectedWorkspaces}
              options={[
                { label: '全选', value: '__SELECT_ALL__' },
                ...workspaces.map(w => ({ label: w.name, value: w.id }))
              ]}
              style={{ width: '100%' }}
              maxTagCount={5}
              onSelect={(value: string) => {
                if (value === '__SELECT_ALL__') {
                  setSelectedWorkspaces(workspaces.map(w => w.id));
                }
              }}
              onDeselect={(value: string) => {
                if (value === '__SELECT_ALL__') {
                  setSelectedWorkspaces([]);
                }
              }}
            />
          </div>

          <div className="form-item">
            <label className="form-label">数据类型</label>
            <Checkbox.Group
              value={dataTypes}
              onChange={(v) => setDataTypes(v as string[])}
              options={[
                { label: '需求', value: 'story' },
                { label: '任务', value: 'task' },
                { label: '迭代', value: 'iteration' },
                { label: '缺陷', value: 'bug' },
                { label: '工时', value: 'timesheet' },
              ]}
            />
          </div>

          <div className="form-item form-item-full">
            <label className="form-label">时间范围</label>
            <div className="range-picker-wrapper">
              <RangePicker
                value={dateRange}
                onChange={(v) => v && setDateRange(v as [dayjs.Dayjs, dayjs.Dayjs])}
                format="YYYY-MM-DD"
                style={{ width: '100%' }}
              />
              <span className="form-hint">(需求创建时间)</span>
            </div>
          </div>

          <div className="form-item">
            <label className="form-label">更新策略</label>
            <Radio.Group value={updatePolicy} onChange={(e) => setUpdatePolicy(e.target.value)}>
              <Radio value="upsert">覆盖更新</Radio>
              <Radio value="incremental">增量更新</Radio>
            </Radio.Group>
          </div>

          <div className="form-item form-item-action">
            <Button
              type="primary"
              icon={<SyncOutlined spin={syncing} />}
              onClick={handleSync}
              disabled={syncing}
              size="large"
              block
            >
              {syncing ? '同步中...' : '开始同步'}
            </Button>
          </div>
        </div>
      </div>
      
      {/* 自动同步配置 */}
      <div className="section-linear">
        <div className="section-header-collapsible" onClick={() => setAutoSyncCollapsed(!autoSyncCollapsed)}>
          <div className="header-left">
            <SettingOutlined style={{ color: '#722ed1', fontSize: 14 }} />
            <span className="section-title">自动同步配置</span>
            {autoSyncConfig?.lastStatus && (
              <Tag color={autoSyncConfig.lastStatus === 'success' ? 'success' : 'error'} size="small">
                上次: {autoSyncConfig.lastStatus === 'success' ? '成功' : '失败'}
              </Tag>
            )}
          </div>
          {autoSyncCollapsed ? <DownOutlined /> : <UpOutlined />}
        </div>

        {!autoSyncCollapsed && (
        <div className="config-content">
          {/* 总开关 */}
          <div className="config-row config-row-highlight">
            <div className="config-label-group">
              <BellOutlined style={{ color: '#1677ff' }} />
              <span>自动同步</span>
              <Tooltip title="开启后将按照设定的时间自动同步 TAPD 数据">
                <InfoCircleOutlined style={{ color: '#8c8c8c', cursor: 'pointer' }} />
              </Tooltip>
            </div>
            <Switch
              checked={autoSyncEnabled}
              onChange={toggleAutoSync}
              checkedChildren="开启"
              unCheckedChildren="关闭"
              disabled={!autoSyncConfig}
            />
          </div>

          {autoSyncEnabled && (
            <>
              {/* 执行时间 */}
              <div className="config-subsection">
                <div className="subsection-title">
                  <ClockCircleOutlined style={{ color: '#1677ff' }} />
                  执行时间
                </div>
                <div className="subsection-content">
                  <div className="sync-time-info">
                    每天 {syncTimes.length > 0 ? syncTimes.map(t => t.format('HH:mm')).join('、') : '未设置'} 执行一次
                  </div>
                  <div className="time-picker-list">
                    {syncTimes.map((time, index) => (
                      <Space key={index}>
                        <TimePicker
                          value={time}
                          format="HH:mm"
                          onChange={(value) => {
                            const newTimes = [...syncTimes];
                            newTimes[index] = value!;
                            setSyncTimes(newTimes);
                          }}
                          minuteStep={15}
                          size="middle"
                        />
                        {syncTimes.length > 1 && (
                          <Button size="small" danger onClick={() => removeSyncTime(index)} icon={<CloseCircleOutlined />}>
                            删除
                          </Button>
                        )}
                      </Space>
                    ))}
                    {syncTimes.length < 5 && (
                      <Button size="small" type="dashed" icon={<PlusOutlined />} onClick={addSyncTime}>
                        添加时间
                      </Button>
                    )}
                  </div>
                  <div className="config-hint">最多可设置 5 个时间点，建议选择业务低峰期</div>
                </div>
              </div>

              {/* 同步范围 */}
              <div className="config-subsection">
                <div className="subsection-title">
                  <DatabaseOutlined style={{ color: '#52c41a' }} />
                  同步范围
                </div>
                <div className="subsection-content">
                  <div className="config-row">
                    <span className="config-label">数据范围</span>
                    <Space>
                      <span>同步最近</span>
                      <InputNumber min={7} max={365} step={1} value={daysBack} onChange={(value) => setDaysBack(value || 90)} size="middle" />
                      <span>天的数据</span>
                    </Space>
                  </div>
                  <div className="config-row">
                    <span className="config-label">数据类型</span>
                    <Checkbox.Group
                      value={autoSyncDataTypes}
                      onChange={(v) => setAutoSyncDataTypes(v as string[])}
                      options={[
                        { label: '需求', value: 'story' },
                        { label: '任务', value: 'task' },
                        { label: '迭代', value: 'iteration' },
                        { label: '缺陷', value: 'bug' },
                        { label: '工时', value: 'timesheet' },
                      ]}
                    />
                  </div>
                </div>
              </div>

              {/* 同步策略 */}
              <div className="config-subsection">
                <div className="subsection-title">
                  <SyncOutlined style={{ color: '#fa8c16' }} />
                  同步策略
                </div>
                <div className="subsection-content">
                  <div className="config-row">
                    <span className="config-label">策略</span>
                    <Select value={syncStrategy} onChange={setSyncStrategy} style={{ width: 200 }} size="middle"
                      options={[
                        { value: 'incremental', label: '增量同步' },
                        { value: 'full', label: '全量同步' },
                        { value: 'smart', label: '智能同步' },
                      ]}
                    />
                  </div>
                </div>
              </div>

              {/* 通知设置 */}
              <div className="config-subsection">
                <div className="subsection-title">
                  <BellOutlined style={{ color: '#eb2f96' }} />
                  通知设置
                </div>
                <div className="subsection-content">
                  <Checkbox checked={notifyOnComplete} onChange={(e) => setNotifyOnComplete(e.target.checked)}>
                    同步完成时通知
                  </Checkbox>
                  <Checkbox checked={notifyOnError} onChange={(e) => setNotifyOnError(e.target.checked)} style={{ marginLeft: 16 }}>
                    同步失败时通知
                  </Checkbox>
                </div>
              </div>

              {/* 运行状态 */}
              {autoSyncConfig && (
                <div className="config-subsection">
                  <div className="subsection-title">
                    <InfoCircleOutlined style={{ color: '#722ed1' }} />
                    运行状态
                  </div>
                  <div className="subsection-content status-info">
                    <div><span>上次执行:</span> <strong>{autoSyncConfig.lastExecutedAt ? dayjs(autoSyncConfig.lastExecutedAt).format('YYYY-MM-DD HH:mm:ss') : '暂无记录'}</strong></div>
                    <div><span>上次状态:</span> <Tag color={autoSyncConfig.lastStatus === 'success' ? 'success' : autoSyncConfig.lastStatus === 'failed' ? 'error' : 'default'}>
                      {autoSyncConfig.lastStatus === 'success' ? '成功' : autoSyncConfig.lastStatus === 'failed' ? '失败' : '未知'}
                    </Tag></div>
                    <div><span>下次执行:</span> <strong style={{ color: '#1677ff' }}>{autoSyncConfig.nextExecuteAt ? dayjs(autoSyncConfig.nextExecuteAt).format('YYYY-MM-DD HH:mm:ss') : '待计算'}</strong></div>
                  </div>
                </div>
              )}

              {/* 操作按钮 */}
              <div className="config-actions">
                <Space size="middle">
                  <Button 
                    type="default" 
                    icon={<SyncOutlined spin={executingAutoSync} />} 
                    loading={executingAutoSync}
                    onClick={handleExecuteAutoSync}
                    size="large"
                    disabled={!autoSyncConfig?.id || executingAutoSync}
                  >
                    {executingAutoSync ? '执行中...' : '立即执行'}
                  </Button>
                  <Button type="primary" icon={<SaveOutlined />} loading={savingConfig} onClick={saveAutoSyncConfig} size="large">
                    保存配置
                  </Button>
                </Space>
              </div>
            </>
          )}

          {!autoSyncConfig && !loadingConfig && (
            <div className="empty-config">
              <SettingOutlined style={{ fontSize: 32, marginBottom: 12, color: '#d9d9d9' }} />
              <p>点击上方开关启用自动同步功能</p>
            </div>
          )}
        </div>
        )}
      </div>
      
      {/* 同步进度 */}
      {syncing && currentJob && (
        <div className="section-linear section-highlight">
          <div className="section-title">同步进度</div>
          <div className="progress-content">
            <Progress percent={syncProgress} status="active" strokeColor="#1677ff" />
            <p className="progress-msg">{syncMsg}</p>
            <p className="progress-detail">
              已同步: 迭代 {currentJob.iterationCount} 个, 需求 {currentJob.storyCount} 个, 任务 {currentJob.taskCount} 个
            </p>
          </div>
        </div>
      )}

      {/* 数据概览 - 统计条状布局 */}
      <div className="section-linear">
        <div className="section-header-with-tag">
          <span className="section-title">数据概览</span>
          {(filterWorkspaceId || filterStatus || filterIterationId || filterOwner || filterCreatedRange || filterCompletedRange) && (
            <Tag color="blue" size="small">已筛选</Tag>
          )}
        </div>

        <div className="stats-bar-linear">
          <div className="stat-item-linear">
            <div className="stat-icon-linear stat-icon-blue">
              <DatabaseOutlined />
            </div>
            <div className="stat-content-linear">
              <div className="stat-label-linear">需求数</div>
              <div className="stat-value-linear">{dataStats?.storyCount || 0}</div>
            </div>
          </div>

          <div className="stat-item-linear">
            <div className="stat-icon-linear stat-icon-orange">
              <DatabaseOutlined />
            </div>
            <div className="stat-content-linear">
              <div className="stat-label-linear">任务数</div>
              <div className="stat-value-linear">{dataStats?.taskCount || 0}</div>
            </div>
          </div>

          <div className="stat-item-linear">
            <div className="stat-icon-linear stat-icon-green">
              <DatabaseOutlined />
            </div>
            <div className="stat-content-linear">
              <div className="stat-label-linear">迭代数</div>
              <div className="stat-value-linear">{dataStats?.iterationCount || 0}</div>
            </div>
          </div>

          <div className="stat-item-linear">
            <div className="stat-icon-linear stat-icon-red">
              <DatabaseOutlined />
            </div>
            <div className="stat-content-linear">
              <div className="stat-label-linear">缺陷数</div>
              <div className="stat-value-linear">{dataStats?.bugCount || 0}</div>
            </div>
          </div>

          <div className="stat-item-linear">
            <div className="stat-icon-linear stat-icon-purple">
              <DatabaseOutlined />
            </div>
            <div className="stat-content-linear">
              <div className="stat-label-linear">预估工时</div>
              <div className="stat-value-linear">{dataStats?.estimatedEffort || 0}<span className="stat-suffix-linear">h</span></div>
            </div>
          </div>

          <div className="stat-item-linear">
            <div className="stat-icon-linear stat-icon-cyan">
              <DatabaseOutlined />
            </div>
            <div className="stat-content-linear">
              <div className="stat-label-linear">实际工时</div>
              <div className="stat-value-linear">{dataStats?.actualEffort || 0}<span className="stat-suffix-linear">h</span></div>
            </div>
          </div>

          <div className="stat-item-linear">
            <div className="stat-icon-linear stat-icon-default">
              <DatabaseOutlined />
            </div>
            <div className="stat-content-linear">
              <div className="stat-label-linear">项目数</div>
              <div className="stat-value-linear">{dataStats?.workspaceCount || 0}</div>
            </div>
          </div>
        </div>

        <div className="stats-footer">
          <span>最后同步: {dataStats?.lastSyncAt ? dayjs(dataStats.lastSyncAt).format('YYYY-MM-DD HH:mm:ss') : '暂无数据'}</span>
          <span>同步状态: {dataStats?.lastSyncStatus === 'success' ? '成功' : dataStats?.lastSyncStatus === 'failed' ? '失败' : '暂无'}</span>
        </div>
      </div>
      
      {/* 数据明细 */}
      <div className="section-linear">
        <div className="section-header-with-action">
          <span className="section-title">数据明细</span>
          <Button type="link" size="small" icon={<ClearOutlined />} onClick={handleResetFilters}>
            重置筛选
          </Button>
        </div>

        {/* 筛选区域 */}
        <div className="filter-section">
          <div className="filter-header">
            <FilterOutlined style={{ color: '#1677ff', fontSize: 13 }} />
            <span>筛选条件</span>
          </div>
          <Row gutter={[16, 12]} align="middle">
            <Col xs={24} sm={12} md={8} lg={6}>
              <div className="filter-item">
                <label className="filter-label">所属项目</label>
                <Select
                  mode="multiple"
                  placeholder="全部项目"
                  allowClear
                  value={filterWorkspaceId}
                  onChange={(value) => {
                    handleMultiSelectChange(value as string[], dataStats?.filters?.projects || [], setFilterWorkspaceId, 100);
                    setFilterIterationId([]);
                  }}
                  options={addSelectAllOption(dataStats?.filters?.projects || [])}
                  style={{ width: '100%' }}
                  showSearch
                  optionFilterProp="label"
                  maxTagCount="responsive"
                  size="middle"
                />
              </div>
            </Col>

            <Col xs={24} sm={12} md={8} lg={6}>
              <div className="filter-item">
                <label className="filter-label">状态</label>
                <Select
                  mode="multiple"
                  placeholder="全部状态"
                  allowClear
                  value={filterStatus}
                  onChange={(value) => handleMultiSelectChange(value as string[], dataStats?.filters?.statuses || [], setFilterStatus, 200)}
                  options={addSelectAllOption(dataStats?.filters?.statuses || [])}
                  style={{ width: '100%' }}
                  maxTagCount="responsive"
                  size="middle"
                />
              </div>
            </Col>

            <Col xs={24} sm={12} md={8} lg={6}>
              <div className="filter-item">
                <label className="filter-label">迭代</label>
                <Select
                  mode="multiple"
                  placeholder="全部迭代"
                  allowClear
                  value={filterIterationId}
                  onChange={(value) => handleMultiSelectChange(value as string[], filteredIterations, setFilterIterationId, 200)}
                  options={addSelectAllOption(filteredIterations)}
                  style={{ width: '100%' }}
                  showSearch
                  optionFilterProp="label"
                  notFoundContent="请先选择项目"
                  maxTagCount="responsive"
                  size="middle"
                />
              </div>
            </Col>

            <Col xs={24} sm={12} md={8} lg={6}>
              <div className="filter-item">
                <label className="filter-label">处理人</label>
                <Select
                  mode="multiple"
                  placeholder="全部处理人"
                  allowClear
                  value={filterOwner}
                  onChange={(value) => handleMultiSelectChange(value as string[], dataStats?.filters?.owners || [], setFilterOwner, 200)}
                  options={addSelectAllOption(dataStats?.filters?.owners || [])}
                  style={{ width: '100%' }}
                  showSearch
                  optionFilterProp="label"
                  maxTagCount="responsive"
                  size="middle"
                />
              </div>
            </Col>

            <Col xs={24} sm={12} md={8} lg={6}>
              <div className="filter-item">
                <label className="filter-label">创建时间</label>
                <RangePicker
                  value={filterCreatedRange}
                  onChange={(dates) => { setFilterCreatedRange(dates as [dayjs.Dayjs, dayjs.Dayjs] | null); triggerFilterChange(300); }}
                  format="YYYY-MM-DD"
                  style={{ width: '100%' }}
                  size="middle"
                />
              </div>
            </Col>

            <Col xs={24} sm={12} md={8} lg={6}>
              <div className="filter-item">
                <label className="filter-label">完成时间</label>
                <RangePicker
                  value={filterCompletedRange}
                  onChange={(dates) => { setFilterCompletedRange(dates as [dayjs.Dayjs, dayjs.Dayjs] | null); triggerFilterChange(300); }}
                  format="YYYY-MM-DD"
                  style={{ width: '100%' }}
                  size="middle"
                />
              </div>
            </Col>
          </Row>
        </div>

        {/* 标签页和表格 */}
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            { key: 'story', label: `需求 (${dataStats?.storyCount || 0})` },
            { key: 'task', label: `任务 (${dataStats?.taskCount || 0})` },
            { key: 'iteration', label: `迭代 (${dataStats?.iterationCount || 0})` },
            { key: 'bug', label: `缺陷 (${dataStats?.bugCount || 0})` },
            { key: 'timesheet', label: `工时 (${dataStats?.timesheetCount || 0})` },
          ]}
          className="linear-tabs"
        />
        <Table
          columns={columns}
          dataSource={tableData}
          loading={
            tableLoading ||
            (Array.isArray(filterWorkspaceId) && filterWorkspaceId.length > 0 && !mappingLoaded)
          }
          rowKey="id"
          pagination={{
            ...tablePagination,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条`,
            pageSizeOptions: ['10', '20', '50', '100'],
            onChange: (page, pageSize) => loadTableData(page, pageSize),
            onShowSizeChange: (current, size) => loadTableData(1, size),
          }}
          scroll={{ x: 2400 }}
          size="small"
          className="linear-table"
        />
      </div>

      {/* 同步历史 */}
      <div className="section-linear">
        <div className="section-header-with-icon">
          <span className="section-title">同步历史</span>
          <HistoryOutlined style={{ color: '#8c8c8c' }} />
        </div>
        <Table
          dataSource={syncHistory}
          rowKey="id"
          columns={[
            { title: '开始时间', dataIndex: 'startedAt', key: 'startedAt', width: 180, render: (v: string) => dayjs(v).format('YYYY-MM-DD HH:mm:ss') },
            { title: '项目', dataIndex: 'workspaceIds', key: 'workspaceNames', width: 250, render: (v: string[]) => {
              if (!v?.length) return '-';
              const names = v.map(id => workspaceNameMap[id] || id);
              if (names.length <= 2) return names.join(', ');
              return (
                <Tooltip title={names.join(', ')}>
                  <span>{names.slice(0, 2).join(', ')} 等{names.length}个项目</span>
                </Tooltip>
              );
            }},
            { title: '需求数', dataIndex: 'storyCount', key: 'storyCount', width: 100 },
            { title: '任务数', dataIndex: 'taskCount', key: 'taskCount', width: 100 },
            { title: '迭代数', dataIndex: 'iterationCount', key: 'iterationCount', width: 80 },
            { title: '状态', dataIndex: 'status', key: 'status', width: 100, render: renderSyncStatus },
            { title: '耗时', key: 'duration', width: 100, render: (_v: unknown, r: SyncJob) => r.finishedAt ? `${Math.round((new Date(r.finishedAt).getTime() - new Date(r.startedAt).getTime()) / 1000)}秒` : '-' },
            { title: '操作', key: 'action', width: 80, render: (_v: unknown, r: SyncJob) => r.status === 'failed' ? <Button size="small" type="link" onClick={() => handleRetry(r)}>重试</Button> : null },
          ]}
          pagination={false}
          size="small"
          className="linear-table"
        />
      </div>

      {/* Linear风格全局样式 */}
      <style jsx global>{`
        /* ========================================
           页面容器 - 克制设计
           ======================================== */
        .tapd-data-manager {
          padding: 20px 24px;
          max-width: 100%;
          margin: 0 auto;
          min-height: calc(100vh - 120px);
          background: #fafafa;
        }

        .page-header-linear {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
          padding-bottom: 16px;
          border-bottom: 1px solid #f0f0f0;
        }

        .header-left {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .header-icon {
          font-size: 20px;
          color: #1677ff;
        }

        .header-title {
          font-size: 18px;
          font-weight: 600;
          color: #262626;
          margin: 0;
        }

        /* ========================================
           分区容器 - 统一样式
           ======================================== */
        .section-linear {
          background: #fff;
          border: 1px solid #f0f0f0;
          border-radius: 6px;
          margin-bottom: 16px;
          overflow: hidden;
        }

        .section-highlight {
          border-color: #1677ff;
          box-shadow: 0 0 0 1px rgba(22, 119, 255, 0.08);
        }

        .section-title {
          font-size: 14px;
          font-weight: 600;
          color: #262626;
          padding: 14px 16px;
          border-bottom: 1px solid #f0f0f0;
          background: #fafafa;
        }

        .section-header-with-tag,
        .section-header-with-action,
        .section-header-with-icon {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 14px 16px;
          border-bottom: 1px solid #f0f0f0;
          background: #fafafa;
        }

        .section-header-collapsible {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 14px 16px;
          cursor: pointer;
          transition: background 0.15s ease;
          user-select: none;
        }

        .section-header-collapsible:hover {
          background: #f5f5f5;
        }

        /* ========================================
           表单布局 - Grid系统
           ======================================== */
        .form-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 16px;
          padding: 16px;
        }

        @media (max-width: 768px) {
          .form-grid {
            grid-template-columns: 1fr;
          }
        }

        .form-item {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .form-item-full {
          grid-column: 1 / -1;
        }

        .form-item-action {
          grid-column: 1 / -1;
          display: flex;
          align-items: flex-end;
        }

        .form-label {
          font-size: 13px;
          font-weight: 500;
          color: #595959;
        }

        .range-picker-wrapper {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .form-hint {
          font-size: 12px;
          color: #8c8c8c;
          white-space: nowrap;
        }

        /* ========================================
           配置内容区
           ======================================== */
        .config-content {
          padding: 16px;
        }

        .config-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 0;
          border-bottom: 1px solid #fafafa;
        }

        .config-row:last-child {
          border-bottom: none;
        }

        .config-row-highlight {
          background: #e6f4ff;
          margin: -16px -16px 0 -16px;
          padding: 12px 16px;
          border-radius: 6px 6px 0 0;
          border-bottom: 1px solid #bae7ff;
        }

        .config-label-group {
          display: flex;
          align-items: center;
          gap: 8px;
          font-weight: 500;
          color: #262626;
        }

        .config-label {
          font-size: 13px;
          color: #595959;
          min-width: 70px;
        }

        .config-subsection {
          margin-top: 16px;
          padding-top: 16px;
          border-top: 1px solid #f0f0f0;
        }

        .subsection-title {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          font-weight: 600;
          color: #262626;
          margin-bottom: 12px;
        }

        .subsection-content {
          padding-left: 8px;
        }

        .sync-time-info {
          font-size: 13px;
          color: #595959;
          margin-bottom: 10px;
        }

        .time-picker-list {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-bottom: 8px;
        }

        .config-hint {
          font-size: 12px;
          color: #8c8c8c;
          margin-top: 4px;
        }

        .status-info div {
          font-size: 13px;
          line-height: 2;
        }

        .status-info span {
          color: #8c8c8c;
          margin-right: 8px;
        }

        .config-actions {
          display: flex;
          justify-content: flex-end;
          margin-top: 20px;
          padding-top: 16px;
          border-top: 1px solid #f0f0f0;
        }

        .empty-config {
          text-align: center;
          padding: 40px 20px;
          color: #bfbfbf;
        }

        .empty-config p {
          margin: 0;
          font-size: 13px;
        }

        /* ========================================
           进度显示
           ======================================== */
        .progress-content {
          padding: 16px;
        }

        .progress-msg {
          margin: 10px 0 6px;
          color: #595959;
          font-size: 13px;
        }

        .progress-detail {
          color: #8c8c8c;
          font-size: 12px;
          margin: 0;
        }

        /* ========================================
           统计条状布局（复用Linear风格）
           ======================================== */
        .stats-bar-linear {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
          gap: 1px;
          background: #f0f0f0;
          border: 1px solid #f0f0f0;
          border-radius: 6px;
          overflow: hidden;
          margin: 16px;
        }

        .stat-item-linear {
          background: #fff;
          padding: 14px 16px;
          display: flex;
          align-items: center;
          gap: 12px;
          transition: background 0.15s ease;
        }

        .stat-item-linear:hover {
          background: #fafafa;
        }

        .stat-icon-linear {
          width: 36px;
          height: 36px;
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
          flex-shrink: 0;
        }

        .stat-icon-blue { background: #e6f4ff; color: #1677ff; }
        .stat-icon-orange { background: #fff7e6; color: #fa8c16; }
        .stat-icon-green { background: #f6ffed; color: #52c41a; }
        .stat-icon-red { background: #fff1f0; color: #ff4d4f; }
        .stat-icon-purple { background: #f9f0ff; color: #722ed1; }
        .stat-icon-cyan { background: #e6fffb; color: #13c2c2; }
        .stat-icon-default { background: #fafafa; color: #8c8c8c; }

        .stat-content-linear {
          flex: 1;
          min-width: 0;
        }

        .stat-label-linear {
          font-size: 12px;
          color: #8c8c8c;
          margin-bottom: 2px;
        }

        .stat-value-linear {
          font-size: 18px;
          font-weight: 600;
          color: #262626;
          line-height: 1.2;
        }

        .stat-suffix-linear {
          font-size: 12px;
          color: #8c8c8c;
          font-weight: 400;
          margin-left: 4px;
        }

        .stats-footer {
          display: flex;
          justify-content: space-between;
          padding: 12px 16px;
          border-top: 1px solid #f0f0f0;
          font-size: 12px;
          color: #8c8c8c;
        }

        /* ========================================
           筛选区域
           ======================================== */
        .filter-section {
          padding: 16px;
          background: #fafafa;
          border-bottom: 1px solid #f0f0f0;
        }

        .filter-header {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 13px;
          font-weight: 500;
          color: #595959;
          margin-bottom: 12px;
        }

        .filter-item {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .filter-label {
          font-size: 11px;
          color: #8c8c8c;
        }

        /* ========================================
           表格样式 - 克制设计
           ======================================== */
        .linear-table .ant-table {
          font-size: 13px;
        }

        .linear-table .ant-table-thead > tr > th {
          background: #fafafa !important;
          font-weight: 600 !important;
          color: #595959 !important;
          border-bottom: 1px solid #f0f0f0 !important;
          padding: 10px 12px !important;
          font-size: 12px !important;
        }

        .linear-table .ant-table-tbody > tr:hover > td {
          background: #fafafa !important;
        }

        .linear-table .ant-table-tbody > tr > td {
          padding: 8px 12px !important;
          border-bottom: 1px solid #f5f5f5 !important;
          font-size: 12px !important;
        }

        /* ========================================
           标签页样式
           ======================================== */
        .linear-tabs .ant-tabs-nav {
          margin-bottom: 0 !important;
          padding: 0 16px;
          background: #fafafa;
        }

        .linear-tabs .ant-tabs-tab {
          padding: 12px 16px !important;
          font-size: 13px !important;
        }

        /* ========================================
           响应式适配
           ======================================== */
        @media (max-width: 768px) {
          .tapd-data-manager {
            padding: 12px 16px;
          }

          .stats-bar-linear {
            grid-template-columns: repeat(2, 1fr);
          }

          .page-header-linear {
            flex-direction: column;
            gap: 12px;
            align-items: flex-start;
          }
        }
      `}</style>
    </div>
  );
}
