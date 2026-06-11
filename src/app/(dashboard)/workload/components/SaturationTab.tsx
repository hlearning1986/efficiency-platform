'use client';

/**
 * SaturationTab - 每日饱和度Tab组件
 * 显示日历热力图 + 项目工时分布
 *
 * 特点：
 * - 日历网格展示每日饱和度
 * - 颜色编码：绿色(空闲) → 蓝色(健康) → 橙色(满载) → 红色(过载)
 * - 右侧显示项目工时分布饼图/条形图
 */

import React from 'react';
import { Card, Tooltip, Progress } from 'antd';
import type { CalendarDay, ProjectDist } from '../types/workload.types';
import { getSaturationColor } from '../utils/saturation';

interface SaturationTabProps {
  /** 日历热力图数据 */
  calendar: CalendarDay[];
  /** 项目工时分布 */
  projectDistribution: ProjectDist[];
}

const SaturationTab: React.FC<SaturationTabProps> = ({
  calendar,
  projectDistribution,
}) => {
  // 按周分组日历数据
  const weeks = groupByWeek(calendar);

  return (
    <div className="space-y-4">
      {/* ===== Section 1: 日历热力图 ===== */}
      <Card title="每日饱和度" size="small">
        {/* 星期标题行 */}
        <div className="grid grid-cols-7 gap-1 mb-2 text-center text-xs text-gray-400">
          <div>一</div>
          <div>二</div>
          <div>三</div>
          <div>四</div>
          <div>五</div>
          <div className="text-red-400">六</div>
          <div className="text-red-400">日</div>
        </div>

        {/* 周网格 */}
        <div className="space-y-1">
          {weeks.map((week, weekIndex) => (
            <div key={weekIndex} className="grid grid-cols-7 gap-1">
              {week.map((day) => (
                <Tooltip
                  key={day.date}
                  title={
                    <div>
                      <div>{day.date}</div>
                      <div>饱和度：{Math.round(day.saturation)}%</div>
                      <div>
                        工时：{day.actualHours}h / {day.capacityHours}h
                      </div>
                      {day.projects.length > 0 && (
                        <div>项目：{day.projects.join(', ')}</div>
                      )}
                    </div>
                  }
                >
                  <div
                    className={`h-8 rounded cursor-pointer flex items-center justify-center text-xs font-medium transition-all ${
                      day.isWorkday ? 'hover:scale-110' : 'bg-gray-50'
                    }`}
                    style={{
                      backgroundColor: day.isWorkday
                        ? getSaturationColor(day.saturation)
                        : undefined,
                      color: day.isWorkday ? '#fff' : '#c9cdd4',
                      opacity: day.isWorkday
                        ? Math.min(1, (day.saturation / 100) * 0.8 + 0.2)
                        : 0.5,
                    }}
                  >
                    {new Date(day.date).getDate()}
                  </div>
                </Tooltip>
              ))}
            </div>
          ))}
        </div>

        {/* 图例 */}
        <div className="flex items-center justify-end mt-3 gap-2 text-xs text-gray-400">
          <span>空闲</span>
          <div className="w-4 h-4 rounded" style={{ backgroundColor: getSaturationColor(30) }} />
          <span>健康</span>
          <div className="w-4 h-4 rounded" style={{ backgroundColor: getSaturationColor(70) }} />
          <span>满载</span>
          <div className="w-4 h-4 rounded" style={{ backgroundColor: getSaturationColor(90) }} />
          <span>过载</span>
          <div className="w-4 h-4 rounded" style={{ backgroundColor: getSaturationColor(110) }} />
        </div>
      </Card>

      {/* ===== Section 2: 项目工时分布 ===== */}
      <Card title="项目工时分布" size="small">
        <div className="space-y-2">
          {projectDistribution.map((proj) => (
            <div key={proj.projectId}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium">{proj.projectName}</span>
                <span className="text-sm text-gray-500">
                  {proj.hours}h ({Math.round(proj.percentage)}%)
                </span>
              </div>
              <Progress
                percent={Math.min(proj.percentage, 100)}
                strokeColor={proj.color}
                showInfo={false}
                size="small"
              />
            </div>
          ))}

          {projectDistribution.length === 0 && (
            <div className="text-center py-4 text-gray-400">暂无数据</div>
          )}
        </div>
      </Card>
    </div>
  );
};

/**
 * 将日历数据按周分组（每7天一组）
 */
function groupByWeek(calendar: CalendarDay[]): CalendarDay[][] {
  const weeks: CalendarDay[][] = [];
  let currentWeek: CalendarDay[] = [];

  for (const day of calendar) {
    currentWeek.push(day);

    // 如果是周日或者最后一天，结束当前周
    if (day.dayOfWeek === 0 || calendar.indexOf(day) === calendar.length - 1) {
      // 补齐7天（前面可能缺少周一到周六）
      while (currentWeek.length < 7 && currentWeek.length > 0) {
        // 在开头插入空白天
        currentWeek.unshift({
          date: '',
          dayOfWeek: currentWeek[0].dayOfWeek - 1,
          isWorkday: false,
          isHoliday: false,
          isExtraWorkday: false,
          saturation: 0,
          actualHours: 0,
          capacityHours: 8,
          projects: [],
          taskCount: 0,
        });
      }
      weeks.push(currentWeek);
      currentWeek = [];
    }
  }

  // 处理剩余天数
  if (currentWeek.length > 0) {
    weeks.push(currentWeek);
  }

  return weeks;
}

export default SaturationTab;
