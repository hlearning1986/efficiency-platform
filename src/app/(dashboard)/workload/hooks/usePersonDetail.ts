'use client';

/**
 * usePersonDetail Hook
 * 管理人员详情数据的获取（日历热力图 + 项目分布 + 任务时间线）
 */

import { useState, useCallback, useRef } from 'react';
import { message } from 'antd';
import { fetchPersonDetail } from '../services/workload.api';
import type {
  PersonCard,
  CalendarDay,
  ProjectDist,
  TaskTimelineEntry,
} from '../types/workload.types';

interface UsePersonDetailReturn {
  /** 人员基本信息 */
  person: PersonCard | null;
  /** 日历热力图数据 */
  calendar: CalendarDay[];
  /** 项目工时分布 */
  projectDistribution: ProjectDist[];
  /** 任务时间线 */
  timeline: TaskTimelineEntry[];
  /** 是否正在加载 */
  loading: boolean;
  /**
   * 加载人员详情
   * @param name - 人员姓名
   * @param startDate - 开始日期
   * @param endDate - 结束日期
   */
  load: (name: string, startDate: string, endDate: string) => Promise<void>;
}

export function usePersonDetail(): UsePersonDetailReturn {
  const [person, setPerson] = useState<PersonCard | null>(null);
  const [calendar, setCalendar] = useState<CalendarDay[]>([]);
  const [projectDistribution, setProjectDistribution] = useState<ProjectDist[]>(
    []
  );
  const [timeline, setTimeline] = useState<TaskTimelineEntry[]>([]);
  const [loading, setLoading] = useState(false);

  // 用于取消上一次请求
  const abortControllerRef = useRef<AbortController | null>(null);

  const load = useCallback(
    async (name: string, startDate: string, endDate: string) => {
      // 取消上一次请求
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      abortControllerRef.current = new AbortController();
      setLoading(true);

      try {
        const data = await fetchPersonDetail(name, startDate, endDate);
        setPerson(data.person);
        setCalendar(data.calendarHeatmap);
        setProjectDistribution(data.projectDistribution);
        setTimeline(data.taskTimeline);
      } catch (error) {
        // 忽略取消导致的错误
        if ((error as Error).name !== 'AbortError') {
          console.error('[usePersonDetail] Load error:', error);
          message.error('加载人员详情失败');
        }
      } finally {
        setLoading(false);
        abortControllerRef.current = null;
      }
    },
    []
  );

  return {
    person,
    calendar,
    projectDistribution,
    timeline,
    loading,
    load,
  };
}
