import type {
  RoleType,
  SprintStory,
  TeamConfig,
  MemberDetail,
  CapacityOverview,
  RoleSummary,
  SaturationLevel,
  RiskLevel,
  UtilizationStyle,
} from '../types/sprint.types';
import {
  SATURATION_THRESHOLDS,
  AVG_STORY_EFFORT,
  IDEAL_UTILIZATION_RANGE,
} from './constants';

export function calculateRoleTotals(
  stories: SprintStory[],
): Partial<Record<RoleType, number>> {
  const totals: Partial<Record<RoleType, number>> = {};

  const roles: RoleType[] = ['backend', 'frontend', 'mobile', 'test'];

  roles.forEach((role) => {
    totals[role] = stories.reduce((sum, story) => {
      return sum + (story.effort?.[role] || 0);
    }, 0);
  });

  return totals;
}

export function calculateFinalEffort(teamSize: number, available: number, leave: number): number {
  return Math.max(0, teamSize * available - leave);
}

export function getSaturationLevel(rate: number): SaturationLevel {
  if (rate <= SATURATION_THRESHOLDS.low) return 'low';
  if (rate <= SATURATION_THRESHOLDS.normal) return 'normal';
  if (rate <= SATURATION_THRESHOLDS.high) return 'high';
  return 'over';
}

export function getRiskLevel(utilizationRate: number): RiskLevel {
  if (utilizationRate > 100) return 'danger';
  if (utilizationRate > IDEAL_UTILIZATION_RANGE.max) return 'warning';
  return 'safe';
}

export function getUtilizationStyle(rate: number): UtilizationStyle {
  if (rate < SATURATION_THRESHOLDS.low) {
    return {
      color: '#00b42a',
      gradient: 'linear-gradient(to right, #00b42a, #36cfc9)',
      tipMessage: '团队空闲较多',
    };
  }
  if (rate <= IDEAL_UTILIZATION_RANGE.max) {
    return {
      color: '#1677ff',
      gradient: 'linear-gradient(to right, #1677ff, #4096ff)',
      tipMessage: '利用率健康',
    };
  }
  if (rate <= 100) {
    return {
      color: '#ff7d00',
      gradient: 'linear-gradient(to right, #ff7d00, #ffc53d)',
      tipMessage: '接近满载',
    };
  }
  return {
    color: '#f53f3f',
    gradient: 'linear-gradient(to right, #f53f3f, #ff7875)',
    tipMessage: '已过载！',
  };
}

export function calculateCapacityOverview(
  roleSummaries: RoleSummary[],
): CapacityOverview {
  let totalCapacity = 0;
  let totalUsed = 0;

  roleSummaries.forEach((summary) => {
    totalCapacity += summary.finalEffort;
    totalUsed += summary.requiredEffort;
  });

  const remaining = Math.max(0, totalCapacity - totalUsed);
  const utilizationRate =
    totalCapacity > 0 ? (totalUsed / totalCapacity) * 100 : 0;
  const suggestStories = Math.floor(remaining / AVG_STORY_EFFORT);
  const riskLevel = getRiskLevel(utilizationRate);

  return {
    totalCapacity,
    totalUsed,
    remaining,
    suggestStories,
    utilizationRate,
    riskLevel,
  };
}

export function calculateRoleSummaries(
  roleTotals: Partial<Record<RoleType, number>>,
  teamConfig: TeamConfig,
): RoleSummary[] {
  const roles: RoleType[] = ['backend', 'frontend', 'mobile', 'test'];

  return roles.map((role) => ({
    role,
    requiredEffort: roleTotals[role] || 0,
    finalEffort: calculateFinalEffort(
      (teamConfig as any)[role].teamSize,
      (teamConfig as any)[role].availableDays,
      (teamConfig as any)[role].leaveDays,
    ),
    isSufficient:
      calculateFinalEffort(
        (teamConfig as any)[role].teamSize,
        (teamConfig as any)[role].availableDays,
        (teamConfig as any)[role].leaveDays,
      ) >= (roleTotals[role] || 0),
  }));
}

export function calculateMemberDetails(
  members: MemberDetail[],
  stories: SprintStory[],
  teamConfig: TeamConfig,
): MemberDetail[] {
  return members.map((member) => {
    const memberStories = stories.filter(
      (story) => story.owner === member.name,
    );
    const totalEffort = memberStories.reduce((sum, story) => {
      const roles: RoleType[] = ['backend', 'frontend', 'mobile', 'test'];
      return (
        sum +
        roles.reduce((roleSum, role) => {
          return roleSum + (story.effort?.[role] || 0);
        }, 0)
      );
    }, 0);

    const availableDays =
      (teamConfig as any)[member.role]?.availableDays ||
      DEFAULT_AVAILABLE_DAYS;

    const saturationRate =
      availableDays > 0 ? (totalEffort / availableDays) * 100 : 0;

    return {
      ...member,
      storyCount: memberStories.length,
      totalEffort,
      availableDays,
      actualInput: Math.min(totalEffort, availableDays),
      saturationRate,
    };
  });
}

const DEFAULT_AVAILABLE_DAYS = 10;
