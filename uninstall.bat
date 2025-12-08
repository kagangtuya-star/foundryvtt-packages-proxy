@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion

:: ============================================================
:: FVTT 下载加速补丁卸载脚本 (Windows)
:: ============================================================

title FVTT 下载加速补丁卸载器

echo.
echo ╔═══════════════════════════════════════════════════════════╗
echo ║          FVTT 下载加速补丁 - 卸载/恢复脚本                 ║
echo ╚═══════════════════════════════════════════════════════════╝
echo.

:: 获取 FVTT 目录
if "%~1"=="" (
    echo 请输入 FoundryVTT 安装目录:
    set /p "FVTT_DIR=FVTT目录: "
) else (
    set "FVTT_DIR=%~1"
)

set "FVTT_DIR=!FVTT_DIR:"=!"

if not exist "!FVTT_DIR!" (
    echo [错误] 目录不存在: !FVTT_DIR!
    pause
    exit /b 1
)

:: 搜索目标目录
set "TARGET_DIR="
for /r "!FVTT_DIR!" %%f in (package.mjs) do (
    echo %%f | findstr /i "dist\\packages" >nul
    if !errorlevel! equ 0 (
        for %%d in ("%%~dpf.") do set "TARGET_DIR=%%~fd"
    )
)

if "!TARGET_DIR!"=="" (
    echo [错误] 找不到 dist\packages 目录
    pause
    exit /b 1
)

echo [信息] 目标目录: !TARGET_DIR!
echo.

:: 查找备份目录
echo [搜索] 查找备份目录...
echo.

set "BACKUP_COUNT=0"
for /d %%d in ("!TARGET_DIR!\backup_*") do (
    set /a BACKUP_COUNT+=1
    echo   !BACKUP_COUNT!. %%~nxd
    set "BACKUP_!BACKUP_COUNT!=%%d"
)

if !BACKUP_COUNT! equ 0 (
    echo [错误] 找不到备份目录
    echo 无法恢复原文件
    pause
    exit /b 1
)

echo.
set /p "CHOICE=请选择要恢复的备份 (1-!BACKUP_COUNT!): "

set "SELECTED_BACKUP=!BACKUP_%CHOICE%!"

if "!SELECTED_BACKUP!"=="" (
    echo [错误] 无效的选择
    pause
    exit /b 1
)

echo.
echo [恢复] 从 !SELECTED_BACKUP! 恢复...

:: 恢复文件
if exist "!SELECTED_BACKUP!\package.mjs.bak" (
    copy /y "!SELECTED_BACKUP!\package.mjs.bak" "!TARGET_DIR!\package.mjs" >nul
    echo [成功] 已恢复 package.mjs
) else (
    echo [跳过] 备份中没有 package.mjs.bak
)

if exist "!SELECTED_BACKUP!\views.mjs.bak" (
    copy /y "!SELECTED_BACKUP!\views.mjs.bak" "!TARGET_DIR!\views.mjs" >nul
    echo [成功] 已恢复 views.mjs
) else (
    echo [跳过] 备份中没有 views.mjs.bak
)

echo.
echo ╔═══════════════════════════════════════════════════════════╗
echo ║                      恢复完成！                            ║
echo ╚═══════════════════════════════════════════════════════════╝
echo.
echo [提示] 请重启 FoundryVTT
echo.

pause
