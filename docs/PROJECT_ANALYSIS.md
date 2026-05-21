# 项目全局扫描分析报告

---

## 1. 项目概览

### 一句话描述
**efficiency-platform** 是一个企业级项目效率管理平台，集成腾讯TAPD敏捷协作平台数据同步能力，提供项目全生命周期管理、OKR对齐视图、里程碑跟踪和数据可视化仪表盘。

### 项目根目录结构树

```
d:\platform/
├── efficiency-platform/     # 主应用目录（Next.js项目）
│   ├── .next/              # Next.js构建输出目录
│   ├── prisma/             # Prisma ORM配置和迁移
│   ├── src/                # 源代码目录
│   ├── .env                # 环境变量配置
│   ├── dev.db              # SQLite开发数据库
│   └── package.json        # 依赖配置
├── postgres-data/          # PostgreSQL数据库数据目录
│   └── base/               # 数据库基础数据文件
├── .trae/                  # Trae AI Agent技能配置
│   └── skills/             # 自定义技能目录
└── Story处理_TAPD_API_交互稿.html  # 业务交互文档
```

### 技术栈识别

| 分类 | 技术 | 版本 |
|------|------|------|
| 语言 | TypeScript | ^5 |
| Web框架 | Next.js | 14.2.35 |
| UI组件库 | Ant Design | ^5.29.3 |
| 图表库 | ECharts + Recharts | ^6.0.0 / ^3.8.1 |
| ORM | Prisma | ^7.8.0 |
| 数据库 | PostgreSQL | 通过pg ^8.20.0 |
| 缓存 | Redis | ioredis ^5.10.1 |
| 状态管理 | Zustand | ^5.0.12 |
| 认证 | NextAuth | ^5.0.0-beta.31 |
| 定时任务 | node-cron | ^4.2.1 |
| 构建工具 | npm + Next.js | - |
| CSS | Tailwind CSS | ^3.4.1 |

---

## 2. 模块清单

| 目录/包名 | 推测职责 | 入口文件 | 是否核心模块 |
|-----------|----------|----------|--------------|
| `src/app/(auth)` | 用户认证登录 | `login/page.tsx` | 是 |
| `src/app/(dashboard)` | 主应用仪表盘 | `layout.tsx`, `page.tsx` | 是 |
| `src/app/(dashboard)/projects` | 项目管理模块 | `list/page.tsx`, `manage/page.tsx`, `[id]/page.tsx` | 是 |
| `src/app/(dashboard)/dashboard` | 交付仪表盘 | `delivery-dashboard/page.tsx` | 是 |
| `src/app/(dashboard)/tapd` | TAPD数据管理 | `data-manager/page.tsx` | 是 |
| `src/app/(dashboard)/resources` | 资源同步管理 | `sync/page.tsx` | 是 |
| `src/app/(dashboard)/settings` | 系统设置 | `tapd/page.tsx`, `team-config/page.tsx`, `project-mapping/page.tsx` | 是 |
| `src/app/api` | REST API接口 | `api/v1/*/route.ts` | 是 |
| `src/lib/sync` | TAPD数据同步服务 | `tapd-sync-service.ts` | 是 |
| `src/lib/middleware` | 中间件（认证/RBAC） | `auth.ts`, `rbac.ts` | 是 |
| `src/lib/cron` | 定时任务调度 | `scheduler.ts` | 是 |
| `src/lib` | 核心工具库 | `prisma.ts`, `redis.ts`, `utils/*` | 是 |
| `src/stores` | Zustand状态管理 | `auth.store.ts`, `tapd-config.store.ts` | 是 |
| `src/types` | TypeScript类型定义 | `project.ts`, `auth.ts`, `api.ts` | 是 |
| `src/components` | UI组件 | `layout/SidebarMenu.tsx`, `layout/AppLayout.tsx` | 否 |

---

## 3. 外部依赖清单

### 按用途分类

#### Web框架与UI

| 依赖 | 版本 | 用途 | 状态 |
|------|------|------|------|
| `next` | 14.2.35 | React服务端渲染框架 | ✅ 稳定 |
| `react` | ^18 | UI框架 | ✅ 稳定 |
| `react-dom` | ^18 | React DOM渲染 | ✅ 稳定 |
| `antd` | ^5.29.3 | UI组件库 | ✅ 稳定 |
| `@ant-design/icons` | ^6.1.1 | Ant Design图标 | ✅ 稳定 |
| `@ant-design/pro-components` | ^2.8.10 | Pro组件库 | ✅ 稳定 |

#### 数据库与缓存

| 依赖 | 版本 | 用途 | 状态 |
|------|------|------|------|
| `@prisma/client` | ^7.8.0 | ORM客户端 | ⚠️ 版本较旧（当前最新v12+） |
| `@prisma/adapter-pg` | ^7.8.0 | PostgreSQL适配器 | ⚠️ 版本较旧 |
| `@prisma/adapter-better-sqlite3` | ^7.8.0 | SQLite适配器 | ⚠️ 版本较旧 |
| `@prisma/adapter-libsql` | ^7.8.0 | LibSQL适配器 | ⚠️ 版本较旧 |
| `pg` | ^8.20.0 | PostgreSQL驱动 | ✅ 稳定 |
| `ioredis` | ^5.10.1 | Redis客户端 | ✅ 稳定 |

#### 认证与安全

| 依赖 | 版本 | 用途 | 状态 |
|------|------|------|------|
| `next-auth` | ^5.0.0-beta.31 | 认证库 | ⚠️ Beta版本，生产环境需谨慎 |

#### 数据可视化

| 依赖 | 版本 | 用途 | 状态 |
|------|------|------|------|
| `echarts` | ^6.0.0 | 图表库 | ✅ 稳定 |
| `echarts-for-react` | ^3.0.6 | ECharts React封装 | ✅ 稳定 |
| `recharts` | ^3.8.1 | React图表库 | ✅ 稳定 |

#### 工具库

| 依赖 | 版本 | 用途 | 状态 |
|------|------|------|------|
| `axios` | ^1.15.2 | HTTP客户端 | ⚠️ 有已知安全漏洞（CVE-2024-39332） |
| `node-cron` | ^4.2.1 | 定时任务 | ✅ 稳定 |
| `zustand` | ^5.0.12 | 状态管理 | ✅ 稳定 |
| `xlsx` | ^0.18.5 | Excel处理 | ⚠️ 版本较旧 |
| `exceljs` | ^4.4.0 | Excel读写 | ✅ 稳定 |

#### 开发工具

| 依赖 | 版本 | 用途 | 状态 |
|------|------|------|------|
| `prisma` | ^7.8.0 | ORM CLI | ⚠️ 版本较旧 |
| `typescript` | ^5 | TypeScript编译器 | ✅ 稳定 |
| `tailwindcss` | ^3.4.1 | CSS框架 | ✅ 稳定 |
| `postcss` | ^8 | CSS后处理器 | ✅ 稳定 |
| `eslint` | ^8 | 代码检查 | ⚠️ 版本较旧（当前v9+） |
| `ts-node` | ^10.9.2 | TypeScript运行时 | ⚠️ 版本较旧 |
| `tsx` | ^4.21.0 | TypeScript执行器 | ✅ 稳定 |

#### 第三方集成

| 依赖 | 版本 | 用途 | 状态 |
|------|------|------|------|
| `@opentapd/tapd-node-sdk` | ^1.67.0 | TAPD SDK | ✅ 稳定 |

### 依赖风险评估

| 风险等级 | 依赖 | 说明 |
|----------|------|------|
| **高风险** | `axios@1.15.2` | 存在CVE-2024-39332漏洞，可能导致SSRF攻击 |
| **中风险** | `next-auth@5.0.0-beta.31` | Beta版本，API可能不稳定 |
| **低风险** | `prisma@7.8.0` | 版本较旧，建议升级到稳定版 |
| **低风险** | `eslint@8` | 版本较旧，功能完整但缺少新特性 |

---

## 4. 运行环境推测

### 部署架构

```
┌─────────────────────────────────────────────────────────┐
│                    前端层 (Next.js)                     │
│  - SSR/SSG渲染                                           │
│  - API路由处理                                           │
└─────────────────┬───────────────────────────────────────┘
                  │ HTTP
                  ▼
┌─────────────────────────────────────────────────────────┐
│                    后端服务层                            │
│  - REST API (/api/v1/*)                                 │
│  - 认证中间件 (NextAuth)                                 │
│  - RBAC权限控制                                          │
│  - 定时任务调度 (node-cron)                              │
└─────────────────┬───────────────────────────────────────┘
                  │ Prisma ORM
                  ▼
┌─────────────────────────────────────────────────────────┐
│                    数据存储层                            │
│  ┌─────────────────┐  ┌─────────────────┐              │
│  │  PostgreSQL     │  │    Redis        │              │
│  │  (主数据库)     │  │  (缓存/会话)    │              │
│  └─────────────────┘  └─────────────────┘              │
└─────────────────────────────────────────────────────────┘
```

### 外部服务依赖

| 服务 | 用途 | 配置来源 | 必需性 |
|------|------|----------|--------|
| **PostgreSQL** | 主数据库存储 | `DATABASE_URL` | ✅ 必需 |
| **Redis** | 缓存、会话存储 | `REDIS_URL` | ✅ 必需 |
| **TAPD API** | 敏捷协作平台数据同步 | `TAPD_API_URL`, `TAPD_API_KEY`, `TAPD_API_USER` | ✅ 必需（核心功能） |
| **HR系统** | 人员数据集成 | `HR_API_URL`, `HR_API_KEY` | ⚠️ 可选 |
| **项目管理系统** | 外部项目数据集成 | `PROJECT_API_URL`, `PROJECT_API_KEY` | ⚠️ 可选 |
| **飞书** | 企业IM集成 | `FEISHU_APP_ID`, `FEISHU_APP_SECRET` | ⚠️ 可选 |

### 端口配置

| 服务 | 默认端口 | 配置方式 |
|------|----------|----------|
| Next.js开发服务器 | 3000 | `next dev` |
| PostgreSQL | 5432 | `DATABASE_URL` |
| Redis | 6379 | `REDIS_URL` |

---

## 5. 项目核心特性总结

1. **项目管理**：全生命周期管理，支持项目创建、编辑、状态跟踪、成本管理
2. **OKR对齐**：按OKR分组展示项目，支持战略/常规/技术分类
3. **TAPD集成**：从腾讯敏捷协作平台同步需求(Story)和任务(Task)数据
4. **数据可视化**：交付仪表盘、项目达成率统计、成本分析
5. **定时同步**：自动同步TAPD数据，支持手动触发
6. **权限控制**：RBAC角色权限管理

---

**扫描完成时间**：2026-05-14  
**项目状态**：开发中/维护中  
**依赖风险**：存在高风险依赖（axios），建议及时升级