import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/v1/settings/system?key=xxx
// 获取单个或全部系统配置
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const key = searchParams.get('key');

    if (key) {
      const setting = await prisma.systemSetting.findUnique({ where: { key } });
      return NextResponse.json({
        success: true,
        data: setting ? setting.value : null,
      });
    }

    // 返回全部配置
    const settings = await prisma.systemSetting.findMany();
    const data: Record<string, string> = {};
    for (const s of settings) {
      data[s.key] = s.value;
    }
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('[GET system-setting]', error);
    return NextResponse.json({ success: false, message: '获取配置失败' }, { status: 500 });
  }
}

// PUT /api/v1/settings/system
// 批量保存系统配置（KV 对）
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { settings } = body as { settings: Record<string, string> };

    if (!settings || typeof settings !== 'object') {
      return NextResponse.json({ success: false, message: '参数格式错误' }, { status: 400 });
    }

    for (const [key, value] of Object.entries(settings)) {
      await prisma.systemSetting.upsert({
        where: { key },
        update: { value },
        create: { key, value },
      });
    }

    return NextResponse.json({ success: true, message: '保存成功' });
  } catch (error) {
    console.error('[PUT system-setting]', error);
    return NextResponse.json({ success: false, message: '保存失败' }, { status: 500 });
  }
}
