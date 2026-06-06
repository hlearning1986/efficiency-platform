'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
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

// ==================== 类型定义 ====================
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
  costField: 'customFieldEight',     // 成本归属
  projectField: 'customField13',     // 项目归属
  okrField: 'customFieldOne',        // 冒烟通过
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
  { label: 'customFieldOne（是否冒烟通过）', value: 'customFieldOne' },
  { label: 'customFieldTwo（按时提测）', value: 'customFieldTwo' },
  { label: 'customFieldThree（是否插入或变更需求）', value: 'customFieldThree' },
  { label: 'customFieldFour（故事优先级）', value: 'customFieldFour' },
  { label: 'customFieldFive（备注）', value: 'customFieldFive' },
  { label: 'customFieldSix（初评是否通过）', value: 'customFieldSix' },
  { label: 'customFieldSeven（需求方）', value: 'customFieldSeven' },
  { label: 'customFieldEight（成本归属）', value: 'customFieldEight' },
  { label: 'customField9（发布端口）', value: 'customField9' },
  { label: 'customField10（前端代码已合）', value: 'customField10' },
  { label: 'customField11（后端代码已合）', value: 'customField11' },
  { label: 'customField12（BI提测时间）', value: 'customField12' },
  { label: 'customField13（项目归属）', value: 'customField13' },
  { label: 'customField14', value: 'customField14' },
  { label: 'customField15', value: 'customField15' },
  { label: 'customField16', value: 'customField16' },
  { label: 'customField17', value: 'customField17' },
  { label: 'customField18', value: 'customField18' },
  { label: 'customField19', value: 'customField19' },
  { label: 'customField20', value: 'customField20' },
  { label: 'customField21', value: 'customField21' },
  { label: 'customField22', value: 'customField22' },
  { label: 'customField23', value: 'customField23' },
  { label: 'customField24', value: 'customField24' },
  { label: 'customField25', value: 'customField25' },
  { label: 'customField26', value: 'customField26' },
  { label: 'customField27', value: 'customField27' },
  { label: 'customField28', value: 'customField28' },
  { label: 'customField29', value: 'customField29' },
  { label: 'customField30', value: 'customField30' },
];

/** 步骤标题 */
const STEP_TITLES = ['查询条件', '查询数据', '处理计算', '导出结果'];

/** TAPD Story 状态：英文 → 中文映射 */
const STATUS_MAP: Record<string, string> = {
  // 英文状态码/键 → 中文显示
  'planning': '规划中',
  'developing': '开发中',
  'developed': '已开发',
  'testing': '测试中',
  'tested': '已测试',
  'resolved': '已实现',
  'closed': '已关闭',
  'new': '新建',
  'in_progress': '开发中',
  'done': '已完成',
  'reopened': '重新打开',
  // 中文兜底（直接返回）
  '规划中': '规划中',
  '开发中': '开发中',
  '待测试': '待测试',
  '测试中': '测试中',
  'T测试完': '测试完成',
  '待发布': '待发布',
  '已实现': '已实现',
  '已关闭': '已关闭',
};

/** 状态颜色映射 */
const STATUS_COLOR_MAP: Record<string, string> = {
  '规划中': 'default',
  '开发中': 'processing',
  '待测试': 'warning',
  '测试中': 'processing',
  '测试完成': 'success',
  'T测试完': 'success',
  '待发布': 'warning',
  '已实现': 'success',
  '已关闭': 'default',
  '已开发': 'default',
  '已测试': 'success',
  '新建': 'default',
  '已完成': 'success',
  '重新打开': 'error',
};

/** 格式化日期：ISO字符串 / Date对象 → YYYY-MM-DD HH:mm */
function formatDate(val: unknown): string {
  if (!val) return '';
  if (val instanceof Date) return val.toISOString().slice(0, 16).replace('T', ' ');
  const s = String(val);
  // 已是格式化的字符串则直接返回
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 16).replace('T', ' ');
  // ISO格式
  try { return new Date(s).toISOString().slice(0, 16).replace('T', ' '); }
  catch { return s; }
}

const { Title, Text, Paragraph } = Typography;
const { RangePicker } = DatePicker;

// ==================== 主组件 ====================

export default function DataSyncPage() {
  // ---- 步骤状态 ----
  const [currentStep, setCurrentStep] = useState<number>(0);

  // ---- Step 0: 查询条件 ----
  // TAPD 项目列表（从本地数据库动态查询）
  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);
  const [dynamicProjects, setDynamicProjects] = useState<Array<{id: string; name: string; storyCount: number}>>([]);
  const [isLoadingMeta, setIsLoadingMeta] = useState<boolean>(true);
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs] | null>(null);
  const [completeRange, setCompleteRange] = useState<[Dayjs, Dayjs] | null>(null);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [dynamicStatuses, setDynamicStatuses] = useState<Array<{
    value: string; 
    label: string; 
    count: number; 
    isTranslated?: boolean;
    allValues?: string[];  // 所有对应的原始值数组
    translationSources?: string[];
  }>>([]);
  const [statusMapping, setStatusMapping] = useState<{
    keyToChinese: Record<string, string>; 
    chineseToKeys: Record<string, string[]>;
    knownChineseValues?: string[];
    totalMappings: number;
    // 🎯 按项目映射：{ workspaceId: { statusKey: statusValue } }
    workspaceKeyToChinese?: Record<string, Record<string, string>>;
  } | null>(null);

  // 从数据库动态加载元信息（项目列表、状态列表）
  useEffect(() => {
    const loadMetaInfo = async () => {
      try {
        setIsLoadingMeta(true);
        console.log('[数据同步] 正在从数据库加载项目列表和状态列表...');
        
        const response = await fetch('/api/v1/resources/tapd/meta');
        const result = await response.json();
        
        if (result.success && result.data) {
          setDynamicProjects(result.data.projects || []);
          setDynamicStatuses(result.data.statuses || []);
          
          // 保存状态映射关系（用于后续数据处理和显示）
          if (result.data.statusMapping) {
            setStatusMapping(result.data.statusMapping);
            console.log('[数据同步] ✅ 状态映射已加载:', {
              映射数量: result.data.statusMapping.totalMappings,
              示例: Object.entries(result.data.statusMapping.keyToChinese).slice(0, 3)
            });
          }
          
          console.log(`[数据同步] ✅ 加载完成:`);
          console.log(`   - 项目数: ${result.data.projects?.length || 0}`);
          console.log(`   - 状态数: ${result.data.statuses?.length || 0}`);
          
          if (result.data.statistics) {
            console.log(`   - 总Story: ${result.data.statistics.totalStories}`);
            console.log(`   - 总Task: ${result.data.statistics.totalTasks}`);
          }
        } else {
          console.warn('[数据同步] ⚠️ 加载失败，使用预置列表:', result.error);
          // 回退到硬编码列表
          setDynamicProjects(TAPD_PROJECTS.map(p => ({ ...p, storyCount: 0 })));
        }
      } catch (error) {
        console.error('[数据同步] ❌ 加载元信息失败:', error);
        // 回退到硬编码列表
        setDynamicProjects(TAPD_PROJECTS.map(p => ({ ...p, storyCount: 0 })));
      } finally {
        setIsLoadingMeta(false);
      }
    };

    loadMetaInfo();
  }, []);

  // ---- Step 1: 数据查询 ----
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

  // ---- Step 1: 处理计算 ----
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

  // ---- Step 2: 导出 ----
  const [exportFileName, setExportFileName] = useState<string>(
    `TAPD数据同步_${dayjs().format('YYYYMMDD_HHmmss')}`,
  );
  const [exportOptions, setExportOptions] = useState({
    includeRaw: true,
    includeProcessed: true,
    includeStats: true,
  });

  // ==================== Step 1: 查询数据（从本地数据库） ====================
  
  /**
   * 从本地已同步的 TAPD 数据库中查询数据
   * 优化：不再实时调用 TAPD API，直接使用落库数据
   * 优势：1) 响应速度快 2) 状态已标准化 3) 节省API调用次数
   */
  const handleFetchData = useCallback(async () => {
    if (selectedProjects.length === 0) {
      message.warning('请至少选择一个项目');
      return;
    }

    setIsFetching(true);
    setFetchProgress({
      stage: '正在从本地数据库查询数据...',
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
      // 调用本地数据库查询 API
      setFetchProgress((prev) => ({
        ...prev,
        stage: '正在查询 Story 需求数据...',
        percent: 30,
      }));

      // 将选中的状态标签转换为所有对应的原始值
      // 例如：选择"已实现" → 发送 ["resolved", "已实现"]
      const resolvedStatusesForQuery: string[] = [];
      
      if (selectedStatuses.length > 0) {
        selectedStatuses.forEach(selectedStatus => {
          // 在dynamicStatuses中查找匹配的项
          const matchedStatus = dynamicStatuses.find(s => 
            s.label === selectedStatus || s.value === selectedStatus
          );
          
          if (matchedStatus?.allValues && matchedStatus.allValues.length > 0) {
            // 如果有allValues，使用它（包含所有映射的原始值）
            resolvedStatusesForQuery.push(...matchedStatus.allValues);
          } else {
            // 否则使用原始值本身
            resolvedStatusesForQuery.push(selectedStatus);
          }
        });
        
        // 去重
        const uniqueStatuses = [...new Set(resolvedStatusesForQuery)];
        
        console.log('[查询数据] 状态转换:', {
          原始选择: selectedStatuses,
          转换后: uniqueStatuses,
        });
      }

      const response = await fetch('/api/v1/resources/tapd/local-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceIds: selectedProjects,
          createdBegin: dateRange ? dateRange[0].format('YYYY-MM-DD HH:mm:ss') : undefined,
          createdEnd: dateRange ? dateRange[1].format('YYYY-MM-DD HH:mm:ss') : undefined,
          completedBegin: completeRange ? completeRange[0].format('YYYY-MM-DD HH:mm:ss') : undefined,
          completedEnd: completeRange ? completeRange[1].format('YYYY-MM-DD HH:mm:ss') : undefined,
          statuses: resolvedStatusesForQuery.length > 0 ? resolvedStatusesForQuery : undefined,
        }),
      });

      console.log('[查询数据] 请求参数:', {
        workspaceIds: selectedProjects,
        dateRange: dateRange?.map(d => d.format('YYYY-MM-DD HH:mm:ss')),
        completeRange: completeRange?.map(d => d.format('YYYY-MM-DD HH:mm:ss')),
        selectedStatuses,  // 用户选择的显示标签
        resolvedStatuses: resolvedStatusesForQuery,  // 实际发送给API的值
      });

      const data = await response.json();
      
      console.log('[查询数据] API 响应:', {
        success: data.success,
        message: data.message,
        storyCount: data.stories?.length || 0,
        taskCount: data.tasks?.length || 0,
        statistics: data.statistics,
      });

      if (!data.success) {
        throw new Error(data.message || '查询本地数据失败');
      }

      // 转换 Prisma 对象为 Record<string, unknown> 格式（兼容后续处理逻辑）
      const allStories = (data.stories || []).map((story: Record<string, unknown>) => {
        const converted = { ...story };
        
        // 处理日期字段格式化
        if (converted.created instanceof Date) {
          converted.created = converted.created.toISOString();
        }
        if (converted.modified instanceof Date) {
          converted.modified = converted.modified.toISOString();
        }
        if (converted.completed instanceof Date) {
          converted.completed = converted.completed.toISOString();
        }
        if (converted.begin instanceof Date) {
          converted.begin = converted.begin.toISOString();
        }
        if (converted.due instanceof Date) {
          converted.due = converted.due.toISOString();
        }
        
        return converted as Record<string, unknown>;
      });

      const allTasks = (data.tasks || []).map((task: Record<string, unknown>) => {
        const converted = { ...task };
        
        // 处理日期字段格式化
        if (converted.created instanceof Date) {
          converted.created = converted.created.toISOString();
        }
        if (converted.modified instanceof Date) {
          converted.modified = converted.modified.toISOString();
        }
        if (converted.completed instanceof Date) {
          converted.completed = converted.completed.toISOString();
        }
        if (converted.begin instanceof Date) {
          converted.begin = converted.begin.toISOString();
        }
        if (converted.due instanceof Date) {
          converted.due = converted.due.toISOString();
        }
        
        return converted as Record<string, unknown>;
      });

      setRawStories(allStories);
      setRawTasks(allTasks);
      
      // 设置自定义字段映射（如果有）
      if (data.customFieldMapping && Object.keys(data.customFieldMapping).length > 0) {
        setCustomFieldMapping(data.customFieldMapping);
      }

      // 处理警告信息
      if (data.warning) {
        message.warning(data.warning, 5);  // 显示 5 秒
        console.warn('[查询数据] 警告:', data.warning);
      }

      setFetchProgress((prev) => ({
        ...prev,
        storyCount: allStories.length,
        taskCount: allTasks.length,
        personCount: data.statistics?.personCount || 0,
        percent: 100,
        stage: '数据查询完成',
        elapsed: Math.round((Date.now() - startTime) / 1000),
      }));

      if (allStories.length > 0 || allTasks.length > 0) {
        message.success(
          `查询完成：${allStories.length} 个 Story，${allTasks.length} 个 Task` +
          `（来自本地数据库，耗时 ${Math.round((Date.now() - startTime) / 1000)}s）`
        );
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : '查询数据失败';
      message.error(errorMsg);
      setFetchProgress((prev) => ({
        ...prev,
        stage: `查询失败: ${errorMsg}`,
        percent: prev.percent,
      }));
    } finally {
      setIsFetching(false);
      if (fetchTimerRef.current) {
        clearInterval(fetchTimerRef.current);
        fetchTimerRef.current = null;
      }
    }
  }, [selectedProjects, dateRange, completeRange, selectedStatuses]);

  // ==================== Step 2: 处理数据 ====================

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
        const parentId = String(task['storyId'] ?? task['parentId'] ?? '');
        if (parentId) {
          if (!storyTaskMap.has(parentId)) {
            storyTaskMap.set(parentId, []);
          }
          storyTaskMap.get(parentId)!.push(task);
        }
      }

      // 辅助函数：安全读取字段值（支持 camelCase 和 snake_case 兼容）
      const getField = (obj: Record<string, unknown>, ...keys: string[]): string => {
        for (const key of keys) {
          const val = obj[key];
          if (val !== undefined && val !== null && val !== '') return String(val);
        }
        return '';
      };

      // 处理 Story 行
      for (const story of processedStories) {
        const storyId = getField(story, 'id');
        const wsId = getField(story, 'workspaceId', 'workspace_id');

        // 自定义字段映射：优先用自动识别的映射，否则用默认 camelCase
        const wsMapping = customFieldMapping[wsId] || {};
        const costFieldKey = wsMapping['成本归属'] || 'customFieldEight';
        const projectFieldKey = wsMapping['项目归属'] || 'customField13';
        const smokePassKey = wsMapping['冒烟通过'] || 'customFieldOne';
        const onTimeKey = wsMapping['按时提测'] || 'customFieldTwo';

        // 🎯 状态转中文：按项目映射 > 全局映射 > 硬编码映射 > 原始值
        const rawStatus = getField(story, 'status');
        const storyWsId = String(getField(story, 'workspaceId') || wsId);
        const cnStatus =
          statusMapping?.workspaceKeyToChinese?.[storyWsId]?.[rawStatus] ||
          statusMapping?.keyToChinese?.[rawStatus] ||
          STATUS_MAP[rawStatus] ||
          rawStatus;

        rows.push({
          type: 'S',
          id: storyId,
          name: getField(story, 'name'),
          workspace: getField(story, 'workspaceName', 'workspace_name', 'workspaceId'),
          status: cnStatus,
          costField: getField(story, costFieldKey),
          projectField: getField(story, projectFieldKey),
          okrField: getField(story, fieldMapping.okrField, 'customFieldOne'),
          iteration: getField(story, 'iterationName', 'iterationId'),
          owner: getField(story, 'owner'),
          creator: getField(story, 'creator'),
          estimated: Number(story['effort'] ?? story['taskEstimated'] ?? 0),
          consumed: Number(story['effortCompleted'] ?? story['taskCompleted'] ?? 0),
          created: formatDate(story['created']),
          completed: formatDate(story['completed']),
          onTime: getField(story, onTimeKey),
          smokePass: getField(story, smokePassKey),
          requirementCount: Number(story['requirementCount'] ?? 0),
        });

        // 处理关联的 Task 行
        const relatedTasks = storyTaskMap.get(storyId) || [];
        const storyWorkspace = getField(story, 'workspaceName', 'workspace_name', 'workspaceId');
        for (const task of relatedTasks) {
          // Task 的 workspaceName 可能缺失（旧数据），从关联 Story 继承
          let taskWorkspace = getField(task, 'workspaceName', 'workspace_name');
          if (!taskWorkspace || /^\d+$/.test(taskWorkspace)) {
            taskWorkspace = storyWorkspace;
          }

          // Task 状态转中文（继承 Story 的 workspaceId）
          const rawTaskStatus = getField(task, 'status');
          const cnTaskStatus =
            statusMapping?.workspaceKeyToChinese?.[storyWsId]?.[rawTaskStatus] ||
            statusMapping?.keyToChinese?.[rawTaskStatus] ||
            STATUS_MAP[rawTaskStatus] ||
            rawTaskStatus;

          rows.push({
            type: 'T',
            id: getField(task, 'id'),
            name: getField(task, 'name'),
            workspace: taskWorkspace,
            status: cnTaskStatus,
            costField: getField(task, costFieldKey) || getField(story, costFieldKey),
            projectField: getField(task, projectFieldKey) || getField(story, projectFieldKey),
            okrField: '-',
            iteration: getField(task, 'iterationName') || getField(story, 'iterationName') || '',
            owner: getField(task, 'owner'),
            creator: getField(task, 'creator'),
            estimated: Number(task['effort'] ?? 0),
            consumed: Number(task['effortCompleted'] ?? 0),
            created: formatDate(task['created']),
            completed: formatDate(task['completed']),
            onTime: '-',
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

  // ==================== Step 3: 导出 Excel ====================

  const MAX_CELL_LENGTH = 30000;  // Excel 单元格最大字符数（保守值，留足够余量）
  const MAX_DESCRIPTION_LENGTH = 5000;  // 描述字段特殊限制（避免过大）
  
  const truncateCellValue = (value: unknown, field?: string): string => {
    if (value === null || value === undefined) {
      return '';
    }
    
    let strValue = String(value);
    
    const maxLength = (field === 'description' || field === 'extraData') 
      ? MAX_DESCRIPTION_LENGTH 
      : MAX_CELL_LENGTH;
    
    if (strValue.length <= maxLength) {
      return strValue;
    }
    
    console.warn(`[导出] ⚠️ 文本截断 [${field || 'unknown'}]: ${strValue.length} → ${maxLength} 字符`);
    return strValue.substring(0, maxLength) + '...[已截断]';
  };

  const sanitizeRowForExport = (row: Record<string, unknown>): Record<string, unknown> => {
    const sanitized: Record<string, unknown> = {};
    
    Object.entries(row).forEach(([key, value]) => {
      if (value === null || value === undefined) {
        sanitized[key] = '';
      } else if (typeof value === 'object' && !(value instanceof Date)) {
        try {
          const jsonStr = JSON.stringify(value);
          sanitized[key] = truncateCellValue(jsonStr, key);
        } catch {
          sanitized[key] = '[Object]';
        }
      } else if (value instanceof Date) {
        sanitized[key] = value.toISOString();
      } else {
        sanitized[key] = truncateCellValue(value, key);
      }
    });
    
    return sanitized;
  };
  
  const validateAndSanitizeSheetData = (data: Record<string, unknown>[]): Record<string, unknown>[] => {
    let truncatedCount = 0;
    
    const result = data.map((row, index) => {
      const sanitized = sanitizeRowForExport(row);
      
      Object.entries(sanitized).forEach(([key, value]) => {
        if (typeof value === 'string' && value.length > MAX_CELL_LENGTH) {
          sanitized[key] = value.substring(0, MAX_CELL_LENGTH);
          truncatedCount++;
        }
      });
      
      return sanitized;
    });
    
    if (truncatedCount > 0) {
      console.log(`[导出] 🛡️ 最终验证：额外截断 ${truncatedCount} 个超长单元格`);
    }
    
    return result;
  };

  const handleExportExcel = useCallback(() => {
    try {
      console.log('[导出] 开始生成 Excel 文件...');
      console.log(`[导出] 原始数据: Story=${rawStories.length}, Task=${rawTasks.length}`);
      console.log(`[导出] 处理后数据: ${processedData.length}`);
      console.log(`[导出] 统计数据: ${personStats.length}`);

      const wb = XLSX.utils.book_new();

      // Sheet 1: TAPD 原始数据
      if (exportOptions.includeRaw) {
        if (rawStories.length > 0) {
          const sanitizedStories = validateAndSanitizeSheetData(rawStories);
          const ws1 = XLSX.utils.json_to_sheet(sanitizedStories);
          XLSX.utils.book_append_sheet(wb, ws1, 'Story原始数据');
          console.log(`[导出] ✅ Story原始数据已添加 (${sanitizedStories.length} 条)`);
        }

        if (rawTasks.length > 0) {
          const sanitizedTasks = validateAndSanitizeSheetData(rawTasks);
          const ws2 = XLSX.utils.json_to_sheet(sanitizedTasks);
          XLSX.utils.book_append_sheet(wb, ws2, 'Task原始数据');
          console.log(`[导出] ✅ Task原始数据已添加 (${sanitizedTasks.length} 条)`);
        }
      }

      // Sheet 2: 处理后数据
      if (exportOptions.includeProcessed && processedData.length > 0) {
        const processedRows = processedData.map((row) => ({
          类型: row.type === 'S' ? 'Story' : 'Task',
          ID: row.id,
          标题: truncateCellValue(row.name),
          所属项目: truncateCellValue(row.workspace),
          状态: truncateCellValue(row.status),
          成本归属: truncateCellValue(row.costField),
          项目归属: truncateCellValue(row.projectField),
          OKR名称: truncateCellValue(row.okrField),
          迭代: truncateCellValue(row.iteration),
          处理人: truncateCellValue(row.owner),
          创建人: truncateCellValue(row.creator),
          预估工时: row.estimated,
          完成工时: row.consumed,
          创建时间: row.created,
          完成时间: row.completed,
          按时提测: row.onTime,
          插入变更: truncateCellValue(row.changeType),
          冒烟通过: truncateCellValue(row.smokePass),
          需求数: row.requirementCount,
        }));
        const ws3 = XLSX.utils.json_to_sheet(processedRows);
        XLSX.utils.book_append_sheet(wb, ws3, '处理后数据');
        console.log(`[导出] ✅ 处理后数据已添加 (${processedRows.length} 条)`);
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
        console.log(`[导出] ✅ 需求数统计已添加 (${statsRows.length} 条)`);
      }

      console.log('[导出] 正在写入 Excel 文件...');
      
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
      console.log('[导出] ✅ Excel 导出完成！');
    } catch (err) {
      console.error('❌ [导出] Excel 导出失败:', err);
      
      let errorMessage = '导出失败，请重试';
      if (err instanceof Error) {
        errorMessage = err.message;
        console.error('❌ [导出] 详细错误:', err.stack);
        
        if (errorMessage.includes('32767') || errorMessage.includes('string limit')) {
          errorMessage = '检测到超长文本，建议：1) 取消勾选"TAPD原始数据" 2) 或缩小查询范围后重试';
        } else if (errorMessage.includes('out of memory') || errorMessage.includes('heap')) {
          errorMessage = '数据量过大导致内存不足，请缩小查询范围或分批导出';
        }
      }
      
      message.error(`导出失败: ${errorMessage}`);
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
        // 优先用动态工作流映射（覆盖 status_8/status_6 等自定义码），fallback 到硬编码
        const cnStatus = statusMapping?.keyToChinese?.[status] || STATUS_MAP[status] || status;
        return <Tag color={STATUS_COLOR_MAP[cnStatus] || 'default'}>{cnStatus}</Tag>;
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
      width: 150,
      render: (val: unknown) => formatDate(val),
    },
    {
      title: '完成时间',
      dataIndex: 'completed',
      key: 'completed',
      width: 150,
      render: (val: unknown) => formatDate(val),
    },
    {
      title: '按时提测',
      dataIndex: 'onTime',
      key: 'onTime',
      width: 80,
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
        <span style={{ fontWeight: 700, color: '#1890ff' }}>{Number.isFinite(val) ? val.toFixed(1) : val}</span>
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
      render: (val: number) => (Number.isFinite(val) ? val.toFixed(1) : val),
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

  /** Step 0: 查询条件配置 */
  const renderStep1 = () => (
    <Card>
      {isLoadingMeta ? (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <Spin size="large" tip="正在从数据库加载项目列表..." />
        </div>
      ) : (
        <Form layout="vertical">
          <Form.Item
            label={
              <span>
                TAPD 项目
                {dynamicProjects.length > 0 && (
                  <Tag color="blue" style={{ marginLeft: 8 }}>
                    数据库共 {dynamicProjects.length} 个项目
                  </Tag>
                )}
              </span>
            }
            required
            extra={
              <span style={{ fontSize: 12, color: '#999' }}>
                {dynamicProjects.length > 0 
                  ? `从数据库动态加载 · 选择项目后可查询已同步的数据（共 ${dynamicProjects.reduce((sum, p) => sum + p.storyCount, 0)} 条Story）`
                  : '⚠️ 未找到项目数据，请先在"TAPD数据管理"页面执行同步'
                }
              </span>
            }
          >
            <Select
              mode="multiple"
              showSearch
              allowClear
              placeholder={dynamicProjects.length > 0 ? "选择或搜索 TAPD 项目" : "请先同步数据..."}
              value={selectedProjects}
              onChange={setSelectedProjects}
              style={{ width: '100%' }}
              optionFilterProp="label"
              options={dynamicProjects.map((p) => ({
                label: `${p.name}（${p.id}）${p.storyCount > 0 ? ` · ${p.storyCount}条` : ''}`,
                value: p.id,
              }))}
              dropdownRender={(menu) => (
                <>
                  <div style={{ padding: '8px 12px', borderBottom: '1px solid #f0f0f0', display: 'flex', gap: 8 }}>
                    <Button
                      size="small"
                      onClick={() => setSelectedProjects(dynamicProjects.map((p) => p.id))}
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
                    共 {dynamicProjects.length} 个项目 · 已选 {selectedProjects.length} 个 · 输入关键词可搜索
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

        <Form.Item label={
          <span>
            需求状态
            {dynamicStatuses.length > 0 && (
              <Tag color="green" style={{ marginLeft: 8 }}>
                数据库共 {dynamicStatuses.length} 种状态
                {statusMapping && statusMapping.totalMappings > 0 && (
                  <span> · 已中文化</span>
                )}
              </Tag>
            )}
          </span>
        }
        extra={
          <span style={{ fontSize: 12, color: '#999' }}>
            {dynamicStatuses.length > 0 
              ? `从数据库动态加载 · 已中文化显示（基于TAPD工作流配置）`
              : '使用预置状态列表'
            }
          </span>
        }
        >
          <Select
            mode="multiple"
            placeholder={dynamicStatuses.length > 0 ? "请选择需求状态（可多选，不选则查询全部）" : "请选择需求状态"}
            value={selectedStatuses}
            onChange={setSelectedStatuses}
            options={(dynamicStatuses.length > 0 ? dynamicStatuses : STATUS_OPTIONS.map(s => ({ value: s, label: s, count: 0 }))).map((s) => ({
              label: `${s.label}${s.count > 0 ? ` (${s.count}条)` : ''}`,
              value: s.value,
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
              setCurrentStep(1);  // ✅ 修正：跳转到查询进度页（Step 1）
              handleFetchData();
            }}
          >
            查询数据
          </Button>
        </Form.Item>

        {/* 提示信息 */}
        <div style={{ 
          marginTop: 16, 
          padding: '12px', 
          background: '#f6ffed', 
          border: '1px solid #b7eb8f',
          borderRadius: 6,
          fontSize: 13,
          color: '#52c41a'
        }}>
          💡 <strong>优化提示：</strong>将从本地已同步的 TAPD 数据库中查询数据，无需实时调用 TAPD API，响应更快！
        </div>
      </Form>
      )}
    </Card>
  );

  /** Step 1: 数据查询进度 */
  const renderStep2 = () => (
    <Card title="📊 从本地数据库查询数据">
      <Spin spinning={isFetching} tip="正在查询数据...">
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
                  setCurrentStep(2);
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

  /** Step 2: 处理计算 */
  const renderStep3 = () => {
    try {
      return (
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
              formatter={(val) => Number(val).toFixed(1)}
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
          onClick={() => setCurrentStep(3)}
        >
          下一步
        </Button>
        <Button onClick={() => setCurrentStep(1)}>上一步</Button>
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
                onRow={(record) => ({
                  style: record.type === 'S'
                    ? { backgroundColor: '#fafafa' }
                    : undefined,
                })}
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
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ whiteSpace: 'nowrap' }}>工时上限</span>
                        <InputNumber
                          value={rule.maxHours === Infinity ? 9999 : rule.maxHours}
                          min={0}
                          style={{ width: '100%', flex: 1 }}
                          onChange={(val) => {
                            const newRules = [...rules];
                            newRules[index] = {
                              ...newRules[index],
                              maxHours: val === 9999 ? Infinity : (val ?? 0),
                            };
                            setRules(newRules);
                          }}
                        />
                      </div>
                    </Col>
                    <Col span={12}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ whiteSpace: 'nowrap' }}>需求数</span>
                        <InputNumber
                          value={rule.value}
                          min={0}
                          step={0.1}
                          style={{ width: '100%', flex: 1 }}
                          onChange={(val) => {
                            const newRules = [...rules];
                            newRules[index] = {
                              ...newRules[index],
                              value: val ?? 0,
                            };
                            setRules(newRules);
                          }}
                        />
                      </div>
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

      {/* 注意：行高亮样式已移至全局 CSS 或通过 rowClassName + style 实现 */}
        </Card>
      );
    } catch (err) {
      console.error('[renderStep3] 渲染错误:', err);
      return (
        <Card>
          <div style={{ padding: 24, color: 'red' }}>
            <p>处理计算步骤渲染出错:</p>
            <pre>{err instanceof Error ? err.message : String(err)}</pre>
          </div>
        </Card>
      );
    }
  };

  /** Step 3: 导出结果 */
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
        <Button size="large" onClick={() => setCurrentStep(2)}>
          上一步
        </Button>
      </div>
    </Card>
  );

  // ==================== 步骤内容映射 ====================

  const stepContentMap: Record<number, React.ReactNode> = {
    0: renderStep1(),
    1: renderStep2(),
    2: renderStep3(),
    3: renderStep4(),
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
          从本地已同步的 TAPD 数据库中查询需求数据，自动计算需求数和成本归属
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

      {/* 步骤内容 - 带错误保护 */}
      {(() => {
        try {
          return stepContentMap[currentStep];
        } catch (err) {
          console.error(`[步骤${currentStep}] 渲染崩溃:`, err);
          return (
            <Card>
              <div style={{ padding: 24, color: 'red' }}>
                <p><strong>步骤 {currentStep} 渲染出错:</strong></p>
                <pre>{err instanceof Error ? err.stack : String(err)}</pre>
              </div>
            </Card>
          );
        }
      })()}
    </div>
  );
}
