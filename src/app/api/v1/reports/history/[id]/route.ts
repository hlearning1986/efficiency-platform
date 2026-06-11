import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const report = await prisma.analysisReport.findUnique({
      where: { id },
    });

    if (!report) {
      return NextResponse.json(
        { success: false, error: '报告不存在' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: report,
    });
  } catch (error) {
    console.error('[Report Detail API] 获取报告详情失败:', error);
    return NextResponse.json(
      { success: false, error: '获取报告详情失败' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const report = await prisma.analysisReport.findUnique({
      where: { id },
      select: { id: true, title: true },
    });

    if (!report) {
      return NextResponse.json(
        { success: false, error: '报告不存在' },
        { status: 404 }
      );
    }

    await prisma.analysisReport.delete({
      where: { id },
    });

    console.log(`[Reports History API] 报告已删除: ${id} - ${report.title}`);

    return NextResponse.json({
      success: true,
      message: '报告已删除',
    });
  } catch (error) {
    console.error('[Reports History API] 删除报告失败:', error);
    return NextResponse.json(
      { success: false, error: '删除报告失败' },
      { status: 500 }
    );
  }
}
