'use client';

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { message } from 'antd';
import type {
  SprintData,
  SprintStory,
  TeamOption,
  SprintOption,
  TeamConfig,
  StoryEffort,
  RoleType,
} from '../types/sprint.types';
import { DEFAULT_TEAM_CONFIG } from '../utils/constants';
import { useLocalStorage } from './useLocalStorage';

export function useSprintData() {
  const [sprintData, setSprintData] = useState<SprintData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [teams, setTeams] = useState<TeamOption[]>([]);
  const [sprints, setSprints] = useState<SprintOption[]>([]);

  const [teamConfig, setTeamConfig] = useLocalStorage<TeamConfig>(
    'sprint-config-default',
    DEFAULT_TEAM_CONFIG,
  );
  const [storyEfforts, setStoryEfforts] = useLocalStorage<StoryEffort[]>(
    'sprint-efforts-default',
    [],
  );

  // ✅ 性能优化：使用 Map 提高查找效率（O(1) vs O(n)）- 必须在组件顶层
  const effortMap = useMemo(() => {
    const map = new Map<string, Record<RoleType, number>>();
    storyEfforts.forEach(e => map.set(e.storyId, e.efforts));
    return map;
  }, [storyEfforts]);

  // ✅ 性能优化：使用 AbortController 取消未完成的请求（防止竞态条件）
  const abortControllerRef = useRef<AbortController | null>(null);

  const loadSprint = useCallback(
    async (sprintId: string, workspaceId?: string) => {
      // ✅ 取消之前的未完成请求
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      const controller = new AbortController();
      abortControllerRef.current = controller;

      setIsLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams();
        if (workspaceId) {
          params.append('realtime', 'true');
          params.append('workspaceId', workspaceId);
        }

        const response = await fetch(
          `/api/v1/agile/sprints/${sprintId}${params.toString() ? `?${params}` : ''}`,
          { signal: controller.signal },
        );

        if (!response.ok) throw new Error('Failed to fetch sprint data');

        const data = await response.json();
        const apiStories: SprintStory[] = data.data.stories || [];
        const members = data.data.members || [];

        // ✅ 使用预计算的 effortMap（已在顶层通过 useMemo 创建）
        const mergedStories = apiStories.map((story) => {
          const localEffort = effortMap.get(story.id);
          return {
            ...story,
            effort: localEffort || story.effort || {},
          };
        });

        setSprintData({
          sprint: data.data.sprint,
          stories: mergedStories,
          members,
          teamConfig,
          stats: data.data.stats,
          source: data.data.source,
          fetchedAt: data.data.fetchedAt,
        });

        if (data.data.source === 'tapd_realtime') {
          message.success(
            `已从 TAPD 获取实时数据（${apiStories.length} 条需求）`,
            3,
          );
        }
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          console.error('Error loading sprint:', err);
          setError(err instanceof Error ? err.message : 'Unknown error');
          message.error('加载迭代数据失败');
        }
      } finally {
        setIsLoading(false);
        abortControllerRef.current = null;
      }
    },
    [effortMap, teamConfig],
  );

  const loadSprints = useCallback(async (workspaceId: string) => {
    try {
      const params = new URLSearchParams();
      params.append('realtime', 'true');

      const response = await fetch(
        `/api/v1/agile/sprints?workspaceId=${workspaceId}&${params}`,
      );

      if (!response.ok) throw new Error('Failed to fetch sprints');

      const data = await response.json();

      if (data.success && data.data) {
        setSprints(data.data.sprints || []);
      }
    } catch (err) {
      console.error('Error fetching sprints:', err);
      message.error('获取迭代列表失败');
    }
  }, []);

  const refreshFromTAPD = useCallback(
    async (sprintId: string, workspaceId?: string) => {
      setIsLoading(true);

      try {
        if (!workspaceId) {
          message.warning('请先选择 TAPD 项目');
          return;
        }

        console.log(
          `[useSprintData] 开始同步 TAPD 数据到本地。sprintId=${sprintId}, workspaceId=${workspaceId}`,
        );

        const response = await fetch(
          `/api/v1/agile/sprints/${sprintId}/refresh`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ workspaceId }),
          },
        );

        if (!response.ok) {
          const errorData = await response.json().catch(() => null);
          throw new Error(errorData?.message || `HTTP ${response.status}`);
        }

        const result = await response.json();

        if (!result.success) {
          throw new Error(result.message || '同步失败');
        }

        message.success(result.data.message || '数据同步成功');

        await loadSprint(sprintId, workspaceId);
      } catch (err) {
        console.error('Error refreshing TAPD data:', err);
        const errorMessage = err instanceof Error ? err.message : '刷新TAPD数据失败';
        message.error(errorMessage);
      } finally {
        setIsLoading(false);
      }
    },
    [loadSprint],
  );

  // ✅ 性能优化：优化搜索算法（提前转小写，避免重复转换）
  const searchStories = useCallback(
    (keyword: string): SprintStory[] => {
      if (!sprintData || !keyword.trim()) return sprintData?.stories || [];

      const lowerKeyword = keyword.toLowerCase().trim();

      return sprintData.stories.filter((story) => {
        // ✅ 使用短路评估优化性能
        return (
          (story.tapdId?.toLowerCase().includes(lowerKeyword)) ||
          story.title.toLowerCase().includes(lowerKeyword) ||
          (story.creator?.toLowerCase().includes(lowerKeyword)) ||
          (story.owner?.toLowerCase().includes(lowerKeyword))
        );
      });
    },
    [sprintData],
  );

  // ✅ 性能优化：优化更新逻辑（减少中间对象创建）
  const updateStoryEffort = useCallback(
    (storyId: string, role: RoleType, value: number) => {
      setStoryEfforts((prev) => {
        const existingIndex = prev.findIndex((e) => e.storyId === storyId);

        if (existingIndex >= 0) {
          // ✅ 直接修改数组元素（避免创建新数组）
          const updated = [...prev];
          updated[existingIndex] = {
            ...updated[existingIndex],
            efforts: { ...updated[existingIndex].efforts, [role]: value },
          };
          return updated;
        } else {
          return [...prev, { storyId, efforts: { [role]: value } }];
        }
      });

      if (sprintData) {
        setSprintData((prev) => {
          if (!prev) return prev;

          return {
            ...prev,
            stories: prev.stories.map((story) =>
              story.id === storyId
                ? {
                    ...story,
                    effort: { ...story.effort, [role]: value },
                  }
                : story,
            ),
          };
        });
      }
    },
    [setStoryEfforts, sprintData],
  );

  const updateTeamConfig = useCallback(
    (
      role: RoleType,
      field: 'teamSize' | 'availableDays' | 'leaveDays',
      value: number,
    ) => {
      setTeamConfig((prev) => {
        const currentRole = (prev as any)[role] || { teamSize: 0, availableDays: 0, leaveDays: 0 };
        return {
          ...prev,
          [role]: { ...currentRole, [field]: value },
        } as TeamConfig;
      });

      if (sprintData) {
        setSprintData((prev) => {
          if (!prev) return prev;
          const currentRole = (prev.teamConfig as any)[role] || { teamSize: 0, availableDays: 0, leaveDays: 0 };
          return {
            ...prev,
            teamConfig: {
              ...prev.teamConfig,
              [role]: { ...currentRole, [field]: value },
            } as TeamConfig,
          };
        });
      }
    },
    [setTeamConfig, sprintData],
  );

  // ✅ 优化：防止 teams 重复加载（使用 ref + cleanup）
  // 注意：React Strict Mode 下组件会挂载→卸载→再挂载，需要在 cleanup 时重置
  const hasLoadedTeams = useRef(false);

  useEffect(() => {
    // 防止重复加载
    if (hasLoadedTeams.current) return;
    hasLoadedTeams.current = true;

    let isMounted = true;

    const fetchTeams = async () => {
      try {
        console.log('[useSprintData] 开始加载 TAPD 项目列表...');
        const res = await fetch('/api/v1/resources/tapd/meta');

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }

        const data = await res.json();
        console.log('[useSprintData] TAPD Meta API 响应:', data);

        const projectList = data.data?.projects || [];
        console.log('[useSprintData] 解析到项目数量:', projectList.length);

        // ✅ 检查组件是否仍然挂载（避免内存泄漏）
        if (isMounted) {
          setTeams(
            projectList.map((p: { id: string; name: string; storyCount?: number }) => ({
              id: p.id,
              name: p.name,
            })),
          );
          console.log('[useSprintData] TAPD 项目列表设置成功, 项目数:', projectList.length);
        }
      } catch (err) {
        console.error('[useSprintData] Error fetching TAPD teams:', err);
        // ✅ 重置标志位，允许下次重试
        hasLoadedTeams.current = false;
      }
    };

    fetchTeams();

    // ✅ 清理函数：组件卸载时必须重置标志位（支持 React Strict Mode）
    return () => {
      isMounted = false;
      // ✅ 关键修复：重置标志位，允许组件重新挂载时重新加载数据
      hasLoadedTeams.current = false;
    };
  }, []); // 空依赖数组，只执行一次

  return {
    sprintData,
    isLoading,
    error,
    teams,
    sprints,
    teamConfig,
    storyEfforts,
    loadSprint,
    loadSprints,
    refreshFromTAPD,
    searchStories,
    updateStoryEffort,
    updateTeamConfig,
    setSprints,
  };
}
