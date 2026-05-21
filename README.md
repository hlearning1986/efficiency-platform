# 效率平台

> 企业级研发效能分析与项目管理系统，通过整合 TAPD 数据提供数据驱动的决策支持。

[![Next.js](https://img.shields.io/badge/Next.js-14.x-blue.svg)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)
[![Prisma](https://img.shields.io/badge/Prisma-5.x-ff69b4.svg)](https://www.prisma.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-14.x-blue.svg)](https://www.postgresql.org/)
[![Ant Design](https://img.shields.io/badge/Ant%20Design-5.x-purple.svg)](https://ant.design/)

---

## 📋 项目简介

**效率平台**是一款面向企业级用户的研发效能分析与项目管理系统，通过无缝对接腾讯 TAPD 敏捷协作平台，自动同步需求、任务、迭代、缺陷、工时等数据，提供多维度的效率指标分析和可视化展示，帮助企业管理层、项目经理和团队负责人实现数据驱动的决策管理。

核心能力包括：项目全生命周期管理、TAPD 数据自动同步、效能指标分析、资源利用率统计、成本效益评估等。

---

## 🛠️ 技术栈

| 分类 | 技术 | 版本 |
|------|------|------|
| 框架 | Next.js | 14.x |
| 语言 | TypeScript | 5.x |
| ORM | Prisma | 5.x |
| 认证 | NextAuth.js | 5.x |
| UI 框架 | Ant Design | 5.x |
| 状态管理 | Zustand | 4.x |
| 数据库 | PostgreSQL | 14.x |
| 缓存 | Redis | 7.x |

---

## 🚀 本地运行步骤

### 前置条件

确保已安装以下环境：
- Node.js ≥ 20.x
- npm ≥ 10.x
- PostgreSQL ≥ 14.x
- Redis ≥ 7.x（可选，开发环境使用内存模拟）

### 1. 克隆项目

```bash
git clone <repository-url>
cd efficiency-platform
```

### 2. 安装依赖

```bash
npm install
```

### 3. 配置环境变量

复制 `.env.example` 并修改：

```bash
cp .env.example .env
```

配置内容：

```env
# 数据库配置
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/efficiency"

# Redis配置
REDIS_URL="redis://localhost:6379"

# NextAuth配置
NEXTAUTH_SECRET="your-secret-key-here"
AUTH_SECRET="your-auth-secret-here"

# TAPD配置
TAPD_API_URL="https://api.tapd.cn"
TAPD_API_USER="your-tapd-user"
TAPD_API_PASSWORD="your-tapd-password"
```

### 4. 数据库初始化

```bash
# 创建数据库（可选，如果数据库不存在）
createdb efficiency

# 运行数据库迁移
npx prisma migrate dev --name init

# 生成 Prisma 客户端
npx prisma generate
```

### 5. 启动开发服务器

```bash
npm run dev
```

访问 http://localhost:3000 即可进入系统。

### 6. 登录系统

系统默认使用临时密码验证（开发阶段）：
- 用户名：任意邮箱（需先在数据库中创建用户）
- 密码：`initial_password`

> **注意**：生产环境需接入正式认证系统（如飞书SSO）

---

## 📁 项目目录结构

```
efficiency-platform/
├── src/
│   ├── app/                      # Next.js App Router
│   │   ├── (auth)/               # 认证页面（登录）
│   │   ├── (dashboard)/          # 主应用页面
│   │   │   ├── dashboard/        # 交付仪表盘
│   │   │   ├── projects/         # 项目管理
│   │   │   ├── tapd/             # TAPD数据管理
│   │   │   ├── resources/        # 资源同步
│   │   │   └── settings/         # 系统设置
│   │   └── api/v1/               # REST API
│   │       ├── projects/         # 项目管理API
│   │       ├── tapd/             # TAPD同步API
│   │       ├── efficiency/       # 效能分析API
│   │       ├── dashboard/        # 仪表盘API
│   │       ├── resources/        # 资源管理API
│   │       ├── settings/         # 系统设置API
│   │       └── admin/            # 管理API
│   ├── lib/                      # 核心库
│   │   ├── auth.ts               # NextAuth配置
│   │   ├── prisma.ts             # Prisma客户端
│   │   ├── redis.ts              # Redis客户端
│   │   ├── middleware/           # 中间件（auth/rbac）
│   │   ├── sync/                 # TAPD同步服务
│   │   ├── cron/                 # 定时任务调度
│   │   └── utils/                # 工具函数
│   ├── stores/                   # Zustand状态管理
│   ├── components/               # UI组件
│   ├── types/                    # TypeScript类型定义
│   └── generated/                # 生成代码（Prisma）
├── prisma/                       # Prisma配置
├── public/                       # 静态资源
├── next.config.js                # Next.js配置
├── tsconfig.json                 # TypeScript配置
└── package.json                  # 项目依赖
```

---

## ✨ 核心功能清单

| 模块 | 功能 | 描述 |
|------|------|------|
| **项目管理** | 项目CRUD | 创建、编辑、删除项目 |
| | 里程碑管理 | 按季度管理项目里程碑 |
| | 成本管理 | 项目成本预算管理 |
| | ROI分析 | 投资回报率分析 |
| **效能分析** | 效率排行榜 | 团队/个人效率排名 |
| | 交付仪表盘 | 项目交付数据可视化 |
| | 成员画像 | 员工绩效分析 |
| **TAPD管理** | 数据同步 | 需求/任务/迭代同步 |
| | 数据查询 | TAPD原始数据查询 |
| | 数据统计 | 同步数据统计分析 |
| **资源管理** | 成员分布 | 团队资源分布统计 |
| | 同步日志 | 数据同步历史记录 |
| **系统设置** | 团队配置 | 团队基础信息管理 |
| | 项目映射 | TAPD项目映射配置 |
| | 系统配置 | 全局系统配置 |

---

## ❓ 常见问题

### Q1: 数据库连接失败

**现象**：启动时提示数据库连接失败

**解决方案**：
1. 检查 PostgreSQL 是否已启动
2. 确认 `.env` 中的 `DATABASE_URL` 配置正确
3. 确保数据库用户有访问权限

### Q2: TAPD 同步失败

**现象**：同步任务执行失败

**可能原因**：
- TAPD API 凭证错误
- 网络无法访问 TAPD API
- API 调用频率超限（429错误）

**解决方案**：
1. 检查 TAPD 用户名和密码配置
2. 确认网络可访问 https://api.tapd.cn
3. 系统会自动重试（最多3次）

### Q3: 登录失败

**现象**：输入密码后无法登录

**解决方案**：
- 当前使用临时密码验证，密码固定为 `initial_password`
- 确保用户已在数据库中创建（`UserAccount` 表）

### Q4: 页面加载缓慢

**现象**：仪表盘页面加载时间长

**可能原因**：
- 数据库查询缺少索引
- TAPD 数据量过大

**优化建议**：
- 为常用查询字段创建索引
- 考虑添加数据缓存

### Q5: 权限不足

**现象**：访问某些页面时提示权限不足

**说明**：
- 系统采用 RBAC 权限控制
- 不同角色有不同的访问权限
- 如需调整权限，请联系管理员

---

## 📜 开发规范

### 代码风格

1. **文件命名**：使用 kebab-case（如 `api-response.ts`）
2. **变量命名**：使用 camelCase（如 `userName`）
3. **类型命名**：使用 PascalCase（如 `UserAccount`）
4. **常量命名**：使用 UPPER_CASE（如 `API_PERMISSIONS`）

### 目录组织

1. 页面组件放在 `src/app/`
2. 通用组件放在 `src/components/`
3. 业务逻辑放在 `src/lib/`
4. 状态管理放在 `src/stores/`

### API 开发

1. 使用 RESTful 风格
2. 统一响应格式：`{ code, message, data }`
3. 错误处理使用统一的错误码
4. 认证使用 `requireAuth()` 中间件
5. 权限检查使用 `checkPermission()` 中间件

### 数据库操作

1. 使用 Prisma ORM
2. 避免直接在 Controller 中操作数据库
3. 使用事务保证数据一致性
4. 复杂查询使用 `.include()` 避免 N+1 查询

### 错误处理

1. 使用 `try-catch` 包裹异步操作
2. 使用统一的错误响应工具函数
3. 生产环境不暴露详细错误信息
4. 记录错误日志便于排查

### 提交规范

```
<type>(<scope>): <description>

例：
feat(projects): 添加项目创建功能
fix(tapd): 修复同步任务状态更新问题
docs: 更新 README 文档
refactor(lib): 重构同步服务代码
```

---

## 📄 License

MIT License

---

**项目状态**：开发中  
**最后更新**：2026-05-14