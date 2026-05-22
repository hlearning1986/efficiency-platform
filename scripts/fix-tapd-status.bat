@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

:: ============================================================
:: TAPD 状态数据修复工具 - 完整版
:: 
:: 功能：
::   1. 诊断当前状态数据问题
::   2. 批量修正错误的状态值
::   3. 验证修复结果
::
:: 使用方法：
::   fix-tapd-status.bat              # 完整流程（诊断+修复+验证）
::   fix-tapd-status.bat --preview    # 只运行诊断和预览
::   fix-tapd-status.bat --fix-only   # 跳过诊断，直接修复
::
:: 作者: Auto-generated
:: 日期: %date%
:: ============================================================

title TAPD 状态数据修复工具

echo.
echo ╔══════════════════════════════════════════════════════════════╗
echo ║                                                              ║
echo ║        🔧 TAPD 状态数据修复工具 - 完整版                     ║
echo ║                                                              ║
echo ╚══════════════════════════════════════════════════════════════╝
echo.

:: 设置项目根目录
set "PROJECT_ROOT=%~dp0.."
cd /d "%PROJECT_ROOT%"

:: 检查 Node.js 是否安装
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ 错误: 未检测到 Node.js，请先安装 Node.js
    echo    下载地址: https://nodejs.org/
    goto :eof
)

:: 检查数据库文件是否存在
if not exist "prisma\dev.db" (
    echo ❌ 错误: 未找到数据库文件 prisma\dev.db
    echo    请确保在正确的项目目录下运行此脚本
    goto :eof
)

echo ✅ 环境检查通过
echo    项目目录: %PROJECT_ROOT%
echo    数据库文件: prisma\dev.db
echo.

:: 解析命令行参数
set "SKIP_DIAGNOSIS=false"
set "SKIP_FIX=false"
set "SKIP_VERIFY=false"

:parse_args
if "%~1"=="" goto :args_done
if "%~1"=="--preview" (
    set "SKIP_FIX=true"
    set "SKIP_VERIFY=true"
)
if "%~1"=="--fix-only" (
    set "SKIP_DIAGNOSIS=true"
)
shift
goto :parse_args

:args_done

:: ============================================
:: 第一步：深度诊断（如果未跳过）
:: ============================================
if "%SKIP_DIAGNOSIS%"=="true" goto :step_fix

echo.
echo ═══════════════════════════════════════════════════════════════
echo 📋 第一步：深度诊断
echo ═══════════════════════════════════════════════════════════════
echo.

echo 🔍 正在分析各项目的状态数据...
echo.

call node scripts\diagnose-status-issue.js

if %errorlevel% neq 0 (
    echo.
    echo ⚠️ 诊断脚本执行失败，但继续执行后续步骤...
) else (
    echo.
    echo ✅ 诊断完成
)

echo.
echo 按任意键继续到下一步...
pause >nul

:: ============================================
:: 第二步：预览修复操作
:: ============================================
:step_fix
if "%SKIP_FIX%"=="true" goto :step_verify

echo.
echo ═══════════════════════════════════════════════════════════════
echo 📝 第二步：预览修复操作
echo ═══════════════════════════════════════════════════════════════
echo.

echo 👀 正在预览将要执行的修复操作（不会修改数据库）...
echo.

call node scripts\fix-tapd-status.js

if %errorlevel% neq 0 (
    echo.
    echo ❌ 预览脚本执行失败
    goto :confirm_fix
)

echo.
echo ────────────────────────────────────────────────────────
echo.
set /p "CONFIRM=是否执行批量修复？(Y/N): "
if /i not "%CONFIRM%"=="Y" (
    echo.
    echo ⏭️  用户取消，跳过修复步骤
    goto :step_verify
)

:: ============================================
:: 第三步：执行修复
:: ============================================
:confirm_fix

echo.
echo ═══════════════════════════════════════════════════════════════
echo 🔨 第三步：执行修复操作
echo ═══════════════════════════════════════════════════════════════
echo.

echo ⚠️  警告：即将修改数据库中的状态数据！
echo.

call node scripts\fix-tapd-status.js --execute

if %errorlevel% neq 0 (
    echo.
    echo ❌ 修复脚本执行失败！
    echo    请检查错误信息并手动处理
    goto :eof
) else (
    echo.
    echo ✅ 修复执行完成
)

echo.
echo 按任意键继续到验证步骤...
pause >nul

:: ============================================
:: 第四步：验证修复结果
:: ============================================
:step_verify
if "%SKIP_VERIFY%"=="true" goto :done

echo.
echo ═══════════════════════════════════════════════════════════════
echo 🔍 第四步：验证修复结果
echo ═══════════════════════════════════════════════════════════════
echo.

echo 🔄 正在重新运行诊断以验证修复效果...
echo.

call node scripts\diagnose-status-issue.js

echo.
echo ═══════════════════════════════════════════════════════════════
echo 📊 修复报告总结
echo ═══════════════════════════════════════════════════════════════
echo.

echo ✅ 已完成的操作:
echo    • 深度诊断各项目状态分布
echo    • 预览并确认修复方案
echo    • 批量修正错误的状态值
echo    • 验证修复后的数据质量
echo.
echo 💡 后续建议:
echo    1. 刷新浏览器页面 http://localhost:3000/tapd/data-manager
echo    2. 检查各项目的需求状态是否正确显示为中文
echo    3. 如仍有问题，请查看上方诊断报告的详细分析
echo    4. 建议定期运行此脚本进行数据质量检查
echo.

:: ============================================
:: 完成
:: ============================================
:done

echo ╔══════════════════════════════════════════════════════════════╗
echo ║                                                              ║
echo ║        🎉 TAPD 状态数据修复流程已完成！                      ║
echo ║                                                              ║
echo ╚══════════════════════════════════════════════════════════════╝
echo.

:: 询问是否打开报告文件
set /p "OPEN_REPORT=是否打开详细日志？(Y/N): "
if /i "%OPEN_REPORT%"=="Y" (
    echo.
    echo 📂 正在打开项目目录...
    explorer "%PROJECT_ROOT%"
)

goto :eof

:: ============================================
:: 帮助信息
:: ============================================
:help
echo.
echo 用法: fix-tapd-status.bat [选项]
echo.
echo 选项:
echo   --preview     只运行诊断和预览，不执行实际修复
echo   --fix-only    跳过诊断步骤，直接执行修复
echo   --help        显示此帮助信息
echo.
echo 示例:
echo   fix-tapd-status.bat           # 完整流程
echo   fix-tapd-status.bat --preview # 只预览不修复
echo   fix-tapd-status.bat --fix-only# 直接修复
echo.
goto :eof
