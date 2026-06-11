import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '10');

    const skip = (page - 1) * pageSize;

    const [reports, total] = await Promise.all([
      prisma.analysisReport.findMany({
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
        select: {
          id: true,
          title: true,
          meta: true,
          mode: true,
          projects: true,
          dateStart: true,
          dateEnd: true,
          status: true,
          reportType: true,
          metadata: true,
          createdAt: true,
        },
      }),
      prisma.analysisReport.count(),
    ]);

    return NextResponse.json({
      success: true,
      data: reports,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    console.error('[Reports History API] 获取历史记录失败:', error);
    return NextResponse.json(
      { success: false, error: '获取历史记录失败' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      title,
      meta,
      mode,
      projects,
      dateStart,
      dateEnd,
      status,
      reportType,
      htmlContent,
      metadata,
      createdBy,
    } = body;

    if (!title || !htmlContent) {
      return NextResponse.json(
        { success: false, error: '标题和HTML内容不能为空' },
        { status: 400 }
      );
    }

    const report = await prisma.analysisReport.create({
      data: {
        title,
        meta: meta || null,
        mode: mode || 'advanced',
        projects: projects || [],
        dateStart: dateStart || '',
        dateEnd: dateEnd || '',
        status: status || null,
        reportType: reportType || 'full',
        htmlContent,
        metadata: metadata || {},
        createdBy: createdBy || null,
      },
    });

    console.log(`[Reports History API] 报告已保存: ${report.id} - ${report.title}`);

    return NextResponse.json({
      success: true,
      data: report,
      message: '报告保存成功',
    });
  } catch (error) {
    console.error('[Reports History API] 保存报告失败:', error);
    return NextResponse.json(
      { success: false, error: '保存报告失败' },
      { status: 500 }
    );
  }
}
