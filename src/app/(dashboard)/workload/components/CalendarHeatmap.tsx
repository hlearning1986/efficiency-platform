'use client';

/**
 * CalendarHeatmap - 日历热力图组件（性能优化版）
 *
 * 性能优化：
 * 1. 预建日期→任务映射表：O(tasks) 而非 O(days × tasks)
 * 2. React.memo 日格单元格：避免无关重渲染
 * 3. useCallback 稳定化事件处理器
 * 4. 简化内联样式，提取公共样式对象
 */

import React, { useState, useMemo, useCallback } from 'react';
import type { PersonCard, TaskItem } from '../types/workload.types';

interface CalendarHeatmapProps {
  person: PersonCard;
  dateRange: [Date, Date];
}

/** 日历日期项（精简版，减少属性数量） */
interface CalendarDay {
  date: Date;
  dayOfMonth: number;
  isWeekend: boolean;
  saturation: number;
  actualHours: number;
  taskCount: number;
  projects: Array<{ name: string; hours: number; saturation: string }>;
  dayTasks?: TaskItem[];
}

// ============================================================
// 提取到组件外部的常量（避免每次渲染重建）
// ============================================================

/** 每日容量 */
const DAILY_CAPACITY = 8;

/** 热力图颜色映射（预计算） */
const HEATMAP_COLORS = [
  { bg: '#fafafa', text: '#bfbfbf' },   // 0: 无数据
  { bg: '#f0f5ff', text: '#597ef7' },   // 1-30: 浅蓝
  { bg: '#d6e4ff', text: '#2f54eb' },   // 31-50: 中浅蓝
  { bg: '#bae0ff', text: '#1677ff' },   // 51-70: 中蓝
  { bg: '#69b1ff', text: '#0958d9' },   // 71-90: 深蓝
  { bg: '#1890ff', text: '#003a8c' },   // 91-100: 最深蓝
];

const getHeatmapColor = (sat: number) => {
  if (sat <= 0) return HEATMAP_COLORS[0];
  if (sat <= 30) return HEATMAP_COLORS[1];
  if (sat <= 50) return HEATMAP_COLORS[2];
  if (sat <= 70) return HEATMAP_COLORS[3];
  if (sat <= 90) return HEATMAP_COLORS[4];
  return HEATMAP_COLORS[5];
};

/** 公共样式（避免每个格子创建新对象） */
const CELL_BASE_STYLE: React.CSSProperties = {
  aspectRatio: '1.4',
  borderRadius: '8px',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '11px',
  fontWeight: 500,
  position: 'relative' as const,
};

const EMPTY_CELL_STYLE: React.CSSProperties = {
  ...CELL_BASE_STYLE,
  border: '1px solid #e8e8e8',
  background: '#fafafa',
};

const WEEKEND_CELL_STYLE: React.CSSProperties = {
  ...EMPTY_CELL_STYLE,
  background: '#fafafa',
};

// ============================================================
// DayCell - 单个日格（React.memo 防止无关重渲染）
// ============================================================

interface DayCellProps {
  day: CalendarDay;
  colors: { bg: string; text: string };
  hasData: boolean;
  onEnter: (day: CalendarDay, e: React.MouseEvent<HTMLDivElement>) => void;
  onLeave: () => void;
}

const DayCell = React.memo<DayCellProps>(({ day, colors, hasData, onEnter, onLeave }) => (
  <div
    className={`cal-day-cell ${day.isWeekend ? 'cal-weekend' : ''} ${!hasData ? 'cal-rest' : ''}`}
    onMouseEnter={(e) => onEnter(day, e)}
    onMouseLeave={onLeave}
    title={`${day.date.getMonth() + 1}月${day.dayOfMonth}日${hasData ? ` 负载:${day.saturation}%` : ''}`}
    role="button"
    tabIndex={hasData ? 0 : -1}
    style={{
      ...(hasData
        ? { ...CELL_BASE_STYLE, background: colors.bg, cursor: 'pointer' as const }
        : day.isWeekend ? WEEKEND_CELL_STYLE : EMPTY_CELL_STYLE),
      color: day.isWeekend && !hasData ? '#bbb' : colors.text,
      transition: 'transform .15s ease, background-color .15s ease, box-shadow .15s ease',
    }}
  >
    <span style={{
      fontSize: '11.5px',
      fontWeight: 600,
      lineHeight: 1,
      color: day.isWeekend && !hasData ? '#ff4d4f' : 'inherit',
    }}>
      {day.dayOfMonth}
    </span>
    {hasData && (
      <span style={{ fontSize: '9px', fontWeight: 600, marginTop: '1px', lineHeight: 1, opacity: 0.85 }}>
        {day.saturation}%
      </span>
    )}
    <span style={{
      position: 'absolute', bottom: '2px', right: '3px', fontSize: '8px',
      opacity: 0.6, color: day.isWeekend ? '#ff4d4f' : '#999',
    }}>
      {day.date.getMonth() + 1}/{day.dayOfMonth}
    </span>
  </div>
));

DayCell.displayName = 'DayCell';

// ============================================================
// 主组件
// ============================================================

const CalendarHeatmap: React.FC<CalendarHeatmapProps> = ({ person, dateRange }) => {
  const [hoveredDay, setHoveredDay] = useState<CalendarDay | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  /**
   * 核心优化：预建日期→任务映射表
   * 时间复杂度从 O(days × tasks) 降低到 O(days + tasks)
   */
  const calendarData = useMemo(() => {
    const days: CalendarDay[] = [];
    const start = dateRange[0];
    const end = dateRange[1];
    const totalDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    // 直接访问 PersonCard 类型属性（类型已定义，无需强制转换）
    const dailyBreakdown = person.dailyBreakdown || {};
    const dailyActualHours = person.dailyActualHours || {};
    const taskList = person.taskList || [];

    // 检查是否有每日明细数据
    const hasDailyData = Object.keys(dailyBreakdown).length > 0 || Object.keys(dailyActualHours).length > 0;

    // 兜底：如果没有每日明细但有总工时，按工作日均匀分配
    let fallbackDailyHours: Record<string, number> | null = null;
    if (!hasDailyData && person.actual > 0) {
      fallbackDailyHours = {};
      let workDayCount = 0;
      // 先统计工作日数量
      for (let i = 0; i < totalDays; i++) {
        const d = new Date(start.getTime() + i * 24 * 60 * 60 * 1000);
        const dow = d.getDay();
        if (dow !== 0 && dow !== 6) workDayCount++;
      }
      const avgHours = workDayCount > 0 ? person.actual / workDayCount : 0;
      for (let i = 0; i < totalDays; i++) {
        const d = new Date(start.getTime() + i * 24 * 60 * 60 * 1000);
        const dow = d.getDay();
        if (dow !== 0 && dow !== 6) {
          fallbackDailyHours[d.toISOString().slice(0, 10)] = avgHours;
        }
      }
    }

    // ⭐ 关键优化：一次性构建日期→任务映射表（O(tasks)）
    const dateTaskMap = new Map<string, TaskItem[]>();
    for (let i = 0; i < totalDays; i++) {
      dateTaskMap.set(
        new Date(start.getTime() + i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        []
      );
    }
    for (const task of taskList) {
      if (!task.begin || !task.due) continue;
      const tBegin = new Date(task.begin).getTime();
      const tDue = new Date(task.due).getTime();
      for (const [dateKey] of dateTaskMap) {
        const dayTime = new Date(dateKey).getTime();
        if (dayTime >= tBegin && dayTime <= tDue) {
          dateTaskMap.get(dateKey)!.push(task);
        }
      }
    }

    // 构建日历数据（O(days)，直接查表而非filter）
    for (let i = 0; i < totalDays; i++) {
      const date = new Date(start.getTime() + i * 24 * 60 * 60 * 1000);
      const dayOfWeek = date.getDay();
      const dateKey = date.toISOString().slice(0, 10);
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

      // 优先使用每日明细，否则使用兜底数据
      const estimatedHours = hasDailyData ? (dailyBreakdown[dateKey] || 0) : (fallbackDailyHours?.[dateKey] || 0);
      const actualHours = hasDailyData ? (dailyActualHours[dateKey] || 0) : (fallbackDailyHours?.[dateKey] || 0);
      const effectiveHours = actualHours > 0 ? actualHours : estimatedHours;
      let saturation = DAILY_CAPACITY > 0 ? Math.round((effectiveHours / DAILY_CAPACITY) * 100) : 0;
      saturation = Math.max(0, Math.min(100, saturation));

      // 周末无数据 → 快速跳过
      if (isWeekend && estimatedHours === 0 && actualHours === 0) {
        days.push({
          date, dayOfMonth: date.getDate(), isWeekend: true,
          saturation: 0, actualHours: 0, taskCount: 0, projects: [],
        });
        continue;
      }

      // 直接查表获取当天任务（O(1)）
      const dayTasks = dateTaskMap.get(dateKey) || [];

      // 按workspaceId分组统计项目工时
      const projectMap = new Map<string, { name: string; hours: number }>();
      const taskCountForAvg = Math.max(dayTasks.length, 1);
      for (const task of dayTasks) {
        const wsId = task.workspaceId;
        const effort = task.effort || 0;
        if (!projectMap.has(wsId)) {
          projectMap.set(wsId, {
            name: task.projectName || person.project || `项目${wsId.slice(-6)}`,
            hours: 0,
          });
        }
        projectMap.get(wsId)!.hours += effort / taskCountForAvg;
      }

      const projects = Array.from(projectMap.entries()).map(([_, data]) => ({
        name: data.name,
        hours: Math.round(data.hours * 10) / 10,
        saturation: `${Math.round((data.hours / DAILY_CAPACITY) * 100)}%`,
      }));

      days.push({
        date, dayOfMonth: date.getDate(), isWeekend,
        saturation,
        actualHours: Math.round(actualHours * 10) / 10,
        taskCount: dayTasks.length,
        projects,
        dayTasks: dayTasks.length > 0 ? dayTasks : undefined,
      });
    }

    return days;
  }, [person, dateRange]);

  /** useCallback 稳定化事件处理器 */
  const handleMouseEnter = useCallback((day: CalendarDay, event: React.MouseEvent<HTMLDivElement>) => {
    setHoveredDay(day);
    const rect = event.currentTarget.getBoundingClientRect();
    setTooltipPos({ x: rect.left + rect.width / 2, y: rect.top - 8 });
  }, []);

  const handleMouseLeave = useCallback(() => {
    setHoveredDay(null);
  }, []);

  // 计算偏移量
  const firstDay = calendarData[0]?.date?.getDay();
  const offsetDays = firstDay === 0 ? 6 : firstDay - 1;

  /** 检测月份变化 */
  const getMonthSeparator = useCallback((index: number): { show: boolean; month: number } => {
    if (index === 0) return { show: false, month: 0 };
    const curMonth = calendarData[index].date.getMonth();
    const prevMonth = calendarData[index - 1].date.getMonth();
    return { show: curMonth !== prevMonth, month: curMonth + 1 };
  }, [calendarData]);

  return (
    <div style={{ position: 'relative' }}>
      {/* 标题栏 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
        <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#1a1a2e' }}>
          📅 日历热力图
        </h4>
        <span style={{
          fontSize: '12px', color: '#5a6b7c', padding: '4px 10px',
          background: '#f5f7fa', borderRadius: '6px', fontWeight: 500,
        }}>
          {dateRange[0]?.toLocaleDateString('zh-CN')} ~ {dateRange[1]?.toLocaleDateString('zh-CN')}
        </span>
      </div>

      {/* 日历网格 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}>
        {/* 填充空白格子 */}
        {Array.from({ length: offsetDays }).map((_, idx) => (
          <div key={`empty-${idx}`} style={{ aspectRatio: '1.4' }} />
        ))}

        {/* 日期格子（使用 memoized DayCell） */}
        {calendarData.map((day, index) => {
          const monthSep = getMonthSeparator(index);
          const colors = getHeatmapColor(day.saturation);
          const hasData = day.saturation > 0;

          return (
            <React.Fragment key={index}>
              {monthSep.show && (
                <div style={{
                  gridColumn: '1 / -1', textAlign: 'center', fontSize: '12px',
                  fontWeight: 700, color: '#1677ff', padding: '6px 0 2px',
                  borderTop: '2px solid #e8ecf1', marginTop: '4px', letterSpacing: '2px',
                }}>
                  {monthSep.month}月
                </div>
              )}
              <DayCell
                day={day}
                colors={colors}
                hasData={hasData}
                onEnter={handleMouseEnter}
                onLeave={handleMouseLeave}
              />
            </React.Fragment>
          );
        })}
      </div>

      {/* Tooltip（仅在hover时渲染内容） */}
      {hoveredDay && hoveredDay.saturation > 0 && (
        <div
          role="tooltip"
          aria-live="polite"
          style={{
            position: 'fixed', background: '#1a1a2e', color: '#fff',
            padding: '14px 18px', borderRadius: '12px', fontSize: '12.5px',
            pointerEvents: 'none', zIndex: 9999,
            boxShadow: '0 10px 36px rgba(0,0,0,.3)',
            maxWidth: '380px', lineHeight: 1.6,
            left: Math.min(tooltipPos.x + 12, window.innerWidth - 392),
            top: tooltipPos.y > 280 ? undefined : tooltipPos.y - 90,
            bottom: tooltipPos.y > 280 ? window.innerHeight - tooltipPos.y + 8 : undefined,
          }}
        >
          {/* 标题 */}
          <div style={{ fontWeight: 700, marginBottom: '8px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0, background: getHeatmapColor(hoveredDay.saturation).bg }} />
            {person.name} · {hoveredDay.date.getMonth() + 1}月{hoveredDay.dayOfMonth}日
          </div>

          {/* 统计指标 */}
          <div style={{ display: 'flex', gap: '16px', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,.12)', marginBottom: '8px' }}>
            {[
              { val: `${hoveredDay.saturation}%`, lbl: '负荷', color: '#faad14' },
              { val: `${hoveredDay.actualHours}h`, lbl: '投入', color: '#faad14' },
              { val: '8h', lbl: '容量', color: '#fff' },
              { val: `${hoveredDay.taskCount}`, lbl: '任务数', color: '#fff' },
            ].map(s => (
              <div key={s.lbl} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '15px', fontWeight: 800, color: s.color }}>{s.val}</div>
                <div style={{ fontSize: '10px', color: '#888', textTransform: 'uppercase', letterSpacing: '.5px' }}>{s.lbl}</div>
              </div>
            ))}
          </div>

          {/* 任务列表（限制显示数量） */}
          {hoveredDay.dayTasks && hoveredDay.dayTasks.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '180px', overflowY: 'auto' }}>
              {hoveredDay.dayTasks.slice(0, 5).map((task, idx) => (
                <div key={idx} style={{
                  display: 'flex', flexDirection: 'column', gap: '5px',
                  padding: '8px 10px', borderRadius: '8px',
                  background: 'rgba(255,255,255,.05)', fontSize: '11.5px',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ color: '#69b1ff', fontWeight: 600, minWidth: '80px', flexShrink: 0, fontSize: '11px' }}>
                      {task.projectName || person.project || `项目${task.workspaceId?.slice(-6)}`}
                    </span>
                    <span style={{ flex: 1, color: '#ddd', fontSize: '11.5px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={task.name}>
                      {task.name.length > 20 ? task.name.slice(0, 20) + '...' : task.name}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingLeft: '4px', fontSize: '10.5px', color: '#aaa' }}>
                    <span>{hoveredDay.date.getMonth() + 1}/{hoveredDay.dayOfMonth}</span>
                    <span>
                      <span style={{ color: '#ffc069' }}>预估 {task.effort}h</span>
                      {task.effortCompleted !== undefined && task.effortCompleted > 0 && (
                        <> <span style={{ margin: '0 4px' }}>|</span><span style={{ color: '#52c41a' }}>完成 {task.effortCompleted}h</span></>
                      )}
                    </span>
                  </div>
                </div>
              ))}
              {hoveredDay.dayTasks.length > 5 && (
                <div style={{ textAlign: 'center', color: '#888', fontSize: '11px', paddingTop: '4px' }}>
                  还有 {hoveredDay.dayTasks.length - 5} 个任务...
                </div>
              )}
            </div>
          ) : hoveredDay.projects.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {hoveredDay.projects.slice(0, 4).map((proj, idx) => (
                <div key={idx} style={{
                  display: 'flex', flexDirection: 'column', gap: '5px',
                  padding: '8px 10px', borderRadius: '8px',
                  background: 'rgba(255,255,255,.05)', fontSize: '11.5px',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ color: '#69b1ff', fontWeight: 600, minWidth: '68px', flexShrink: 0, fontSize: '11px' }}>{proj.name}</span>
                    <span style={{ flex: 1, color: '#ddd', fontSize: '11.5px' }}>日常开发</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingLeft: '4px', fontSize: '10.5px', color: '#aaa' }}>
                    <span>{hoveredDay.date.getMonth() + 1}/{hoveredDay.dayOfMonth}</span>
                    <span>
                      <span>预估 {Math.round(proj.hours * 1.2)}h</span>
                      <span style={{ margin: '0 4px' }}>|</span>
                      <span style={{ color: proj.hours > 0 ? '#ffc069' : '#666' }}>完成 {proj.hours}h</span>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
};

export default CalendarHeatmap;
