'use client';

import { useState, useEffect, useMemo } from 'react';
import type {
  SprintStory,
  TeamConfig,
  MemberDetail,
  CapacityOverview,
  RoleSummary,
} from '../types/sprint.types';
import {
  calculateRoleTotals,
  calculateCapacityOverview,
  calculateRoleSummaries,
  calculateMemberDetails,
} from '../utils/calculations';

interface UseCapacityCalculationReturn {
  capacityOverview: CapacityOverview | null;
  roleSummaries: RoleSummary[];
  memberDetails: MemberDetail[];
}

export function useCapacityCalculation(
  stories: SprintStory[],
  teamConfig: TeamConfig,
  members: MemberDetail[],
): UseCapacityCalculationReturn {
  // 使用 useMemo 直接计算，避免 useEffect + setState 的循环
  const result = useMemo(() => {
    try {
      const roleTotals = calculateRoleTotals(stories);
      const summaries = calculateRoleSummaries(roleTotals, teamConfig);
      const overview = calculateCapacityOverview(summaries);
      const memberDetails = calculateMemberDetails(members, stories, teamConfig);

      return {
        capacityOverview: overview,
        roleSummaries: summaries,
        memberDetails,
      };
    } catch (error) {
      console.error('Error in capacity calculation:', error);
      return {
        capacityOverview: null,
        roleSummaries: [],
        memberDetails: [],
      };
    }
  }, [stories, teamConfig, members]);

  return result;
}
