/**
 * 工作日计算模块
 * 从 iteration-analysis/route.ts 迁移增强
 * 支持排除周末、假日，计入加班日
 */

interface CalcWorkDaysParams {
  startDate: Date;
  endDate: Date;
  holidays: Set<string>;      // 假日集合 (YYYY-MM-DD)
  extraWorkdays: Set<string>; // 加班日集合 (YYYY-MM-DD)
}

/**
 * 计算两个日期之间的工作日列表
 *
 * @param params - 计算参数
 * @returns 工作日Date数组（已排除周末和假日，包含加班日）
 */
export function calcWorkDays(params: CalcWorkDaysParams): Date[] {
  const { startDate, endDate, holidays, extraWorkdays } = params;
  const workDays: Date[] = [];

  // 参数校验
  if (!startDate || !endDate) {
    console.warn('[calcWorkDays] 缺少日期参数，返回空数组');
    return workDays;
  }

  // 使用本地时间创建日期对象，避免时区转换问题
  // 将字符串转换为本地时间的年月日
  const startLocal = new Date(
    startDate.getFullYear(),
    startDate.getMonth(),
    startDate.getDate()
  );
  const endLocal = new Date(
    endDate.getFullYear(),
    endDate.getMonth(),
    endDate.getDate()
  );

  const cur = new Date(startLocal);
  cur.setHours(0, 0, 0, 0);

  const end = new Date(endLocal);
  end.setHours(23, 59, 59, 999);

  while (cur <= end) {
    const dayStr = cur.toISOString().slice(0, 10);
    const isWeekend = cur.getDay() === 0 || cur.getDay() === 6;
    const isHoliday = holidays.has(dayStr);
    const isExtra = extraWorkdays.has(dayStr);

    // 工作日条件：非周末且非假日，或者是加班日
    if ((!isWeekend && !isHoliday) || isExtra) {
      workDays.push(new Date(cur));
    }

    cur.setDate(cur.getDate() + 1);
  }

  return workDays;
}

/**
 * 判断某日期是否为工作日
 *
 * @param date - 待判断日期
 * @param holidays - 假日集合
 * @param extraWorkdays - 加班日集合
 * @returns 是否为工作日
 */
export function isWorkday(
  date: Date,
  holidays: Set<string>,
  extraWorkdays: Set<string>
): boolean {
  const ds = date.toISOString().slice(0, 10);
  return ((date.getDay() !== 0 && date.getDay() !== 6) && !holidays.has(ds)) || extraWorkdays.has(ds);
}

/**
 * 获取日期范围内的所有日期字符串数组
 *
 * @param start - 开始日期
 * @param end - 结束日期
 * @returns 日期字符串数组 (YYYY-MM-DD格式)
 */
export function getDateRangeArray(start: Date, end: Date): string[] {
  const dates: string[] = [];
  const c = new Date(start);
  c.setHours(0, 0, 0, 0);

  const e = new Date(end);
  e.setHours(23, 59, 59, 999);

  while (c <= e) {
    dates.push(c.toISOString().slice(0, 10));
    c.setDate(c.getDate() + 1);
  }

  return dates;
}
