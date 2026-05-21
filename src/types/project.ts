export interface QuarterMilestone {
  quarter: string;      // Q1, Q2, Q3, Q4
  target: string;       // 季度目标
  achievement: string;  // 季度达成
  progress: number;     // 达成率 0-100
}

export interface QuarterCost {
  quarter: string;
  totalCost: number;
}

export interface ProjectItem {
  id: string;
  name: string;
  code: string;
  type: string;
  category: string;     // STRATEGIC | REGULAR | TECHNICAL
  status: string;
  health: string;
  progress: number;
  okrName: string;
  partner: string;
  po: string;
  ownerName?: string;
  teamName?: string;
  milestones: QuarterMilestone[];
  costs: QuarterCost[];
  totalCost: number;
  avgProgress: number;
  startDate?: string;
  endDate?: string;
  description?: string;
}

export interface ProjectStats {
  totalProjects: number;
  strategicCount: number;
  regularCount: number;
  technicalCount: number;
  avgProgress: number;
  totalCost: number;
  highAchievementCount: number;
}

export interface ProjectListResponse {
  list: ProjectItem[];
  total: number;
  page: number;
  pageSize: number;
  stats: ProjectStats;
}
