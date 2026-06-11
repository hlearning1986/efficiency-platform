/**
 * GET /api/v1/workload/debug-owner-format
 * 检查任务表owner字段的实际格式
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    // 获取任务表中的owner样本（按出现频率排序）
    const topOwners = await prisma.tapdTask.groupBy({
      by: ['owner'],
      where: { owner: { not: null } },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 30,
    });

    // 获取角色映射表中的memberName样本
    const roleMembers = await prisma.tapdMemberRoleMapping.groupBy({
      by: ['memberName'],
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 20,
    });

    // 对比分析
    const ownerTypes = {
      chineseName: [],      // 中文名 (如"张三")
      englishName: [],      // 英文名 (如"zhangsan")
      userId: [],           // 数字ID (如"123456")
      email: [],            // 邮箱 (如"xxx@xxx.com")
      special: [],          // 特殊字符或混合
      other: [],
    };

    for (const o of topOwners) {
      const name = o.owner || '';
      if (/^[\u4e00-\u9fa5]{2,4}$/.test(name)) {
        ownerTypes.chineseName.push({ name, count: o._count.id });
      } else if (/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(name)) {
        if (name.includes('@')) {
          ownerTypes.email.push({ name, count: o._count.id });
        } else {
          ownerTypes.englishName.push({ name, count: o._count.id });
        }
      } else if (/^\d+$/.test(name)) {
        ownerTypes.userId.push({ name, count: o._count.id });
      } else {
        ownerTypes.special.push({ name, count: o._count.id });
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        taskOwnerSample: topOwners.slice(0, 15).map(o => ({
          owner: o.owner,
          taskCount: o._count.id,
          type: classifyOwnerType(o.owner),
        })),
        roleMemberSample: roleMembers.slice(0, 10).map(m => ({
          memberName: m.memberName,
          mappingCount: m._count.id,
        })),
        ownerTypeStats: {
          chineseName: ownerTypes.chineseName.length,
          englishName: ownerTypes.englishName.length,
          userId: ownerTypes.userId.length,
          email: ownerTypes.email.length,
          special: ownerTypes.special.length,
        },
        samples: {
          chineseNames: ownerTypes.chineseName.slice(0, 5),
          englishNames: ownerTypes.englishName.slice(0, 5),
          userIds: ownerTypes.userId.slice(0, 5),
          emails: ownerTypes.email.slice(0, 3),
          specials: ownerTypes.special.slice(0, 3),
        },
      }
    });

    function classifyOwnerType(owner: string | null): string {
      if (!owner) return 'null';
      if (/^[\u4e00-\u9fa5]{2,4}$/.test(owner)) return '中文名';
      if (/^[a-zA-Z][a-zA-Z0-9_-]+$/.test(owner)) return owner.includes('@') ? '邮箱' : '英文名';
      if (/^\d+$/.test(owner)) return '数字ID';
      return '特殊格式';
    }
  } catch (error) {
    console.error('[debug-owner-format] Error:', error);
    return NextResponse.json(
      { success: false, message: (error as Error).message },
      { status: 500 }
    );
  }
}
