'use client';

import React, { useState, useEffect, useCallback, useMemo, memo } from 'react';
import {
  Modal,
  Card,
  Table,
  Tag,
  Space,
  Progress,
  Row,
  Col,
  Button,
  message,
  Spin,
  Typography,
  Divider,
  Tooltip,
  List,
  Avatar,
  Checkbox,
  DatePicker,
  Select,
  InputNumber,
  Statistic,
  Badge,
  Alert,
} from 'antd';
import {
  WarningOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  CalendarOutlined,
  TeamOutlined,
  ClockCircleOutlined,
  FileTextOutlined,
  DownloadOutlined,
  EyeOutlined,
  DeleteOutlined,
  HistoryOutlined,
  SendOutlined,
  PlusOutlined,
  MinusCircleOutlined,
  FilterOutlined,
  ClearOutlined,
  SwapOutlined,
  ThunderboltOutlined,
  InfoCircleOutlined,
  ReloadOutlined,
  DashboardOutlined,
  BarChartOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';

const { Text, Title, Paragraph } = Typography;
const { Option } = Select;

// ====================================================
// 类型定义
// ====================================================

interface StoryForSelection {
  id: string;
  name: string;
  priority: number;
  owner: string;
  effort: number;
  progress: number;
  status: string;
  statusLabel?: string;
  testDate?: string;
}

interface PersonLoad {
  name: string;
  role: string;
  effort: number;
  completed: number;
  capacity: number;
  loadPct: number;
  workDays: number;
  taskStart: string;
  taskEnd: string;
  storyCount: number;
  taskCount: number;
}

interface RiskItem {
  level: 'high' | 'medium' | 'low';
  title: string;
  description: string;
}

interface AnalysisData {
  iteration: { id: string; name: string; startDate: string; endDate: string };
  stories: Array<{ id: string; name: string; priority: number; effort: number; progress: number; completed?: number; testDate?: string; owner?: string }>;
  persons: PersonLoad[];
  grouped: Record<string, PersonLoad[]>;
  risks: RiskItem[];
  totals: {
    storyCount: number;
    totalEffort: number;
    totalTaskEffort: number;
    totalTaskCompleted: number;
    overloadCount: number;
    normalCount: number;
    lightCount: number;
  };
  config: {
    priorityMin: number;
    priorityMax: number;
    extraWorkdays: string[];
    holidays: string[];
    dailyCapacityH: number;
  };
}

interface AnalysisHistoryItem {
  id: string;
  timestamp: string;
  description: string;
  workspaceId: string;
  iterationId: string;
  config: {
    extraWorkdays: string[];
    holidays: string[];
    priorityMin: number;
    priorityMax: number;
    dailyCapacityH?: number;
    selectedStoryIds?: string[];
  };
  result?: AnalysisData;
  htmlReport?: string;
}

// ====================================================
// 常量 & 配置
// ====================================================

const PRIORITY_COLORS: Record<number, string> = {
  0: '#f5222d',
  1: '#fa8c16',
  2: '#faad14',
  3: '#fadb14',
  4: '#a0d911',
  5: '#52c41a',
  6: '#13c2c2',
  7: '#1890ff',
};

const HISTORY_STORAGE_KEY = 'tapd_analysis_history_v2';
const MAX_HISTORY_ITEMS = 20;

// ====================================================
// 工具函数
// ====================================================

function loadHistory(): AnalysisHistoryItem[] {
  try {
    const stored = localStorage.getItem(HISTORY_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveHistory(history: AnalysisHistoryItem[]) {
  try {
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history.slice(0, MAX_HISTORY_ITEMS)));
  } catch (e) {
    console.warn('保存分析历史失败:', e);
  }
}

function getPriorityLabel(prio: number | undefined): string {
  if (prio === undefined || prio === null || isNaN(prio)) return '-';
  return `P${prio}`;
}

function getPriorityColor(prio: number): string {
  return PRIORITY_COLORS[prio] || '#d9d9d9';
}

// ====================================================
// 主组件
// ====================================================

interface IterationAnalysisModalProps {
  open: boolean;
  onClose: () => void;
  workspaceId: string;
  iterationId: string;
  iterationName?: string;
}

/**
 * 迭代排期诊断分析
 *
 * 设计原则（Linear风格）：
 * - 克制设计：平静的表面层级，少量颜色
 * - 信息密度：紧凑但可读，避免卡片马赛克
 * - 功能优先：每个区域一个职责，实用文案
 * - 清晰层级：通过间距、字重、颜色建立视觉层次
 */
const IterationAnalysisModal: React.FC<IterationAnalysisModalProps> = memo(({
  open,
  onClose,
  workspaceId,
  iterationId,
  iterationName,
}) => {
  // ========== 状态管理 ==========
  const [loading, setLoading] = useState(false);
  const [fetchingStories, setFetchingStories] = useState(false);
  const [data, setData] = useState<AnalysisData | null>(null);
  const [htmlReport, setHtmlReport] = useState<string | null>(null);

  const [allStories, setAllStories] = useState<StoryForSelection[]>([]);
  const [selectedStoryIds, setSelectedStoryIds] = useState<Set<string>>(new Set());

  const [extraWorkdays, setExtraWorkdays] = useState<string[]>([]);
  const [holidays, setHolidays] = useState<string[]>([]);
  const [dailyCapacityH, setDailyCapacityH] = useState<number>(8);

  const [history, setHistory] = useState<AnalysisHistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  const [priorityFilter, setPriorityFilter] = useState<[number, number]>([0, 7]);

  // ========== 初始化：加载需求列表 ==========
  useEffect(() => {
    if (open) {
      setHistory(loadHistory());
      fetchIterationStories();
      setSelectedStoryIds(new Set());
    }
  }, [open, workspaceId, iterationId]);

  // 从 TAPD 获取迭代的需求列表
  const fetchIterationStories = useCallback(async () => {
    setFetchingStories(true);
    try {
      const res = await fetch(`/api/v1/tapd/realtime?workspace_id=${workspaceId}&iteration_id=${iterationId}&action=get_iteration_stories&limit=200`);
      const json = await res.json();

      if (json.success && json.data?.stories) {
        const stories: StoryForSelection[] = json.data.stories.map((s: any) => ({
          id: s.id || s.tapdId,
          name: s.title || s.name,
          priority: (s.priority !== undefined && s.priority !== null && !isNaN(s.priority)) ? s.priority : undefined,
          owner: s.owner || '',
          effort: s.effort || 0,
          progress: s.effort && s.effort > 0
            ? Math.round(((s.effortCompleted || 0) / s.effort) * 100)
            : 0,
          status: s.status,
          statusLabel: s.statusLabel,
          testDate: s.testDate,
        }));

        setAllStories(stories);
        setSelectedStoryIds(new Set(stories.map(s => s.id)));

        message.success(`加载了 ${stories.length} 个需求`);
      } else {
        message.error('获取需求列表失败');
      }
    } catch (e) {
      console.error('获取需求列表失败:', e);
      message.error('获取需求列表异常');
    } finally {
      setFetchingStories(false);
    }
  }, [workspaceId, iterationId]);

  // ========== 需求选择操作 ==========

  const toggleStorySelection = useCallback((storyId: string) => {
    setSelectedStoryIds(prev => {
      const next = new Set(prev);
      if (next.has(storyId)) {
        next.delete(storyId);
      } else {
        next.add(storyId);
      }
      return next;
    });
  }, []);

  const handleSelectAll = useCallback((checked: boolean) => {
    if (checked) {
      setSelectedStoryIds(new Set(allStories.map(s => s.id)));
    } else {
      setSelectedStoryIds(new Set());
    }
  }, [allStories]);

  const handleSelectByPriority = useCallback((minPrio: number, maxPrio: number) => {
    const filtered = allStories.filter(s => s.priority >= minPrio && s.priority <= maxPrio);
    setSelectedStoryIds(prev => {
      const next = new Set(prev);
      filtered.forEach(s => next.add(s.id));
      return next;
    });
  }, [allStories]);

  const handleInvertSelection = useCallback(() => {
    const allIds = new Set(allStories.map(s => s.id));
    const inverted = new Set<string>();
    allIds.forEach(id => {
      if (!selectedStoryIds.has(id)) {
        inverted.add(id);
      }
    });
    setSelectedStoryIds(inverted);
  }, [allStories, selectedStoryIds]);

  const handleClearSelection = useCallback(() => {
    setSelectedStoryIds(new Set());
  }, []);

  // ========== 日期操作 ==========

  const addExtraWorkday = (date: dayjs.Dayjs | null) => {
    if (date) {
      const dateStr = date.format('YYYY-MM-DD');
      if (!extraWorkdays.includes(dateStr)) {
        setExtraWorkdays(prev => [...prev, dateStr].sort());
      }
    }
  };

  const removeExtraWorkday = (dateStr: string) => {
    setExtraWorkdays(prev => prev.filter(d => d !== dateStr));
  };

  const addHoliday = (date: dayjs.Dayjs | null) => {
    if (date) {
      const dateStr = date.format('YYYY-MM-DD');
      if (!holidays.includes(dateStr)) {
        setHolidays(prev => [...prev, dateStr].sort());
      }
    }
  };

  const removeHoliday = (dateStr: string) => {
    setHolidays(prev => prev.filter(d => d !== dateStr));
  };

  // ========== 核心分析逻辑 ==========

  const handleAnalyze = useCallback(async () => {
    if (selectedStoryIds.size === 0) {
      message.warning('请至少选择一个需求进行分析');
      return;
    }

    setLoading(true);
    setData(null);
    setHtmlReport(null);

    try {
      const selectedStories = allStories.filter(s => selectedStoryIds.has(s.id));
      const validPriorities = selectedStories
        .map(s => s.priority)
        .filter(p => p !== undefined && p !== null && !isNaN(p));

      const priorityMin = validPriorities.length > 0 ? Math.min(...validPriorities) : 0;
      const priorityMax = validPriorities.length > 0 ? Math.max(...validPriorities) : 7;

      const config = {
        priorityMin,
        priorityMax,
        extraWorkdays,
        holidays,
        dailyCapacityH,
        selectedStoryIds: Array.from(selectedStoryIds),
      };

      console.log('[Analysis] 发送分析请求:', config);

      const res = await fetch('/api/v1/tapd/iteration-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId,
          iterationId,
          ...config,
        }),
      });

      const json = await res.json();
      if (json.success) {
        const resultData = json.data;
        setData(resultData);

        const historyItem: AnalysisHistoryItem = {
          id: Date.now().toString(),
          timestamp: new Date().toISOString(),
          description: `分析 ${selectedStoryIds.size} 个需求 (P${priorityMin}-P${priorityMax})`,
          workspaceId,
          iterationId,
          config,
          result: resultData,
        };

        const newHistory = [historyItem, ...history].slice(0, MAX_HISTORY_ITEMS);
        setHistory(newHistory);
        saveHistory(newHistory);

        message.success(`分析完成！共 ${resultData.stories.length} 个需求，${resultData.persons.length} 名成员`);
      } else {
        message.error('分析失败: ' + json.message);
      }
    } catch (e) {
      message.error('分析异常');
      console.error('分析异常:', e);
    } finally {
      setLoading(false);
    }
  }, [selectedStoryIds, allStories, extraWorkdays, holidays, dailyCapacityH, workspaceId, iterationId, history]);

  // ========== 报告生成 ==========

  const handleGenerateReport = async () => {
    if (!data) return;

    try {
      message.loading('正在生成报告...', 0);
      const res = await fetch('/api/v1/tapd/iteration-analysis/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      message.destroy();

      if (json.success && json.html) {
        setHtmlReport(json.html);

        const updatedHistory = history.map(item =>
          item.result === data ? { ...item, htmlReport: json.html } : item
        );
        setHistory(updatedHistory);
        saveHistory(updatedHistory);

        message.success('报告生成成功！');
      } else {
        message.error('生成报告失败: ' + (json.message || '未知错误'));
      }
    } catch (e) {
      message.destroy();
      message.error('生成报告异常');
    }
  };

  const handleDownloadReport = () => {
    if (!htmlReport) return;
    const blob = new Blob([htmlReport], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `迭代分析_${iterationName || iterationId}_${new Date().toISOString().slice(0,10)}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // ========== 历史记录操作 ==========

  const handleLoadFromHistory = useCallback((item: AnalysisHistoryItem) => {
    if (item.config.selectedStoryIds) {
      setSelectedStoryIds(new Set(item.config.selectedStoryIds));
    }
    setExtraWorkdays(item.config.extraWorkdays || []);
    setHolidays(item.config.holidays || []);
    setDailyCapacityH(item.config.dailyCapacityH || 8);
    setShowHistory(false);

    if (item.result) {
      setData(item.result);
      if (item.htmlReport) {
        setHtmlReport(item.htmlReport);
      }
    }
  }, []);

  const handleDeleteHistory = useCallback((id: string) => {
    const newHistory = history.filter(h => h.id !== id);
    setHistory(newHistory);
    saveHistory(newHistory);
    message.success('已删除');
  }, [history]);

  const handleClearHistory = useCallback(() => {
    setHistory([]);
    saveHistory([]);
    message.success('已清空历史');
  }, []);

  // ========== 统计计算（使用 useMemo 缓存）==========

  const selectedStories = useMemo(() => {
    return allStories.filter(s => selectedStoryIds.has(s.id));
  }, [allStories, selectedStoryIds]);

  const totalEffort = useMemo(() => {
    return selectedStories.reduce((sum, s) => sum + s.effort, 0);
  }, [selectedStories]);

  const avgProgress = useMemo(() => {
    if (selectedStories.length === 0) return 0;
    return Math.round(selectedStories.reduce((sum, s) => sum + s.progress, 0) / selectedStories.length);
  }, [selectedStories]);

  // ✅ 需求列表表格列定义
  const storyColumns: ColumnsType<StoryForSelection> = useMemo(() => [
    {
      title: '选择',
      dataIndex: 'id',
      key: 'select',
      width: 50,
      render: (id: string) => (
        <Checkbox
          checked={selectedStoryIds.has(id)}
          onChange={() => toggleStorySelection(id)}
          className="modern-checkbox"
        />
      ),
    },
    {
      title: '优先级',
      dataIndex: 'priority',
      key: 'priority',
      width: 70,
      sorter: (a, b) => a.priority - b.priority,
      render: (prio: number, record: any) => (
        <Tag
          color={record?.priorityIsEmpty ? '#999' : getPriorityColor(prio)}
          className="priority-tag-modern"
        >
          {record?.priorityIsEmpty ? '-' : getPriorityLabel(prio)}
        </Tag>
      ),
      filters: Array.from({ length: 8 }, (_, i) => ({ text: `P${i}`, value: i })),
      onFilter: (value, record) => record.priority === value,
    },
    {
      title: '需求名称',
      dataIndex: 'name',
      key: 'name',
      ellipsis: true,
      render: (name: string) => (
        <Tooltip title={name}>
          <Text strong className="story-name-text">{name}</Text>
        </Tooltip>
      ),
    },
    {
      title: '负责人',
      dataIndex: 'owner',
      key: 'owner',
      width: 90,
      render: (owner: string) => <span className="owner-name-text">{owner || '-'}</span>,
    },
    {
      title: '工时',
      dataIndex: 'effort',
      key: 'effort',
      width: 65,
      sorter: (a, b) => a.effort - b.effort,
      render: (effort: number) => <span className="effort-value-text">{effort}h</span>,
    },
    {
      title: '进度',
      dataIndex: 'progress',
      key: 'progress',
      width: 120,
      render: (progress: number) => (
        <Progress
          percent={progress}
          size="small"
          status={progress >= 100 ? 'success' : 'active'}
          className="progress-bar-modern"
        />
      ),
    },
    {
      title: '状态',
      dataIndex: 'statusLabel',
      key: 'status',
      width: 90,
      render: (statusLabel: string) => {
        const statusConfig: Record<string, { bg: string; color: string; border: string }> = {
          '已实现': { bg: '#f6ffed', color: '#389e0d', border: '#b7eb8f' },
          '进行中': { bg: '#e6f4ff', color: '#0958d9', border: '#91caff' },
          '待开始': { bg: '#fffbe6', color: '#d48806', border: '#ffe58f' },
          '规划中': { bg: '#f9f0ff', color: '#531dab', border: '#d3adf7' },
          '待测试': { bg: '#e6fffb', color: '#08979c', border: '#87e8de' },
          '待发布': { bg: '#fff7e6', color: '#d46b08', border: '#ffd591' },
          '已关闭': { bg: '#fafafa', color: '#595959', border: '#d9d9d9' },
        };
        const config = statusConfig[statusLabel] || { bg: '#fafafa', color: '#8c8c8c', border: '#d9d9d9' };
        return (
          <Tag
            style={{
              backgroundColor: config.bg,
              color: config.color,
              borderColor: config.border,
              borderRadius: '6px',
              padding: '2px 10px',
              fontWeight: 500,
              fontSize: '12px',
              border: '1px solid',
            }}
          >
            {statusLabel || '-'}
          </Tag>
        );
      },
    },
  ], [selectedStoryIds, toggleStorySelection]);

  // ====================================================
  // ✨ 现代化渲染
  // ====================================================

  return (
    <Modal
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <ThunderboltOutlined style={{ fontSize: 18, color: '#1677ff' }} />
          <div>
            <div style={{ fontSize: 16, fontWeight: 600, color: '#262626', lineHeight: 1.4 }}>迭代排期诊断分析</div>
            <div style={{ fontSize: 13, color: '#8c8c8c', marginTop: 2 }}>{iterationName || `迭代 #${iterationId}`}</div>
          </div>
          {history.length > 0 && (
            <Badge count={history.length} size="small" offset={[0, 0]}>
              <Button
                size="small"
                icon={<HistoryOutlined />}
                onClick={() => setShowHistory(!showHistory)}
                style={{ marginLeft: 16 }}
              >
                历史
              </Button>
            </Badge>
          )}
        </div>
      }
      open={open}
      onCancel={onClose}
      width={1400}
      footer={[
        <Button key="close" onClick={onClose} size="large" className="close-btn">
          关闭
        </Button>,
      ]}
      className="analysis-modal-linear"
      centered
      styles={{
        body: { padding: '20px 24px', background: '#fafafa' }
      }}
    >
      {/* ========== Linear风格全局样式 ========== */}
      <style jsx global>{`
        /* ========================================
           Modal 容器 - 克制设计
           ======================================== */
        .analysis-modal-linear .ant-modal-content {
          border-radius: 8px !important;
          box-shadow: 0 6px 16px rgba(0, 0, 0, 0.08), 0 0 1px rgba(0, 0, 0, 0.1);
          background: #fff;
        }

        .analysis-modal-linear .ant-modal-header {
          padding: 16px 24px;
          border-bottom: 1px solid #f0f0f0;
          background: #fff;
        }

        .analysis-modal-linear .ant-modal-body {
          max-height: 82vh;
          overflow-y: auto;
          background: #fafafa;
        }

        .analysis-modal-linear .ant-modal-body::-webkit-scrollbar {
          width: 6px;
        }

        .analysis-modal-linear .ant-modal-body::-webkit-scrollbar-track {
          background: #f0f0f0;
        }

        .analysis-modal-linear .ant-modal-body::-webkit-scrollbar-thumb {
          background: #d9d9d9;
          border-radius: 3px;
        }

        .analysis-modal-linear .ant-modal-body::-webkit-scrollbar-thumb:hover {
          background: #bfbfbf;
        }

        /* ========================================
           统计概览 - 紧凑条状布局
           ======================================== */
        .stats-bar-linear {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 1px;
          background: #f0f0f0;
          border: 1px solid #f0f0f0;
          border-radius: 6px;
          margin-bottom: 20px;
          overflow: hidden;
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
        .stat-icon-purple { background: #f9f0ff; color: #722ed1; }

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

        /* ========================================
           ✨ Header 样式
           ======================================== */
        .modal-header-modern {
          display: flex;
          align-items: center;
          gap: 16px;
          position: relative;
          z-index: 1;
        }

        .header-icon-wrapper {
          width: 48px;
          height: 48px;
          background: rgba(255, 255, 255, 0.2);
          backdrop-filter: blur(10px);
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          animation: iconPulse 2s ease-in-out infinite;
        }

        @keyframes iconPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(255,255,255,0.4); }
          50% { box-shadow: 0 0 0 10px rgba(255,255,255,0); }
        }

        .header-icon {
          font-size: 24px !important;
          color: #fff !important;
        }

        .header-title-group {
          flex: 1;
        }

        .header-title {
          color: #fff !important;
          margin: 0 !important;
          font-size: 20px !important;
          letter-spacing: 0.5px;
        }

        .header-subtitle {
          color: rgba(255,255,255,0.85) !important;
          font-size: 13px;
          margin-top: 2px;
        }

        .history-btn {
          background: rgba(255,255,255,0.2) !important;
          border: 1px solid rgba(255,255,255,0.3) !important;
          color: #fff !important;
          border-radius: 10px !important;
          font-weight: 500 !important;
          backdrop-filter: blur(10px);
          transition: all 0.3s ease !important;
        }

        .history-btn:hover {
          background: rgba(255,255,255,0.35) !important;
          border-color: rgba(255,255,255,0.5) !important;
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        }

        .close-btn {
          border-radius: 10px !important;
          font-weight: 500 !important;
          height: 40px !important;
          padding: 0 24px !important;
        }

        /* ========================================
           ✨ 统计卡片样式
           ======================================== */
        .stat-card-modern {
          border-radius: 16px !important;
          overflow: hidden;
          position: relative;
          transition: all 0.35s cubic-bezier(0.4, 0, 0.2, 1);
          border: none !important;
          box-shadow: 0 4px 16px rgba(0,0,0,0.06);
        }

        .stat-card-modern::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 4px;
          background: var(--card-accent);
        }

        .stat-card-modern:hover {
          transform: translateY(-6px);
          box-shadow: 0 12px 32px rgba(0,0,0,0.12);
        }

        .stat-card-modern .ant-statistic-title {
          font-size: 13px !important;
          color: #666 !important;
          font-weight: 600 !important;
          margin-bottom: 8px !important;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .stat-card-modern .ant-statistic-content {
          font-size: 32px !important;
          font-weight: 700 !important;
        }

        .stat-card-modern .ant-statistic-content-prefix {
          font-size: 24px !important;
          margin-right: 8px !important;
          animation: statIconFloat 3s ease-in-out infinite;
        }

        @keyframes statIconFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }

        .stat-card-modern .ant-statistic-content-suffix {
          font-size: 16px !important;
          color: #999 !important;
          font-weight: 500 !important;
        }

        /* 卡片1：蓝色 - 需求 */
        .stat-card-stories {
          --card-accent: linear-gradient(90deg, #1677ff, #4096ff);
          background: linear-gradient(135deg, #e6f4ff 0%, #f0f5ff 100%) !important;
        }

        .stat-card-stories .ant-statistic-content-value {
          color: #1677ff !important;
        }

        /* 卡片2：橙色 - 工时 */
        .stat-card-effort {
          --card-accent: linear-gradient(90deg, #fa8c16, #ffc53d);
          background: linear-gradient(135deg, #fff7e6 0%, #fffbe6 100%) !important;
        }

        .stat-card-effort .ant-statistic-content-value {
          color: #fa8c16 !important;
        }

        /* 卡片3：绿色 - 进度 */
        .stat-card-progress {
          --card-accent: linear-gradient(90deg, #52c41a, #95de64);
          background: linear-gradient(135deg, #f6ffed 0%, #fcffe6 100%) !important;
        }

        .stat-card-progress .ant-statistic-content-value {
          color: #52c41a !important;
        }

        /* 卡片4：紫色 - 日历 */
        .stat-card-calendar {
          --card-accent: linear-gradient(90deg, #722ed1, #b37feb);
          background: linear-gradient(135deg, #f9f0ff 0%, #fef0ff 100%) !important;
        }

        .stat-card-calendar .ant-statistic-content-value {
          color: #722ed1 !important;
        }

        /* ========================================
           ✨ 需求选择区域样式
           ======================================== */
        .section-card-modern {
          border-radius: 16px !important;
          border: 1px solid #f0f0f0 !important;
          box-shadow: 0 2px 12px rgba(0,0,0,0.04);
          margin-bottom: 20px !important;
          transition: all 0.3s ease;
        }

        .section-card-modern:hover {
          box-shadow: 0 4px 20px rgba(0,0,0,0.08);
        }

        .section-card-modern > .ant-card-head {
          background: linear-gradient(180deg, #fafbfc 0%, #ffffff 100%);
          border-bottom: 2px solid #f0f0f0;
          padding: 0 20px !important;
          min-height: 52px;
        }

        .section-card-modern > .ant-card-head-title {
          font-size: 15px !important;
          font-weight: 700 !important;
          color: #262626 !important;
          padding: 14px 0 !important;
        }

        .section-card-modern > .ant-card-body {
          padding: 20px !important;
        }

        /* 表格样式升级 */
        .modern-story-table .ant-table {
          border-radius: 12px;
          overflow: hidden;
        }

        .modern-story-table .ant-table-thead > tr > th {
          background: linear-gradient(180deg, #fafbfc 0%, #f5f5f5 100%) !important;
          font-weight: 600 !important;
          font-size: 12px !important;
          color: #595959 !important;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          border-bottom: 2px solid #e8e8e8 !important;
          padding: 12px 12px !important;
        }

        .modern-story-table .ant-table-tbody > tr {
          transition: all 0.25s ease;
        }

        .modern-story-table .ant-table-tbody > tr:hover > td {
          background: linear-gradient(90deg, #f0f5ff 0%, #ffffff 100%) !important;
          transform: scale(1.005);
        }

        .modern-story-table .ant-table-tbody > tr > td {
          padding: 10px 12px !important;
          font-size: 12px !important;
          vertical-align: middle;
        }

        /* Checkbox 样式 */
        .modern-checkbox .ant-checkbox-checked .ant-checkbox-inner {
          background-color: #1677ff !important;
          border-color: #1677ff !important;
        }

        /* Priority Tag */
        .priority-tag-modern {
          border-radius: 8px !important;
          font-weight: 700 !important;
          font-size: 11px !important;
          padding: 2px 10px !important;
          min-width: 40px;
          text-align: center;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }

        /* Story Name */
        .story-name-text {
          color: #262626 !important;
          font-size: 12px !important;
          max-width: 350px;
        }

        /* Owner Name */
        .owner-name-text {
          color: #595959 !important;
          font-size: 12px !important;
        }

        /* Effort Value */
        .effort-value-text {
          color: #fa8c16 !important;
          font-weight: 600 !important;
          font-size: 12px !important;
        }

        /* Progress Bar */
        .progress-bar-modern .ant-progress-inner {
          background: #f5f5f5 !important;
          height: 8px !important;
          border-radius: 4px !important;
        }

        .progress-bar-modern .ant-progress-bg {
          height: 8px !important;
          border-radius: 4px !important;
          background: linear-gradient(90deg, #1677ff, #4096ff) !important;
        }

        .progress-bar-modern.ant-progress-status-success .ant-progress-bg {
          background: linear-gradient(90deg, #52c41a, #73d13d) !important;
        }

        /* ========================================
           ✨ 操作按钮区样式
           ======================================== */
        .cta-section-modern {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%) !important;
          border: none !important;
          border-radius: 20px !important;
          padding: 28px !important;
          margin-bottom: 24px !important;
          position: relative;
          overflow: hidden;
          box-shadow: 0 10px 40px rgba(102, 126, 234, 0.35);
        }

        .cta-section-modern::before {
          content: '';
          position: absolute;
          top: -50%;
          left: -20%;
          width: 400px;
          height: 400px;
          background: radial-gradient(circle, rgba(255,255,255,0.12) 0%, transparent 70%);
          animation: ctaGlow 6s ease-in-out infinite;
        }

        @keyframes ctaGlow {
          0%, 100% { transform: translate(0, 0) rotate(0deg); opacity: 0.6; }
          50% { transform: translate(80px, 40px) rotate(180deg); opacity: 1; }
        }

        .cta-button-primary {
          background: rgba(255,255,255,0.95) !important;
          border: none !important;
          color: #667eea !important;
          font-weight: 700 !important;
          font-size: 15px !important;
          height: 48px !important;
          padding: 0 36px !important;
          border-radius: 12px !important;
          box-shadow: 0 4px 16px rgba(0,0,0,0.2) !important;
          transition: all 0.35s cubic-bezier(0.4, 0, 0.2, 1) !important;
          position: relative;
          z-index: 1;
        }

        .cta-button-primary:hover:not(:disabled) {
          transform: translateY(-3px) scale(1.02);
          box-shadow: 0 8px 24px rgba(0,0,0,0.3) !important;
          background: #fff !important;
        }

        .cta-button-secondary {
          background: transparent !important;
          border: 2px solid rgba(255,255,255,0.6) !important;
          color: #fff !important;
          font-weight: 600 !important;
          font-size: 14px !important;
          height: 44px !important;
          padding: 0 24px !important;
          border-radius: 10px !important;
          transition: all 0.3s ease !important;
          position: relative;
          z-index: 1;
        }

        .cta-button-secondary:hover {
          background: rgba(255,255,255,0.15) !important;
          border-color: #fff !important;
          transform: translateY(-2px);
        }

        /* ========================================
           ✨ 分析结果展示样式
           ======================================== */
        .result-alert-modern {
          border-radius: 14px !important;
          border: none !important;
          background: linear-gradient(135deg, #f6ffed 0%, #fcffe6 100%) !important;
          box-shadow: 0 4px 16px rgba(82, 196, 26, 0.15) !important;
          margin-bottom: 20px !important;
        }

        .result-alert-modern .ant-alert-icon {
          font-size: 20px !important;
        }

        .result-alert-modern .ant-alert-message {
          font-size: 15px !important;
          font-weight: 700 !important;
          color: #389e0d !important;
        }

        .result-divider-modern {
          font-size: 17px !important;
          font-weight: 700 !important;
          color: #262626 !important;
          margin: 24px 0 16px !important;

          &::before, &::after {
            border-top-color: #e8e8e8 !important;
          }
        }

        /* 人员负载表 */
        .result-table-modern .ant-table-thead > tr > th {
          background: linear-gradient(180deg, #fafbfc 0%, #f5f5f5 100%) !important;
          font-weight: 600 !important;
          font-size: 12px !important;
          color: #595959 !important;
          border-bottom: 2px solid #e8e8e8 !important;
        }

        .result-table-modern .ant-table-tbody > tr:hover > td {
          background: #f0f5ff !important;
        }

        .result-table-modern .ant-progress-inner {
          height: 10px !important;
          border-radius: 5px !important;
        }

        .result-table-modern .ant-progress-bg {
          height: 10px !important;
          border-radius: 5px !important;
        }

        /* 负载率进度条特殊配色 */
        .load-progress-high .ant-progress-bg {
          background: linear-gradient(90deg, #ff4d4f, #ff7875) !important;
        }

        .load-progress-medium .ant-progress-bg {
          background: linear-gradient(90deg, #faad14, #ffc53d) !important;
        }

        .load-progress-low .ant-progress-bg {
          background: linear-gradient(90deg, #52c41a, #73d13d) !important;
        }

        /* 风险卡片 */
        .risk-card-modern {
          border-radius: 14px !important;
          border: 1px solid #f0f0f0 !important;
          box-shadow: 0 2px 12px rgba(0,0,0,0.04);
        }

        .risk-item-modern {
          padding: 16px !important;
          border-radius: 10px !important;
          transition: all 0.3s ease;
          margin-bottom: 8px !important;
        }

        .risk-item-modern:hover {
          background: #fafafa;
          transform: translateX(4px);
        }

        .risk-icon-high {
          color: #ff4d4f !important;
          font-size: 22px !important;
          animation: riskPulse 2s ease-in-out infinite;
        }

        .risk-icon-medium {
          color: #faad14 !important;
          font-size: 22px !important;
        }

        .risk-icon-low {
          color: #1677ff !important;
          font-size: 22px !important;
        }

        @keyframes riskPulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.15); }
        }

        /* ========================================
           ✨ 历史记录面板
           ======================================== */
        .history-panel-modern {
          border-radius: 14px !important;
          border: 1px solid #e8e8e8 !important;
          box-shadow: 0 4px 20px rgba(0,0,0,0.06);
          margin-bottom: 20px !important;
          animation: slideDown 0.3s ease-out;
        }

        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .history-item-modern {
          padding: 14px 16px !important;
          border-radius: 10px !important;
          transition: all 0.25s ease;
          margin-bottom: 8px !important;
          border: 1px solid transparent;
        }

        .history-item-modern:hover {
          background: #f8f9fe !important;
          border-color: #d6e4ff;
          transform: translateX(4px);
        }

        /* ========================================
           ✨ 响应式设计
           ======================================== */
        @media (max-width: 1400px) {
          .analysis-modal-modern {
            max-width: 95vw !important;
          }

          .analysis-modal-modern .ant-modal-body {
            padding: 24px !important;
          }
        }

        @media (max-width: 1200px) {
          .stat-card-modern .ant-statistic-content {
            font-size: 26px !important;
          }

          .cta-button-primary {
            height: 42px !important;
            padding: 0 28px !important;
            font-size: 14px !important;
          }
        }

        @media (max-width: 768px) {
          .analysis-modal-linear .ant-modal-body {
            padding: 16px !important;
          }

          .stats-bar-linear {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        /* ========================================
           Linear风格 - 分区容器
           ======================================== */
        .section-linear {
          background: #fff;
          border: 1px solid #f0f0f0;
          border-radius: 6px;
          margin-bottom: 16px;
          overflow: hidden;
        }

        .section-header-linear {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 16px;
          border-bottom: 1px solid #f0f0f0;
          background: #fafafa;
          flex-wrap: wrap;
          gap: 8px;
        }

        /* 日期配置块 */
        .date-config-block {
          padding: 16px;
        }

        .date-config-title {
          margin-bottom: 12px;
          display: flex;
          align-items: center;
        }

        /* 操作按钮栏 */
        .action-bar-linear {
          background: #fff;
          border: 1px solid #f0f0f0;
          border-radius: 6px;
          padding: 16px 24px;
          margin-bottom: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 16px;
          flex-wrap: wrap;
        }

        /* ========================================
           表格 - 克制设计
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

        .linear-table .ant-table-tbody > tr {
          transition: background 0.15s ease;
        }

        .linear-table .ant-table-tbody > tr:hover > td {
          background: #fafafa !important;
        }

        .linear-table .ant-table-tbody > tr.table-row-selected > td {
          background: #e6f4ff !important;
        }

        .linear-table .ant-table-tbody > tr > td {
          padding: 8px 12px !important;
          border-bottom: 1px solid #f5f5f5 !important;
          font-size: 12px !important;
        }

        /* 复选框 */
        .modern-checkbox .ant-checkbox-wrapper {
          margin-right: 0 !important;
        }

        /* 优先级标签 */
        .priority-tag-modern {
          border-radius: 4px !important;
          font-size: 11px !important;
          padding: 0 6px !important;
          line-height: 20px !important;
          border: none !important;
          font-weight: 500 !important;
        }

        /* 需求名称文本 */
        .story-name-text {
          color: #1677ff !important;
          font-size: 12px !important;
          cursor: pointer;
          max-width: 320px;
        }

        .story-name-text:hover {
          text-decoration: underline;
        }

        /* 负责人文本 */
        .owner-name-text {
          color: #595959 !important;
          font-size: 12px !important;
          max-width: 100px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          display: inline-block;
        }

        /* 工时数值 */
        .effort-value-text {
          color: #262626 !important;
          font-weight: 500 !important;
          font-size: 12px !important;
        }

        /* 进度条 */
        .progress-bar-modern .ant-progress-inner {
          background: #f0f0f0 !important;
          height: 6px !important;
          border-radius: 3px !important;
        }

        .progress-bar-modern .ant-progress-bg {
          height: 6px !important;
          border-radius: 3px !important;
          background: #1677ff !important;
        }

        .progress-bar-modern.ant-progress-status-success .ant-progress-bg {
          background: #52c41a !important;
        }

        /* ========================================
           历史记录 - 简洁风格
           ======================================== */
        .history-panel-modern {
          border-radius: 6px !important;
          border: 1px solid #f0f0f0 !important;
          box-shadow: none !important;
          margin-bottom: 16px !important;
        }

        .history-panel-modern > .ant-card-head {
          background: #fafafa;
          border-bottom: 1px solid #f0f0f0;
          padding: 8px 16px !important;
          min-height: auto !important;
        }

        .history-panel-modern > .ant-card-body {
          padding: 12px !important;
        }

        .history-item-modern {
          padding: 10px 12px !important;
          border-radius: 4px !important;
          transition: background 0.15s ease;
          margin-bottom: 4px !important;
          border: 1px solid transparent;
        }

        .history-item-modern:hover {
          background: #fafafa;
          border-color: #e6f4ff;
        }

        /* ========================================
           分析结果 - 清晰展示
           ======================================== */
        .result-alert-modern {
          border-radius: 6px !important;
          border: 1px solid #b7eb8f !important;
          background: #f6ffed !important;
          margin-bottom: 16px !important;
        }

        .result-divider-modern {
          font-size: 14px !important;
          font-weight: 600 !important;
          color: #262626 !important;
          margin: 20px 0 12px !important;

          &::before, &::after {
            border-top-color: #f0f0f0 !important;
          }
        }

        /* 结果表格 */
        .result-table-modern .ant-table-thead > tr > th {
          background: #fafafa !important;
          font-weight: 600 !important;
          font-size: 12px !important;
          color: #595959 !important;
          border-bottom: 1px solid #f0f0f0 !important;
        }

        .result-table-modern .ant-table-tbody > tr:hover > td {
          background: #fafafa !important;
        }

        .result-table-modern .ant-progress-inner {
          height: 8px !important;
          border-radius: 4px !important;
        }

        .result-table-modern .ant-progress-bg {
          height: 8px !important;
          border-radius: 4px !important;
        }

        /* 负载率配色 */
        .load-progress-high .ant-progress-bg {
          background: #ff4d4f !important;
        }

        .load-progress-medium .ant-progress-bg {
          background: #faad14 !important;
        }

        .load-progress-low .ant-progress-bg {
          background: #52c41a !important;
        }

        /* 风险卡片 */
        .risk-card-modern {
          border-radius: 6px !important;
          border: 1px solid #f0f0f0 !important;
          box-shadow: none !important;
        }

        .risk-item-modern {
          padding: 12px !important;
          border-radius: 4px !important;
          transition: background 0.15s ease;
          margin-bottom: 4px !important;
        }

        .risk-item-modern:hover {
          background: #fafafa;
        }

        .risk-icon-high { color: #ff4d4f !important; font-size: 18px !important; }
        .risk-icon-medium { color: #faad14 !important; font-size: 18px !important; }
        .risk-icon-low { color: #1677ff !important; font-size: 18px !important; }
      `}</style>

      <Spin spinning={loading || fetchingStories} size="large">

        {/* ========== 统计概览（紧凑条状布局）========== */}
        <div className="stats-bar-linear">
          <div className="stat-item-linear">
            <div className="stat-icon-linear stat-icon-blue">
              <DashboardOutlined />
            </div>
            <div className="stat-content-linear">
              <div className="stat-label-linear">选中需求</div>
              <div className="stat-value-linear">
                {selectedStoryIds.size}
                <span className="stat-suffix-linear">/ {allStories.length}</span>
              </div>
            </div>
          </div>

          <div className="stat-item-linear">
            <div className="stat-icon-linear stat-icon-orange">
              <ClockCircleOutlined />
            </div>
            <div className="stat-content-linear">
              <div className="stat-label-linear">总估算工时</div>
              <div className="stat-value-linear">
                {totalEffort}
                <span className="stat-suffix-linear">h</span>
              </div>
            </div>
          </div>

          <div className="stat-item-linear">
            <div className="stat-icon-linear stat-icon-green">
              <BarChartOutlined />
            </div>
            <div className="stat-content-linear">
              <div className="stat-label-linear">平均进度</div>
              <div className="stat-value-linear" style={{ color: avgProgress >= 50 ? '#52c41a' : '#faad14' }}>
                {avgProgress}
                <span className="stat-suffix-linear">%</span>
              </div>
            </div>
          </div>

          <div className="stat-item-linear">
            <div className="stat-icon-linear stat-icon-purple">
              <CalendarOutlined />
            </div>
            <div className="stat-content-linear">
              <div className="stat-label-linear">加班日/节假日</div>
              <div className="stat-value-linear">
                {extraWorkdays.length}/{holidays.length}
              </div>
            </div>
          </div>
        </div>

        {/* ========== 需求筛选区域 ========== */}
        <div className="section-linear">
          <div className="section-header-linear">
            <Space>
              <FilterOutlined style={{ color: '#1677ff', fontSize: 14 }} />
              <span style={{ fontWeight: 600, fontSize: 14, color: '#262626' }}>需求筛选</span>
              <Text type="secondary" style={{ fontSize: 12 }}>
                勾选需要参与排期分析的需求
              </Text>
            </Space>
            <Space wrap size="small">
              <Button size="small" onClick={() => handleSelectAll(true)} type="primary" ghost>全选</Button>
              <Button size="small" onClick={handleClearSelection}>清空</Button>
              <Button size="small" onClick={handleInvertSelection}>反选</Button>
              <Divider type="vertical" />
              <Select
                size="small"
                placeholder="按优先级筛选"
                style={{ width: 150 }}
                allowClear
                onChange={(value) => {
                  if (value) {
                    const [min, max] = value.split('-').map(Number);
                    handleSelectByPriority(min, max);
                  }
                }}
              >
                <Option value="0-1">P0-P1（紧急）</Option>
                <Option value="2-3">P2-P3（重要）</Option>
                <Option value="4-5">P4-P5（一般）</Option>
                <Option value="6-7">P6-P7（低优先）</Option>
              </Select>
            </Space>
          </div>
          <Table
            dataSource={allStories}
            columns={storyColumns}
            rowKey="id"
            size="small"
            pagination={{
              pageSize: 10,
              showSizeChanger: true,
              pageSizeOptions: ['10', '20', '50'],
              showTotal: (total) => `共 ${total} 个需求`,
              size: 'default',
            }}
            scroll={{ y: 380 }}
            rowClassName={(record) =>
              selectedStoryIds.has(record.id) ? 'table-row-selected' : ''
            }
            className="linear-table"
            bordered={false}
          />
        </div>

        {/* ========== 日期配置区域（并排布局）========== */}
        <div className="section-linear">
          <Row gutter={24}>
            <Col xs={24} md={12}>
              <div className="date-config-block">
                <div className="date-config-title">
                  <CalendarOutlined style={{ color: '#52c41a', marginRight: 6 }} />
                  <span style={{ fontWeight: 600, fontSize: 13, color: '#262626' }}>加班日</span>
                  <Text type="secondary" style={{ fontSize: 12, marginLeft: 8 }}>额外工作日</Text>
                </div>
                <DatePicker
                  onChange={addExtraWorkday}
                  placeholder="选择加班日期"
                  style={{ width: '100%', marginBottom: 10 }}
                  size="middle"
                />
                {extraWorkdays.length > 0 ? (
                  <div>
                    {extraWorkdays.map(date => (
                      <Tag
                        key={date}
                        color="green"
                        closable
                        onClose={() => removeExtraWorkday(date)}
                        style={{ marginBottom: 4, borderRadius: 4, padding: '2px 8px', fontSize: 12 }}
                      >
                        {date}
                      </Tag>
                    ))}
                  </div>
                ) : (
                  <Text type="secondary" style={{ fontSize: 12 }}>未设置（周末不计入工作日）</Text>
                )}
              </div>
            </Col>

            <Col xs={24} md={12}>
              <div className="date-config-block">
                <div className="date-config-title">
                  <CalendarOutlined style={{ color: '#ff4d4f', marginRight: 6 }} />
                  <span style={{ fontWeight: 600, fontSize: 13, color: '#262626' }}>节假日</span>
                  <Text type="secondary" style={{ fontSize: 12, marginLeft: 8 }}>休息日</Text>
                </div>
                <DatePicker
                  onChange={addHoliday}
                  placeholder="选择节假日"
                  style={{ width: '100%', marginBottom: 10 }}
                  size="middle"
                />
                {holidays.length > 0 ? (
                  <div>
                    {holidays.map(date => (
                      <Tag
                        key={date}
                        color="red"
                        closable
                        onClose={() => removeHoliday(date)}
                        style={{ marginBottom: 4, borderRadius: 4, padding: '2px 8px', fontSize: 12 }}
                      >
                        {date}
                      </Tag>
                    ))}
                  </div>
                ) : (
                  <Text type="secondary" style={{ fontSize: 12 }}>未设置（工作日均计入容量）</Text>
                )}
              </div>
            </Col>
          </Row>
        </div>

        {/* ========== 高级选项 ========== */}
        <div className="section-linear">
          <div className="section-header-linear">
            <Space>
              <SafetyCertificateOutlined style={{ color: '#722ed1', fontSize: 14 }} />
              <span style={{ fontWeight: 600, fontSize: 14, color: '#262626' }}>高级选项</span>
            </Space>
          </div>
          <Row align="middle" gutter={[24, 12]}>
            <Col xs={24} sm={12} md={8}>
              <Space size="middle">
                <Text strong style={{ fontSize: 13 }}>每日工作时长</Text>
                <InputNumber
                  min={1}
                  max={24}
                  value={dailyCapacityH}
                  onChange={(val) => setDailyCapacityH(val || 8)}
                  addonAfter="小时"
                  size="middle"
                  style={{ width: 140 }}
                />
              </Space>
            </Col>
            <Col xs={24} sm={12} md={16}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                人员容量 = 工作日数 × 每日工时
              </Text>
            </Col>
          </Row>
        </div>

        {/* ========== 操作按钮区 ========== */}
        <div className="action-bar-linear">
          <Button
            type="primary"
            size="large"
            icon={<SendOutlined />}
            onClick={handleAnalyze}
            loading={loading}
            disabled={selectedStoryIds.size === 0}
            style={{ minWidth: 180 }}
          >
            开始分析（{selectedStoryIds.size}个需求）
          </Button>

          {data && (
            <Space size="middle">
              <Button
                icon={<FileTextOutlined />}
                onClick={handleGenerateReport}
              >
                生成报告
              </Button>
              {htmlReport && (
                <>
                  <Button
                    icon={<EyeOutlined />}
                    onClick={() => {
                      const win = window.open('', '_blank');
                      if (win) {
                        win.document.write(htmlReport);
                        win.document.close();
                      }
                    }}
                  >
                    预览
                  </Button>
                  <Button
                    icon={<DownloadOutlined />}
                    onClick={handleDownloadReport}
                  >
                    下载
                  </Button>
                </>
              )}
            </Space>
          )}
        </div>

        {/* ========== ✨ 历史记录面板（动画展开）========== */}
        {showHistory && history.length > 0 && (
          <Card
            className="history-panel-modern"
            title={
              <Space>
                <HistoryOutlined style={{ color: '#722ed1' }} />
                <span>分析历史</span>
                <Badge count={history.length} style={{ backgroundColor: '#722ed1' }} />
              </Space>
            }
            extra={
              <Space>
                <Button
                  type="link"
                  danger
                  size="small"
                  onClick={handleClearHistory}
                >
                  清空全部
                </Button>
                <Button
                  type="link"
                  size="small"
                  onClick={() => setShowHistory(false)}
                >
                  收起
                </Button>
              </Space>
            }
          >
            <List
              dataSource={history}
              renderItem={(item) => (
                <List.Item
                  className="history-item-modern"
                  actions={[
                    <Button
                      key="load"
                      type="primary"
                      size="small"
                      ghost
                      icon={<ReloadOutlined />}
                      onClick={() => handleLoadFromHistory(item)}
                      style={{ borderRadius: '8px' }}
                    >
                      加载
                    </Button>,
                    <Button
                      key="delete"
                      type="link"
                      danger
                      size="small"
                      icon={<DeleteOutlined />}
                      onClick={() => handleDeleteHistory(item.id)}
                    />,
                  ]}
                >
                  <List.Item.Meta
                    avatar={
                      <Avatar
                        style={{
                          backgroundColor: item.result ? '#52c41a' : '#1890ff',
                          fontSize: 14,
                          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                        }}
                        icon={item.result ? <CheckCircleOutlined /> : <ClockCircleOutlined />}
                      />
                    }
                    title={
                      <Text ellipsis style={{ maxWidth: 450, fontWeight: 600, fontSize: 13 }}>
                        {item.description}
                      </Text>
                    }
                    description={
                      <Space size={16} wrap>
                        <Text type="secondary" style={{ fontSize: 11 }}>
                          {new Date(item.timestamp).toLocaleString('zh-CN')}
                        </Text>
                        {item.config.extraWorkdays.length > 0 && (
                          <Tag color="green" style={{ fontSize: 10, borderRadius: '6px' }}>
                            加班{item.config.extraWorkdays.length}天
                          </Tag>
                        )}
                        {item.config.holidays.length > 0 && (
                          <Tag color="red" style={{ fontSize: 10, borderRadius: '6px' }}>
                            放假{item.config.holidays.length}天
                          </Tag>
                        )}
                        {item.result && (
                          <Tag color="blue" style={{ fontSize: 10, borderRadius: '6px' }}>
                            {item.result.stories.length}个Story
                          </Tag>
                        )}
                      </Space>
                    }
                  />
                </List.Item>
              )}
            />
          </Card>
        )}

        {/* ========== ✨ 分析结果展示（数据可视化增强）========== */}
        {data && !showHistory && (
          <>
            <Divider className="result-divider-modern" orientation="left">
              <Space>
                <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 20 }} />
                <span>分析结果</span>
              </Space>
            </Divider>

            {/* 结果概要 Alert */}
            <Alert
              className="result-alert-modern"
              message={`✅ 分析完成！共 ${data.stories.length} 个需求，${data.persons.length} 名成员`}
              description={
                <Space wrap size="middle">
                  <Tag
                    color="#ff4d4f"
                    style={{
                      fontSize: 13,
                      padding: '4px 14px',
                      borderRadius: '8px',
                      fontWeight: 600,
                    }}
                  >
                    ⚠️ 超载 {data.totals.overloadCount} 人
                  </Tag>
                  <Tag
                    color="#faad14"
                    style={{
                      fontSize: 13,
                      padding: '4px 14px',
                      borderRadius: '8px',
                      fontWeight: 600,
                    }}
                  >
                    🔶 高负载 {data.totals.normalCount} 人
                  </Tag>
                  <Tag
                    color="#52c41a"
                    style={{
                      fontSize: 13,
                      padding: '4px 14px',
                      borderRadius: '8px',
                      fontWeight: 600,
                    }}
                  >
                  ✅ 轻负载 {data.totals.lightCount} 人
                  </Tag>
                  <Tag
                    color="#1677ff"
                    style={{
                      fontSize: 13,
                      padding: '4px 14px',
                      borderRadius: '8px',
                      fontWeight: 600,
                    }}
                  >
                    📊 总工时 {data.totals.totalEffort}h
                  </Tag>
                </Space>
              }
              type="success"
              showIcon
              action={
                <Button
                  size="middle"
                  type="primary"
                  onClick={handleGenerateReport}
                  style={{ borderRadius: '8px', fontWeight: 600 }}
                >
                  生成详细报告
                </Button>
              }
            />

            {/* 人员负载表 */}
            <Table
              dataSource={data.persons}
              rowKey="name"
              size="middle"
              pagination={false}
              scroll={{ x: 900 }}
              className="result-table-modern"
              bordered={false}
              columns={[
                {
                  title: '姓名',
                  dataIndex: 'name',
                  fixed: 'left',
                  width: 110,
                  render: (name: string) => (
                    <Text strong style={{ fontSize: 13 }}>{name}</Text>
                  ),
                },
                {
                  title: '角色',
                  dataIndex: 'role',
                  width: 130,
                  render: (role: string) => (
                    <Tag
                      color="blue"
                      style={{
                        borderRadius: '6px',
                        padding: '2px 10px',
                        fontWeight: 500,
                        fontSize: 12,
                      }}
                    >
                      {role}
                    </Tag>
                  ),
                },
                { title: '工时(h)', dataIndex: 'effort', width: 85, sorter: (a, b) => a.effort - b.effort },
                { title: '已完成(h)', dataIndex: 'completed', width: 95 },
                { title: '容量(h)', dataIndex: 'capacity', width: 85 },
                {
                  title: '负载率',
                  dataIndex: 'loadPct',
                  width: 140,
                  sorter: (a, b) => a.loadPct - b.loadPct,
                  render: (pct: number) => {
                    let className = 'load-progress-low';
                    if (pct > 100) className = 'load-progress-high';
                    else if (pct > 80) className = 'load-progress-medium';

                    return (
                      <Progress
                        percent={Math.min(pct, 200)}
                        size="small"
                        status={pct > 100 ? 'exception' : pct > 80 ? 'normal' : 'success'}
                        format={() => `${pct}%`}
                        className={className}
                      />
                    );
                  },
                },
                { title: '工作天数', dataIndex: 'workDays', width: 95 },
                { title: '任务数', dataIndex: 'taskCount', width: 75 },
                { title: '需求数', dataIndex: 'storyCount', width: 75 },
              ]}
            />

            {/* 风险提示卡片 */}
            {data.risks.length > 0 && (
              <Card
                className="risk-card-modern"
                title={
                  <Space>
                    <WarningOutlined style={{ color: '#ff4d4f', fontSize: 18 }} />
                    <span style={{ fontSize: 15, fontWeight: 700 }}>风险提示</span>
                    <Badge count={data.risks.length} style={{ backgroundColor: '#ff4d4f' }} />
                  </Space>
                }
                style={{ marginTop: 20 }}
              >
                <List
                  dataSource={data.risks}
                  renderItem={(risk) => (
                    <List.Item className="risk-item-modern">
                      <List.Item.Meta
                        avatar={
                          risk.level === 'high'
                            ? <WarningOutlined className="risk-icon-high" />
                            : risk.level === 'medium'
                            ? <ExclamationCircleOutlined className="risk-icon-medium" />
                            : <InfoCircleOutlined className="risk-icon-low" />
                        }
                        title={
                          <Text strong style={{ fontSize: 14 }}>
                            {risk.title}
                          </Text>
                        }
                        description={
                          <Paragraph
                            style={{
                              marginBottom: 0,
                              fontSize: 13,
                              color: '#595959',
                              lineHeight: 1.6,
                            }}
                          >
                            {risk.description}
                          </Paragraph>
                        }
                      />
                    </List.Item>
                  )}
                />
              </Card>
            )}
          </>
        )}
      </Spin>
    </Modal>
  );
});

// ✅ 设置 displayName（便于调试）
IterationAnalysisModal.displayName = 'IterationAnalysisModal';

export default IterationAnalysisModal;
