'use client';

/**
 * usePersonList Hook
 * 管理人员列表数据的获取、筛选和分页状态
 */

import { useState, useCallback, useRef } from 'react';
import { message } from 'antd';
import { fetchPersons, type FetchPersonsParams } from '../services/workload.api';
import type { PersonCard, WorkloadFilters } from '../types/workload.types';

interface UsePersonListReturn {
  /** 当前页的人员列表 */
  persons: PersonCard[];
  /** 总人数（用于分页） */
  total: number;
  /** 是否正在加载 */
  loading: boolean;
  /**
   * 加载人员列表
   * @param startDate - 开始日期
   * @param endDate - 结束日期
   * @param filters - 筛选条件
   * @param page - 页码（默认1）
   * @param pageSize - 每页条数（默认50）
   */
  load: (
    startDate: string,
    endDate: string,
    filters?: WorkloadFilters,
    page?: number,
    pageSize?: number
  ) => Promise<void>;
}

export function usePersonList(): UsePersonListReturn {
  const [persons, setPersons] = useState<PersonCard[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  // 用于取消上一次请求
  const abortControllerRef = useRef<AbortController | null>(null);

  const load = useCallback(
    async (
      startDate: string,
      endDate: string,
      filters: WorkloadFilters = {},
      page = 1,
      pageSize = 50
    ) => {
      // 取消上一次请求
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      abortControllerRef.current = new AbortController();
      setLoading(true);

      try {
        const params: FetchPersonsParams = {
          startDate,
          endDate,
          ...filters,
          page,
          pageSize,
        };

        const data = await fetchPersons(params);
        setPersons(data.persons);
        setTotal(data.total);
      } catch (error) {
        // 忽略取消导致的错误
        if ((error as Error).name !== 'AbortError') {
          console.error('[usePersonList] Load error:', error);
          message.error('加载人员列表失败');
        }
      } finally {
        setLoading(false);
        abortControllerRef.current = null;
      }
    },
    []
  );

  return { persons, total, loading, load };
}
