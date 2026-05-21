import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/v1/tapd/debug/raw-api-test
 * 直接测试 TAPD API 原始响应
 */
export async function GET(req: NextRequest) {
  try {
    const workspaceId = req.nextUrl.searchParams.get('workspaceId') || '37198579';
    
    const config = await prisma.systemSetting.findUnique({
      where: { key: 'tapd_api_config' },
    });
    
    if (!config?.value) {
      return NextResponse.json({ error: '未配置' }, { status: 400 });
    }
    
    const { apiUser, apiPassword } = JSON.parse(config.value);
    const credentials = Buffer.from(`${apiUser}:${apiPassword}`).toString('base64');
    
    // 直接调用 TAPD API（带时间范围参数，与同步代码一致）
    const url = `https://api.tapd.cn/stories?workspace_id=${workspaceId}&limit=2&page=1&created=2026-01-01~2026-12-31`;
    
    console.log(`\n[RAW API TEST] 调用 URL: ${url}`);
    
    const resp = await fetch(url, {
      headers: { Authorization: `Basic ${credentials}` },
    });
    
    console.log(`[RAW API TEST] 响应状态: ${resp.status}`);
    
    const data = await resp.json();
    
    console.log(`[RAW API TEST] 响应结构:`);
    console.log(`  status: ${data.status}`);
    console.log(`  info: ${data.info}`);
    console.log(`  data.count: ${data.data?.count}`);
    console.log(`  data.data.length: ${data.data?.data?.length}`);
    
    if (data.data?.data && data.data.data.length > 0) {
      const sample = data.data.data[0];
      const story = sample.Story || sample;
      
      console.log(`\n[RAW API TEST] 样本数据:`);
      console.log(`  id: ${story.id}`);
      console.log(`  name: ${story.name}`);
      console.log(`  created: ${story.created} (type: ${typeof story.created})`);
      console.log(`  completed: ${story.completed} (type: ${typeof story.completed})`);
    }
    
    return NextResponse.json({
      url,
      responseStatus: resp.status,
      tapdStatus: data.status,
      tapdInfo: data.info,
      count: data.data?.count,
      dataLength: data.data?.data?.length,
      sample: data.data?.data?.[0],
    });
    
  } catch (error) {
    console.error('[RAW API TEST] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
