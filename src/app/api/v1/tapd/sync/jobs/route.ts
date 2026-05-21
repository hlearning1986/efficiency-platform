import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { fullSyncWithSkill } from '@/lib/sync/tapd-skill-sync';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const jobId = searchParams.get('id');

    if (jobId) {
      const job = await prisma.tapdSyncRecord.findUnique({
        where: { id: jobId },
      });
      return NextResponse.json({ success: true, data: job });
    }

    const jobs = await prisma.tapdSyncRecord.findMany({
      orderBy: { startedAt: 'desc' },
      take: limit,
    });

    return NextResponse.json({ success: true, data: jobs });
  } catch (error) {
    const message = error instanceof Error ? error.message : '查询同步任务失败';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { workspaceIds, dataTypes, timeRange, updatePolicy } = body;

    if (!workspaceIds?.length) {
      return NextResponse.json({ success: false, message: '请选择至少一个项目' }, { status: 400 });
    }

    if (!dataTypes?.length) {
      return NextResponse.json({ success: false, message: '请选择至少一种数据类型' }, { status: 400 });
    }

    // 检查是否有正在运行的任务
    const runningJob = await prisma.tapdSyncRecord.findFirst({
      where: { status: 'running' },
    });

    if (runningJob) {
      return NextResponse.json({
        success: false,
        message: '已有同步任务正在运行，请稍后再试',
        jobId: runningJob.id,
      }, { status: 400 });
    }

    // 创建同步任务
    const job = await prisma.tapdSyncRecord.create({
      data: {
        syncType: 'full',
        workspaceIds,
        dataTypes,
        status: 'running',
        progress: 0,
      },
    });

    // 异步执行同步（使用正确的 TAPD Skill 实现）
    executeSyncJob(job.id, workspaceIds, dataTypes, timeRange, updatePolicy).catch(console.error);

    return NextResponse.json({
      success: true,
      jobId: job.id,
      message: '同步任务已创建',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '创建同步任务失败';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

async function executeSyncJob(
  jobId: string,
  workspaceIds: string[],
  dataTypes: string[],
  timeRange?: { begin: string; end: string },
  _updatePolicy?: string,
) {
  try {
    console.log(`[Sync] 开始执行同步任务 (Job ID: ${jobId})`);
    console.log(`[Sync] 工作区: ${workspaceIds.join(', ')}`);
    console.log(`[Sync] 数据类型: ${dataTypes.join(', ')}`);
    
    const updateProgress = async (progress: number) => {
      await prisma.tapdSyncRecord.update({
        where: { id: jobId },
        data: { progress },
      });
    };

    await updateProgress(10);
    
    // 使用 TAPD Skill 进行同步（正确的实现）
    const result = await fullSyncWithSkill({
      workspaceIds,
      createdBegin: timeRange?.begin,
      createdEnd: timeRange?.end,
      onProgress: async (msg, percent) => {
        console.log(`[Sync] ${msg} (${percent}%)`);
        await updateProgress(percent);
      },
    });

    await updateProgress(100);
    
    if (!result.success) {
      throw new Error(result.error || '同步失败');
    }

    console.log(`[Sync] 同步完成:`);
    console.log(`[Sync]   需求: ${result.storyCount}`);
    console.log(`[Sync]   任务: ${result.taskCount}`);
    console.log(`[Sync]   迭代: ${result.iterationCount}`);

    // 更新任务状态为完成
    await prisma.tapdSyncRecord.update({
      where: { id: jobId },
      data: {
        status: 'completed',
        progress: 100,
        storyCount: result.storyCount,
        taskCount: result.taskCount,
        iterationCount: result.iterationCount,
        finishedAt: new Date(),
      },
    });
    
  } catch (error) {
    console.error('[Sync] 同步失败:', error);
    
    const message = error instanceof Error ? error.message : String(error);
    
    await prisma.tapdSyncRecord.update({
      where: { id: jobId },
      data: {
        status: 'failed',
        errorMsg: message,
        finishedAt: new Date(),
      },
    });
    
    throw error;
  }
}
