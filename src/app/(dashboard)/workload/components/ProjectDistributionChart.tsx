'use client';

/**
 * ProjectDistributionChart - 项目工时分布图表（性能优化版）
 *
 * 优化：React.memo 条形行 + 提取公共样式
 */

import React, { useMemo } from 'react';
import type { PersonCard } from '../types/workload.types';

interface ProjectDistributionChartProps {
  person: PersonCard;
}

/** 项目颜色映射表（组件外常量） */
const PROJECT_COLORS = [
  '#1677ff', '#722ed1', '#13c2c2', '#fa8c16',
  '#52c41a', '#eb2f96', '#999',
];

// ============================================================
// 公共样式（组件外部，避免每次渲染重建）
// ============================================================

const BAR_TRACK_STYLE: React.CSSProperties = {
  flex: 1,
  height: '22px',
  background: '#f0f2f5',
  borderRadius: '11px',
  overflow: 'hidden',
  position: 'relative' as const,
};

const THRESHOLD_STYLE: React.CSSProperties = {
  position: 'absolute',
  top: 0,
  left: '70%',
  width: '1.5px',
  height: '100%',
  background: 'rgba(250,173,20,.35)',
  zIndex: 0,
};

// ============================================================
// BarRow - 单个项目条形行（React.memo）
// ============================================================

interface BarRowProps {
  name: string;
  hours: number;
  percent: number;
  color: string;
}

const BarRow = React.memo<BarRowProps>(({ name, hours, percent, color }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
    <div style={{
      fontSize: '12.5px', fontWeight: 600, width: '120px',
      flexShrink: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
    }}>
      {name}
    </div>
    <div
      role="progressbar"
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`${name}: ${percent}%, ${hours}小时`}
      style={BAR_TRACK_STYLE}
    >
      <div style={{
        height: '100%', borderRadius: '11px',
        display: 'flex', alignItems: 'center',
        paddingLeft: percent > 15 ? '10px' : '0',
        transition: 'width .8s ease',
        fontSize: '11px', fontWeight: 700, color: 'white',
        background: color, width: `${percent}%`,
        textShadow: '0 1px 2px rgba(0,0,0,.12)',
      }}>
        {percent > 15 && `${percent}%`}
      </div>
      <div aria-hidden="true" style={THRESHOLD_STYLE} />
    </div>
    <div style={{
      fontSize: '12px', fontWeight: 600, color: '#94a3b8',
      width: '60px', textAlign: 'right', flexShrink: 0,
    }}>
      {hours}h
    </div>
  </div>
));

BarRow.displayName = 'BarRow';

// ============================================================
// 主组件
// ============================================================

const ProjectDistributionChart: React.FC<ProjectDistributionChartProps> = ({ person }) => {
  const projects = useMemo(() => {
    const taskList = (person as Record<string, unknown>).taskList as Array<{ workspaceId?: string; projectName?: string; effort?: number }> || [];

    if (taskList.length === 0) {
      return [{
        name: person.project || '未分配项目',
        hours: Math.round(person.actual * 10) / 10,
        percent: 100,
        color: PROJECT_COLORS[0],
      }];
    }

    // 按 workspaceId 分组
    const projectMap = new Map<string, { name: string; hours: number }>();
    for (const task of taskList) {
      const wsId = task.workspaceId || 'unknown';
      const effort = task.effort || 0;
      if (!projectMap.has(wsId)) {
        projectMap.set(wsId, { name: task.projectName || `项目${String(wsId).slice(-6)}`, hours: 0 });
      }
      projectMap.get(wsId)!.hours += effort;
    }

    // 排序 + 计算百分比
    const arr = Array.from(projectMap.entries())
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => b.hours - a.hours);

    const totalHours = Math.max(arr.reduce((s, p) => s + p.hours, 0), 0.01);

    return arr.map((item, idx) => ({
      ...item,
      hours: Math.round(item.hours * 10) / 10,
      percent: Math.round((item.hours / totalHours) * 100),
      color: PROJECT_COLORS[idx % PROJECT_COLORS.length],
    }));
  }, [person]);

  const totalHours = projects.reduce((sum, p) => sum + p.hours, 0);

  return (
    <div>
      <h4 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '14px', color: '#1a1a2e' }}>
        📊 项目工时分布
      </h4>

      <div role="list" aria-label="项目工时分布列表" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {projects.map((item) => (
          <BarRow key={item.id} {...item} role="listitem" />
        ))}
      </div>

      {totalHours === 0 && (
        <div style={{ textAlign: 'center', padding: '32px 20px', color: '#94a3b8' }}>
          <div style={{ fontSize: '40px', marginBottom: '12px', opacity: 0.4 }}>📊</div>
          <p style={{ fontSize: '13px', lineHeight: 1.6 }}>暂无项目工时数据</p>
          <p style={{ fontSize: '12px', marginTop: '6px', opacity: 0.7 }}>该人员在查询期间未记录实际工时</p>
        </div>
      )}
    </div>
  );
};

export default ProjectDistributionChart;
