import { prisma } from '@/lib/prisma';
import dayjs from 'dayjs';

interface ReportParams {
  projects?: string[];
  dateStart: string;
  dateEnd: string;
  statuses: string[];
}

interface KPIData {
  label: string;
  value: string | number;
  subtitle?: string;
}

interface ReportMetadata {
  title: string;
  meta: string;
  kpis: KPIData[];
}

interface ProjectMonthlyData {
  [projectName: string]: number[];
}

interface TeamDef {
  name: string;
  color: string;
  projects: string[];
  storyCount: number;
  totalHours: number;
  insight: string;
}

export async function generateReportData(params: ReportParams): Promise<ReportMetadata> {
  console.log('[Report Generator] 开始生成报告数据, params:', params);

  const { projects = [], dateStart, dateEnd, statuses } = params;

  const where: any = {};

  if (statuses.length > 0 && !statuses.includes('all')) {
    // 兼容性状态筛选（支持中文 + 英文 + TAPD状态码）
    // 数据同步时会逐步转换为中文，但需要兼容现有数据
    const statusMap: Record<string, string[]> = {
      'released': [
        // 中文状态
        '已发布', '已实现', '已解决',
        '已上线', '已完成',
        // 英文标准状态
        'resolved', 'released', 'done',
        // TAPD 状态码（常见完成类状态）
        'status_6', 'status_7', 'status_8',
        // 其他
        'closed'
      ],
      'implemented': [
        // 中文状态
        '已实现', '已解决', '已完成',
        // 英文标准状态
        'resolved', 'done',
        // TAPD 状态码
        'status_6', 'status_7', 'status_8',
        // 其他
        'closed'
      ],
      'all': [],
    };
    const mappedStatuses = statuses.flatMap(s => statusMap[s] || [s]);
    if (mappedStatuses.length > 0) {
      where.status = { in: mappedStatuses };
    }
  }

  if (dateStart && dateEnd) {
    where.completed = {
      gte: new Date(dateStart),
      lte: new Date(dateEnd),
    };
  }

  if (projects.length > 0) {
    where.workspaceId = { in: projects };
  }

  const stories = await prisma.tapdStory.findMany({
    where,
    select: {
      id: true,
      name: true,
      status: true,
      workspaceId: true,
      workspaceName: true,
      completed: true,
      effort: true,
      effortCompleted: true,
    },
    orderBy: { completed: 'desc' },
  });

  // 获取所有相关的workspace名称
  const workspaceIds = [...new Set(stories.map(s => s.workspaceId).filter(Boolean))];
  const workspaces = await prisma.tapdWorkspace.findMany({
    where: { id: { in: workspaceIds } },
    select: { id: true, name: true },
  });
  const workspaceMap = new Map(workspaces.map(w => [w.id, w.name]));

  console.log(`[Report Generator] 查询到 ${stories.length} 条记录`);

  if (stories.length === 0) {
    return {
      title: '分析报告',
      meta: `项目：${projects.join('、') || '全部'} | 时间：${dateStart} ~ ${dateEnd}`,
      kpis: [
        { label: 'Story 完成总数', value: 0 },
        { label: '涉及项目数', value: 0 },
        { label: '总投入工时', value: '0 人天' },
        { label: '月均交付率', value: '0%' },
      ],
    };
  }

  const projectNames = [...new Set(stories.map(s => s.workspaceName || workspaceMap.get(s.workspaceId)).filter(Boolean))];
  
  const totalHours = stories.reduce((sum, s) => sum + (s.effort || 0), 0);
  const avgHoursPerStory = stories.length > 0 ? (totalHours / stories.length).toFixed(1) : '0';

  const startDate = dayjs(dateStart);
  const endDate = dayjs(dateEnd);
  const monthDiff = endDate.diff(startDate, 'month') + 1;
  const monthlyAvg = Math.round(stories.length / monthDiff);

  const kpis: KPIData[] = [
    { label: 'Story 完成总数', value: stories.length },
    { label: '涉及项目数', value: projectNames.length, subtitle: `覆盖 ${projectNames.length} 个项目` },
    { label: '总投入工时', value: `${totalHours.toFixed(0)} 人天`, subtitle: `平均 ${avgHoursPerStory}人天/需求` },
    { label: '月均交付', value: `${monthlyAvg} 个`, subtitle: `时间跨度：${monthDiff}个月` },
  ];

  const title = generateReportTitle(params, stories.length, projectNames);
  const meta = `项目：${projects.join('、') || '全部'} | 时间：${dateStart} ~ ${dateEnd}`;

  console.log('[Report Generator] 报告元数据生成完成:', { title, kpiCount: kpis.length });

  return {
    title,
    meta,
    kpis,
  };
}

function generateReportTitle(params: ReportParams, storyCount: number, projects: string[]): string {
  const startMonth = dayjs(params.dateStart).format('M');
  const endMonth = dayjs(params.dateEnd).format('M');
  const year = dayjs(params.dateStart).year();
  
  let timeRange = '';
  if (startMonth === endMonth) {
    timeRange = `${year}年${startMonth}月`;
  } else {
    timeRange = `${year}年${startMonth}-${endMonth}月`;
  }

  const projectDesc = params.projects?.length > 0
    ? params.projects.slice(0, 2).join('、')
    : '全项目';

  return `${timeRange} ${projectDesc} Story 发布数据分析报告`;
}

export async function getProjectMonthlyData(params: ReportParams): Promise<ProjectMonthlyData> {
  const { projects = [], dateStart, dateEnd, statuses } = params;

  const where: any = {};
  if (statuses.length > 0 && !statuses.includes('all')) {
    // 兼容性状态筛选（支持中文 + 英文 + TAPD状态码）
    // 数据同步时会逐步转换为中文，但需要兼容现有数据
    const statusMap: Record<string, string[]> = {
      'released': [
        // 中文状态
        '已发布', '已实现', '已解决',
        '已上线', '已完成',
        // 英文标准状态
        'resolved', 'released', 'done',
        // TAPD 状态码（常见完成类状态）
        'status_6', 'status_7', 'status_8',
        // 其他
        'closed'
      ],
      'implemented': [
        // 中文状态
        '已实现', '已解决', '已完成',
        // 英文标准状态
        'resolved', 'done',
        // TAPD 状态码
        'status_6', 'status_7', 'status_8',
        // 其他
        'closed'
      ],
      'all': [],
    };
    const mappedStatuses = statuses.flatMap(s => statusMap[s] || [s]);
    if (mappedStatuses.length > 0) {
      where.status = { in: mappedStatuses };
    }
  }
  if (dateStart && dateEnd) {
    where.completed = { gte: new Date(dateStart), lte: new Date(dateEnd) };
  }
  if (projects.length > 0) {
    where.workspaceId = { in: projects };
  }

  const stories = await prisma.tapdStory.findMany({
    where,
    select: {
      workspaceId: true,
      workspaceName: true,
      completed: true,
    },
  });

  // 获取所有相关的workspace名称
  const wsIds = [...new Set(stories.map(s => s.workspaceId).filter(Boolean))];
  const wsList = await prisma.tapdWorkspace.findMany({
    where: { id: { in: wsIds } },
    select: { id: true, name: true },
  });
  const wsMap = new Map(wsList.map(w => [w.id, w.name]));

  const result: ProjectMonthlyData = {};
  const months = getMonthsInRange(dateStart, dateEnd);

  for (const story of stories) {
    const projectName = story.workspaceName || wsMap.get(story.workspaceId) || '未知项目';
    if (!result[projectName]) {
      result[projectName] = new Array(months.length).fill(0);
    }

    if (story.completed) {
      const monthIndex = getMonthIndex(story.completed, dateStart);
      if (monthIndex >= 0 && monthIndex < months.length) {
        result[projectName][monthIndex]++;
      }
    }
  }

  return result;
}

function getMonthsInRange(start: string, end: string): string[] {
  const months: string[] = [];
  let current = dayjs(start);
  const endDay = dayjs(end);
  
  while (current.isBefore(endDay) || current.isSame(endDay, 'month')) {
    months.push(current.format('YYYY-MM'));
    current = current.add(1, 'month');
  }
  
  return months;
}

function getMonthIndex(date: Date | string, startDate: string): number {
  const d = dayjs(date);
  const start = dayjs(startDate);
  return d.diff(start, 'month');
}

// 团队颜色定义
const TEAM_COLORS = [
  '#3b82f6', // 蓝色 - 增长/交付
  '#10b981', // 绿色 - 中台
  '#f59e0b', // 橙色 - 公职/Luca
  '#8b5cf6', // 紫色 - APP
  '#ef4444', // 红色 - BI
  '#ec4899', // 粉色 - 小吉
  '#06b6d4', // 青色 - 其他
];

interface TeamDefData {
  name: string;
  color: string;
  projects: string[];
  storyCount: number;
  totalHours: number;
  insight: string;
}

export async function generateTeamDefs(
  projectMonthly: ProjectMonthlyData,
  stories: any[],
  dateStart: string,
  dateEnd: string
): Promise<TeamDefData[]> {
  const projectNames = Object.keys(projectMonthly);

  if (projectNames.length === 0) return [];

  try {
    console.log('[Report Generator] 从数据库读取团队配置...');

    // 从数据库读取真实的团队配置
    const teamConfigs = await prisma.teamConfig.findMany({
      orderBy: { createdAt: 'asc' },
    });

    console.log(`[Report Generator] 找到 ${teamConfigs.length} 个团队配置`);

    if (teamConfigs.length === 0) {
      console.log('[Report Generator] 未找到团队配置，使用默认分组');
      return generateDefaultTeamDefs(projectMonthly, stories);
    }

    // 获取所有TAPD工作空间名称映射（用于将ID转换为名称）
    const allTapdProjectIds: string[] = [];
    teamConfigs.forEach(config => {
      const ids = JSON.parse(config.tapdProjectIds) as string[];
      allTapdProjectIds.push(...ids);
    });

    const uniqueTapdIds = [...new Set(allTapdProjectIds)];
    const workspaces = await prisma.tapdWorkspace.findMany({
      where: { id: { in: uniqueTapdIds } },
      select: { id: true, name: true },
    });
    const workspaceIdToName = new Map(workspaces.map(w => [w.id, w.name]));

    // 构建项目到团队的映射关系
    const projectTeamMap: Record<string, string> = {};
    const teamProjectsMap: Record<string, string[]> = {};

    for (const config of teamConfigs) {
      const tapdIds = JSON.parse(config.tapdProjectIds) as string[];
      const teamName = config.name;

      if (!teamProjectsMap[teamName]) {
        teamProjectsMap[teamName] = [];
      }

      for (const tapdId of tapdIds) {
        const projectName = workspaceIdToName.get(tapdId);
        if (projectName && projectNames.includes(projectName)) {
          projectTeamMap[projectName] = teamName;
          if (!teamProjectsMap[teamName].includes(projectName)) {
            teamProjectsMap[teamName].push(projectName);
          }
        }
      }
    }

    // 处理未分配到任何团队的项目
    const unassignedProjects = projectNames.filter(p => !projectTeamMap[p]);
    if (unassignedProjects.length > 0) {
      console.log(`[Report Generator] ${unassignedProjects.length} 个项目未分配到任何团队:`, unassignedProjects);
      
      // 将未分配项目归入"其他"团队
      if (!teamProjectsMap['其他']) {
        teamProjectsMap['其他'] = [];
      }
      for (const p of unassignedProjects) {
        projectTeamMap[p] = '其他';
        teamProjectsMap['其他'].push(p);
      }
    }

    // 按团队分组统计stories
    const teamsMap: Record<string, { projects: string[]; stories: any[] }> = {};
    for (const [projectName, teamName] of Object.entries(projectTeamMap)) {
      if (!teamsMap[teamName]) {
        teamsMap[teamName] = { projects: [], stories: [] };
      }
      if (!teamsMap[teamName].projects.includes(projectName)) {
        teamsMap[teamName].projects.push(projectName);
      }

      // 收集该项目的stories
      const projectStories = stories.filter(s =>
        s.workspaceName === projectName ||
        s.workspaceId && teamProjectsMap[teamName]?.some(p => {
          const pData = projectMonthly[p];
          return pData && pData.length > 0;
        })
      );
      
      // 更精确的匹配：根据workspaceId或workspaceName
      const matchedStories = stories.filter(s => {
        const storyProjectName = s.workspaceName || workspaceIdToName.get(s.workspaceId);
        return storyProjectName === projectName;
      });
      
      teamsMap[teamName].stories.push(...matchedStories);
    }

    // 生成团队定义数组
    const teamDefs: TeamDefData[] = [];
    let colorIndex = 0;

    for (const [teamName, teamData] of Object.entries(teamsMap)) {
      // 计算总Story数和工时
      const storyCount = teamData.stories.length;
      const totalHours = teamData.stories.reduce((sum, s) => sum + (s.effort || 0), 0);

      // 生成数据洞察
      const insight = generateTeamInsight(
        teamName,
        teamData.projects,
        projectMonthly,
        storyCount,
        totalHours
      );

      teamDefs.push({
        name: teamName,
        color: TEAM_COLORS[colorIndex % TEAM_COLORS.length],
        projects: teamData.projects,
        storyCount,
        totalHours,
        insight,
      });

      colorIndex++;
    }

    console.log(`[Report Generator] 基于数据库配置生成了 ${teamDefs.length} 个团队定义`);
    
    // 打印详细的团队映射信息
    teamDefs.forEach((def, idx) => {
      console.log(`  [${idx + 1}] ${def.name}: ${def.projects.join(', ')} (${def.storyCount}条需求)`);
    });

    return teamDefs;

  } catch (error) {
    console.error('[Report Generator] 读取团队配置失败，回退到默认模式:', error);
    return generateDefaultTeamDefs(projectMonthly, stories);
  }
}

// 默认团队分组逻辑（当数据库无配置时的后备方案）
function generateDefaultTeamDefs(
  projectMonthly: ProjectMonthlyData,
  stories: any[]
): TeamDefData[] {
  console.log('[Report Generator] 使用默认团队分组规则');
  
  const projectNames = Object.keys(projectMonthly);
  
  // 简单的团队映射规则：基于项目名称关键词
  const teamMapping: Record<string, { name: string; keywords: string[] }> = {
    '增长': { name: '增长团队', keywords: ['销售', 'CRM', 'SCRM', '营销'] },
    '交付中台': { name: '交付&中台', keywords: ['中台', 'Sail', 'OnePiece', 'Areteup'] },
    '公职Luca': { name: '公职&Luca&直播', keywords: ['公职', '直播间', 'Luca'] },
    'APP': { name: '高顿APP', keywords: ['App', '鸿蒙', 'APP'] },
    'BI': { name: 'BI团队', keywords: ['数据', 'BI'] },
    '小吉': { name: '小吉团队', keywords: ['小吉', '英语'] },
  };

  // 为每个项目分配团队
  const projectTeamMap: Record<string, string> = {};
  for (const projectName of projectNames) {
    let assignedTeam = '其他';
    for (const [teamKey, team] of Object.entries(teamMapping)) {
      if (team.keywords.some(kw => projectName.toLowerCase().includes(kw.toLowerCase()))) {
        assignedTeam = teamKey;
        break;
      }
    }
    projectTeamMap[projectName] = assignedTeam;
  }

  // 按团队分组
  const teamsMap: Record<string, { projects: string[]; stories: any[] }> = {};
  for (const [projectName, teamKey] of Object.entries(projectTeamMap)) {
    if (!teamsMap[teamKey]) {
      teamsMap[teamKey] = { projects: [], stories: [] };
    }
    teamsMap[teamKey].projects.push(projectName);

    const projectStories = stories.filter(s =>
      s.workspaceName === projectName ||
      (s.workspaceId && projectMonthly[projectName])
    );
    teamsMap[teamKey].stories.push(...projectStories);
  }

  // 生成团队定义数组
  const teamDefs: TeamDefData[] = [];
  let colorIndex = 0;

  for (const [teamKey, teamData] of Object.entries(teamsMap)) {
    const teamConfig = teamMapping[teamKey] || { name: `${teamKey}团队`, keywords: [] };

    const storyCount = teamData.stories.length;
    const totalHours = teamData.stories.reduce((sum, s) => sum + (s.effort || 0), 0);

    const insight = generateTeamInsight(
      teamConfig.name,
      teamData.projects,
      projectMonthly,
      storyCount,
      totalHours
    );

    teamDefs.push({
      name: teamConfig.name,
      color: TEAM_COLORS[colorIndex % TEAM_COLORS.length],
      projects: teamData.projects,
      storyCount,
      totalHours,
      insight,
    });

    colorIndex++;
  }

  return teamDefs;
}

function generateTeamInsight(
  teamName: string,
  projects: string[],
  projectMonthly: ProjectMonthlyData,
  storyCount: number,
  totalHours: number
): string {
  try {
    // 计算各月数据趋势
    const months = Object.values(projectMonthly)[0]?.length || 0;
    if (months === 0) return `${teamName}共完成${storyCount}条需求，投入工时约${(totalHours / 8).toFixed(1)}人天。`;

    const monthlyTotals = new Array(months).fill(0);
    for (const project of projects) {
      const data = projectMonthly[project];
      if (data) {
        data.forEach((val, i) => { monthlyTotals[i] += val; });
      }
    }

    const maxMonth = monthlyTotals.indexOf(Math.max(...monthlyTotals));
    const minMonth = monthlyTotals.indexOf(Math.min(...monthlyTotals));
    const monthNames = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

    let insight = `${teamName}（${projects.join('、')}）共完成${storyCount}条需求`;
    
    if (months > 1 && maxMonth !== minMonth) {
      insight += `，${monthNames[maxMonth] || `${maxMonth + 1}月`}发布量最高（${monthlyTotals[maxMonth]}条）`;
      insight += `，${monthNames[minMonth] || `${minMonth + 1}月`}为低谷（${monthlyTotals[minMonth]}条）`;
    } else if (months > 0) {
      insight += `，单月均发布约${Math.round(storyCount / months)}条`;
    }

    if (totalHours > 0) {
      insight += `，总投入工时约${(totalHours / 8).toFixed(1)}人天`;
    }

    insight += '。';
    return insight;
  } catch (error) {
    console.error('[Report Generator] 生成洞察失败:', error);
    return `${teamName}共完成${storyCount}条需求。`;
  }
}
