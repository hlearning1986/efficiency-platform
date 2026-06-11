import axios, { type AxiosInstance, type AxiosError } from 'axios';
import { logger } from '@/lib/utils/logger';

// ============================================================
// TAPD API Response Types
// ============================================================

interface TapdPaginatedResponse<T> {
  data: T[];
  total: number;
}

// ============================================================
// Exported Interface Types
// ============================================================

export interface TapdRequirement {
  id: string;
  name: string;
  status: string;
  priority: string;
  description?: string;
  owner: string;
  created: string;
  modified: string;
  completed?: string;
  iteration_id: string;
  category?: string;
  begin?: string;
  due_date?: string;
  workspace_id: string;
}

export interface TapdDefect {
  id: string;
  title: string;
  status: string;
  severity: string;
  priority: string;
  description?: string;
  reporter: string;
  current_owner: string;
  created: string;
  modified: string;
  resolved?: string;
  closed?: string;
  iteration_id: string;
  workspace_id: string;
  category?: string;
  resolution?: string;
}

export interface TapdWorkHour {
  id: string;
  entry_date: string;
  spent: number;
  task_type?: string;
  owner: string;
  workspace_id: string;
  created: string;
  modified: string;
  object_id: string;
  object_type: string;
  iteration_id: string;
  category?: string;
}

export interface TapdIteration {
  id: string;
  name: string;
  status: string;
  startdate: string;
  enddate: string;
  description?: string;
  workspace_id: string;
  created: string;
  modified: string;
  category?: string;
}

// ============================================================
// TAPD Client Configuration
// ============================================================

const PAGE_SIZE = 200;
const MAX_PAGES = 100;

function createTapdClient(): AxiosInstance {
  const baseURL = process.env.TAPD_API_URL;
  if (!baseURL) {
    throw new Error('TAPD_API_URL environment variable is not set');
  }

  const client = axios.create({
    baseURL,
    timeout: 30000,
    headers: {
      'Content-Type': 'application/json',
    },
  });

  client.interceptors.response.use(
    (response) => response,
    (error: AxiosError) => {
      const url = error.config?.url ?? 'unknown';
      const status = error.response?.status;
      const message = error.response?.data
        ? JSON.stringify(error.response.data)
        : error.message;
      logger.error(`TAPD API request failed: ${url}`, {
        status,
        message,
      });
      return Promise.reject(error);
    },
  );

  return client;
}

// ============================================================
// Auto-pagination Helper
// ============================================================

async function fetchAllPages<T>(
  client: AxiosInstance,
  path: string,
  params: Record<string, unknown> = {},
): Promise<T[]> {
  const allItems: T[] = [];

  for (let page = 1; page <= MAX_PAGES; page++) {
    try {
      const response = await client.get<TapdPaginatedResponse<T>>(path, {
        params: {
          ...params,
          limit: PAGE_SIZE,
          page,
        },
      });

      // 防御性检查：确保response.data存在且格式正确
      if (!response.data) {
        logger.warn(`[TAPD Client] Empty response for ${path} page ${page}`);
        break;
      }

      const responseData = response.data as any;
      let data: T[] = [];
      let total = 0;

      // 处理不同的TAPD API响应格式
      if (Array.isArray(responseData)) {
        // 直接返回数组的情况
        data = responseData;
        total = responseData.length;
      } else if (responseData && typeof responseData === 'object') {
        // 标准分页响应 { data: [...], total: N }
        data = Array.isArray(responseData.data) ? responseData.data : [];
        total = typeof responseData.total === 'number' ? responseData.total : data.length;
        
        // 如果data不是数组，记录警告
        if (!Array.isArray(responseData.data) && responseData.data !== undefined && responseData.data !== null) {
          logger.warn(`[TAPD Client] Unexpected data format for ${path}:`, {
            dataType: typeof responseData.data,
            dataValue: responseData.data,
            fullResponse: Object.keys(responseData),
          });
        }
      } else {
        logger.warn(`[TAPD Client] Unexpected response type for ${path}:`, typeof responseData);
        break;
      }

      allItems.push(...data);

      // 分页终止条件
      if (allItems.length >= total || data.length < PAGE_SIZE || data.length === 0) {
        break;
      }

    } catch (error) {
      // 单页请求失败，记录错误但继续（或根据情况中断）
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error(`[TAPD Client] Failed to fetch ${path} page ${page}:`, errorMsg);
      
      // 如果是第一页就失败，抛出异常；否则中断分页
      if (page === 1) {
        throw error;
      } else {
        // 后续页面失败，使用已获取的数据
        logger.warn(`[TAPD Client] Stopping pagination at page ${page} due to error`);
        break;
      }
    }
  }

  return allItems;
}

// ============================================================
// TAPD API Client
// ============================================================

let clientInstance: AxiosInstance | null = null;

function getClient(): AxiosInstance {
  if (!clientInstance) {
    clientInstance = createTapdClient();
  }
  return clientInstance;
}

/**
 * Fetch requirements from TAPD.
 * @param modifiedSince - ISO date string for incremental sync
 */
export async function getRequirements(
  modifiedSince?: string,
): Promise<TapdRequirement[]> {
  const client = getClient();
  const params: Record<string, unknown> = {};
  if (modifiedSince) {
    params.modified = `${modifiedSince}..`;
  }
  return fetchAllPages<TapdRequirement>(client, '/requirements', params);
}

/**
 * Fetch defects from TAPD.
 * @param modifiedSince - ISO date string for incremental sync
 */
export async function getDefects(
  modifiedSince?: string,
): Promise<TapdDefect[]> {
  const client = getClient();
  const params: Record<string, unknown> = {};
  if (modifiedSince) {
    params.modified = `${modifiedSince}..`;
  }
  return fetchAllPages<TapdDefect>(client, '/bugs', params);
}

/**
 * Fetch work hour records from TAPD.
 * @param modifiedSince - ISO date string for incremental sync
 */
export async function getWorkHours(
  modifiedSince?: string,
): Promise<TapdWorkHour[]> {
  const client = getClient();
  const params: Record<string, unknown> = {};
  if (modifiedSince) {
    params.modified = `${modifiedSince}..`;
  }
  return fetchAllPages<TapdWorkHour>(client, '/timesheets', params);
}

/**
 * Fetch iterations from TAPD.
 */
export async function getIterations(): Promise<TapdIteration[]> {
  const client = getClient();
  return fetchAllPages<TapdIteration>(client, '/iterations');
}
