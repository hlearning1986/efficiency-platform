import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/v1/tapd/debug/story-sample
 * 获取 TAPD 需求样本数据用于调试
 */
export async function GET(req: NextRequest) {
  try {
    const workspaceId = req.nextUrl.searchParams.get('workspaceId') || '37198579';

    // 1. 获取 TAPD 配置
    const config = await prisma.systemSetting.findUnique({
      where: { key: 'tapd_api_config' },
    });

    if (!config?.value) {
      return NextResponse.json({ error: '未配置 TAPD API' }, { status: 400 });
    }

    const tapdConfig = JSON.parse(config.value);
    const { apiUser, apiPassword } = tapdConfig;

    // 2. 调用 TAPD API 获取一条需求
    const credentials = Buffer.from(`${apiUser}:${apiPassword}`).toString('base64');
    
    // 获取第一个需求（限制1条）
    const storyResp = await fetch(
      `https://api.tapd.cn/stories?workspace_id=${workspaceId}&limit=1&page=1`,
      {
        headers: { Authorization: `Basic ${credentials}` },
      }
    );
    const storyData = await storyResp.json();

    // 3. 分析返回的数据结构
    const result = {
      workspaceId,
      tapdApiStatus: storyData.status,
      tapdApiInfo: storyData.info,
      totalCount: storyData.data?.count || 0,
      stories: [],
    };

    if (storyData.data?.data && storyData.data.data.length > 0) {
      const rawStory = storyData.data.data[0];
      const story = rawStory.Story || rawStory;

      // 提取关键字段
      result.stories.push({
        id: story.id,
        name: story.name,
        
        // 关键字段
        workspace_id: story.workspace_id,
        workspace_name: story.workspace_name,
        created: story.created,
        completed: story.completed,
        owner: story.owner,
        creator: story.creator,
        
        // 自定义字段（前端需要的）
        custom_field_10: story.custom_field_10,  // 按时提测
        custom_field_11: story.custom_field_11,  // 成本归属
        custom_field_13: story.custom_field_13,  // 项目归属
        custom_field_six: story.custom_field_six, // 是否插入
        
        // 所有字段名列表
        allFields: Object.keys(story),
        
        // 完整原始数据
        rawData: story,
      });

      // 检查哪些关键字段缺失或为空
      const requiredFields = [
        'workspace_name', 'created', 'completed',
        'custom_field_10', 'custom_field_11', 'custom_field_13'
      ];
      
      result.missingFields = requiredFields.filter(f => !(f in story));
      result.emptyFields = requiredFields.filter(f => {
        const val = story[f];
        return val === '' || val === null || val === undefined;
      });
    }

    return NextResponse.json(result);

  } catch (error) {
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : '未知错误' 
    }, { status: 500 });
  }
}
