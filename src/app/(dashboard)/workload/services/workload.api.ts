/**
 * 人力负荷 - API调用封装
 * 封装3个后端API接口的调用逻辑
 */

import type {
  OrgOverview,
  TeamOverview,
  RoleSummaryItem,
  PersonCard,
  CalendarDay,
  ProjectDist,
  TaskTimelineEntry,
} from '../types/workload.types';

const BASE_URL = '/api/v1/workload';

/** 通用API响应结构 */
interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

/**
 * 发送GET请求并解析响应
 */
async function fetchApi<T>(
  endpoint: string,
  params?: Record<string, string>
): Promise<T> {
  const queryString = params
    ? '?' + new URLSearchParams(params).toString()
    : '';

  const response = await fetch(`${BASE_URL}${endpoint}${queryString}`);

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const json: ApiResponse<T> = await response.json();

  if (!json.success) {
    throw new Error(json.message || '请求失败');
  }

  return json.data;
}

// ============================================================
// API 1: 概览接口
// ============================================================

/**
 * 获取概览数据
 *
 * @param startDate - 开始日期 (YYYY-MM-DD)
 * @param endDate - 结束日期 (YYYY-MM-DD)
 * @returns 组织概览 + 团队列表 + 角色端汇总
 */
export function fetchOverview(
  startDate: string,
  endDate: string
): Promise<{
  org: OrgOverview;
  teams: TeamOverview[];
  roleSummary: RoleSummaryItem[];
  /** ⭐ 新增：所有人员饱和度详细数据（用于角色详情弹窗） */
  personSatResults?: import('../../app/api/v1/workload/_lib/types').PersonSatResult[];
}> {
  return fetchApi('/overview', { startDate, endDate });
}

// ============================================================
// API 2: 人员列表接口
// ============================================================

/** 人员列表请求参数 */
export interface FetchPersonsParams {
  startDate: string;
  endDate: string;
  teamId?: string;
  projectId?: string;
  role?: string;
  name?: string;
  page?: number;
  pageSize?: number;
}

/**
 * 获取人员列表
 *
 * @param params - 筛选和分页参数
 * @returns 人员总数 + 分页后的人员列表
 */
export function fetchPersons(
  params: FetchPersonsParams
): Promise<{ total: number; persons: PersonCard[] }> {
  const query: Record<string, string> = {
    startDate: params.startDate,
    endDate: params.endDate,
  };

  // 可选参数
  if (params.teamId) query.teamId = params.teamId;
  if (params.projectId) query.projectId = params.projectId;
  if (params.role) query.role = params.role;
  if (params.name) query.name = params.name;
  if (params.page) query.page = String(params.page);
  if (params.pageSize) query.pageSize = String(params.pageSize);

  return fetchApi('/persons', query);
}

// ============================================================
// API 3: 人员明细接口
// ============================================================

/**
 * 获取人员详情
 *
 * @param name - 人员姓名（URL编码）
 * @param startDate - 开始日期
 * @param endDate - 结束日期
 * @returns 人员信息 + 日历热力图 + 项目分布 + 任务时间线
 */
export function fetchPersonDetail(
  name: string,
  startDate: string,
  endDate: string
): Promise<{
  person: PersonCard;
  calendarHeatmap: CalendarDay[];
  projectDistribution: ProjectDist[];
  taskTimeline: TaskTimelineEntry[];
}> {
  return fetchApi(`/persons/${encodeURIComponent(name)}/detail`, {
    startDate,
    endDate,
  });
}
