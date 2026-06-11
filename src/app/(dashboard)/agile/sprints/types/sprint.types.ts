export type RoleType = 'backend' | 'frontend' | 'mobile' | 'test';

export interface TeamConfig {
  [role in RoleType]: {
    teamSize: number;
    availableDays: number;
    leaveDays: number;
  };
}

export interface StoryEffort {
  storyId: string;
  efforts: Partial<Record<RoleType, number>>;
}

export interface SprintStory {
  id: string;
  tapdId?: string;
  title: string;
  status: string;
  statusLabel: string;
  priority: number;
  owner?: string;
  creator?: string;
  iterationId: string;
  product?: string; // 产品
  testDate?: string; // 提测时间
  releasePlan?: string; // 发布计划
  remark?: string; // 备注
  effort?: Partial<Record<RoleType, number>>;
  totalEffort?: number;
  taskCount?: number;
  _isRemoved?: boolean; // 是否被临时移除
}

export interface MemberDetail {
  id: string;
  name: string;
  avatar?: string;
  role: RoleType;
  teamName: string;
  storyCount: number;
  totalEffort: number;
  availableDays: number;
  actualInput: number;
  saturationRate: number;
}

export interface CapacityOverview {
  totalCapacity: number;
  totalUsed: number;
  remaining: number;
  suggestStories: number;
  utilizationRate: number;
  riskLevel: 'safe' | 'warning' | 'danger';
}

export interface RoleSummary {
  role: RoleType;
  requiredEffort: number;
  finalEffort: number;
  isSufficient: boolean;
}

export type SaturationLevel = 'low' | 'normal' | 'high' | 'over';
export type RiskLevel = 'safe' | 'warning' | 'danger';

export interface UtilizationStyle {
  color: string;
  gradient: string;
  tipMessage: string;
}

export interface TeamOption {
  id: string;
  name: string;
}

export interface SprintOption {
  id: string;
  name: string;
  startDate?: string;
  endDate?: string;
  status?: string;
}

export interface SprintData {
  sprint: {
    id: string;
    name: string;
    projectId: string;
    projectName: string;
    startDate: string;
    endDate: string;
    status: string;
  };
  stories: SprintStory[];
  members: MemberDetail[];
  teamConfig: TeamConfig;
  stats?: {
    totalEffort: number;
    totalCompleted: number;
    totalRemain: number;
    statusBreakdown: Record<string, number>;
    roleEffort: Partial<Record<RoleType, number>>;
    unmappedOwnerCount: number;
    taskCount?: number;
  };
  source?: string;
  fetchedAt?: string;
}
