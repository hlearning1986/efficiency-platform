/**
 * 每日工时分解模块
 * 将跨天任务的预估/已完成工时按工作日分解到每日
 *
 * 核心规则：
 * - 过去日期：使用完成工时（集中在due日）
 * - 未来日期：使用预估工时均摊到每个工作日
 */

import { calcWorkDays } from './workday.calc';

/** 任务输入数据结构 */
export interface TaskInput {
  id: string;
  name: string;
  owner?: string;
  status: string;
  effort?: number;           // 预估总工时(h)
  effortCompleted?: number;   // 已完成工时(h)
  begin?: Date;               // 开始日期
  due?: Date;                 // 截止日期
  storyId?: string;
  workspaceId: string;
}

/**
 * 分解多个任务的每日工时并合并
 *
 * @param tasks - 任务列表
 * @param startDate - 分析开始日期
 * @param endDate - 分析结束日期
 * @param holidays - 假日集合
 * @param extraWorkdays - 加班日集合
 * @param referenceDate - 参考日期（用于区分过去/未来），默认当前时间
 * @returns 合并后的每日工时记录 { dateStr: hours }
 */
export function buildDailyLoad(
  tasks: TaskInput[],
  startDate: Date,
  endDate: Date,
  holidays: Set<string>,
  extraWorkdays: Set<string>,
  referenceDate: Date = new Date()
): Record<string, number> {
  const merged: Record<string, number> = {};

  for (const task of tasks) {
    // 跳过没有明确起止时间的任务
    if (!task.begin || !task.due) continue;

    const tBegin = new Date(task.begin);
    const tEnd = new Date(task.due);

    // 计算该任务的工作日范围
    const twd = calcWorkDays({
      startDate: tBegin,
      endDate: tEnd,
      holidays,
      extraWorkdays,
    });

    if (twd.length === 0) continue;

    const effort = task.effort || 0;
    const completed = task.effortCompleted || 0;
    const isDone = ['done', 'closed'].includes(task.status.toLowerCase());
    const dueKey = task.due ? new Date(task.due).toISOString().slice(0, 10) : '';

    // 预估工时均摊到每个工作日
    const dailyH = effort > 0 ? Math.round((effort / twd.length) * 100) / 100 : 0;

    for (const d of twd) {
      const dk = d.toISOString().slice(0, 10);
      const isPast = d <= referenceDate; // 包含今天
      let h = 0;

      if (isPast) {
        // ===== 过去/当天日期：使用已完成工时 =====
        if (isDone && completed > 0) {
          // 已完成任务：在due日集中记录已完成工时
          if (dk === dueKey) {
            h = completed;
          }
        } else if (effort > 0) {
          // 未完成但有预估：按工作日均摊预估工时（保守估计）
          h = dailyH;
        }
        // else: 既未完成也无预估，跳过
      } else {
        // ===== 未来日期：使用预估工时均摊 =====
        if (effort > 0) {
          h = dailyH;
        }
      }

      // 累加到合并结果（保留1位小数）
      if (h > 0) {
        merged[dk] = Math.round(((merged[dk] || 0) + h) * 10) / 10;
      }
    }
  }

  return merged;
}
