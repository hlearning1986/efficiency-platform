/**
 * 人力负荷页面 - 前端类型定义
 * 与后端API响应类型对应，用于前端组件和Hooks
 */

// ============================================================
// 基础类型
// ============================================================

/** 工作角色 */
export type WorkloadRole = 'frontend' | 'backend' | 'mobile' | 'test';

/** 饱和度等级 */
export type SaturationLevel = 'low' | 'normal' | 'high' | 'over';

/** 任务状态 */
export type TaskStatus = 'done' | 'in_progress' | 'todo';

// ============================================================
// 组织/团队/项目聚合类型
// ============================================================

/** 组织概览 */
export interface OrgOverview {
  totalPeople: number;
  totalCapacity: number;
  totalActual: number;
  saturation: number;
}

/** 团队概览 */
export interface TeamOverview {
  id?: string;
  teamId?: string;
  teamName?: string;
  name?: string;
  projectIds: string[];
  projectName: string[];
  peopleCount: number;
  actualHours: number;
  capacityHours: number;
  saturation: number;
  projects?: ProjectOverview[];
}

/** 项目概览（团队展开时显示） */
export interface ProjectOverview {
  id: string;
  name: string;
  roles: RoleOverview[];
}

/** 角色概览 */
export interface RoleOverview {
  role: WorkloadRole;
  roleName: string;
  hours: number;
  cap: number;
  saturation: number;
}

/** 角色端汇总（组织级） */
export interface RoleSummaryItem {
  role: WorkloadRole;
  roleName: string;
  totalHours: number;
  totalCap: number;
  peopleCount: number;
  saturation: number;
  color: string;
}

// ============================================================
// 人员相关类型
// ============================================================

/** 人员卡片数据 */
export interface PersonCard {
  name: string;
  avatar: string;       // 头像背景颜色
  team: string;
  project: string;
  role: WorkloadRole;
  roleName: string;
  days: number;
  actual: number;       // 实际工时(h)
  cap: number;          // 容量上限(h)
  sat: number;          // 饱和度(%)
  loanStatus?: string;

  // ⭐ 真实任务数据字段（来自 TAPD）
  dailyBreakdown?: Record<string, number>;      // 每日预估工时 { "2026-06-10": 6.2 }
  dailyActualHours?: Record<string, number>;    // 每日实际工时 { "2026-06-10": 5.8 }

  // ⭐ 新增：真实任务列表（用于Tooltip和项目分布）
  taskList?: TaskItem[];                         // 该人员的所有任务
}

/** ⭐ 新增：真实任务项（来自 TAPD Task API） */
export interface TaskItem {
  id: string;                    // TAPD任务ID
  name: string;                  // 任务名称
  workspaceId: string;           // 项目ID
  projectName?: string;          // 项目名称（已映射）
  iterationId?: string;          // 迭代ID
  iterationName?: string;        // 迭代名称
  effort: number;                // 预估工时(h)
  effortCompleted?: number;      // 已完成工时(h)
  begin?: Date;                  // 预计开始日期
  due?: Date;                    // 预计结束日期
  status: string;                // 任务状态 (open/progressing/done)
}

// ============================================================
// 人员详情面板类型
// ============================================================

/** 日历热力图日期项 */
export interface CalendarDay {
  date: string;
  dayOfWeek: number;
  isWorkday: boolean;
  isHoliday: boolean;
  isExtraWorkday: boolean;
  saturation: number;
  actualHours: number;
  capacityHours: number;
  projects: string[];   // 涉及的项目名称列表
  taskCount: number;
}

/** 项目工时分布项 */
export interface ProjectDist {
  projectId: string;
  projectName: string;
  hours: number;
  percentage: number;
  color: string;
}

/** 任务时间线条目 */
export interface TaskTimelineEntry {
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
  dailyHours: Record<string, number>;
  color: string;
  storyId?: string;
  storyName?: string;
}

// ============================================================
// 筛选与状态管理类型
// ============================================================

/** 筛选条件 */
export interface WorkloadFilters {
  teamId?: string;
  projectId?: string;
  role?: string;
  name?: string;
}

/** 页面全局状态 */
export interface WorkloadState {
  dateRange: { start: string; end: string };
  selectedPerson: string | null;
  activeTab: 'saturation' | 'timeline';
  filters: WorkloadFilters;
  expandedTeams: Set<string>;
}
