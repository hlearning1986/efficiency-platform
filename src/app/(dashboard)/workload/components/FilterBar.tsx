'use client';

/**
 * FilterBar - 筛选器栏组件
 * 完全匹配原型图设计规范
 *
 * 新版布局：
 * - 左侧：开始日期 | 结束日期 | 查询按钮
 * - 右侧：快捷切换（本月/上月/本季度/本年度）
 */

import React, { useState } from 'react';
import {
  DatePicker,
  Select,
  Input,
  Button,
} from 'antd';
import { SearchOutlined, CalendarOutlined } from '@ant-design/icons';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';
import type { TeamOverview, WorkloadFilters } from '../types/workload.types';
import {
  COLORS,
} from '../utils/design-tokens';
import {
  getThisMonth,
  getLastMonth,
  getThisQuarter,
  getThisYear,
} from '../utils/date-range';

const { RangePicker } = DatePicker;

interface FilterBarProps {
  /** 当前日期范围 */
  dateRange: [Dayjs, Dayjs] | null;
  /** 团队列表（用于下拉选择） */
  teams: TeamOverview[];
  /** 当前筛选条件 */
  filters: WorkloadFilters;
  /** 日期范围变更回调 */
  onDateChange: (dates: [Dayjs, Dayjs] | null) => void;
  /** 筛选条件变更回调 */
  onFilterChange: (filters: WorkloadFilters) => void;
  /** 重置筛选回调 */
  onReset: () => void;
}

/** 快捷周期选项 - 新版 */
const PERIOD_OPTIONS = [
  { key: 'this-month', label: '本月', getRange: getThisMonth },
  { key: 'last-month', label: '上月', getRange: getLastMonth },
  { key: 'this-quarter', label: '本季度', getRange: getThisQuarter },
  { key: 'this-year', label: '本年度', getRange: getThisYear },
];

const FilterBar: React.FC<FilterBarProps> = ({
  dateRange,
  teams,
  filters,
  onDateChange,
  onFilterChange,
  onReset,
}) => {
  // 当前激活的快捷周期（默认本月）
  const [activePeriod, setActivePeriod] = useState<string>('this-month');

  /**
   * 处理快捷周期点击
   */
  const handlePeriodClick = (key: string) => {
    setActivePeriod(key);
    const option = PERIOD_OPTIONS.find((p) => p.key === key);
    if (option) {
      const range = option.getRange();
      onDateChange([dayjs(range.start), dayjs(range.end)]);
    }
  };

  /**
   * 处理单个日期变更
   */
  const handleStartDateChange = (date: Dayjs | null) => {
    if (date && dateRange && dateRange[1]) {
      // 检查是否匹配某个预设周期
      const matched = PERIOD_OPTIONS.find((p) => {
        const range = p.getRange();
        return (
          date.format('YYYY-MM-DD') === range.start &&
          dateRange[1].format('YYYY-MM-DD') === range.end
        );
      });
      setActivePeriod(matched?.key || '');
      onDateChange([date, dateRange[1]]);
    }
  };

  const handleEndDateChange = (date: Dayjs | null) => {
    if (date && dateRange && dateRange[0]) {
      // 检查是否匹配某个预设周期
      const matched = PERIOD_OPTIONS.find((p) => {
        const range = p.getRange();
        return (
          dateRange[0].format('YYYY-MM-DD') === range.start &&
          date.format('YYYY-MM-DD') === range.end
        );
      });
      setActivePeriod(matched?.key || '');
      onDateChange([dateRange[0], date]);
    }
  };

  return (
    <div className="filter-bar" style={{
      background: COLORS.bgCard,
      borderRadius: '16px',
      border: `1px solid ${COLORS.borderLight}`,
      padding: '20px 24px',
      marginBottom: '24px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '20px',
      boxShadow: '0 1px 4px rgba(0,0,0,.05)',
      flexWrap: 'wrap',
    }}>
      {/* ===== 左侧区域：日期选择 + 查询 ===== */}
      <div style={{
        display: 'flex',
        alignItems: 'flex-end',
        gap: '12px',
        flexWrap: 'wrap',
      }}>
        {/* 开始日期 */}
        <div className="form-field" style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
        }}>
          <label className="form-label" style={{
            fontSize: '13px',
            fontWeight: 600,
            color: COLORS.textSecondary,
          }}>
            开始日期
          </label>
          <DatePicker
            value={dateRange?.[0]}
            onChange={(date) => handleStartDateChange(date)}
            allowClear={false}
            format="YYYY/MM/DD"
            placeholder="请选择"
            style={{
              width: 150,
              height: '40px',
              borderRadius: '8px',
              fontSize: '14px',
            }}
            suffixIcon={<CalendarOutlined />}
          />
        </div>

        {/* 结束日期 */}
        <div className="form-field" style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
        }}>
          <label className="form-label" style={{
            fontSize: '13px',
            fontWeight: 600,
            color: COLORS.textSecondary,
          }}>
            结束日期
          </label>
          <DatePicker
            value={dateRange?.[1]}
            onChange={(date) => handleEndDateChange(date)}
            allowClear={false}
            format="YYYY/MM/DD"
            placeholder="请选择"
            style={{
              width: 150,
              height: '40px',
              borderRadius: '8px',
              fontSize: '14px',
            }}
            suffixIcon={<CalendarOutlined />}
          />
        </div>

        {/* 查询按钮 */}
        <Button
          type="primary"
          icon={<SearchOutlined />}
          style={{
            height: '40px',
            paddingLeft: '28px',
            paddingRight: '28px',
            background: COLORS.primary,
            border: 'none',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: 600,
            marginBottom: '1px',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = COLORS.primaryHover;
            e.currentTarget.style.transform = 'translateY(-1px)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(22,119,255,.25)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = COLORS.primary;
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          查询
        </Button>
      </div>

      {/* ===== 右侧区域：快捷切换 ===== */}
      <div className="period-quick-nav" style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
      }}>
        <span className="pq-label" style={{
          fontSize: '13px',
          color: COLORS.textSecondary,
          marginRight: '2px',
          fontWeight: 500,
        }}>
          快捷切换:
        </span>
        {PERIOD_OPTIONS.map((option) => (
          <button
            key={option.key}
            className={`pq-btn ${activePeriod === option.key ? 'active' : ''}`}
            onClick={() => handlePeriodClick(option.key)}
            style={{
              padding: '7px 18px',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer',
              border: `1.5px solid ${activePeriod === option.key ? COLORS.primary : COLORS.borderLight}`,
              background: activePeriod === option.key ? COLORS.primary : '#fff',
              color: activePeriod === option.key ? '#fff' : COLORS.textSecondary,
              transition: 'all .2s ease',
              outline: 'none',
              whiteSpace: 'nowrap',
            }}
            onMouseEnter={(e) => {
              if (activePeriod !== option.key) {
                e.currentTarget.style.borderColor = COLORS.primary;
                e.currentTarget.style.color = COLORS.primary;
                e.currentTarget.style.background = 'rgba(22,119,255,.04)';
              }
            }}
            onMouseLeave={(e) => {
              if (activePeriod !== option.key) {
                e.currentTarget.style.borderColor = COLORS.borderLight;
                e.currentTarget.style.color = COLORS.textSecondary;
                e.currentTarget.style.background = '#fff';
              }
            }}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
};

export default FilterBar;
