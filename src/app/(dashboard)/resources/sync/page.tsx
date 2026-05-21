'use client';

import React, { useState, useCallback, useRef } from 'react';
import {
  Card,
  Steps,
  Form,
  Input,
  Button,
  Table,
  Tag,
  Select,
  DatePicker,
  message,
  Spin,
  Progress,
  Tabs,
  InputNumber,
  Statistic,
  Row,
  Col,
  Typography,
  Checkbox,
  Space,
} from 'antd';
import {
  ApiOutlined,
  CloudSyncOutlined,
  CloudDownloadOutlined,
  SettingOutlined,
  ExportOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ReloadOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import * as XLSX from 'xlsx';
import dayjs, { Dayjs } from 'dayjs';
import { useTapdConfigStore } from '@/stores/tapd-config.store';

// ==================== 类型定义 ====================

/** API 连接配置 */
/** 连接状态 */
type ConnectionStatus = 'idle' | 'testing' | 'connected' | 'failed';

/** TAPD 项目（保留类型供后续使用） */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface TapdProject {
  id: string;
  name: string;
}

/** 拉取进度 */
interface FetchProgress {
  stage: string;
  percent: number;
  storyCount: number;
  taskCount: number;
  personCount: number;
  elapsed: number;
}

/** 统计数据 */
interface Statistics {
  totalStories: number;
  totalTasks: number;
  totalRequirement: number;
  personCount: number;
}

/** 人员统计 */
interface PersonStat {
  name: string;
  count: number;
  ratio: number;
}

/** 字段映射 */
interface FieldMapping {
  costField: string;
  projectField: string;
  okrField: string;
}

/** 需求数规则 */
interface RequirementRule {
  maxHours: number;
  value: number;
}

/** 处理后的数据行 */
interface ProcessedRow {
  type: 'S' | 'T';
  id: string;
  name: string;
  workspace: string;
  status: string;
  costField: string;
  projectField: string;
  okrField: string;
  iteration: string;
  owner: string;
  creator: string;
  estimated: number;
  consumed: number;
  created: string;
  completed: string;
  onTime: string;
  changeType: string;
  smokePass: string;
  requirementCount: number;
  [key: string]: unknown;
}

// ==================== 常量定义 ====================

/** 默认需求数规则 */
const DEFAULT_RULES: RequirementRule[] = [
  { maxHours: 8, value: 0.5 },
  { maxHours: 16, value: 0.7 },
  { maxHours: 24, value: 1.0 },
  { maxHours: 48, value: 1.5 },
  { maxHours: Infinity, value: 1.8 },
];

/** 默认字段映射 */
const DEFAULT_FIELD_MAPPING: FieldMapping = {
  costField: 'custom_field_eight',     // 成本归属
  projectField: 'custom_field_13',     // 项目归属
  okrField: 'custom_field_one',        // 冒烟通过
};

/** 预置 TAPD 项目列表 */
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
];

/** 需求状态选项 */
const STATUS_OPTIONS = [
  '规划中',
  '开发中',
  '待测试',
  '测试中',
  'T测试完',
  '待发布',
  '已发布',
  '已实现',
  '已关闭',
];

/** 自定义字段选项 */
const CUSTOM_FIELD_OPTIONS = [
  { label: 'custom_field_one（是否冒烟通过）', value: 'custom_field_one' },
  { label: 'custom_field_two（按时提测）', value: 'custom_field_two' },
  { label: 'custom_field_three（是否插入或变更需求）', value: 'custom_field_three' },
  { label: 'custom_field_four（故事优先级）', value: 'custom_field_four' },
  { label: 'custom_field_five（备注）', value: 'custom_field_five' },
  { label: 'custom_field_six（初评是否通过）', value: 'custom_field_six' },
  { label: 'custom_field_seven（需求方）', value: 'custom_field_seven' },
  { label: 'custom_field_eight（成本归属）', value: 'custom_field_eight' },
  { label: 'custom_field_9（发布端口）', value: 'custom_field_9' },
  { label: 'custom_field_10（前端代码已合）', value: 'custom_field_10' },
  { label: 'custom_field_11（后端代码已合）', value: 'custom_field_11' },
  { label: 'custom_field_12（BI提测时间）', value: 'custom_field_12' },
  { label: 'custom_field_13（项目归属）', value: 'custom_field_13' },
  { label: 'custom_field_14', value: 'custom_field_14' },
  { label: 'custom_field_15', value: 'custom_field_15' },
  { label: 'custom_field_16', value: 'custom_field_16' },
  { label: 'custom_field_17', value: 'custom_field_17' },
  { label: 'custom_field_18', value: 'custom_field_18' },
  { label: 'custom_field_19', value: 'custom_field_19' },
  { label: 'custom_field_20', value: 'custom_field_20' },
  { label: 'custom_field_21', value: 'custom_field_21' },
  { label: 'custom_field_22', value: 'custom_field_22' },
  { label: 'custom_field_23', value: 'custom_field_23' },
  { label: 'custom_field_24', value: 'custom_field_24' },
  { label: 'custom_field_25', value: 'custom_field_25' },
  { label: 'custom_field_26', value: 'custom_field_26' },
  { label: 'custom_field_27', value: 'custom_field_27' },
  { label: 'custom_field_28', value: 'custom_field_28' },
  { label: 'custom_field_29', value: 'custom_field_29' },
  { label: 'custom_field_30', value: 'custom_field_30' },
];

/** 步骤标题 */
const STEP_TITLES = ['API 连接', '查询条件', '拉取数据', '处理计算', '导出结果'];

const { Title, Text, Paragraph } = Typography;
const { RangePicker } = DatePicker;

// ==================== 主组件 ====================

export default function DataSyncPage() {
  // ---- 步骤状态 ----
  const [currentStep, setCurrentStep] = useState<number>(0);

  // ---- Step 0: API 连接配置 ----
  // ---- TAPD 全局配置 ----
  const { config: apiConfig, isConfigured } = useTapdConfigStore();
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>(isConfigured ? 'connected' : 'idle');
  const [connectionError, setConnectionError] = useState<string>('');

  // ---- Step 1: 查询条件 ----
  // TAPD 项目列表（TAPD API 不支持获取项目列表，改为手动输入）
  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs] | null>(null);
  const [completeRange, setCompleteRange] = useState<[Dayjs, Dayjs] | null>(null);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);

  // ---- Step 2: 数据拉取 ----
  const [isFetching, setIsFetching] = useState<boolean>(false);
  const [fetchProgress, setFetchProgress] = useState<FetchProgress>({
    stage: '',
    percent: 0,
    storyCount: 0,
    taskCount: 0,
    personCount: 0,
    elapsed: 0,
  });
  const [rawStories, setRawStories] = useState<Record<string, unknown>[]>([]);
  const [customFieldMapping, setCustomFieldMapping] = useState<Record<string, Record<string, string>>>({});
  const [rawTasks, setRawTasks] = useState<Record<string, unknown>[]>([]);
  const fetchTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ---- Step 3: 处理计算 ----
  const [processedData, setProcessedData] = useState<ProcessedRow[]>([]);
  const [statistics, setStatistics] = useState<Statistics>({
    totalStories: 0,
    totalTasks: 0,
    totalRequirement: 0,
    personCount: 0,
  });
  const [personStats, setPersonStats] = useState<PersonStat[]>([]);
  const [fieldMapping, setFieldMapping] = useState<FieldMapping>({ ...DEFAULT_FIELD_MAPPING });
  const [rules, setRules] = useState<RequirementRule[]>([...DEFAULT_RULES]);
  const [activeTab, setActiveTab] = useState<string>('result');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  // ---- Step 4: 导出 ----
  const [exportFileName, setExportFileName] = useState<string>(
    `TAPD数据同步_${dayjs().format('YYYYMMDD_HHmmss')}`,
  );
  const [exportOptions, setExportOptions] = useState({
    includeRaw: true,
    includeProcessed: true,
    includeStats: true,
  });

  // ==================== TAPD API 调用（通过服务端代理，避免 CORS） ====================

  /** 通过后端代理调用 TAPD API */
  const tapdProxy = useCallback(async (action: string, params?: Record<string, unknown>) => {
    const res = await fetch('/api/v1/resources/tapd/proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        apiUser: apiConfig.apiUser,
        apiPassword: apiConfig.apiPassword,
        action,
        ...params,
      }),
    });
    const data = await res.json();
    if (!data.success) {
      throw new Error(data.message || '请求失败');
    }
    return data;
  }, [apiConfig]);

  // ==================== Step 0: API 连接测试 ====================

  const handleTestConnection = useCallback(async () => {
    if (!apiConfig.apiUser || !apiConfig.apiPassword) {
      message.warning('请先在系统设置中配置 TAPD API 凭据');
      return;
    }

    setConnectionStatus('testing');
    try {
      await tapdProxy('test-auth');

      setConnectionStatus('connected');
      setConnectionError('');
      message.success('TAPD API 连接成功');
    } catch (err) {
      setConnectionStatus('failed');
      const errorMsg = err instanceof Error ? err.message : '连接失败';
      message.error(errorMsg);
      setConnectionError(errorMsg);
    }
  }, [apiConfig, tapdProxy]);

  // ==================== Step 1: 拉取数据 ====================

  const handleFetchData = useCallback(async () => {
    if (selectedProjects.length === 0) {
      message.warning('请至少选择一个项目');
      return;
    }

    setIsFetching(true);
    setFetchProgress({
      stage: '正在拉取 Story 需求...',
      percent: 10,
      storyCount: 0,
      taskCount: 0,
      personCount: 0,
      elapsed: 0,
    });

    const startTime = Date.now();

    // 启动计时器
    fetchTimerRef.current = setInterval(() => {
      setFetchProgress((prev) => ({
        ...prev,
        elapsed: Math.round((Date.now() - startTime) / 1000),
      }));
    }, 1000);

    try {
      // 1. 逐项目拉取 Stories（避免单次请求超时）
      const allStories: Record<string, unknown>[] = [];
      const allCustomFieldMapping: Record<string, Record<string, string>> = {};

      for (let i = 0; i < selectedProjects.length; i++) {
        const wsId = selectedProjects[i];
        setFetchProgress((prev) => ({
          ...prev,
          stage: `正在拉取 Story 需求... (${i + 1}/${selectedProjects.length})`,
          percent: 10 + Math.round((i / selectedProjects.length) * 40),
        }));

        const storiesData = await tapdProxy('fetch-stories', {
          workspaceIds: [wsId],
          createdBegin: dateRange ? dateRange[0].format('YYYY-MM-DD HH:mm:ss') : undefined,
          createdEnd: dateRange ? dateRange[1].format('YYYY-MM-DD HH:mm:ss') : undefined,
          completedBegin: completeRange ? completeRange[0].format('YYYY-MM-DD HH:mm:ss') : undefined,
          completedEnd: completeRange ? completeRange[1].format('YYYY-MM-DD HH:mm:ss') : undefined,
          status: selectedStatuses.length > 0 ? selectedStatuses : undefined,
        });

        const stories = storiesData.stories || [];
        allStories.push(...stories);
        if (storiesData.customFieldMapping) {
          Object.assign(allCustomFieldMapping, storiesData.customFieldMapping);
        }

        // 每次请求后等待 500ms，避免触发 TAPD API 速率限制
        if (i < selectedProjects.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }

      setRawStories(allStories);
      if (Object.keys(allCustomFieldMapping).length > 0) {
        setCustomFieldMapping(allCustomFieldMapping);
      }

      setFetchProgress((prev) => ({
        ...prev,
        storyCount: allStories.length,
        percent: 55,
        stage: '正在拉取 Task 任务...',
      }));

      // 2. 逐项目拉取 Tasks（避免单次请求超时）
      const allTasks: Record<string, unknown>[] = [];
      const storyIds = allStories.map((s) => String(s['id'] || '')).filter(Boolean);

      for (let i = 0; i < selectedProjects.length; i++) {
        const wsId = selectedProjects[i];
        setFetchProgress((prev) => ({
          ...prev,
          stage: `正在拉取 Task 任务... (${i + 1}/${selectedProjects.length})`,
          percent: 55 + Math.round((i / selectedProjects.length) * 35),
        }));

        const tasksData = await tapdProxy('fetch-tasks', {
          workspaceIds: [wsId],
          storyIds,
        });

        const tasks = tasksData.tasks || [];
        allTasks.push(...tasks);

        // 每次请求后等待 500ms，避免触发 TAPD API 速率限制
        if (i < selectedProjects.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }

      setRawTasks(allTasks);

      // 3. 统计人员
      const personSet = new Set<string>();
      allStories.forEach((s: Record<string, unknown>) => {
        const owner = String(s['owner'] || '');
        if (owner) personSet.add(owner);
      });
      allTasks.forEach((t: Record<string, unknown>) => {
        const owner = String(t['owner'] || '');
        if (owner) personSet.add(owner);
      });

      setFetchProgress({
        stage: '数据拉取完成',
        percent: 100,
        storyCount: allStories.length,
        taskCount: allTasks.length,
        personCount: personSet.size,
        elapsed: Math.round((Date.now() - startTime) / 1000),
      });

      message.success(`拉取完成：${allStories.length} 个 Story，${allTasks.length} 个 Task`);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : '拉取数据失败';
      message.error(errorMsg);
      setFetchProgress((prev) => ({
        ...prev,
        stage: `拉取失败: ${errorMsg}`,
        percent: prev.percent,
      }));
    } finally {
      setIsFetching(false);
      if (fetchTimerRef.current) {
        clearInterval(fetchTimerRef.current);
        fetchTimerRef.current = null;
      }
    }
  }, [selectedProjects, dateRange, completeRange, selectedStatuses, tapdProxy]);

  // ==================== Step 3: 处理数据 ====================

  const handleProcessData = useCallback(async () => {
    setIsProcessing(true);
    try {
      const res = await fetch('/api/v1/resources/tapd/process-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stories: rawStories,
          tasks: rawTasks,
          rules: { ranges: rules },
          fieldMapping,
          apiUser: apiConfig.apiUser,
          apiPassword: apiConfig.apiPassword,
          customFieldMapping,
        }),
      });
      const data = await res.json();

      if (!data.success) {
        throw new Error(data.message || '处理数据失败');
      }

      // 转换处理后的数据
      const rows: ProcessedRow[] = [];
      const processedStories = data.processedData || [];
      const processedTasks = data.processedTasks || [];

      // 建立 Story -> Task 映射（使用后端处理后的 tasks）
      const storyTaskMap = new Map<string, Record<string, unknown>[]>();
      for (const task of processedTasks) {
        const parentId = String(task['story_id'] ?? '');
        if (parentId) {
          if (!storyTaskMap.has(parentId)) {
            storyTaskMap.set(parentId, []);
          }
          storyTaskMap.get(parentId)!.push(task);
        }
      }

      // 处理 Story 行
      for (const story of processedStories) {
        const storyId = String(story['id'] ?? '');
        const wsId = String(story['workspace_id'] ?? '');
        const wsMapping = customFieldMapping[wsId] || {};

        // 通过 custom_fields_settings API 动态获取字段映射
        // 每个项目的自定义字段编号不同，不能用硬编码
        const costFieldName = wsMapping['成本归属'] || 'custom_field_eight';
        const projectFieldName = wsMapping['项目归属'] || 'custom_field_13';
        const smokeFieldName = wsMapping['是否冒烟通过'] || 'custom_field_one';
        const onTimeFieldName = wsMapping['按时提测'] || 'custom_field_two';
        const changeFieldName = wsMapping['是否插入或变更需求'] || wsMapping['是否插入需求'] || 'custom_field_three';

        rows.push({
          type: 'S',
          id: storyId,
          name: String(story['name'] ?? ''),
          workspace: String(story['workspace_name'] ?? story['workspace_id'] ?? ''),
          status: String(story['status'] ?? ''),
          costField: String(story[costFieldName] ?? ''),
          projectField: String(story[projectFieldName] ?? ''),
          okrField: String(story[smokeFieldName] ?? ''),
          iteration: String(story['iteration_name'] ?? story['iteration_id'] ?? ''),
          owner: String(story['owner'] ?? ''),
          creator: String(story['creator'] ?? ''),
          estimated: Number(story['effort'] ?? story['task_estimated'] ?? 0),
          consumed: Number(story['effort_completed'] ?? story['task_completed'] ?? 0),
          created: String(story['created'] ?? ''),
          completed: String(story['completed'] ?? ''),
          onTime: String(story[onTimeFieldName] ?? ''),
          changeType: String(story[changeFieldName] ?? ''),
          smokePass: String(story[smokeFieldName] ?? ''),
          requirementCount: Number(story['requirement_count'] ?? 0),
        });

        // 处理关联的 Task 行
        const relatedTasks = storyTaskMap.get(storyId) || [];
        for (const task of relatedTasks) {
          const taskWsId = String(task['workspace_id'] ?? '');
          const taskWsMapping = customFieldMapping[taskWsId] || {};
          const taskCostFieldName = taskWsMapping['成本归属'] || 'custom_field_eight';
          const taskProjectFieldName = taskWsMapping['项目归属'] || 'custom_field_13';

          rows.push({
            type: 'T',
            id: String(task['id'] ?? ''),
            name: String(task['name'] ?? ''),
            workspace: String(task['workspace_name'] ?? task['workspace_id'] ?? ''),
            status: String(task['status'] ?? ''),
            costField: String(task[taskCostFieldName] ?? ''),
            projectField: String(task[taskProjectFieldName] ?? ''),
            okrField: '-',
            iteration: String(task['iteration_name'] ?? task['iteration_id'] ?? ''),
            owner: String(task['owner'] ?? ''),
            creator: String(task['creator'] ?? ''),
            estimated: Number(task['effort'] ?? 0),
            consumed: Number(task['effort_completed'] ?? 0),
            created: String(task['created'] ?? ''),
            completed: String(task['completed'] ?? ''),
            onTime: '-',
            changeType: '-',
            smokePass: '-',
            requirementCount: 0,
          });
        }
      }

      setProcessedData(rows);
      setStatistics(data.statistics || {
        totalStories: 0,
        totalTasks: 0,
        totalRequirement: 0,
        personCount: 0,
      });
      setPersonStats(data.personStats || []);

      message.success('数据处理完成');
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : '处理数据失败';
      message.error(errorMsg);
    } finally {
      setIsProcessing(false);
    }
  }, [rawStories, rawTasks, rules, fieldMapping, customFieldMapping]);

  // ==================== Step 4: 导出 Excel ====================

  const handleExportExcel = useCallback(() => {
    try {
      const wb = XLSX.utils.book_new();

      // Sheet 1: TAPD 原始数据
      if (exportOptions.includeRaw) {
        // Stories
        if (rawStories.length > 0) {
          const ws1 = XLSX.utils.json_to_sheet(rawStories);
          XLSX.utils.book_append_sheet(wb, ws1, 'Story原始数据');
        }

        // Tasks
        if (rawTasks.length > 0) {
          const ws2 = XLSX.utils.json_to_sheet(rawTasks);
          XLSX.utils.book_append_sheet(wb, ws2, 'Task原始数据');
        }
      }

      // Sheet 2: 处理后数据
      if (exportOptions.includeProcessed && processedData.length > 0) {
        const processedRows = processedData.map((row) => ({
          类型: row.type === 'S' ? 'Story' : 'Task',
          ID: row.id,
          标题: row.name,
          所属项目: row.workspace,
          状态: row.status,
          成本归属: row.costField,
          项目归属: row.projectField,
          OKR名称: row.okrField,
          迭代: row.iteration,
          处理人: row.owner,
          创建人: row.creator,
          预估工时: row.estimated,
          完成工时: row.consumed,
          创建时间: row.created,
          完成时间: row.completed,
          按时提测: row.onTime,
          插入变更: row.changeType,
          冒烟通过: row.smokePass,
          需求数: row.requirementCount,
        }));
        const ws3 = XLSX.utils.json_to_sheet(processedRows);
        XLSX.utils.book_append_sheet(wb, ws3, '处理后数据');
      }

      // Sheet 3: 需求数统计
      if (exportOptions.includeStats && personStats.length > 0) {
        const statsRows = personStats.map((p, index) => ({
          排名: index + 1,
          处理人: p.name,
          需求数: p.count,
          占比: `${p.ratio}%`,
        }));
        const ws4 = XLSX.utils.json_to_sheet(statsRows);
        XLSX.utils.book_append_sheet(wb, ws4, '需求数统计');
      }

      // 使用 write + Blob 下载（比 writeFile 更可靠）
      const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([wbout], { type: 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${exportFileName}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      message.success('Excel 导出成功');
    } catch (err) {
      console.error('导出 Excel 失败:', err);
      message.error(`导出失败: ${err instanceof Error ? err.message : '未知错误'}`);
    }
  }, [rawStories, rawTasks, processedData, personStats, exportOptions, exportFileName]);

  // ==================== 重置条件 ====================

  const handleResetConditions = useCallback(() => {
    setSelectedProjects([]);
    setDateRange(null);
    setCompleteRange(null);
    setSelectedStatuses([]);
    message.info('查询条件已重置');
  }, []);

  // ==================== 重置规则 ====================

  const handleResetRules = useCallback(() => {
    setRules([...DEFAULT_RULES]);
    message.info('规则已重置为默认值');
  }, []);

  // ==================== 应用规则 ====================

  const handleApplyRules = useCallback(() => {
    // 规则会在处理数据时使用
    message.success('规则已应用，请点击"处理数据"按钮');
  }, []);

  // ==================== 表格列定义 ====================

  const processedColumns = [
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 60,
      fixed: 'left' as const,
      render: (type: string) => (
        <Tag color={type === 'S' ? 'blue' : 'default'}>
          {type === 'S' ? 'S' : 'T'}
        </Tag>
      ),
    },
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 100,
      ellipsis: true,
    },
    {
      title: '标题',
      dataIndex: 'name',
      key: 'name',
      width: 200,
      ellipsis: true,
    },
    {
      title: '所属项目',
      dataIndex: 'workspace',
      key: 'workspace',
      width: 120,
      ellipsis: true,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 90,
      render: (status: string) => {
        const colorMap: Record<string, string> = {
          '规划中': 'default',
          '开发中': 'processing',
          '待测试': 'warning',
          '测试中': 'processing',
          'T测试完': 'success',
          '待发布': 'warning',
          '已实现': 'success',
          '已关闭': 'default',
        };
        return <Tag color={colorMap[status] || 'default'}>{status}</Tag>;
      },
    },
    {
      title: '成本归属',
      dataIndex: 'costField',
      key: 'costField',
      width: 100,
      ellipsis: true,
    },
    {
      title: '项目归属',
      dataIndex: 'projectField',
      key: 'projectField',
      width: 100,
      ellipsis: true,
    },
    {
      title: '迭代',
      dataIndex: 'iteration',
      key: 'iteration',
      width: 100,
      ellipsis: true,
    },
    {
      title: '处理人',
      dataIndex: 'owner',
      key: 'owner',
      width: 80,
      ellipsis: true,
    },
    {
      title: '创建人',
      dataIndex: 'creator',
      key: 'creator',
      width: 80,
      ellipsis: true,
    },
    {
      title: '预估工时',
      dataIndex: 'estimated',
      key: 'estimated',
      width: 90,
      align: 'right' as const,
    },
    {
      title: '完成工时',
      dataIndex: 'consumed',
      key: 'consumed',
      width: 90,
      align: 'right' as const,
    },
    {
      title: '创建时间',
      dataIndex: 'created',
      key: 'created',
      width: 120,
      ellipsis: true,
    },
    {
      title: '完成时间',
      dataIndex: 'completed',
      key: 'completed',
      width: 120,
      ellipsis: true,
    },
    {
      title: '按时提测',
      dataIndex: 'onTime',
      key: 'onTime',
      width: 80,
    },
    {
      title: '插入/变更',
      dataIndex: 'changeType',
      key: 'changeType',
      width: 90,
    },
    {
      title: '冒烟通过',
      dataIndex: 'smokePass',
      key: 'smokePass',
      width: 80,
    },
    {
      title: '需求数',
      dataIndex: 'requirementCount',
      key: 'requirementCount',
      width: 80,
      align: 'right' as const,
      render: (val: number) => (
        <span style={{ fontWeight: 700, color: '#1890ff' }}>{val}</span>
      ),
    },
  ];

  /** 人员统计排行表格列 */
  const personStatsColumns = [
    {
      title: '排名',
      key: 'rank',
      width: 70,
      render: (_: unknown, __: unknown, index: number) => (
        <Text strong style={{ color: index < 3 ? '#faad14' : undefined }}>
          {index + 1}
        </Text>
      ),
    },
    {
      title: '处理人',
      dataIndex: 'name',
      key: 'name',
      width: 120,
    },
    {
      title: '需求数',
      dataIndex: 'count',
      key: 'count',
      width: 100,
      sorter: (a: PersonStat, b: PersonStat) => a.count - b.count,
    },
    {
      title: '占比',
      dataIndex: 'ratio',
      key: 'ratio',
      width: 100,
      render: (val: number) => `${val}%`,
    },
    {
      title: '进度',
      key: 'progress',
      width: 200,
      render: (_: unknown, record: PersonStat) => (
        <Progress
          percent={Math.min(record.ratio, 100)}
          size="small"
          strokeColor="#1890ff"
        />
      ),
    },
  ];

  // ==================== 渲染各步骤内容 ====================

  /** Step 0: API 连接配置 */
  const renderStep0 = () => (
    <Card>
      <div style={{ maxWidth: 480 }}>
        {/* 配置状态 */}
        {isConfigured ? (
          <>
            <div
              style={{
                padding: '12px 16px',
                background: '#f6ffed',
                border: '1px solid #b7eb8f',
                borderRadius: 8,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginBottom: 16,
              }}
            >
              <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 18 }} />
              <Text style={{ color: '#52c41a', fontWeight: 500 }}>
                API 凭据已配置（{apiConfig.apiUser}）
              </Text>
            </div>
            <Form layout="vertical">
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
                    onClick={() => window.location.href = '/settings/tapd'}
                  >
                    修改配置
                  </Button>
                </Space>
              </Form.Item>
            </Form>
          </>
        ) : (
          <div
            style={{
              padding: '20px 16px',
              background: '#fff7e6',
              border: '1px solid #ffe58f',
              borderRadius: 8,
              marginBottom: 16,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <SettingOutlined style={{ color: '#fa8c16', fontSize: 18 }} />
              <Text style={{ color: '#fa8c16', fontWeight: 500 }}>
                尚未配置 TAPD API 凭据
              </Text>
            </div>
            <Paragraph style={{ color: '#666', fontSize: 13, marginBottom: 16 }}>
              请先前往系统设置页面配置 TAPD API 连接信息，配置完成后返回此处继续操作。
            </Paragraph>
            <Button
              type="primary"
              onClick={() => window.location.href = '/settings/tapd'}
            >
              前往配置
            </Button>
          </div>
        )}

        {/* 连接测试结果 */}
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
              marginTop: 16,
            }}
          >
            <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 18 }} />
            <Text style={{ color: '#52c41a', fontWeight: 500 }}>
              连接成功 - 请在下方选择 TAPD 项目
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
              marginTop: 16,
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

        <Form.Item style={{ marginTop: 24 }}>
          <Button
            type="primary"
            disabled={connectionStatus !== 'connected'}
            onClick={() => setCurrentStep(1)}
          >
            下一步
          </Button>
        </Form.Item>
      </div>
    </Card>
  );

  /** Step 1: 查询条件配置 */
  const renderStep1 = () => (
    <Card>
      <Form layout="vertical">
        <Form.Item
          label="TAPD 项目 ID"
          required
          extra={
            <span style={{ fontSize: 12, color: '#999' }}>
              输入 TAPD 项目 ID，多个用英文逗号分隔。获取方式：TAPD 网页 → 进入项目 → 点击左上角项目名称查看 ID
            </span>
          }
        >
          <Select
            mode="multiple"
            showSearch
            allowClear
            placeholder="选择或搜索 TAPD 项目，也可手动输入项目 ID"
            value={selectedProjects}
            onChange={setSelectedProjects}
            style={{ width: '100%' }}
            optionFilterProp="label"
            options={TAPD_PROJECTS.map((p) => ({
              label: `${p.name}（${p.id}）`,
              value: p.id,
            }))}
            dropdownRender={(menu) => (
              <>
                <div style={{ padding: '8px 12px', borderBottom: '1px solid #f0f0f0', display: 'flex', gap: 8 }}>
                  <Button
                    size="small"
                    onClick={() => setSelectedProjects(TAPD_PROJECTS.map((p) => p.id))}
                  >
                    全选
                  </Button>
                  <Button
                    size="small"
                    onClick={() => setSelectedProjects([])}
                  >
                    全不选
                  </Button>
                </div>
                {menu}
                <div style={{ padding: '4px 8px', borderTop: '1px solid #f0f0f0', fontSize: 12, color: '#999' }}>
                  共 {TAPD_PROJECTS.length} 个项目 · 已选 {selectedProjects.length} 个 · 输入关键词可搜索
                </div>
              </>
            )}
          />
        </Form.Item>

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item label="需求创建时间">
              <RangePicker
                style={{ width: '100%' }}
                value={dateRange}
                onChange={(dates) => {
                  if (dates && dates[0] && dates[1]) {
                    setDateRange([dates[0], dates[1]]);
                  } else {
                    setDateRange(null);
                  }
                }}
                showTime={{ defaultValue: [dayjs('00:00', 'HH:mm'), dayjs('23:59', 'HH:mm')] }}
                format="YYYY-MM-DD HH:mm"
                presets={[
                  { label: '最近一周', value: [dayjs().subtract(7, 'day'), dayjs()] },
                  { label: '最近一个月', value: [dayjs().subtract(1, 'month'), dayjs()] },
                  { label: '最近三个月', value: [dayjs().subtract(3, 'month'), dayjs()] },
                  { label: '最近半年', value: [dayjs().subtract(6, 'month'), dayjs()] },
                  { label: '本月', value: [dayjs().startOf('month'), dayjs()] },
                  { label: '上月', value: [dayjs().subtract(1, 'month').startOf('month'), dayjs().subtract(1, 'month').endOf('month')] },
                ]}
                allowClear
              />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label="需求完成时间">
              <RangePicker
                style={{ width: '100%' }}
                value={completeRange}
                onChange={(dates) => {
                  if (dates && dates[0] && dates[1]) {
                    setCompleteRange([dates[0], dates[1]]);
                  } else {
                    setCompleteRange(null);
                  }
                }}
                showTime={{ defaultValue: [dayjs('00:00', 'HH:mm'), dayjs('23:59', 'HH:mm')] }}
                format="YYYY-MM-DD HH:mm"
                presets={[
                  { label: '最近一周', value: [dayjs().subtract(7, 'day'), dayjs()] },
                  { label: '最近一个月', value: [dayjs().subtract(1, 'month'), dayjs()] },
                  { label: '最近三个月', value: [dayjs().subtract(3, 'month'), dayjs()] },
                  { label: '最近半年', value: [dayjs().subtract(6, 'month'), dayjs()] },
                  { label: '本月', value: [dayjs().startOf('month'), dayjs()] },
                  { label: '上月', value: [dayjs().subtract(1, 'month').startOf('month'), dayjs().subtract(1, 'month').endOf('month')] },
                ]}
                allowClear
              />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item label="需求状态">
          <Select
            mode="multiple"
            placeholder="请选择需求状态（可多选，不选则拉取全部）"
            value={selectedStatuses}
            onChange={setSelectedStatuses}
            options={STATUS_OPTIONS.map((s) => ({
              label: s,
              value: s,
            }))}
            style={{ width: '100%' }}
            allowClear
          />
        </Form.Item>

        <Form.Item>
          <Button onClick={handleResetConditions} style={{ marginRight: 12 }}>
            重置条件
          </Button>
          <Button
            type="primary"
            icon={<CloudDownloadOutlined />}
            disabled={selectedProjects.length === 0}
            onClick={() => {
              setCurrentStep(2);
              handleFetchData();
            }}
          >
            拉取数据
          </Button>
        </Form.Item>

        <Form.Item>
          <Button onClick={() => setCurrentStep(0)}>上一步</Button>
        </Form.Item>
      </Form>
    </Card>
  );

  /** Step 2: 数据拉取进度 */
  const renderStep2 = () => (
    <Card>
      <Spin spinning={isFetching} tip="正在拉取数据...">
        <div style={{ padding: '24px 0' }}>
          {/* 进度条 */}
          <Progress
            type="dashboard"
            percent={fetchProgress.percent}
            format={(percent) => `${percent}%`}
            strokeColor={{
              '0%': '#108ee9',
              '100%': '#87d068',
            }}
            style={{ marginBottom: 32, display: 'flex', justifyContent: 'center' }}
          />

          {/* 当前阶段提示 */}
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <Text style={{ fontSize: 16, fontWeight: 500 }}>
              {fetchProgress.stage}
            </Text>
          </div>

          {/* 统计卡片 */}
          <Row gutter={16}>
            <Col span={6}>
              <Card bordered={false} style={{ background: '#fafafa', textAlign: 'center' }}>
                <Statistic
                  title="Story 需求数"
                  value={fetchProgress.storyCount}
                  suffix="个"
                  valueStyle={{ color: '#1890ff' }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card bordered={false} style={{ background: '#fafafa', textAlign: 'center' }}>
                <Statistic
                  title="Task 任务数"
                  value={fetchProgress.taskCount}
                  suffix="个"
                  valueStyle={{ color: '#52c41a' }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card bordered={false} style={{ background: '#fafafa', textAlign: 'center' }}>
                <Statistic
                  title="涉及人员数"
                  value={fetchProgress.personCount}
                  suffix="人"
                  valueStyle={{ color: '#fa8c16' }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card bordered={false} style={{ background: '#fafafa', textAlign: 'center' }}>
                <Statistic
                  title="已用时间"
                  value={fetchProgress.elapsed}
                  suffix="秒"
                  valueStyle={{ color: '#722ed1' }}
                />
              </Card>
            </Col>
          </Row>

          {/* 操作按钮 */}
          <div style={{ marginTop: 32, textAlign: 'center' }}>
            {!isFetching && fetchProgress.percent === 100 && (
              <Button
                type="primary"
                size="large"
                icon={<SettingOutlined />}
                onClick={async () => {
                  await handleProcessData();
                  setCurrentStep(3);
                }}
              >
                处理数据
              </Button>
            )}
            {!isFetching && fetchProgress.percent < 100 && (
              <Button
                type="primary"
                size="large"
                icon={<ReloadOutlined />}
                onClick={handleFetchData}
              >
                重新拉取
              </Button>
            )}
          </div>
        </div>
      </Spin>

      <div style={{ marginTop: 16 }}>
        <Button onClick={() => setCurrentStep(1)}>上一步</Button>
      </div>
    </Card>
  );

  /** Step 3: 处理计算 */
  const renderStep3 = () => (
    <Card>
      {/* 顶部统计卡片 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card bordered={false} style={{ background: '#fafafa', textAlign: 'center' }}>
            <Statistic
              title="Story 总数"
              value={statistics.totalStories}
              suffix="个"
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card bordered={false} style={{ background: '#fafafa', textAlign: 'center' }}>
            <Statistic
              title="Task 总数"
              value={statistics.totalTasks}
              suffix="个"
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card bordered={false} style={{ background: '#fafafa', textAlign: 'center' }}>
            <Statistic
              title="总需求数"
              value={statistics.totalRequirement}
              valueStyle={{ color: '#fa8c16' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card bordered={false} style={{ background: '#fafafa', textAlign: 'center' }}>
            <Statistic
              title="处理人数"
              value={statistics.personCount}
              suffix="人"
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
      </Row>

      {/* 操作按钮 */}
      <div style={{ marginBottom: 16, display: 'flex', gap: 12 }}>
        <Button
          type="primary"
          icon={<CloudSyncOutlined />}
          loading={isProcessing}
          onClick={handleProcessData}
        >
          处理数据
        </Button>
        <Button
          type="primary"
          disabled={processedData.length === 0}
          onClick={() => setCurrentStep(4)}
        >
          下一步
        </Button>
        <Button onClick={() => setCurrentStep(2)}>上一步</Button>
      </div>

      {/* Tabs */}
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'result',
            label: '处理结果',
            children: (
              <Table
                dataSource={processedData}
                columns={processedColumns}
                rowKey="id"
                scroll={{ x: 2200, y: 500 }}
                size="small"
                pagination={{
                  pageSize: 50,
                  showSizeChanger: true,
                  showTotal: (total) => `共 ${total} 条`,
                }}
                rowClassName={(record) =>
                  record.type === 'S' ? 'story-row' : 'task-row'
                }
              />
            ),
          },
          {
            key: 'mapping',
            label: '字段映射',
            children: (
              <div style={{ maxWidth: 480 }}>
                <Form layout="vertical">
                  <Form.Item label="成本归属字段">
                    <Select
                      value={fieldMapping.costField}
                      onChange={(val) =>
                        setFieldMapping((prev) => ({ ...prev, costField: val }))
                      }
                      options={CUSTOM_FIELD_OPTIONS}
                    />
                  </Form.Item>
                  <Form.Item label="项目归属字段">
                    <Select
                      value={fieldMapping.projectField}
                      onChange={(val) =>
                        setFieldMapping((prev) => ({ ...prev, projectField: val }))
                      }
                      options={CUSTOM_FIELD_OPTIONS}
                    />
                  </Form.Item>
                  <Form.Item label="OKR 名称字段">
                    <Select
                      value={fieldMapping.okrField}
                      onChange={(val) =>
                        setFieldMapping((prev) => ({ ...prev, okrField: val }))
                      }
                      options={CUSTOM_FIELD_OPTIONS}
                    />
                  </Form.Item>
                </Form>
              </div>
            ),
          },
          {
            key: 'rules',
            label: '需求数规则',
            children: (
              <div style={{ maxWidth: 480 }}>
                <Paragraph type="secondary">
                  根据预估工时区间计算需求数，工时小于等于上限时取对应值。
                </Paragraph>
                {rules.map((rule, index) => (
                  <Row gutter={16} key={index} style={{ marginBottom: 12 }}>
                    <Col span={12}>
                      <InputNumber
                        addonBefore="工时上限"
                        value={rule.maxHours === Infinity ? 9999 : rule.maxHours}
                        min={0}
                        style={{ width: '100%' }}
                        onChange={(val) => {
                          const newRules = [...rules];
                          newRules[index] = {
                            ...newRules[index],
                            maxHours: val === 9999 ? Infinity : (val ?? 0),
                          };
                          setRules(newRules);
                        }}
                      />
                    </Col>
                    <Col span={12}>
                      <InputNumber
                        addonBefore="需求数"
                        value={rule.value}
                        min={0}
                        step={0.1}
                        style={{ width: '100%' }}
                        onChange={(val) => {
                          const newRules = [...rules];
                          newRules[index] = {
                            ...newRules[index],
                            value: val ?? 0,
                          };
                          setRules(newRules);
                        }}
                      />
                    </Col>
                  </Row>
                ))}
                <div style={{ marginTop: 16, display: 'flex', gap: 12 }}>
                  <Button type="primary" onClick={handleApplyRules}>
                    应用规则
                  </Button>
                  <Button onClick={handleResetRules}>重置默认</Button>
                </div>
              </div>
            ),
          },
        ]}
      />

      {/* 内联样式：Story 行高亮，Task 行缩进 */}
      <style jsx global>{`
        .story-row {
          background-color: #fafafa !important;
        }
        .story-row:hover > td {
          background-color: #f0f0f0 !important;
        }
        .task-row td:first-child {
          padding-left: 32px !important;
        }
      `}</style>
    </Card>
  );

  /** Step 4: 导出结果 */
  const renderStep4 = () => (
    <Card>
      {/* 需求数统计排行 */}
      <Title level={5} style={{ marginBottom: 16 }}>
        需求数统计排行
      </Title>
      <Table
        dataSource={personStats}
        columns={personStatsColumns}
        rowKey="name"
        pagination={false}
        size="small"
        style={{ marginBottom: 32 }}
      />

      {/* 导出配置 */}
      <Title level={5} style={{ marginBottom: 16 }}>
        导出配置
      </Title>
      <div style={{ maxWidth: 480, marginBottom: 24 }}>
        <Form layout="vertical">
          <Form.Item label="文件名">
            <Input
              value={exportFileName}
              onChange={(e) => setExportFileName(e.target.value)}
              suffix=".xlsx"
            />
          </Form.Item>
          <Form.Item>
            <Checkbox
              checked={exportOptions.includeRaw}
              onChange={(e) =>
                setExportOptions((prev) => ({ ...prev, includeRaw: e.target.checked }))
              }
            >
              TAPD 原始数据
            </Checkbox>
          </Form.Item>
          <Form.Item>
            <Checkbox
              checked={exportOptions.includeProcessed}
              onChange={(e) =>
                setExportOptions((prev) => ({
                  ...prev,
                  includeProcessed: e.target.checked,
                }))
              }
            >
              处理后数据
            </Checkbox>
          </Form.Item>
          <Form.Item>
            <Checkbox
              checked={exportOptions.includeStats}
              onChange={(e) =>
                setExportOptions((prev) => ({
                  ...prev,
                  includeStats: e.target.checked,
                }))
              }
            >
              需求数统计
            </Checkbox>
          </Form.Item>
        </Form>
      </div>

      {/* 操作按钮 */}
      <div style={{ display: 'flex', gap: 12 }}>
        <Button
          type="primary"
          icon={<ExportOutlined />}
          size="large"
          onClick={handleExportExcel}
        >
          导出 Excel
        </Button>
        <Button size="large" onClick={() => setCurrentStep(3)}>
          上一步
        </Button>
      </div>
    </Card>
  );

  // ==================== 步骤内容映射 ====================

  const stepContentMap: Record<number, React.ReactNode> = {
    0: renderStep0(),
    1: renderStep1(),
    2: renderStep2(),
    3: renderStep3(),
    4: renderStep4(),
  };

  // ==================== 主渲染 ====================

  return (
    <div>
      {/* 页面标题 */}
      <div style={{ marginBottom: 24 }}>
        <Title level={3} style={{ marginBottom: 4 }}>
          数据同步
        </Title>
        <Text type="secondary">
          通过 TAPD API 拉取需求数据，自动计算需求数和成本归属
        </Text>
      </div>

      {/* Steps 导航 */}
      <Steps
        current={currentStep}
        onChange={(step) => {
          // 只允许回退到已完成的步骤
          if (step < currentStep) {
            setCurrentStep(step);
          }
        }}
        items={STEP_TITLES.map((title, index) => ({
          title,
          icon:
            index === 0 ? (
              <ApiOutlined />
            ) : index === 1 ? (
              <SearchOutlined />
            ) : index === 2 ? (
              <CloudDownloadOutlined />
            ) : index === 3 ? (
              <SettingOutlined />
            ) : (
              <ExportOutlined />
            ),
        }))}
        style={{ marginBottom: 24 }}
      />

      {/* 步骤内容 */}
      {stepContentMap[currentStep]}
    </div>
  );
}
