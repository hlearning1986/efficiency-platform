// ============================================================
// 人力负荷 - 共享类型定义
// ============================================================

export type WorkloadRole = 'frontend' | 'backend' | 'mobile' | 'test';
export type SaturationLevel = 'low' | 'normal' | 'high' | 'over';
export type TaskStatus = 'done' | 'in_progress' | 'todo';

// ---- 人员原子饱和度结果（Level-5）----
export interface PersonSatResult {
  name: string;
  role: WorkloadRole;
  roleName: string;
  teamName: string;
  mainProject: string;
  project?: string;                  // 前端组件用（别名）
  totalEffort: number;              // 总预估工时(h) - 来自任务effort
  actual?: number;                   // 前端实际工时字段
  capacity: number;                  // 容量上限(h)
  saturation: number;                // 饱和度(%)
  workDayCount: number;              // 工作日天数
  dailyBreakdown: DailyRecord;       // 每日预估工时 { dateStr: hours } - 来自任务
  dailyActualHours: DailyRecord;     // 每日实际工时 { dateStr: hours } - 来自Timesheet ⭐新增
  loanStatus?: string;               // 借调状态
  loanWorkDayCount?: number;        // 借调工作日天数（被借调出去的天数，用于团队分母计算）
  isLoanPerson?: boolean;           // 是否为借调人员（从其他团队借入）
  taskList?: Array<{                 // 该人员的任务列表（用于时间线和tooltip）
    id: string;                      // TAPD任务ID
    name: string;                    // 任务名称
    workspaceId: string;             // TAPD项目ID
    projectName?: string;            // 项目名称
    iterationId?: string;            // 迭代ID
    iterationName?: string;          // 迭代名称
    effort: number;                  // 预估工时(h)
    effortCompleted?: number;        // 完成工时(h)
    begin?: Date;                    // 预计开始日期
    due?: Date;                      // 预计结束日期
    status: string;                  // 任务状态
  }>;
}

/** 每日工时记录 */
export interface DailyRecord {
  [dateStr: string]: number;
}

// ---- 角色聚合结果（Level-4）----
export interface RoleAggResult {
  role: WorkloadRole;
  roleName: string;
  totalHours: number;
  totalCap: number;
  peopleCount: number;
  saturation: number;
}

// ---- 项目聚合结果（Level-3）----
export interface ProjAggResult {
  projectId: string;
  projectName: string;
  roles: ProjRoleAgg[];
  totalHours: number;
  totalCap: number;
  saturation: number;
}

export interface ProjRoleAgg {
  role: WorkloadRole;
  roleName: string;
  hours: number;
  cap: number;
  saturation: number;
}

// ---- 团队聚合结果（Level-2）----
export interface TeamAggResult {
  teamId: string;
  teamName: string;
  projectIds: string[];
  projectName: string[];
  peopleCount: number;
  actualHours: number;
  capacityHours: number;
  saturation: number;
  projects?: ProjAggResult[];
}

// ---- 组织聚合结果（Level-1）----
export interface OrgAggResult {
  totalPeople: number;
  totalCapacity: number;
  totalActual: number;
  saturation: number;
}

// ---- 日历热力图日 ----
export interface CalendarDayItem {
  date: string;
  dayOfWeek: number;
  isWorkday: boolean;
  isHoliday: boolean;
  isExtraWorkday: boolean;
  saturation: number;
  actualHours: number;
  capacityHours: number;
  projects: string[];
  taskCount: number;
}

// ---- 项目工时分布项 ----
export interface ProjectDistItem {
  projectId: string;
  projectName: string;
  hours: number;
  percentage: number;
  color: string;
}

// ---- 任务时间线项 ----
export interface TaskTimelineItem {
  id: string;
  name: string;
  projectName: string;
  projectId: string;
  status: TaskStatus;
  statusLabel: string;
  startDate: string;
  endDate: string;
  estHours: number;
  actHours: number;
  progressPct: number;
  dailyHours: DailyRecord;
  color: string;
  storyId?: string;
  storyName?: string;
}

// ---- API响应类型 ----
export interface WorkloadOverviewResponse {
  org: OrgAggResult;
  teams: TeamAggResult[];
  roleSummary: RoleAggResult[];
  /** ⭐ 新增：所有人员饱和度详细数据（用于角色详情弹窗） */
  personSatResults: PersonSatResult[];
}

export interface PersonListItem {
  name: string;
  avatar: string;
  team: string;
  project: string;
  role: WorkloadRole;
  roleName: string;
  days: number;
  actual: number;
  cap: number;
  sat: number;
  loanStatus?: string;

  // ⭐ 真实的每日任务数据（来自 TAPD）
  dailyBreakdown?: DailyRecord;      // 每日预估工时 { "2026-06-10": 6.2 }
  dailyActualHours?: DailyRecord;    // 每日实际工时 { "2026-06-10": 5.8 }

  // ⭐ 新增：真实任务列表
  taskList?: Array<{
    id: string;
    name: string;
    workspaceId: string;
    effort: number;
    effortCompleted?: number;
    begin?: Date;
    due?: Date;
    status: string;
  }>;
}

export interface PersonListResponse {
  total: number;
  persons: PersonListItem[];
}

export interface PersonDetailResponse {
  person: PersonListItem;
  calendarHeatmap: CalendarDayItem[];
  projectDistribution: ProjectDistItem[];
  taskTimeline: TaskTimelineItem[];
}
