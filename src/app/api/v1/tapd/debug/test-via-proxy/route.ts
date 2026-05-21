import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/v1/tapd/debug/test-via-proxy
 * 通过 skill-proxy 测试（与同步代码完全一致）
 */
export async function GET() {
  try {
    // 与同步代码完全一致的调用方式
    const requestBody = {
      service: 'stories',
      action: 'list',
      workspaceIds: ['37198579'],
      params: {
        limit: 2,
        page: 1,
        created: '2026-01-01~2026-12-31',  // 时间范围
      },
      fields: ['id', 'name', 'created', 'completed', 'workspace_id', 'workspace_name'],  // 可选
    };
    
    console.log('\n[PROXY TEST] 通过 skill-proxy 调用...');
    console.log('[PROXY TEST] Request body:', JSON.stringify(requestBody, null, 2));
    
    const resp = await fetch('http://localhost:3000/api/v1/tapd/skill-proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });
    
    const result = await resp.json();
    
    console.log('[PROXY TEST] Response status:', resp.status);
    console.log('[PROXY TEST] Success:', result.success);
    
    if (result.data && result.data.length > 0) {
      const tapdData = result.data[0].data;
      console.log('[PROXY TEST] TAPD status:', tapdData?.status);
      console.log('[PROXY TEST] TAPD info:', tapdData?.info);
      console.log('[PROXY TEST] Data count:', tapdData?.data?.length);
      
      if (tapdData?.data && tapdData.data.length > 0) {
        const sample = tapdData.data[0];
        const story = sample.Story || sample;
        
        console.log('\n[PROXY TEST] ✅ 获取到数据!');
        console.log('   Sample ID:', story.id);
        console.log('   Sample name:', story.name);
        console.log('   Created:', story.created, '(type:', typeof story.created + ')');
        console.log('   Completed:', story.completed, '(type:', typeof story.completed + ')');
        
        return NextResponse.json({
          success: true,
          message: '通过 proxy 成功获取数据',
          tapdStatus: tapdData.status,
          count: tapdData.data.length,
          sample: {
            id: story.id,
            name: story.name,
            created: story.created,
            createdType: typeof story.created,
            completed: story.completed,
            completedType: typeof story.completed,
          },
        });
      }
    }
    
    return NextResponse.json({
      success: false,
      message: '未获取到数据',
      response: result,
    });
    
  } catch (error) {
    console.error('[PROXY TEST] Error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}
