# 版本管理说明 (VERSION MANAGEMENT)

## 📍 当前版本信息

**项目名称**: 效率平台 (Efficiency Platform)
**当前版本**: v1.2.0
**版本类型**: 次要发布版 (Minor Release)
**发布日期**: 2026-06-09
**上一个版本**: v1.0.1 (2026-06-01)
**升级类型**: MINOR (新功能模块 + Bug修复)

---

## 📋 v1.2.0 版本亮点

### ✅ 新增功能模块（2个）

1. **📊 人力负荷与饱和度分析模块 (Workload)**
   - 人员饱和度明细：日历热力图、任务时间线、每日饱和度分布
   - 团队饱和度卡片：按团队维度展示人员列表和饱和度统计
   - 角色详情弹窗：按角色维度展示成员详情，支持一人多项目多行显示
   - 饱和度计算引擎：支持3种借调场景（无借调/被借调出/双向借调）
   - 借调工作日计算：区分借调入/被借调出人员的有效工作日天数

2. **🎯 敏捷管理 - 迭代管理角色配置增强**
   - 成员多选批量分配角色（checkbox多选 + 批量下拉）
   - 一人多角色支持（单个人员可同时分配多个角色）
   - 批量分配预览（选择角色后实时预览Tag）
   - 角色映射保存优化（upsert模式，保留已有配置）

### ✅ 关键Bug修复（3个Critical级别）

1. **TAPD任务日期字段缺失导致数据为空** — API未传fields参数，begin/due为undefined
2. **人员名称不一致导致数据匹配失败** — TAPD原始名称含特殊字符，cleanOwner未统一
3. **人员多项目数据显示逻辑** — 合并/展开规则不明确

### 📈 影响范围

| 模块 | 新增文件 | 修改文件 | 变更类型 |
|------|---------|---------|---------|
| Workload人力负荷 | 15+ | 5 | 新模块 |
| Agile迭代管理 | 0 | 2 | 功能增强 |
| TAPD数据提供者 | 0 | 1 | Critical修复 |
| API路由层 | 4 | 3 | 功能增强+修复 |

### 🔗 详细变更日志

完整的技术细节、代码示例、测试结果请查看：
👉 [CHANGELOG.md](./CHANGELOG.md#120---2026-06-09)

---

## 🎯 版本号规范

本项目遵循 [Semantic Versioning](https://semver.org/) (语义化版本) 规范：

```
MAJOR.MINOR.PATCH

示例: v1.2.3
├─ MAJOR (1): 不兼容的API变更
├─ MINOR (2): 向后兼容的功能新增
└─ PATCH (3): 向后兼容的问题修正
```

### 版本升级规则

| 变更类型 | 示例 | 说明 |
|---------|------|------|
| **重大重构/不兼容改动** | `1.0.0` → `2.0.0` | MAJOR +1 |
| **新功能模块** | `1.0.0` → `1.1.0` | MINOR +1 |
| **Bug修复/小改进** | `1.0.0` → `1.0.1` | PATCH +1 |

---

## 📂 Git分支与标签策略

### 分支结构
```
master (生产稳定版)
  │
  ├── tag: v1.0.0 ← 当前位置
  │
  └── develop (开发主分支) - 待创建
      │
      ├── feature/tapd-status-fix
      ├── feature/dashboard-v2
      └── hotfix/critical-bug
```

### 标签命名规则
```bash
# 正式版本
v{MAJOR}.{MINOR}.{PATCH}
例: v1.0.0, v1.1.0, v2.0.0

# 预发布版本（可选）
v{MAJOR}.{MINOR}.{PATCH}-{preRelease}.{build}
例: v1.1.0-beta.1, v2.0.0-rc.1
```

---

## 🔙 回滚操作指南

### 场景1：回滚到上一个稳定版本

```bash
# 查看所有版本标签
git tag -l "v*" --sort=-version:refname

# 输出示例：
# v1.0.0
# v0.9.0 (假设存在)

# 回滚到指定版本
git checkout v1.0.0

# 如果需要基于该版本继续开发
git checkout -b release/v1.0.1-hotfix
```

### 场景2：紧急修复后重新发布

```bash
# 1. 基于当前版本创建hotfix分支
git checkout master
git checkout -b hotfix/v1.0.1

# 2. 修复问题并提交
# ... 编辑代码 ...
git add .
git commit -m "fix: 修复XXX严重问题"

# 3. 创建新版本标签
git tag -a v1.0.1 -m "Hotfix: 修复XXX问题"

# 4. 合并回master
git checkout master
git merge hotfix/v1.0.1

# 5. 推送标签到远程仓库
git push origin v1.0.1
```

### 场景3：查看历史版本的代码

```bash
# 查看某个版本的文件内容
git show v1.0.0:src/app/layout.tsx

# 临时切换到某个版本查看
git checkout v1.0.0
# ... 浏览代码 ...
git checkout master  # 返回最新版本

# 导出某个版本的完整代码
git archive v1.0.0 -o efficiency-platform-v1.0.0.zip
```

---

## 🚀 发布新版本流程

### 标准发布流程

```bash
# 1. 确保在master分支且代码是最新的
git checkout master
git pull origin master

# 2. 更新版本号（如果需要）
# 编辑 package.json 的 version 字段

# 3. 运行测试（如果有）
npm test  # 或 npm run test:e2e

# 4. 构建验证
npm run build

# 5. 提交所有更改
git add .
git commit -m "release: v{x.y.z} 版本发布

## 新增功能
- 功能1描述
- 功能2描述

## 问题修复
- 修复问题描述1 (#123)
- 修复问题描述2 (#456)

## 性能优化
- 优化描述"

# 6. 创建版本标签
git tag -a v{x.y.z} -m "Release v{x.y.z}

版本亮点：
• 新增XXX功能
• 修复XXX问题
• 性能提升XX%

发布日期: YYYY-MM-DD"

# 7. 推送到远程仓库
git push origin master
git push origin v{x.y.z}  # 重要！推送标签

# 8. 更新 CHANGELOG.md
# 记录新版本的详细变更
```

---

## 📊 当前版本文件清单

### v1.0.0 包含的核心文件

#### 源代码 (`src/`)
- ✅ 应用页面 (`app/(dashboard)/`)
- ✅ API路由 (`app/api/v1/`)
- ✅ 组件库 (`components/`)
- ✅ 工具库 (`lib/`, `utils/`, `stores/`)

#### 配置文件
- ✅ `package.json` - 项目依赖配置
- ✅ `tsconfig.json` - TypeScript配置
- ✅ `next.config.mjs` - Next.js配置
- ✅ `prisma/schema.prisma` - 数据库模型定义
- ✅ `.env.example` - 环境变量模板

#### 文档 (`docs/`)
- ✅ PRD.md - 产品需求文档
- ✅ TECHNICAL_DESIGN.md - 技术设计文档
- ✅ FEATURE_ANALYSIS.md - 功能分析
- ✅ ARCHITECTURE_ANALYSIS.md - 架构分析
- ✅ CODE_QUALITY_REPORT.md - 代码质量报告
- ✅ CHANGELOG.md - 版本变更日志 ⭐ 新增

#### 工具脚本 (`scripts/`)
- ✅ 调试工具集 (debug-*.js, test-*.js)
- ✅ 维护工具 (setup-tapd.ts, clean-running.js)
- ✅ 数据修复工具 (fix-tapd-status.js) ⭐ 新增
- ✅ 验证工具 (verify-*.js, check-*.ts)

#### 部署相关
- ✅ Dockerfile
- ✅ docker-compose.yml
- ✅ nginx.conf
- ✅ `.dockerignore`

---

## 🔍 版本对比工具

### 查看两个版本之间的差异

```bash
# 查看v1.0.0和当前版本的差异
git diff v1.0.0 HEAD --stat

# 查看具体文件的变更
git diff v1.0.0 HEAD -- src/app/(dashboard)/tapd/data-manager/page.tsx

# 查看某个版本的提交记录
git log v1.0.0 --oneline --decorate
```

### 导出版本报告

```bash
# 生成v1.0.0版本的完整报告
git log v1.0.0 --pretty=format:"%h|%s|%an|%ad" --date=short > v1.0.0-commits.txt

# 统计代码量
git diff v1.0.0~1 v1.0.0 --shortstat
```

---

## 💾 备份策略建议

### 本地备份
```bash
# 定期备份整个仓库
tar -czf efficiency-platform-backup-$(date +%Y%m%d).tar.gz \
    --exclude='node_modules' \
    --exclude='.next' \
    --exclude='.git' \
    efficiency-platform/
```

### 远程备份（推荐）
```bash
# 添加远程仓库
git remote add origin https://github.com/your-org/efficiency-platform.git

# 推送所有分支和标签
git push -u origin master --tags

# 设置自动备份（可选）
# 使用GitHub Actions或GitLab CI定期备份
```

---

## 📞 版本相关问题排查

### 常见问题

**Q1: 如何确认当前使用的版本？**
```bash
git describe --tags --always
# 输出: v1.0.0 或 commit hash
```

**Q2: 如何查看某个版本包含哪些功能？**
```bash
git show v1.0.0 --stat
# 或查看 CHANGELOG.md
cat CHANGELOG.md | grep -A 50 "\[1.0.0\]"
```

**Q3: 标签推送失败怎么办？**
```bash
# 强制更新远程标签（谨慎使用）
git push origin :refs/tags/v1.0.0  # 删除远程旧标签
git push origin v1.0.0             # 推送新标签
```

**Q4: 如何恢复误删的标签？**
```bash
# 从reflog恢复
git reflog  # 找到创建tag时的commit hash
git tag -a v1.0.0 <commit-hash> -m "恢复的标签"
```

---

## 🎓 最佳实践

### 1. 定期打标签
- 每次正式发布必须打标签
- 重要的里程碑也要打标签（如beta版）
- 标签消息要详细说明版本亮点

### 2. 保持Changelog更新
- 每次版本发布前更新CHANGELOG.md
- 记录所有breaking changes
- 分类整理：Added / Fixed / Changed / Deprecated

### 3. 分支管理规范
- master分支始终保持稳定可部署
- 功能开发使用feature/*分支
- 紧急修复使用hotfix/*分支
- 合并前必须通过code review

### 4. 版本号递增规范
- 不要跳跃式递增（如1.0→1.5）
- 遵循语义化版本原则
- pre-release版本使用后缀（-alpha, -beta, -rc）

---

## 📝 版本发布检查清单

发布新版本前请确认：

- [ ] 所有测试用例通过
- [ ] 文档已更新（README, CHANGELOG, API文档）
- [ ] 版本号已正确更新（package.json等）
- [ ] 无编译错误或警告
- [ ] 数据库迁移脚本已准备
- [ ] 已创建版本标签
- [ ] 标签已推送到远程仓库
- [ ] 已通知相关人员（产品、测试、运维）

---

**文档维护者**: Development Team  
**最后更新**: 2026-06-01  
**适用范围**: Efficiency Platform v1.0.1+  

如有疑问，请查阅 [CHANGELOG.md](./CHANGELOG.md) 或联系技术支持。
