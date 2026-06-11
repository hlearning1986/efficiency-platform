import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { parseNaturalLanguageQuery } from '@/lib/reports/nlp-parser';
import { generateReportData, getProjectMonthlyData, generateTeamDefs } from '@/lib/reports/report-generator';
import { renderHTMLReport } from '@/lib/reports/html-renderer';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('[Report API] 收到请求:', JSON.stringify(body, null, 2));

    const { mode, naturalQuery, projects: projectNames, dateRange, status = 'released', reportType = 'full', customTitle } = body;

    let params: any = {};

    if (mode === 'natural' && naturalQuery) {
      console.log('[Report API] 使用自然语言模式');
      params = parseNaturalLanguageQuery(naturalQuery);
      
      // 如果自然语言解析出项目名称，转换为ID
      if (params.projects && params.projects.length > 0) {
        const workspaces = await prisma.tapdWorkspace.findMany({
          where: { name: { in: params.projects } },
          select: { id: true },
        });
        params.projects = workspaces.map(w => w.id);
      }
    } else if (mode === 'advanced') {
      console.log('[Report API] 使用高级筛选模式');
      
      // 将项目名称转换为ID
      let projectIds: string[] = [];
      if (projectNames && projectNames.length > 0) {
        const workspaces = await prisma.tapdWorkspace.findMany({
          where: { id: { in: projectNames } },
          select: { id: true },
        });
        projectIds = workspaces.map(w => w.id);
      }
      
      params = {
        projects: projectIds,
        dateStart: dateRange?.[0] || new Date().toISOString().split('T')[0],
        dateEnd: dateRange?.[1] || new Date().toISOString().split('T')[0],
        statuses: status === 'all' ? [] : status === 'released' ? ['released'] : [status],
      };
    } else {
      return NextResponse.json(
        { error: '请提供有效的查询参数' },
        { status: 400 }
      );
    }

    if (customTitle) {
      params.customTitle = customTitle;
    }

    console.log('[Report API] 解析后的参数:', JSON.stringify(params, null, 2));

    const metadata = await generateReportData(params);
    
    let htmlContent = '';
    
    if (reportType !== 'summary') {
      const chartData = await getProjectMonthlyData(params);
      
      // 查询stories数据用于团队分析
      const where: any = {};
      if (params.statuses && params.statuses.length > 0) {
        const statusMap: Record<string, string[]> = {
          'released': ['resolved', 'released'],
          'implemented': ['resolved'],
        };
        const mappedStatuses = params.statuses.flatMap(s => statusMap[s] || [s]);
        if (mappedStatuses.length > 0) {
          where.status = { in: mappedStatuses };
        }
      }
      if (params.dateStart && params.dateEnd) {
        where.completed = { gte: new Date(params.dateStart), lte: new Date(params.dateEnd) };
      }
      if (params.projects && params.projects.length > 0) {
        where.workspaceId = { in: params.projects };
      }

      const stories = await prisma.tapdStory.findMany({
        where,
        select: {
          id: true,
          name: true,
          workspaceId: true,
          workspaceName: true,
          completed: true,
          effort: true,
          effortCompleted: true,
        },
      });

      // 生成团队定义
      const teamDefs = await generateTeamDefs(chartData, stories, params.dateStart, params.dateEnd);
      
      const months = Object.values(chartData)[0]
        ? Array.from({ length: Object.values(chartData)[0].length }, (_, i) => {
            const start = new Date(params.dateStart);
            start.setMonth(start.getMonth() + i);
            return `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`;
          })
        : [];
      
      const monthlyTotals = months.map((_, monthIndex) =>
        Object.values(chartData).reduce((sum, data) => sum + (data[monthIndex] || 0), 0)
      );

      htmlContent = renderHTMLReport(
        customTitle || metadata.title,
        metadata.meta,
        {
          months,
          monthlyTotals,
          projectMonthly: chartData,
          teamDefs,
        }
      );
    }

    console.log('[Report API] 报告生成成功');

    // 自动保存到历史记录
    try {
      await prisma.analysisReport.create({
        data: {
          title: customTitle || metadata.title,
          meta: metadata.meta,
          mode: mode || 'advanced',
          projects: params.projects || [],
          dateStart: params.dateStart || '',
          dateEnd: params.dateEnd || '',
          status: status || null,
          reportType: reportType || 'full',
          htmlContent: htmlContent,
          metadata: metadata.kpis || {},
        },
      });
      console.log('[Report API] 报告已自动保存到历史记录');
    } catch (saveError) {
      console.error('[Report API] 保存到历史记录失败（不影响返回）:', saveError);
    }

    return NextResponse.json({
      success: true,
      metadata,
      html: htmlContent,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Report API] 错误:', error);
    return NextResponse.json(
      { 
        error: '报告生成失败',
        details: error instanceof Error ? error.message : '未知错误'
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: '智能分析报告 API',
    version: '1.0.0',
    endpoints: {
      generate: {
        method: 'POST',
        description: '生成分析报告',
        body: {
          mode: 'natural | advanced',
          naturalQuery: 'string (自然语言模式)',
          projects: 'string[] (高级模式)',
          dateRange: '[string, string]',
          status: 'string',
          reportType: 'full | trend | summary',
          customTitle: 'string',
        },
      },
    },
  });
}
