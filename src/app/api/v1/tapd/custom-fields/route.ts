import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const workspaceId = searchParams.get('workspaceId');

    if (!workspaceId) {
      return NextResponse.json({ 
        success: false, 
        message: '请提供项目ID' 
      }, { status: 400 });
    }

    // 获取 TAPD API 配置
    const config = await prisma.systemSetting.findUnique({
      where: { key: 'tapd_api_config' },
    });

    if (!config) {
      return NextResponse.json({ 
        success: false, 
        message: '未找到TAPD API配置' 
      }, { status: 404 });
    }

    let tapdConfig;
    try {
      tapdConfig = JSON.parse(config.value as string);
    } catch (e) {
      return NextResponse.json({ 
        success: false, 
        message: 'TAPD配置格式错误' 
      }, { status: 500 });
    }

    const { apiUser, apiPassword } = tapdConfig;

    if (!apiUser || !apiPassword) {
      return NextResponse.json({ 
        success: false, 
        message: 'TAPD API凭据未配置' 
      }, { status: 400 });
    }

    // 1. 调用 TAPD 自定义字段配置 API
    let fieldMapping: Record<string, string> = {};
    let tapdApiSuccess = false;
    
    try {
      const url = `https://api.tapd.cn/stories/custom_fields_settings?workspace_id=${workspaceId}`;
      const credentials = Buffer.from(`${apiUser}:${apiPassword}`).toString('base64');

      console.log(`[CustomFields-API] 开始调用 TAPD API: ${url}`);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${credentials}`,
          'Content-Type': 'application/json',
        },
      });

      console.log(`[CustomFields-API] TAPD API 响应状态: ${response.status}`);

      if (response.ok) {
        const result = await response.json();
        
        console.log(`[CustomFields-API] TAPD API 返回数据:`, JSON.stringify(result).substring(0, 500));
        
        if (result.status === 1) {
          tapdApiSuccess = true;
          const fields = result.data || [];
          console.log(`[CustomFields-API] TAPD API 返回 ${fields.length} 个字段配置`);
          
          fields.forEach((item: any) => {
            const cfg = item.CustomFieldConfig;
            if (cfg.enabled === '1' && cfg.name && cfg.custom_field) {
              fieldMapping[cfg.custom_field] = cfg.name;
              console.log(`[CustomFields-API]   ✅ ${cfg.custom_field} → ${cfg.name}`);
            }
          });
        } else {
          console.warn(`[CustomFields-API] TAPD API 返回错误:`, result.info);
        }
      } else {
        console.error(`[CustomFields-API] TAPD API HTTP 错误: ${response.status}`);
      }
    } catch (error) {
      console.error('[CustomFields-API] TAPD API 调用失败:', error);
    }

    console.log(`[CustomFields-API] TAPD API 提供的映射:`, fieldMapping);

    // 2. 从数据库补充缺失的字段映射（关键修复！）
    try {
      console.log(`[CustomFields-API] 开始数据库补充逻辑...`);
      
      // 查询该项目的样本数据（取前5条）
      const sampleStories = await prisma.tapdStory.findMany({
        where: { workspaceId: workspaceId },
        take: 5,
        select: {
          rawJson: true,
        },
      });

      console.log(`[CustomFields-API] 查询到 ${sampleStories.length} 条样本数据`);

      if (sampleStories.length > 0) {
        // 收集所有有值的自定义字段
        const dbFields: Record<string, Set<string>> = {};
        
        sampleStories.forEach((story, idx) => {
          const raw = story.rawJson as Record<string, any> | null;
          if (raw) {
            for (const [key, value] of Object.entries(raw)) {
              // 匹配所有自定义字段格式
              if (
                (key.startsWith('custom_field_') || key.startsWith('custom_field')) &&
                value && String(value).trim() !== ''
              ) {
                if (!dbFields[key]) {
                  dbFields[key] = new Set();
                }
                dbFields[key].add(String(value));
                
                if (idx === 0) {  // 只打印第一条记录发现的字段
                  console.log(`[CustomFields-API]   📦 样本中发现字段: ${key} = "${String(value).substring(0, 50)}"`);
                }
              }
            }
          }
        });

        console.log(`[CustomFields-API] 数据库中共发现 ${Object.keys(dbFields).length} 个有值的自定义字段`);

        // 为数据库中有值但 API 未配置的字段添加推断映射
        for (const [fieldKey, values] of Object.entries(dbFields)) {
          if (!fieldMapping[fieldKey]) {
            // 基于常见模式推断字段名称
            const inferredName = inferFieldName(fieldKey, values);
            if (inferredName) {
              fieldMapping[fieldKey] = inferredName;
              console.log(`[CustomFields-API]   🆕 推断映射: ${fieldKey} → "${inferredName}"`);
            } else {
              console.warn(`[CustomFields-API]   ⚠️ 无法推断字段: ${fieldKey}`);
            }
          } else {
            console.log(`[CustomFields-API]   ✅ 已有映射: ${fieldKey} → "${fieldMapping[fieldKey]}"`);
          }
        }
      } else {
        console.warn(`[CustomFields-API] ⚠️ 未找到任何样本数据！workspaceId: ${workspaceId}`);
      }
    } catch (error) {
      console.error('[CustomFields-API] 数据库查询失败:', error);
    }

    console.log(`[CustomFields-API] 🎯 最终 fieldMapping:`, JSON.stringify(fieldMapping, null, 2));

    return NextResponse.json({
      success: true,
      data: {
        workspaceId,
        fieldMapping,
      },
    });
  } catch (error) {
    console.error('获取自定义字段配置失败:', error);
    const message = error instanceof Error ? error.message : '服务器错误';
    return NextResponse.json({ 
      success: false, 
      message 
    }, { status: 500 });
  }
}

/**
 * 根据字段键和值的特征推断字段名称（优化版：支持多关键词匹配 + 优先级）
 */
function inferFieldName(fieldKey: string, values: Set<string>): string | null {
  const sampleValue = Array.from(values)[0];
  const valueLower = sampleValue.toLowerCase();
  
  // 通用智能推断（适用于所有 custom_field_* 字段）
  return smartInferFieldName(fieldKey, valueLower);
}

/**
 * 智能字段名推断引擎
 * 优先级：成本归属 > 项目归属 > 按时提测 > 时间 > 其他
 */
function smartInferFieldName(fieldKey: string, valueLower: string): string {
  
  // 🔴 最高优先级：成本归属特征词（最明确）
  const costKeywords = ['成本', '平摊', '科技研发中心', 'cost'];
  if (costKeywords.some(kw => valueLower.includes(kw))) {
    return '成本归属';
  }
  
  // 🟠 高优先级：项目归属特征词
  const projectKeywords = [
    '项目', '常规项目', '技术项目', 
    '直播', '点播', 'app', '鸿蒙',
    'bi', '数据'
  ];
  if (projectKeywords.some(kw => valueLower.includes(kw))) {
    return '项目归属';
  }
  
  // 🟡 中优先级：按时提测（布尔值）
  if (valueLower === '是' || valueLower === '否' || valueLower === 'yes' || valueLower === 'no') {
    return '按时提测';
  }
  
  // 🟢 低优先级：时间戳
  if (/^\d{4}-\d{2}-\d{2}/.test(valueLower)) {
    return '创建时间(自定义)';
  }
  
  // 🔵 兜底：返回字段编号
  if (fieldKey.startsWith('custom_field_')) {
    const num = fieldKey.replace('custom_field_', '');
    return `CF-${num}`;
  } else if (fieldKey === 'custom_field_one') {
    return 'CF-One';
  } else if (fieldKey === 'custom_field_two') {
    return 'CF-Two';
  }
  
  return `未知-${fieldKey}`;
}
