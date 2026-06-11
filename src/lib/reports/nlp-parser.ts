import dayjs from 'dayjs';

interface ParsedParams {
  projects: string[];
  dateStart: string;
  dateEnd: string;
  statuses: string[];
  reportTitle: string;
}

const PROJECT_PATTERNS = [
  /AI销售专项|ai.?sales/i,
  /CRM_?销售|crm.?sale/i,
  /MCRM_?SCRM|mcrm/i,
  /高顿APP|gaodun.?app/i,
  /BI平台|bi.?platform/i,
  /小吉|xiaoji/i,
];

const PROJECT_NAMES = ['AI销售专项', 'CRM_销售', 'MCRM_SCRM', '高顿APP', 'BI平台', '小吉'];

const TIME_PATTERNS = {
  quarter: /Q([1-4])/i,
  halfYear: /(上|下)半年/i,
  monthRange: /(\d{1,2})\s*[-~至]\s*(\d{1,2})月/i,
  yearRange: /(\d{4})年?/i,
};

function extractProjects(query: string): string[] {
  const found: string[] = [];
  
  for (let i = 0; i < PROJECT_PATTERNS.length; i++) {
    if (PROJECT_PATTERNS[i].test(query)) {
      found.push(PROJECT_NAMES[i]);
    }
  }

  if (found.length === 0 && /所有项目|全部项目|全项目/i.test(query)) {
    return [];
  }

  return found;
}

function extractTimeRange(query: string): { start: string; end: string } {
  const now = dayjs();
  let year = now.year();
  
  const yearMatch = query.match(TIME_PATTERNS.yearRange);
  if (yearMatch) {
    year = parseInt(yearMatch[1]);
  }

  const quarterMatch = query.match(TIME_PATTERNS.quarter);
  if (quarterMatch) {
    const q = parseInt(quarterMatch[1]);
    const startMonth = (q - 1) * 3 + 1;
    const endMonth = q * 3;
    return {
      start: `${year}-${String(startMonth).padStart(2, '0')}-01`,
      end: `${year}-${String(endMonth).padStart(2, '0')}-30`,
    };
  }

  const halfYearMatch = query.match(TIME_PATTERNS.halfYear);
  if (halfYearMatch) {
    const isFirstHalf = halfYearMatch[1] === '上';
    return isFirstHalf
      ? { start: `${year}-01-01`, end: `${year}-06-30` }
      : { start: `${year}-07-01`, end: `${year}-12-31` };
  }

  const monthRangeMatch = query.match(TIME_PATTERNS.monthRange);
  if (monthRangeMatch) {
    const startMonth = parseInt(monthRangeMatch[1]);
    const endMonth = parseInt(monthRangeMatch[2]);
    return {
      start: `${year}-${String(startMonth).padStart(2, '0')}-01`,
      end: `${year}-${String(endMonth).padStart(2, '0')}-30`,
    };
  }

  return {
    start: `${year}-01-01`,
    end: now.format('YYYY-MM-DD'),
  };
}

function generateTitle(params: ParsedParams): string {
  const startDate = dayjs(params.dateStart);
  const endDate = dayjs(params.dateEnd);
  
  let timeDesc = '';
  if (startDate.month() === endDate.month()) {
    timeDesc = `${startDate.format('YYYY年M月')}`;
  } else {
    timeDesc = `${startDate.format('M月')}-${endDate.format('M月')}`;
    if (startDate.year() !== endDate.year()) {
      timeDesc = `${startDate.format('YYYY年M月')}-${endDate.format('YYYY年M月')}`;
    } else {
      timeDesc = `${startDate.year()}年${timeDesc}`;
    }
  }

  const projectDesc = params.projects.length > 0
    ? params.projects.slice(0, 2).join('、') + (params.projects.length > 2 ? `等${params.projects.length}个项目` : '')
    : '全部项目';

  return `${timeDesc} ${projectDesc} Story 发布数据分析报告`;
}

export function parseNaturalLanguageQuery(query: string): ParsedParams {
  const projects = extractProjects(query);
  const { start: dateStart, end: dateEnd } = extractTimeRange(query);

  const params: ParsedParams = {
    projects,
    dateStart,
    dateEnd,
    statuses: ['已发布', '已实现'],
    reportTitle: '',
  };

  params.reportTitle = generateTitle(params);

  console.log('[NLP Parser] 解析结果:', JSON.stringify(params, null, 2));
  return params;
}
