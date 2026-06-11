import dayjs from 'dayjs';

interface ChartData {
  months: string[];
  monthlyTotals: number[];
  projectMonthly: Record<string, number[]>;
  projectHours?: Record<string, number[]>; // 工时分段数据
  teamDefs?: TeamDef[]; // 团队定义
}

interface TeamDef {
  name: string;
  color: string;
  projects: string[];
  storyCount: number;
  totalHours: number;
  hourDist?: number[]; // [小于1人天, 1-3人天, 3-6人天, 大于6人天]
  insight: string;
}

export function renderHTMLReport(
  title: string,
  meta: string,
  chartData: ChartData
): string {
  const { months, monthlyTotals, projectMonthly, projectHours = {}, teamDefs = [] } = chartData;

  const ALL_MONTH_COLORS = [
    '#3b82f6', '#10b981', '#f59e0b', '#ef4444',
    '#8b5cf6', '#06b6d4', '#84cc16', '#f97316',
    '#ec4899', '#14b8a6', '#a855f7', '#eab308',
  ];
  const monthColors = ALL_MONTH_COLORS.slice(0, months.length);
  const monthColorsLight = monthColors.map(c => c.replace(')', ',.75)').replace('rgb', 'rgba').replace('#', 'rgba(').replace(/([a-f0-9]{6})/i, (m) => {
    const r = parseInt(m.slice(0,2), 16);
    const g = parseInt(m.slice(2,4), 16);
    const b = parseInt(m.slice(4,6), 16);
    return `${r},${g},${b},.75`;
  }));

  const projectEntries = Object.entries(projectMonthly);
  const totalStories = monthlyTotals.reduce((a, b) => a + b, 0);
  const totalProjects = projectEntries.length;
  const totalTeams = teamDefs.length;

  // HTML标签常量
  const SCRIPT_CLOSE = '<' + '/script>';

  // 格式化月份显示
  const displayMonths = months.map(m => {
    if (m.match(/^\d{4}-\d{2}$/)) {
      return m.split('-')[1] + '月';
    }
    return m;
  });

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(title)}</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js">${SCRIPT_CLOSE}
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
  :root {
    --blue-50: oklch(97% 0.02 250); --blue-100: oklch(93% 0.04 250); --blue-200: oklch(86% 0.07 250);
    --blue-400: oklch(70% 0.14 250); --blue-500: oklch(60% 0.17 250); --blue-600: oklch(50% 0.18 250);
    --blue-700: oklch(42% 0.16 250); --blue-800: oklch(32% 0.12 250);
    --gray-50: oklch(98% 0.005 250); --gray-100: oklch(95% 0.008 250); --gray-200: oklch(90% 0.012 250);
    --gray-300: oklch(82% 0.018 250); --gray-400: oklch(65% 0.025 250); --gray-500: oklch(50% 0.03 250);
    --gray-600: oklch(38% 0.025 250); --gray-700: oklch(28% 0.02 250); --gray-800: oklch(18% 0.015 250);
    --gray-900: oklch(12% 0.01 250);
    --green-500: oklch(65% 0.15 160); --green-600: oklch(55% 0.14 160);
    --amber-500: oklch(75% 0.15 75); --amber-600: oklch(65% 0.14 75);
    --red-500: oklch(62% 0.22 25); --red-600: oklch(52% 0.2 25);
    --purple-500: oklch(62% 0.18 300); --purple-600: oklch(52% 0.16 300);
    --pink-500: oklch(65% 0.18 340); --pink-600: oklch(55% 0.16 340);
    --bg: var(--gray-50); --surface: #ffffff; --border: var(--gray-200); --border-subtle: var(--gray-100);
    --text-primary: var(--gray-800); --text-secondary: var(--gray-500); --text-muted: var(--gray-400);
    --accent: var(--blue-600); --accent-bg: var(--blue-50);
    --space-1: 4px; --space-2: 8px; --space-3: 12px; --space-4: 16px; --space-5: 20px;
    --space-6: 24px; --space-8: 32px; --space-10: 40px; --space-12: 48px; --space-16: 64px;
    --font: 'Noto Sans SC', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    --text-xs: .75rem; --text-sm: .875rem; --text-base: 1rem; --text-lg: 1.125rem;
    --text-xl: 1.25rem; --text-2xl: 1.5rem; --text-3xl: 1.875rem;
    --shadow-sm: 0 1px 2px rgba(0,0,0,.04), 0 1px 3px rgba(0,0,0,.06);
    --shadow-md: 0 4px 6px rgba(0,0,0,.04), 0 2px 4px rgba(0,0,0,.04);
    --shadow-lg: 0 10px 15px rgba(0,0,0,.06), 0 4px 6px rgba(0,0,0,.04);
    --radius-sm: 6px; --radius-md: 10px; --radius-lg: 14px; --radius-xl: 20px; --radius-full: 9999px;
    --ease-out-quart: cubic-bezier(.25,1,.5,1); --ease-out-expo: cubic-bezier(.16,1,.3,1);
  }
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html { font-size: 16px; -webkit-font-smoothing: antialiased; }
  body { font-family: var(--font); background: var(--bg); color: var(--text-primary); line-height: 1.6; }

  .header {
    background: var(--gray-900); color: #fff; padding: var(--space-10) var(--space-16) var(--space-10);
    position: relative; overflow: hidden;
  }
  .header::before {
    content: ''; position: absolute; top: -50%; right: -10%; width: 600px; height: 600px;
    background: radial-gradient(circle, oklch(50% 0.18 250) 0%, transparent 70%); opacity: .3;
    pointer-events: none;
  }
  .header::after {
    content: ''; position: absolute; bottom: 0; left: 0; right: 0; height: 1px;
    background: linear-gradient(90deg, transparent, oklch(60% 0.15 250), transparent);
  }
  .header-inner { position: relative; z-index: 1; max-width: 1200px; margin: 0 auto; }
  .header-eyebrow {
    display: inline-flex; align-items: center; gap: var(--space-2);
    font-size: var(--text-xs); font-weight: 600; letter-spacing: .1em; text-transform: uppercase;
    color: var(--blue-400); margin-bottom: var(--space-3);
  }
  .header h1 {
    font-size: clamp(1.5rem, 4vw, var(--text-3xl)); font-weight: 800; letter-spacing: -.02em;
    line-height: 1.2; color: #fff; margin-bottom: var(--space-3);
  }
  .header p { font-size: var(--text-sm); color: var(--gray-400); max-width: 600px; }
  .header-meta { display: flex; gap: var(--space-2); margin-top: var(--space-5); }
  .meta-badge {
    display: inline-flex; align-items: center; gap: var(--space-2);
    font-size: var(--text-xs); font-weight: 500; color: var(--gray-400);
    background: rgba(255,255,255,.08); border: 1px solid rgba(255,255,255,.12);
    padding: var(--space-1) var(--space-3); border-radius: var(--radius-full);
  }
  .meta-badge strong { color: var(--gray-200); }

  .kpi-section {
    max-width: 1200px; margin: calc(-1 * var(--space-8)) auto 0; padding: 0 var(--space-6);
    position: relative; z-index: 10;
  }
  .kpi-grid { display: grid; grid-template-columns: 2fr 1fr; gap: var(--space-4); align-items: start; }
  .kpi-panel {
    background: var(--surface); border-radius: var(--radius-xl); box-shadow: var(--shadow-lg);
    border: 1px solid var(--border-subtle); padding: var(--space-6);
    animation: slideUp .5s var(--ease-out-expo) both;
  }
  .kpi-panel:nth-child(2) { animation-delay: .08s; }
  .kpi-panel-title {
    font-size: var(--text-xs); font-weight: 700; letter-spacing: .08em; text-transform: uppercase;
    color: var(--text-muted); margin-bottom: var(--space-5); display: flex; align-items: center; gap: var(--space-2);
  }
  .kpi-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(80px, 1fr)); gap: var(--space-3); }
  .kpi-card {
    text-align: center; padding: var(--space-5) var(--space-3); border-radius: var(--radius-lg);
    background: var(--gray-50); border: 1px solid var(--border-subtle);
    transition: transform .2s var(--ease-out-quart), box-shadow .2s; cursor: default;
  }
  .kpi-card:hover { transform: translateY(-2px); box-shadow: var(--shadow-md); }
  .kpi-card.total { background: var(--gray-900); border-color: var(--gray-800); }
  .kpi-card.total .kpi-val { color: #fff; }
  .kpi-card.total .kpi-label { color: var(--gray-400); }
  .kpi-card.highlight { background: var(--accent-bg); border-color: oklch(60% 0.1 250 / .2); }
  .kpi-val {
    font-size: var(--text-2xl); font-weight: 800; color: var(--text-primary); line-height: 1;
    font-variant-numeric: tabular-nums; letter-spacing: -.02em;
  }
  .kpi-label { font-size: var(--text-xs); color: var(--text-secondary); margin-top: var(--space-2); font-weight: 500; }
  .kpi-sub { font-size: 10px; color: var(--text-muted); margin-top: 2px; }
  .kpi-org-grid { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3); }
  .kpi-org-card {
    padding: var(--space-5); border-radius: var(--radius-lg); background: var(--gray-50);
    border: 1px solid var(--border-subtle); text-align: center;
    transition: transform .2s var(--ease-out-quart);
  }
  .kpi-org-card:hover { transform: translateY(-2px); }
  .kpi-org-card .kpi-val { color: var(--blue-700); }
  .kpi-org-card .kpi-sub { color: var(--blue-400); font-weight: 600; }

  .container { max-width: 1200px; margin: 0 auto; padding: var(--space-8) var(--space-6) var(--space-16); }

  .section { margin-bottom: var(--space-10); animation: slideUp .5s var(--ease-out-expo) both; }
  .section-header {
    display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--space-5);
    padding-bottom: var(--space-4); border-bottom: 2px solid var(--border);
  }
  .section-title {
    font-size: var(--text-lg); font-weight: 700; color: var(--text-primary);
    display: flex; align-items: center; gap: var(--space-3);
  }
  .section-title::before {
    content: ''; display: block; width: 4px; height: 1.2em; border-radius: 2px; background: var(--accent);
  }
  .section-badge {
    font-size: var(--text-xs); font-weight: 600; color: var(--accent); background: var(--accent-bg);
    padding: var(--space-1) var(--space-3); border-radius: var(--radius-full);
    border: 1px solid oklch(60% 0.1 250 / .15);
  }

  .charts-row { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-5); margin-bottom: var(--space-10); }
  .chart-card {
    background: var(--surface); border-radius: var(--radius-xl); box-shadow: var(--shadow-sm);
    border: 1px solid var(--border-subtle); padding: var(--space-6);
    animation: slideUp .5s var(--ease-out-expo) both; transition: box-shadow .2s;
  }
  .chart-card:hover { box-shadow: var(--shadow-md); }
  .chart-card:nth-child(2) { animation-delay: .06s; }
  .chart-card-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: var(--space-5); }
  .chart-card-title { font-size: var(--text-base); font-weight: 700; color: var(--text-primary); }
  .chart-card-subtitle { font-size: var(--text-xs); color: var(--text-muted); margin-top: 2px; }
  .chart-legend { display: flex; gap: var(--space-4); flex-wrap: wrap; }
  .legend-item { display: flex; align-items: center; gap: var(--space-2); font-size: var(--text-xs); color: var(--text-secondary); font-weight: 500; }
  .legend-dot { width: 8px; height: 8px; border-radius: 2px; flex-shrink: 0; }
  .chart-wrap { height: 300px; position: relative; }

  /* Team Accordion */
  .team-list { display: flex; flex-direction: column; gap: var(--space-4); }
  .team-card {
    background: var(--surface); border-radius: var(--radius-xl); box-shadow: var(--shadow-sm);
    border: 1px solid var(--border-subtle); overflow: hidden;
    animation: slideUp .5s var(--ease-out-expo) both; transition: box-shadow .2s;
  }
  .team-card:hover { box-shadow: var(--shadow-md); }
  .team-header {
    display: flex; align-items: center; justify-content: space-between;
    padding: var(--space-5) var(--space-6); cursor: pointer; transition: background .15s; gap: var(--space-4);
  }
  .team-header:hover { background: var(--gray-50); }
  .team-header-left { display: flex; align-items: center; gap: var(--space-4); }
  .team-color-bar { width: 4px; height: 48px; border-radius: 2px; flex-shrink: 0; }
  .team-name { font-size: var(--text-base); font-weight: 700; color: var(--text-primary); margin-bottom: var(--space-1); }
  .team-pills { display: flex; gap: var(--space-2); flex-wrap: wrap; }
  .pill {
    font-size: 11px; font-weight: 500; color: var(--text-secondary); background: var(--gray-100);
    padding: 2px var(--space-3); border-radius: var(--radius-full); border: 1px solid var(--border);
  }
  .team-header-right { display: flex; align-items: center; gap: var(--space-5); flex-shrink: 0; }
  .team-stats { display: flex; gap: var(--space-4); font-size: var(--text-sm); color: var(--text-secondary); }
  .team-stat strong { color: var(--text-primary); font-weight: 700; }
  .team-months { display: flex; gap: var(--space-3); font-size: var(--text-xs); color: var(--text-muted); }
  .team-months span { white-space: nowrap; }
  .team-arrow {
    width: 32px; height: 32px; border-radius: var(--radius-md); background: var(--gray-100);
    display: flex; align-items: center; justify-content: center; font-size: 14px; color: var(--text-secondary);
    transition: transform .25s var(--ease-out-quart), background .15s; flex-shrink: 0;
  }
  .team-arrow.open { transform: rotate(180deg); background: var(--accent-bg); color: var(--accent); }

  .team-body { display: none; border-top: 1px solid var(--border); background: var(--gray-50); padding: var(--space-6); }
  .team-body.open { display: block; }

  .team-insight {
    background: #fefce8; border: 1px solid oklch(80% 0.12 75 / .3); border-left: 4px solid var(--amber-500);
    border-radius: var(--radius-lg); padding: var(--space-4) var(--space-5); margin-bottom: var(--space-6);
  }
  .insight-title { font-size: var(--text-xs); font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: oklch(55% 0.12 75); margin-bottom: var(--space-2); }
  .insight-text { font-size: var(--text-sm); color: oklch(35% 0.08 75); line-height: 1.7; }

  .hour-analysis { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-5); margin-bottom: var(--space-6); }
  .hour-panel { background: var(--surface); border-radius: var(--radius-lg); border: 1px solid var(--border-subtle); padding: var(--space-5); }
  .hour-panel-title { font-size: var(--text-sm); font-weight: 700; color: var(--text-primary); margin-bottom: var(--space-4); display: flex; align-items: center; gap: var(--space-2); }
  .hour-chart-wrap { height: 180px; }
  .hour-bar-container { margin-bottom: var(--space-4); }
  .hour-bar-label-row { display: flex; justify-content: space-between; font-size: var(--text-xs); color: var(--text-muted); margin-bottom: var(--space-2); }
  .hour-bar { height: 10px; border-radius: var(--radius-full); background: var(--gray-100); overflow: hidden; display: flex; }
  .hour-bar-seg { height: 100%; transition: width .6s var(--ease-out-quart); }

  .hour-table { width: 100%; border-collapse: collapse; font-size: var(--text-xs); margin-top: var(--space-3); }
  .hour-table th { text-align: left; font-weight: 600; color: var(--text-secondary); padding: var(--space-2) var(--space-3); border-bottom: 2px solid var(--border); background: var(--gray-50); }
  .hour-table td { padding: var(--space-3); border-bottom: 1px solid var(--border-subtle); color: var(--text-primary); }
  .hour-table td:first-child { display: flex; align-items: center; gap: var(--space-2); }
  .hour-table .dot { width: 8px; height: 8px; border-radius: 2px; flex-shrink: 0; }
  .hour-table .total-row td { background: var(--gray-100); font-weight: 700; border-bottom: none; }

  .team-chart-section { margin-bottom: var(--space-6); }
  .team-chart-wrap { height: 220px; }

  .sub-proj-section-title { font-size: var(--text-sm); font-weight: 700; color: var(--text-secondary); margin-bottom: var(--space-4); text-transform: uppercase; letter-spacing: .06em; }
  .sub-proj-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: var(--space-4); }
  .sub-proj-card { background: var(--surface); border-radius: var(--radius-lg); border: 1px solid var(--border-subtle); padding: var(--space-5); transition: box-shadow .2s, transform .2s var(--ease-out-quart); }
  .sub-proj-card:hover { box-shadow: var(--shadow-md); transform: translateY(-1px); }
  .sub-proj-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: var(--space-4); }
  .sub-proj-name { font-size: var(--text-sm); font-weight: 700; color: var(--text-primary); }
  .sub-proj-total { font-size: var(--text-xs); color: var(--text-muted); background: var(--gray-100); padding: 2px var(--space-3); border-radius: var(--radius-full); font-weight: 600; }
  .sub-proj-chart { height: 140px; }

  .summary-card {
    background: var(--surface); border-radius: var(--radius-xl); box-shadow: var(--shadow-sm);
    border: 1px solid var(--border-subtle); overflow: hidden;
    animation: slideUp .5s var(--ease-out-expo) .25s both;
  }
  .summary-table { width: 100%; border-collapse: collapse; font-size: var(--text-sm); font-variant-numeric: tabular-nums; }
  .summary-table th {
    background: var(--gray-50); color: var(--text-secondary); font-weight: 700; font-size: var(--text-xs);
    text-transform: uppercase; letter-spacing: .05em; padding: var(--space-4) var(--space-5);
    text-align: center; border-bottom: 2px solid var(--border);
  }
  .summary-table th:first-child { text-align: left; }
  .summary-table td { padding: var(--space-4) var(--space-5); text-align: center; border-bottom: 1px solid var(--border-subtle); color: var(--text-primary); transition: background .1s; }
  .summary-table td:first-child { text-align: left; font-weight: 600; }
  .summary-table tr:hover td { background: var(--gray-50); }
  .summary-table .team-tag { font-size: var(--text-xs); font-weight: 500; color: var(--text-secondary); }
  .summary-table .total-row td { background: var(--gray-100); font-weight: 800; color: var(--text-primary); border-bottom: none; }

  @keyframes slideUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
  @media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation-duration: .01ms !important; transition-duration: .01ms !important; } }

  @media (max-width: 900px) {
    .charts-row { grid-template-columns: 1fr; }
    .kpi-grid { grid-template-columns: repeat(3, 1fr); }
    .kpi-card:nth-child(1) { grid-column: span 3; }
    .hour-analysis { grid-template-columns: 1fr; }
  }
  @media (max-width: 640px) {
    .header { padding: var(--space-6); }
    .kpi-section { padding: 0 var(--space-4); }
    .container { padding: var(--space-5) var(--space-4) var(--space-10); }
    .kpi-cards { grid-template-columns: repeat(2, 1fr); }
    .kpi-card:nth-child(1) { grid-column: span 2; }
    .team-header { flex-wrap: wrap; }
    .team-months { display: none; }
    .sub-proj-grid { grid-template-columns: 1fr; }
  }
</style>
</head>
<body>

<!-- HEADER -->
<header class="header">
  <div class="header-inner">
    <div class="header-eyebrow">
      <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor"><rect x="1" y="1" width="4" height="4" rx="1"/><rect x="7" y="1" width="4" height="4" rx="1"/><rect x="1" y="7" width="4" height="4" rx="1"/><rect x="7" y="7" width="4" height="4" rx="1"/></svg>
      PMO · ${dayjs().format('YYYY')} Q${Math.ceil((new Date().getMonth() + 1) / 3)} 数据复盘
    </div>
    <h1>${escapeHtml(title)}</h1>
    <p>${escapeHtml(meta)}</p>
    <div class="header-meta">
      <span class="meta-badge"><strong>${totalStories.toLocaleString()}</strong> 条已完成</span>
      <span class="meta-badge"><strong>${totalProjects}</strong> 个项目</span>
      ${totalTeams > 0 ? `<span class="meta-badge"><strong>${totalTeams}</strong> 个团队</span>` : ''}
    </div>
  </div>
</header>

<!-- KPI SECTION -->
<div class="kpi-section">
  <div class="kpi-grid">
    <div class="kpi-panel">
      <div class="kpi-panel-title">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 10 L4.5 6.5 L7 8 L10 3 L12 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
        Story 完成趋势
      </div>
      <div class="kpi-cards">
        <div class="kpi-card total">
          <div class="kpi-val">${totalStories.toLocaleString()}</div>
          <div class="kpi-label">总完成</div>
        </div>
        ${monthlyTotals.map((val, i) => `
        <div class="kpi-card ${i === monthlyTotals.indexOf(Math.min(...monthlyTotals)) ? 'highlight' : ''}">
          <div class="kpi-val">${val.toLocaleString()}</div>
          <div class="kpi-label">${displayMonths[i]}</div>
          ${i === monthlyTotals.indexOf(Math.min(...monthlyTotals)) && i > 0 ? '<div class="kpi-sub">低谷月</div>' : ''}
        </div>
        `).join('')}
      </div>
    </div>
    ${totalTeams > 0 ? `
    <div class="kpi-panel">
      <div class="kpi-panel-title">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="1" y="3" width="12" height="2" rx="1" fill="currentColor"/><rect x="1" y="7" width="8" height="2" rx="1" fill="currentColor"/><rect x="1" y="11" width="10" height="2" rx="1" fill="currentColor"/></svg>
        组织维度
      </div>
      <div class="kpi-org-grid">
        <div class="kpi-org-card">
          <div class="kpi-val">${totalProjects}</div>
          <div class="kpi-label">项目数</div>
          <div class="kpi-sub">运行中</div>
        </div>
        <div class="kpi-org-card">
          <div class="kpi-val">${totalTeams}</div>
          <div class="kpi-label">归属团队</div>
          <div class="kpi-sub">活跃</div>
        </div>
      </div>
    </div>
    ` : ''}
  </div>
</div>

<!-- MAIN CONTENT -->
<div class="container">

  <!-- Charts Row -->
  <div class="charts-row" style="animation: slideUp .5s var(--ease-out-expo) .05s both">
    <div class="chart-card">
      <div class="chart-card-header">
        <div>
          <div class="chart-card-title">全局趋势</div>
          <div class="chart-card-subtitle">每月 Story 总数</div>
        </div>
      </div>
      <div class="chart-legend">
        ${displayMonths.map((m, i) => `<span class="legend-item"><span class="legend-dot" style="background:${monthColors[i]}"></span>${m} ${monthlyTotals[i].toLocaleString()}</span>`).join('')}
      </div>
      <div class="chart-wrap"><canvas id="globalTrendChart"></canvas></div>
    </div>
    ${totalTeams > 0 ? `
    <div class="chart-card">
      <div class="chart-card-header">
        <div>
          <div class="chart-card-title">团队维度</div>
          <div class="chart-card-subtitle">各团队 Story 总量横向对比</div>
        </div>
      </div>
      <div class="chart-legend">
        ${teamDefs.map(t => `<span class="legend-item"><span class="legend-dot" style="background:${t.color}"></span>${t.name}</span>`).join('')}
      </div>
      <div class="chart-wrap"><canvas id="teamBarChart"></canvas></div>
    </div>
    ` : `
    <div class="chart-card">
      <div class="chart-card-header">
        <div>
          <div class="chart-card-title">各项目对比</div>
          <div class="chart-card-subtitle">Story 总量排名</div>
        </div>
      </div>
      <div class="chart-wrap"><canvas id="projectBarChart"></canvas></div>
    </div>
    `}
  </div>

  ${totalTeams > 0 ? `
  <!-- Section 1: Team Overview -->
  <div class="section">
    <div class="section-header">
      <div class="section-title">① 各归属团队月度 Story 发布量对比</div>
      <span class="section-badge">总览</span>
    </div>
    <div class="chart-card" style="padding: var(--space-6) var(--space-6) var(--space-4)">
      <div class="chart-wrap" style="height:360px"><canvas id="overviewChart"></canvas></div>
    </div>
  </div>

  <!-- Section 2: Team Accordion -->
  <div class="section">
    <div class="section-header">
      <div class="section-title">② 归属团队深度分析</div>
      <span class="section-badge">点击展开</span>
    </div>
    <div class="team-list" id="teamAccordion"></div>
  </div>
  ` : ''}

  <!-- Summary Table -->
  <div class="section">
    <div class="section-header">
      <div class="section-title">${totalTeams > 0 ? '③ ' : ''}各项目每月 Story 数汇总</div>
      <span class="section-badge">数据表</span>
    </div>
    <div class="summary-card">
      <table class="summary-table">
        <thead>
          <tr>
            <th style="width:180px">所属项目</th>
            ${totalTeams > 0 ? '<th style="width:120px">归属团队</th>' : ''}
            ${displayMonths.map(m => `<th>${m}</th>`).join('')}
            <th>合计</th>
          </tr>
        </thead>
        <tbody id="summaryTable"></tbody>
      </table>
    </div>
  </div>

</div>

<script>
// 数据初始化
var __MONTHS = ${JSON.stringify(displayMonths)};
var __MONTH_COLORS = ${JSON.stringify(monthColors)};
var __MONTH_COLORS_LIGHT = ${JSON.stringify(monthColorsLight)};
var __PROJECT_DATA = ${JSON.stringify(projectMonthly)};
var __MONTHLY_TOTALS = ${JSON.stringify(monthlyTotals)};
${Object.keys(projectHours).length > 0 ? `var __PROJECT_HOUR_DATA = ${JSON.stringify(projectHours)};` : '// No hour data'}
${teamDefs.length > 0 ? `var __TEAM_DEF = ${JSON.stringify(teamDefs)};` : '// No team data'}

// 全局变量
var MONTHS = __MONTHS;
var MONTH_COLORS = __MONTH_COLORS;
var MONTH_COLORS_LIGHT = __MONTH_COLORS_LIGHT;
var PROJECT_DATA = __PROJECT_DATA;
${teamDefs.length > 0 ? 'var TEAM_DEF = __TEAM_DEF;' : '// TEAM_DEF not available'}

console.log('[Report] 初始化完成');
console.log('[Report] MONTHS:', MONTHS);
console.log('[Report] PROJECT_DATA keys:', Object.keys(PROJECT_DATA));
console.log('[Report] TEAM_DEF:', typeof TEAM_DEF !== 'undefined' ? TEAM_DEF.length : 0, '个团队');

function sumArr(arr) {
  if (!arr || !Array.isArray(arr)) return 0;
  return arr.reduce(function(a, b) { return a + b; }, 0);
}

function totalByMonth(projects) {
  if (!projects || !Array.isArray(projects)) return [];
  return MONTHS.map(function(_, i) {
    return projects.reduce(function(s, p) {
      var val = (PROJECT_DATA[p] && PROJECT_DATA[p][i]) || 0;
      return s + val;
    }, 0);
  });
}

function toDays(h) {
  if (!h) return '0';
  return (h / 8).toFixed(1);
}

function escapeHTML(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// DOM 加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
  console.log('[Report] DOM 加载完成，开始初始化...');
  
  if (typeof Chart === 'undefined') {
    console.error('[Report] Chart.js 未加载！');
    return;
  }
  
  initGlobalTrendChart();
  
  if (typeof TEAM_DEF !== 'undefined' && TEAM_DEF && TEAM_DEF.length > 0) {
    initTeamBarChart();
    initOverviewChart();
  } else {
    initProjectBarChart();
  }
  
  initSummaryTable();
  
  if (typeof TEAM_DEF !== 'undefined' && TEAM_DEF && TEAM_DEF.length > 0) {
    initTeamAccordion();
  }
});

// 全局趋势图
function initGlobalTrendChart() {
  try {
    var canvas = document.getElementById('globalTrendChart');
    if (!canvas) { console.warn('[Report] globalTrendCanvas 未找到'); return; }
    
    var ctx = canvas.getContext('2d');
    new Chart(ctx, {
      type: 'bar',
      data: {
        labels: MONTHS,
        datasets: [{
          data: __MONTHLY_TOTALS,
          backgroundColor: MONTH_COLORS_LIGHT,
          borderColor: MONTH_COLORS,
          borderWidth: 0,
          borderRadius: 6,
          borderSkipped: false
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        layout: { padding: { top: 16 } },
        scales: {
          x: { grid: { display: false }, ticks: { font: { size: 12, weight: '600', family: "'Noto Sans SC', sans-serif" }, color: '#64748b' } },
          y: { beginAtZero: true, grid: { color: '#f1f5f9' }, ticks: { font: { size: 11, family: "'Noto Sans SC', sans-serif" }, color: '#94a3b8' } }
        },
        animation: { duration: 800, easing: 'easeOutQuart',
          onComplete: function() {
            var chart = this; var ctx2 = chart.ctx; ctx2.save();
            ctx2.font = 'bold 13px "Noto Sans SC", sans-serif'; ctx2.fillStyle = '#1e293b';
            ctx2.textAlign = 'center'; ctx2.textBaseline = 'bottom';
            chart.data.datasets[0].data.forEach(function(val, i) {
              if (!val) return;
              var bar = chart.getDatasetMeta(0).data[i];
              if (bar) ctx2.fillText(val, bar.x, bar.y - 4);
            }); ctx2.restore();
          }
        }
      }
    });
    console.log('[Report] ✓ 全局趋势图初始化成功');
  } catch (error) { console.error('[Report] ✗ 全局趋势图初始化失败:', error); }
}

${totalTeams > 0 ? `
// 团队柱状图
function initTeamBarChart() {
  try {
    var canvas = document.getElementById('teamBarChart');
    if (!canvas) return;
    var teams = TEAM_DEF.slice().reverse();
    var totals = teams.map(function(t) { return sumArr(totalByMonth(t.projects)); });
    var colors = teams.map(function(t) { return t.color; });
    var ctx = canvas.getContext('2d');
    new Chart(ctx, {
      type: 'bar',
      data: {
        labels: teams.map(function(t) { return t.name; }),
        datasets: [{ data: totals, backgroundColor: colors.map(function(c) { return c + 'dd'; }), borderColor: colors, borderWidth: 0, borderRadius: 6 }]
      },
      options: {
        indexAxis: 'y', responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } }, layout: { padding: { right: 16 } },
        scales: {
          x: { beginAtZero: true, grid: { color: '#f1f5f9' }, ticks: { font: { size: 11, family: "'Noto Sans SC', sans-serif" }, color: '#94a3b8' } },
          y: { grid: { display: false }, ticks: { font: { size: 12, weight: '600', family: "'Noto Sans SC', sans-serif" }, color: '#475569' } }
        },
        animation: { duration: 800, easing: 'easeOutQuart',
          onComplete: function() {
            var chart = this; var ctx2 = chart.ctx; ctx2.save();
            ctx2.font = 'bold 12px "Noto Sans SC", sans-serif'; ctx2.fillStyle = '#374151';
            ctx2.textAlign = 'left'; ctx2.textBaseline = 'middle';
            chart.data.datasets[0].data.forEach(function(val, i) {
              var bar = chart.getDatasetMeta(0).data[i];
              if (bar) ctx2.fillText(val, bar.x + 8, bar.y);
            }); ctx2.restore();
          }
        }
      }
    });
    console.log('[Report] ✓ 团队柱状图初始化成功');
  } catch (error) { console.error('[Report] ✗ 团队柱状图初始化失败:', error); }
}

// 团队月度对比图
function initOverviewChart() {
  try {
    var canvas = document.getElementById('overviewChart');
    if (!canvas) return;
    var ctx = canvas.getContext('2d');
    var datasets = MONTHS.map(function(m, i) {
      return { label: m, data: TEAM_DEF.map(function(t) { return totalByMonth(t.projects)[i]; }), backgroundColor: MONTH_COLORS_LIGHT[i], borderColor: MONTH_COLORS[i], borderWidth: 1.5, borderRadius: 5 };
    });
    new Chart(ctx, {
      type: 'bar',
      data: { labels: TEAM_DEF.map(function(t) { return t.name; }), datasets: datasets },
      options: {
        responsive: true, maintainAspectRatio: false, layout: { padding: { top: 20 } },
        plugins: { legend: { position: 'top', labels: { font: { size: 12, family: "'Noto Sans SC', sans-serif" }, color: '#64748b', padding: 16 } } },
        scales: {
          x: { grid: { display: false }, ticks: { font: { size: 12, weight: '600', family: "'Noto Sans SC', sans-serif" }, color: '#475569' } },
          y: { beginAtZero: true, grid: { color: '#f1f5f9' }, ticks: { font: { size: 11, family: "'Noto Sans SC', sans-serif" }, color: '#94a3b8' } }
        },
        animation: { duration: 800, easing: 'easeOutQuart',
          onComplete: function() {
            var chart = this; var ctx2 = chart.ctx; ctx2.save();
            ctx2.font = '11px "Noto Sans SC", sans-serif'; ctx2.textAlign = 'center'; ctx2.textBaseline = 'bottom';
            chart.data.datasets.forEach(function(ds, di) {
              var meta = chart.getDatasetMeta(di);
              ds.data.forEach(function(val, i) {
                if (!val) return;
                var bar = meta.data[i];
                if (bar) { ctx2.fillStyle = MONTH_COLORS[di]; ctx2.fillText(val, bar.x, bar.y - 2); }
              });
            }); ctx2.restore();
          }
        }
      }
    });
    console.log('[Report] ✓ 团队月度对比图初始化成功');
  } catch (error) { console.error('[Report] ✗ 团队月度对比图初始化失败:', error); }
}
` : `
// 项目柱状图（无团队时）
function initProjectBarChart() {
  try {
    var canvas = document.getElementById('projectBarChart');
    if (!canvas) return;
    var entries = Object.entries(PROJECT_DATA).sort(function(a, b) { return sumArr(b[1]) - sumArr(a[1]); });
    var ctx = canvas.getContext('2d');
    new Chart(ctx, {
      type: 'bar',
      data: {
        labels: entries.map(function(e) { return e[0]; }),
        datasets: [{ data: entries.map(function(e) { return sumArr(e[1]); }), backgroundColor: '#3b82f6dd', borderColor: '#3b82f6', borderWidth: 0, borderRadius: 6 }]
      },
      options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true, grid: { color: '#f1f5f9' } }, y: { grid: { display: false } } }, animation: { duration: 800, easing: 'easeOutQuart' }
    });
    console.log('[Report] ✓ 项目柱状图初始化成功');
  } catch (error) { console.error('[Report] ✗ 项目柱状图初始化失败:', error); }
}`}

// 汇总表
function initSummaryTable() {
  try {
    var tbody = document.getElementById('summaryTable');
    if (!tbody) { console.warn('[Report] summaryTable 未找到'); return; }

    var totalRow = new Array(MONTHS.length).fill(0);
    var teamMap = {};
    var teamColorMap = {};

    if (typeof TEAM_DEF !== 'undefined' && TEAM_DEF && TEAM_DEF.length > 0) {
      TEAM_DEF.forEach(function(t) {
        t.projects.forEach(function(p) {
          teamMap[p] = t.name;
          teamColorMap[p] = t.color;
        });
      });
    }

    var sortedEntries = Object.entries(PROJECT_DATA).sort(function(a, b) {
      return a[0].localeCompare(b[0], 'zh');
    });

    sortedEntries.forEach(function(entry) {
      var p = entry[0];
      var d = entry[1];
      var total = sumArr(d);
      d.forEach(function(v, i) { totalRow[i] += v; });

      var tr = document.createElement('tr');
      var html = '<td>' + escapeHTML(p) + '</td>';

      if (typeof TEAM_DEF !== 'undefined' && TEAM_DEF && TEAM_DEF.length > 0) {
        var teamColor = teamColorMap[p] || '#64748b';
        var teamName = teamMap[p] || '-';
        html += '<td><span class="team-tag" style="display:inline-flex;align-items:center;gap:6px">';
        html += '<span style="width:6px;height:6px;border-radius:50%;background:' + teamColor + ';flex-shrink:0"></span>';
        html += '<span>' + escapeHTML(teamName) + '</span></span></td>';
      }

      d.forEach(function(v) {
        html += '<td>' + (v || '—') + '</td>';
      });

      html += '<td><strong>' + total + '</strong></td>';
      tr.innerHTML = html;
      tbody.appendChild(tr);
    });

    // 合计行
    var totalTr = document.createElement('tr');
    totalTr.className = 'total-row';
    var totalHtml = '<td>合计</td>';

    if (typeof TEAM_DEF !== 'undefined' && TEAM_DEF && TEAM_DEF.length > 0) {
      totalHtml += '<td>—</td>';
    }

    totalRow.forEach(function(v) {
      totalHtml += '<td>' + v + '</td>';
    });

    totalHtml += '<td><strong>' + sumArr(totalRow) + '</strong></td>';
    totalTr.innerHTML = totalHtml;
    tbody.appendChild(totalTr);

    console.log('[Report] ✓ 汇总表初始化成功，共', sortedEntries.length, '个项目');
  } catch (error) { console.error('[Report] ✗ 汇总表初始化失败:', error); }
}

// 团队手风琴
function initTeamAccordion() {
  try {
    var container = document.getElementById('teamAccordion');
    if (!container) { console.warn('[Report] teamAccordion 未找到'); return; }

    TEAM_DEF.forEach(function(team, ti) {
      var monthly = totalByMonth(team.projects);
      var teamTotal = sumArr(monthly);
      var accId = 'acc_' + ti;
      var chartId = 'tc_' + ti;
      var pillsHtml = team.projects.map(function(p) { return '<span class="pill">' + escapeHTML(p) + '</span>'; }).join('');

      var div = document.createElement('div');
      div.className = 'team-card';

      var monthTagsHtml = '';
      monthly.forEach(function(v, i) {
        monthTagsHtml += '<span style="color:' + MONTH_COLORS[i] + '">' + MONTHS[i] + ' ' + v + '</span>';
      });

      div.innerHTML =
        '<div class="team-header" onclick="toggleAcc(&#39;' + accId + '&#39;,' + ti + ')">' +
          '<div class="team-header-left">' +
            '<div class="team-color-bar" style="background:' + team.color + '"></div>' +
            '<div>' +
              '<div class="team-name">' + escapeHTML(team.name) + '</div>' +
              '<div class="team-pills">' + pillsHtml + '</div>' +
            '</div>' +
          '</div>' +
          '<div class="team-header-right">' +
            '<div class="team-stats"><span class="team-stat"><strong>' + teamTotal + '</strong> 条</span></div>' +
            '<div class="team-months">' + monthTagsHtml + '</div>' +
            '<div class="team-arrow" id="arrow_' + ti + '">▼</div>' +
          '</div>' +
        '</div>' +
        '<div class="team-body" id="' + accId + '">' +
          '<div class="team-insight">' +
            '<div class="insight-title">📈 数据洞察</div>' +
            '<div class="insight-text">' + (team.insight || '暂无洞察数据') + '</div>' +
          '</div>' +
          '<div class="team-chart-section">' +
            '<div class="team-chart-wrap"><canvas id="' + chartId + '"></canvas></div>' +
          '</div>' +
          '<div class="sub-proj-section-title">子项目明细（共 ' + team.projects.length + ' 个项目）</div>' +
          '<div class="sub-proj-grid" id="sub_' + ti + '"></div>' +
        '</div>';

      container.appendChild(div);
    });

    console.log('[Report] ✓ 团队手风琴初始化成功，共', TEAM_DEF.length, '个团队');
  } catch (error) { console.error('[Report] ✗ 团队手风琴初始化失败:', error); }
}

var builtCharts = {};

function toggleAcc(id, ti) {
  try {
    var body = document.getElementById(id);
    var arrow = document.getElementById('arrow_' + ti);
    if (!body || !arrow) return;

    var isOpen = body.classList.contains('open');
    document.querySelectorAll('.team-body').forEach(function(b) { b.classList.remove('open'); });
    document.querySelectorAll('.team-arrow').forEach(function(a) { a.classList.remove('open'); });

    if (!isOpen) {
      body.classList.add('open');
      arrow.classList.add('open');
      if (!builtCharts[ti]) {
        builtCharts[ti] = true;
        buildTeamCharts(ti);
      }
    }
  } catch (error) { console.error('[Report] toggleAcc 错误:', error); }
}

function buildTeamCharts(ti) {
  try {
    var team = TEAM_DEF[ti];
    var monthly = totalByMonth(team.projects);

    // 团队月度柱状图
    var tcEl = document.getElementById('tc_' + ti);
    if (tcEl) {
      var tctx = tcEl.getContext('2d');
      new Chart(tctx, {
        type: 'bar',
        data: {
          labels: MONTHS,
          datasets: [{ label: team.name, data: monthly, backgroundColor: team.color + 'cc', borderColor: team.color, borderWidth: 1.5, borderRadius: 5 }]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: { x: { grid: { display: false } }, y: { beginAtZero: true, grid: { color: '#f1f5f9' } } },
          animation: { duration: 700, easing: 'easeOutQuart',
            onComplete: function() {
              var chart = this; var ctx2 = chart.ctx; ctx2.save();
              ctx2.font = 'bold 12px "Noto Sans SC", sans-serif'; ctx2.fillStyle = '#374151';
              ctx2.textAlign = 'center'; ctx2.textBaseline = 'bottom';
              chart.data.datasets[0].data.forEach(function(val, i) {
                if (!val) return;
                var bar = chart.getDatasetMeta(0).data[i];
                if (bar) ctx2.fillText(val, bar.x, bar.y - 2);
              }); ctx2.restore();
            }
          }
        }
      });
    }

    // 子项目卡片
    var subContainer = document.getElementById('sub_' + ti);
    if (subContainer) {
      team.projects.forEach(function(p) {
        var pData = PROJECT_DATA[p] || [];
        var pTotal = sumArr(pData);
        var card = document.createElement('div');
        card.className = 'sub-proj-card';
        var canvasId = 'sp_' + ti + '_' + p.replace(/[^a-zA-Z0-9]/g, '_');

        card.innerHTML =
          '<div class="sub-proj-header">' +
            '<div class="sub-proj-name">' + escapeHTML(p) + '</div>' +
            '<div class="sub-proj-total">' + pTotal + ' 条</div>' +
          '</div>' +
          '<div class="sub-proj-chart"><canvas id="' + canvasId + '"></canvas></div>';

        subContainer.appendChild(card);

        setTimeout(function() {
          var spCanvas = card.querySelector('canvas');
          if (spCanvas) {
            var spCtx = spCanvas.getContext('2d');
            new Chart(spCtx, {
              type: 'bar',
              data: {
                labels: MONTHS,
                datasets: [{ data: pData, backgroundColor: MONTH_COLORS_LIGHT, borderColor: MONTH_COLORS, borderWidth: 1, borderRadius: 4 }]
              },
              options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: { x: { grid: { display: false }, ticks: { font: { size: 10 } } }, y: { beginAtZero: true, grid: { display: false } } },
                animation: { duration: 600 }
              }
            });
          }
        }, 100);
      });
    }

    console.log('[Report] ✓ 团队图表构建成功:', team.name);
  } catch (error) { console.error('[Report] ✗ buildTeamCharts 错误:', error); }
}
${SCRIPT_CLOSE}
</body>
</html>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
