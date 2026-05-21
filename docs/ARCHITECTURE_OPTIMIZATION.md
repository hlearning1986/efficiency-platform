# 效能平台架构优化方案

## 一、当前架构分析

### 1.1 架构现状

```
┌─────────────────────────────────────────────────────────────────┐
│                    Next.js 全栈应用                             │
├─────────────────────────────────────────────────────────────────┤
│  前端 (React)          │  后端 (API Routes)                     │
│  - 页面组件             │  - /api/v1/projects                    │
│  - 状态管理 (Zustand)   │  - /api/v1/resources/tapd/proxy        │
│                        │  - /api/v1/dashboard/delivery          │
├────────────────────────┴────────────────────────────────────────┤
│  数据库: SQLite (Prisma ORM)                                    │
│  缓存: 内存缓存                                                  │
│  认证: NextAuth.js                                              │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 存在的问题

| 问题 | 影响 | 严重程度 |
|------|------|----------|
| 前后端未分离 | 无法独立扩展，部署耦合 | 中 |
| SQLite 数据库 | 不支持高并发，无连接池 | 高 |
| 内存缓存 | 多实例部署缓存不共享 | 中 |
| TAPD 数据实时拉取 | 响应慢，易超时，无离线能力 | 高 |
| 无数据落库机制 | 部分数据只在前端展示，无法追溯 | 高 |

---

## 二、优化方案

### 方案 A：渐进式优化（推荐）

**目标**：保持 Next.js 全栈架构，优化数据层和缓存层

#### 2.1 数据库优化

**当前**：SQLite → **目标**：PostgreSQL

```prisma
// prisma/schema.prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

**迁移步骤**：
1. 安装 PostgreSQL
2. 修改 `DATABASE_URL` 环境变量
3. 执行 `npx prisma migrate deploy`

#### 2.2 缓存优化

**当前**：内存缓存 → **目标**：Redis

```typescript
// src/lib/redis.ts
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);

// 缓存 TAPD 数据
await redis.setex(`tapd:stories:${wsId}`, 3600, JSON.stringify(stories));
```

#### 2.3 数据落库优化（核心）

**目标**：所有 TAPD 数据先落库，前端只查本地数据库

```
┌──────────────┐     ┌─────────────────┐     ┌──────────────┐
│   TAPD API   │ ──► │  同步服务        │ ──► │  PostgreSQL  │
└──────────────┘     │  (定时/手动)     │     └──────────────┘
                     └─────────────────┘            │
                                                    │
                     ┌─────────────────┐            │
                     │   前端查询       │ ◄──────────┘
                     │  (只查本地库)    │
                     └─────────────────┘
```

**新增数据表**：

```prisma
// 需求数据表
model TapdStory {
  id              String   @id
  name            String
  status          String
  owner           String?
  creator         String?
  created         DateTime
  completed       DateTime?
  workspaceId     String
  workspaceName   String?
  iterationId     String?
  iterationName   String?
  effort          Float?
  effortCompleted Float?
  customField11   String?  // 成本归属
  customField13   String?  // 项目归属
  rawJson         Json?    // 原始数据
  syncedAt        DateTime @default(now())
  
  @@index([workspaceId])
  @@index([status])
  @@index([created])
  @@index([completed])
}

// 任务数据表
model TapdTask {
  id              String   @id
  name            String
  status          String
  owner           String?
  creator         String?
  created         DateTime
  completed       DateTime?
  storyId         String?
  workspaceId     String
  effort          Float?
  effortCompleted Float?
  rawJson         Json?
  syncedAt        DateTime @default(now())
  
  @@index([storyId])
  @@index([workspaceId])
}

// 迭代数据表
model TapdIteration {
  id            String   @id
  name          String
  workspaceId   String
  startDate     DateTime?
  endDate       DateTime?
  status        String?
  syncedAt      DateTime @default(now())
  
  @@index([workspaceId])
}

// 同步记录表
model TapdSyncRecord {
  id            String   @id @default(cuid())
  syncType      String   // full | incremental
  workspaceIds  String[] // 同步的项目列表
  status        String   // running | success | failed
  storyCount    Int      @default(0)
  taskCount     Int      @default(0)
  errorMsg      String?
  startedAt     DateTime @default(now())
  finishedAt    DateTime?
  
  @@index([status])
  @@index([startedAt])
}
```

#### 2.4 同步服务设计

```typescript
// src/lib/sync/tapd-sync-service.ts

export class TapdSyncService {
  /**
   * 全量同步 - 拉取所有项目数据并落库
   */
  async fullSync(workspaceIds: string[], options?: SyncOptions) {
    // 1. 创建同步记录
    const record = await prisma.tapdSyncRecord.create({
      data: { syncType: 'full', workspaceIds, status: 'running' }
    });

    try {
      // 2. 拉取并保存 Stories
      for (const wsId of workspaceIds) {
        const stories = await this.fetchStories(wsId);
        await this.saveStories(stories);
      }

      // 3. 拉取并保存 Tasks
      for (const wsId of workspaceIds) {
        const tasks = await this.fetchTasks(wsId);
        await this.saveTasks(tasks);
      }

      // 4. 更新同步记录
      await prisma.tapdSyncRecord.update({
        where: { id: record.id },
        data: { status: 'success', finishedAt: new Date() }
      });
    } catch (error) {
      await prisma.tapdSyncRecord.update({
        where: { id: record.id },
        data: { status: 'failed', errorMsg: error.message, finishedAt: new Date() }
      });
    }
  }

  /**
   * 增量同步 - 只拉取变更数据
   */
  async incrementalSync(workspaceIds: string[]) {
    const lastSync = await prisma.tapdSyncRecord.findFirst({
      where: { status: 'success' },
      orderBy: { startedAt: 'desc' }
    });

    const since = lastSync?.finishedAt || new Date(Date.now() - 24 * 3600 * 1000);
    // 拉取 since 之后变更的数据...
  }

  /**
   * 保存 Stories 到数据库
   */
  private async saveStories(stories: TapdStory[]) {
    await prisma.$transaction(
      stories.map(story => 
        prisma.tapdStory.upsert({
          where: { id: story.id },
          update: story,
          create: story
        })
      )
    );
  }
}
```

#### 2.5 前端查询改造

**改造前**（直接调用 TAPD API）：
```typescript
// 当前：实时拉取 TAPD 数据
const resp = await fetch('/api/v1/dashboard/delivery', {
  body: JSON.stringify({ workspaceIds, ... })
});
```

**改造后**（查询本地数据库）：
```typescript
// 优化后：查询本地数据库
const resp = await fetch('/api/v1/dashboard/delivery', {
  body: JSON.stringify({ 
    workspaceIds,
    useCache: true,  // 使用缓存数据
    forceSync: false // 不强制同步
  })
});
```

**API 改造**：
```typescript
// src/app/api/v1/dashboard/delivery/route.ts

export async function POST(req: NextRequest) {
  const { workspaceIds, useCache, forceSync } = await req.json();

  // 1. 如果使用缓存，直接查数据库
  if (useCache) {
    const stories = await prisma.tapdStory.findMany({
      where: { workspaceId: { in: workspaceIds } }
    });
    return NextResponse.json({ success: true, data: stories });
  }

  // 2. 如果强制同步，先同步再返回
  if (forceSync) {
    await tapdSyncService.fullSync(workspaceIds);
  }

  // 3. 否则实时拉取（兼容旧逻辑）
  // ...
}
```

---

## 三、实施计划

### Phase 1：数据库迁移（1-2 天）

| 步骤 | 内容 | 验证方式 |
|------|------|----------|
| 1.1 | 添加 PostgreSQL 支持 | 修改 schema.prisma |
| 1.2 | 创建新数据表 | prisma migrate dev |
| 1.3 | 数据迁移脚本 | 迁移现有数据 |

### Phase 2：同步服务开发（2-3 天）

| 步骤 | 内容 | 验证方式 |
|------|------|----------|
| 2.1 | 实现 TapdSyncService | 单元测试 |
| 2.2 | 创建同步 API | POST /api/v1/sync/full |
| 2.3 | 定时同步任务 | node-cron |
| 2.4 | 同步状态查询 | GET /api/v1/sync/status |

### Phase 3：前端改造（1-2 天）

| 步骤 | 内容 | 验证方式 |
|------|------|----------|
| 3.1 | 数据同步页面改造 | 显示同步状态 |
| 3.2 | 交付看板改造 | 查询本地数据 |
| 3.3 | 缓存刷新机制 | 手动/自动刷新 |

### Phase 4：Redis 缓存（1 天）

| 步骤 | 内容 | 验证方式 |
|------|------|----------|
| 4.1 | Redis 连接配置 | 环境变量 |
| 4.2 | 缓存读写封装 | redis.ts |
| 4.3 | 缓存策略实现 | TTL + 失效 |

---

## 四、预期收益

| 指标 | 优化前 | 优化后 | 提升 |
|------|--------|--------|------|
| 查询响应时间 | 30-60s | < 1s | **60x** |
| 并发支持 | 低 (SQLite) | 高 (PostgreSQL) | **10x+** |
| 离线能力 | 无 | 有 | ✅ |
| 数据追溯 | 部分 | 完整 | ✅ |
| 扩展性 | 单实例 | 多实例 | ✅ |

---

## 五、风险与应对

| 风险 | 影响 | 应对措施 |
|------|------|----------|
| 数据同步延迟 | 数据不是最新 | 提供手动刷新按钮 |
| PostgreSQL 运维 | 需要数据库管理 | 使用云数据库服务 |
| 同步失败 | 数据不完整 | 重试机制 + 告警 |

---

## 六、待确认事项

请确认以下选项后开始实施：

1. **数据库选型**：
   - [ ] PostgreSQL（推荐）
   - [ ] MySQL
   - [ ] 其他：______

2. **同步策略**：
   - [ ] 定时同步（每 15 分钟增量 + 每日全量）
   - [ ] 手动同步（用户触发）
   - [ ] 混合模式（定时 + 手动）

3. **缓存策略**：
   - [ ] Redis（推荐）
   - [ ] 数据库缓存
   - [ ] 不使用缓存

4. **实施优先级**：
   - [ ] 先数据库迁移
   - [ ] 先同步服务开发
   - [ ] 先前端改造

---

*文档生成时间：2026-05-13*
