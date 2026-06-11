'use client';

/**
 * useWorkloadOverview Hook
 * 管理概览数据（组织饱和度 + 团队列表 + 角色端汇总 + 人员明细）的获取和状态
 */

import { useState, useCallback, useRef } from 'react';
import { message } from 'antd';
import { fetchOverview } from '../services/workload.api';
import type {
  OrgOverview,
  TeamOverview,
  RoleSummaryItem,
} from '../types/workload.types';
import type { PersonSatResult } from '../../app/api/v1/workload/_lib/types';

interface UseWorkloadOverviewReturn {
  /** 组织概览数据 */
  org: OrgOverview | null;
  /** 团队列表 */
  teams: TeamOverview[];
  /** 角色端汇总 */
  roleSummary: RoleSummaryItem[];
  /** ⭐ 新增：所有人员饱和度详细数据（用于角色详情弹窗） */
  personSatResults: PersonSatResult[];
  /** 是否正在加载 */
  loading: boolean;
  /**
   * 加载概览数据
   * @param startDate - 开始日期 (YYYY-MM-DD)
   * @param endDate - 结束日期 (YYYY-MM-DD)
   */
  load: (startDate: string, endDate: string) => Promise<void>;
}

export function useWorkloadOverview(): UseWorkloadOverviewReturn {
  const [org, setOrg] = useState<OrgOverview | null>(null);
  const [teams, setTeams] = useState<TeamOverview[]>([]);
  const [roleSummary, setRoleSummary] = useState<RoleSummaryItem[]>([]);
  const [personSatResults, setPersonSatResults] = useState<PersonSatResult[]>([]);  // ⭐ 新增
  const [loading, setLoading] = useState(false);

  // 用于取消上一次请求
  const abortControllerRef = useRef<AbortController | null>(null);

  const load = useCallback(async (startDate: string, endDate: string) => {
    // 取消上一次请求
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    setLoading(true);

    try {
      const data = await fetchOverview(startDate, endDate);
      setOrg(data.org);
      setTeams(data.teams);
      setRoleSummary(data.roleSummary);
      // ⭐ 提取人员饱和度详细数据
      if (data.personSatResults && Array.isArray(data.personSatResults)) {
        setPersonSatResults(data.personSatResults);
      } else {
        setPersonSatResults([]);
      }
    } catch (error) {
      // 忽略取消导致的错误
      if ((error as Error).name !== 'AbortError') {
        console.error('[useWorkloadOverview] Load error:', error);
        message.error('加载概览数据失败');
      }
    } finally {
      setLoading(false);
      abortControllerRef.current = null;
    }
  }, []);

  return { org, teams, roleSummary, personSatResults, loading, load };
}
