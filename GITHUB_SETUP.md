# GitHub远程仓库配置指南

## 📍 仓库信息

**仓库地址**: https://github.com/hlearning1986/efficiency-platform  
**所有者**: hlearning1986  
**可见性**: Public (公开)  
**默认分支**: master  
**创建时间**: 2026-05-21  

---

## ✅ 已完成的配置

### 1. 远程仓库连接
```bash
origin  https://github.com/hlearning1986/efficiency-platform.git (fetch)
origin  https://github.com/hlearning1986/efficiency-platform.git (push)
```

### 2. 已推送内容
✅ **代码文件**: 238个对象（503.60 KiB）  
✅ **版本标签**: v1.0.0 (已推送)  
✅ **GitHub Release**: v1.0.0 正式发布版（含完整Changelog）  
✅ **分支**: master (已设置跟踪)

### 3. 认证方式
- **GitHub Token**: ghp_eff*** (已配置)
- **SSH Key**: id_rsa (已存在于 ~/.ssh/)
- **认证状态**: ✅ 有效

---

## 🔗 重要链接

| 链接类型 | URL |
|---------|-----|
| **🏠 仓库主页** | [https://github.com/hlearning1986/efficiency-platform](https://github.com/hlearning1986/efficiency-platform) |
| **📦 v1.0.0 Release** | [https://github.com/hlearning1986/efficiency-platform/releases/tag/v1.0.0](https://github.com/hlearning1986/efficiency-platform/releases/tag/v1.0.0) |
| **📝 问题追踪** | [https://github.com/hlearning1986/efficiency-platform/issues](https://github.com/hlearning1986/efficiency-platform/issues) |
| **🔧 Pull Requests** | [https://github.com/hlearning1986/efficiency-platform/pulls](https://github.com/hlearning1986/efficiency-platform/pulls) |
| **📊 Actions CI/CD** | [https://github.com/hlearning1986/efficiency-platform/actions](https://github.com/hlearning1986/efficiency-platform/actions) |

---

## 🚀 常用Git操作命令

### 查看远程状态
```bash
# 查看远程仓库配置
git remote -v

# 查看远程分支
git branch -r

# 获取远程更新
git fetch origin

# 查看本地与远程的差异
git log origin/master..HEAD --oneline
```

### 推送代码
```bash
# 推送当前分支到远程
git push origin master

# 推送所有分支
git push --all origin

# 推送所有标签
git push origin --tags

# 推送单个标签
git push origin v1.0.0

# 强制推送（谨慎使用）
git push -f origin master
```

### 拉取代码
```bash
# 拉取远程最新代码
git pull origin master

# 拉取并合并（rebase模式）
git pull --rebase origin master

# 获取但不合并
git fetch origin
```

### 克隆仓库（其他开发者）
```bash
# 使用HTTPS
git clone https://github.com/hlearning1986/efficiency-platform.git

# 使用SSH（如果配置了SSH Key）
git clone git@github.com:hlearning1986/efficiency-platform.git

# 克隆到指定目录
git clone https://github.com/hlearning1986/efficiency-platform.git my-project
```

---

## 📦 发布新版本流程

### 完整发布步骤
```bash
# 1. 确保在master分支且代码是最新的
cd d:\platform\efficiency-platform
git checkout master
git pull origin master

# 2. 更新版本号（编辑package.json等）
# ... 编辑代码 ...

# 3. 提交更改
git add .
git commit -m "release: v1.1.0 新功能发布"

# 4. 创建本地标签
git tag -a v1.1.0 -m "Release v1.1.0"

# 5. 推送代码和标签到GitHub
git push origin master
git push origin v1.1.0

# 6. 创建GitHub Release（使用gh CLI）
$env:GH_TOKEN="your_token"
gh release create v1.1.0 \
  --title "Version 1.1.0" \
  --notes-file CHANGELOG.md
```

### 快速发布脚本
创建 `scripts/release.sh`:
```bash
#!/bin/bash
VERSION=$1
if [ -z "$VERSION" ]; then
    echo "用法: ./release.sh <version>"
    exit 1
fi

echo "正在发布版本 $VERSION ..."

# 提交并推送
git add .
git commit -m "release: $VERSION"
git push origin master

# 创建标签并推送
git tag -a $VERSION -m "Release $VERSION"
git push origin $VERSION

# 创建GitHub Release
$env:GH_TOKEN="$YOUR_GH_TOKEN"
gh release create $VERSION \
  --title "Efficiency Platform $VERSION" \
  --notes-file CHANGELOG.md

echo "✅ 版本 $VERSION 发布完成！"
echo "🔗 Release地址: https://github.com/hlearning1986/efficiency-platform/releases/tag/$VERSION"
```

使用方法：
```bash
chmod +x scripts/release.sh
./scripts/release.sh v1.1.0
```

---

## 🔐 认证管理

### Token刷新
```bash
# 查看当前Token信息
$env:GH_TOKEN="YOUR_GITHUB_PERSONAL_ACCESS_TOKEN_HERE"
gh auth status

# 如果Token过期，重新登录
echo "new_token" | gh auth login --with-token
```

### SSH密钥管理
```bash
# 查看已添加到GitHub的SSH密钥
$env:GH_TOKEN="YOUR_GITHUB_PERSONAL_ACCESS_TOKEN_HERE"
gh ssh-key list

# 添加新的SSH密钥
gh ssh-key add ~/.ssh/id_rsa.pub --title "My Computer"

# 删除SSH密钥
gh ssh-key delete <key-id>
```

---

## 🔄 协作开发流程

### Fork + PR 流程（外部贡献者）
```bash
# 1. Fork仓库（在GitHub网页上操作）

# 2. 克隆Fork的仓库
git clone https://github.com/<your-username>/efficiency-platform.git
cd efficiency-platform

# 3. 添加上游仓库
git remote add upstream https://github.com/hlearning1986/efficiency-platform.git

# 4. 创建功能分支
git checkout -b feature/my-feature

# 5. 开发并提交
git add .
git commit -m "feat: 添加XXX功能"

# 6. 推送到你的Fork
git push origin feature/my-feature

# 7. 在GitHub上创建Pull Request
gh pr create --base master --head feature/my-feature \
  --title "Feature: XXX功能" \
  --body "描述你的改动..."
```

### 团队成员直接推送
```bash
# 1. 克隆仓库
git clone https://github.com/hlearning1986/efficiency-platform.git
cd efficiency-platform

# 2. 配置用户信息
git config user.name "Your Name"
git config user.email "your.email@example.com"

# 3. 创建功能分支
git checkout -b feature/xxx

# 4. 开发、提交、推送
git add .
git commit -m "feat: xxx"
git push origin feature/xxx

# 5. 创建PR（使用gh CLI）
gh pr create --base master --head feature/xxx \
  --title "Feature: xxx" \
  --body "PR描述..."
```

---

## 🛠️ 仓库维护命令

### 同步Fork仓库
```bash
# 从上游仓库获取更新
git fetch upstream

# 合并到本地master
git checkout master
git merge upstream/master

# 推送到你的Fork
git push origin master
```

### 清理远程分支
```bash
# 查看已合并的远程分支
git branch -r --merged | grep -v 'master'

# 删除已合并的远程分支
git push origin --delete feature/old-feature
```

### 仓库统计
```bash
# 查看贡献者排名
$env:GH_TOKEN="YOUR_GITHUB_PERSONAL_ACCESS_TOKEN_HERE"
gh api repos/hlearning1986/efficiency-platform/contributors --jq '.[].login'

# 查看提交统计
git shortlog -sn --all

# 查看代码行数统计
git log --pretty=tformat: --numstat | awk '{ add += $1; subs += $2; loc += $1 - $2 } END { printf "added lines: %s, removed lines: %s, total lines: %s\n", add, subs, loc }'
```

---

## ⚠️ 注意事项

### 1. 不要提交敏感信息
以下文件已在 `.gitignore` 中排除，请确保不要强制添加：
- `.env` / `.env.local` - 环境变量
- `*.db` / `*.db-backup` - 数据库文件
- `credentials.json` - 凭证文件
- `node_modules/` - 依赖包

### 2. 大文件处理
如果需要上传大文件（>100MB），请使用 Git LFS：
```bash
# 安装LFS
git lfs install

# 追踪大文件类型
git lfs track "*.psd"
git lfs track "*.zip"

# 正常提交
git add .gitattributes
git commit -m "Add LFS tracking"
```

### 3. 分支保护规则（建议设置）
在GitHub仓库 Settings → Branches 中配置：
- **master分支**: 需要PR审查才能合并
- **禁止直接push**: 强制使用PR流程
- **要求CI通过**: 自动化测试必须通过

设置命令：
```bash
$env:GH_TOKEN="$YOUR_GH_TOKEN"
gh api repos/hlearning1986/efficiency-platform/branches/master/protection \
  --method PUT \
  -f required_status_checks='{"strict":false,"contexts":[]}' \
  -f enforce_admins=true \
  -f required_pull_request_reviews='{"dismiss_stale_reviews":false,"require_code_owner_reviews":true}' \
  -f restrictions=null
```

---

## 📞 问题排查

### 推送失败
```bash
# 错误: Permission denied
# 解决: 检查Token权限或SSH密钥
gh auth status
ssh -T git@github.com

# 错误: ! [rejected] master -> master (non-fast-forward)
# 解决: 先拉取远程更新再推送
git pull --rebase origin master
git push origin master

# 错误: fatal: remote origin already exists.
# 解决: 更新远程地址
git remote set-url origin https://github.com/hlearning1986/efficiency-platform.git
```

### 认证问题
```bash
# 清除缓存凭据
git credential-manager github reject
https://github.com

# 或重置Git凭据
git config --global credential.helper ""
git config --global credential.helper manager
```

---

## 🎯 下一步建议

1. **设置分支保护规则** - 保护master分支
2. **配置CI/CD** - 使用GitHub Actions自动化测试和部署
3. **添加Collaborators** - 邀请团队成员加入开发
4. **创建Project Board** - 使用GitHub Projects进行项目管理
5. **启用Wiki** - 编写详细的使用文档
6. **配置Issue模板** - 统一Bug报告和功能请求格式

---

**文档最后更新**: 2026-05-21  
**维护者**: Development Team  
**仓库地址**: https://github.com/hlearning1986/efficiency-platform ⭐

如有问题，请在仓库中创建 Issue 或联系仓库管理员。
