import type { RoleType, TeamConfig } from '../types/sprint.types';

export const ROLE_LABELS: Record<RoleType, string> = {
  backend: '后端',
  frontend: '前端',
  mobile: '移动端',
  test: '测试',
};

export const ROLE_COLORS: Record<RoleType, string> = {
  backend: '#1677ff',
  frontend: '#00b42a',
  mobile: '#722ed1',
  test: '#f53f3f',
};

export const DEFAULT_TEAM_CONFIG: TeamConfig = {
  backend: { teamSize: 9, availableDays: 10, leaveDays: 1 },
  frontend: { teamSize: 7, availableDays: 10, leaveDays: 0.5 },
  mobile: { teamSize: 10, availableDays: 10, leaveDays: 0 },
  test: { teamSize: 6, availableDays: 10, leaveDays: 0 },
};

export const SATURATION_THRESHOLDS = {
  low: 60,
  normal: 85,
  high: 100,
} as const;

export const AVG_STORY_EFFORT = 2.5;

export const IDEAL_UTILIZATION_RANGE = {
  min: 70,
  max: 85,
} as const;

export const SATURATION_LABELS: Record<string, string> = {
  low: '空闲',
  normal: '健康',
  high: '满载',
  over: '过载',
};
