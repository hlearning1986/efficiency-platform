/**
 * 日期范围工具函数
 * 提供预设日期范围选项
 */

/** 预设日期范围选项 */
export const DATE_PRESETS = [
  {
    label: '本周',
    getRange: () => getThisWeek(),
  },
  {
    label: '下周',
    getRange: () => getNextWeek(),
  },
  {
    label: '本月',
    getRange: () => getThisMonth(),
  },
  {
    label: '下月',
    getRange: () => getNextMonth(),
  },
  {
    label: '近30天',
    getRange: () => getLastNDays(30),
  },
] as const;

/** 日期范围类型 */
export interface DateRange {
  start: string; // YYYY-MM-DD
  end: string;   // YYYY-MM-DD
}

// ============================================================
// 内部辅助函数
// ============================================================

/** 获取今天的0点时间 */
function today(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/** 格式化日期为 YYYY-MM-DD */
function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// ============================================================
// 预设范围实现
// ============================================================

/**
 * 本周（周一到周日）
 */
export function getThisWeek(): DateRange {
  const now = today();
  const dayOfWeek = now.getDay() || 7; // 周日为7
  const monday = new Date(now);
  monday.setDate(now.getDate() - dayOfWeek + 1);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  return {
    start: formatDate(monday),
    end: formatDate(sunday),
  };
}

/**
 * 下周
 */
export function getNextWeek(): DateRange {
  const now = today();
  const dayOfWeek = now.getDay() || 7;
  const nextMonday = new Date(now);
  nextMonday.setDate(now.getDate() - dayOfWeek + 1 + 7);
  const nextSunday = new Date(nextMonday);
  nextSunday.setDate(nextMonday.getDate() + 6);

  return {
    start: formatDate(nextMonday),
    end: formatDate(nextSunday),
  };
}

/**
 * 本月（1号到最后一天）
 */
export function getThisMonth(): DateRange {
  const now = today();
  const year = now.getFullYear();
  const month = now.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  return {
    start: formatDate(firstDay),
    end: formatDate(lastDay),
  };
}

/**
 * 下月
 */
export function getNextMonth(): DateRange {
  const now = today();
  let month = now.getMonth() + 1;
  let year = now.getFullYear();

  // 处理跨年
  if (month > 11) {
    month = 0;
    year += 1;
  }

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  return {
    start: formatDate(firstDay),
    end: formatDate(lastDay),
  };
}

/**
 * 上月
 */
export function getLastMonth(): DateRange {
  const now = today();
  let month = now.getMonth() - 1;
  let year = now.getFullYear();

  // 处理跨年
  if (month < 0) {
    month = 11;
    year -= 1;
  }

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  return {
    start: formatDate(firstDay),
    end: formatDate(lastDay),
  };
}

/**
 * 本季度（当前季度的第一天到最后一天）
 */
export function getThisQuarter(): DateRange {
  const now = today();
  const year = now.getFullYear();
  const month = now.getMonth();
  // 计算当前季度（0-3）
  const quarter = Math.floor(month / 3);
  // 季度起始月份
  const startMonth = quarter * 3;
  const endMonth = startMonth + 2;

  const firstDay = new Date(year, startMonth, 1);
  const lastDay = new Date(year, endMonth + 1, 0);

  return {
    start: formatDate(firstDay),
    end: formatDate(lastDay),
  };
}

/**
 * 本年度（1月1日到12月31日）
 */
export function getThisYear(): DateRange {
  const now = today();
  const year = now.getFullYear();

  const firstDay = new Date(year, 0, 1);
  const lastDay = new Date(year, 11, 31);

  return {
    start: formatDate(firstDay),
    end: formatDate(lastDay),
  };
}

/**
 * 最近N天
 *
 * @param n - 天数
 */
export function getLastNDays(n: number): DateRange {
  const startDate = today();
  startDate.setDate(startDate.getDate() - n + 1);

  return {
    start: formatDate(startDate),
    end: formatDate(today()),
  };
}
