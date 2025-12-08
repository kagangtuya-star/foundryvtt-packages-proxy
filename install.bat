@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion

:: ============================================================
:: FVTT 下载加速补丁安装脚本 (Windows)
:: ============================================================

title FVTT 下载加速补丁安装器

echo.
echo ╔═══════════════════════════════════════════════════════════╗
echo ║          FVTT 下载加速补丁 - 一键安装脚本                  ║
echo ╚═══════════════════════════════════════════════════════════╝
echo.

:: 获取脚本所在目录
set "SCRIPT_DIR=%~dp0"
set "CLIENT_DIR=%SCRIPT_DIR%client"

:: 检查 client 目录
if not exist "%CLIENT_DIR%\package.mjs" (
    echo [错误] 找不到 client\package.mjs
    echo 请确保此脚本在正确的目录中运行
    pause
    exit /b 1
)

if not exist "%CLIENT_DIR%\views.mjs" (
    echo [错误] 找不到 client\views.mjs
    echo 请确保此脚本在正确的目录中运行
    pause
    exit /b 1
)

echo [提示] 补丁文件已找到:
echo   - %CLIENT_DIR%\package.mjs
echo   - %CLIENT_DIR%\views.mjs
echo.

:: 获取 FVTT 目录
if "%~1"=="" (
    echo 请输入 FoundryVTT 安装目录:
    echo 例如: C:\Program Files\FoundryVTT
    echo.
    set /p "FVTT_DIR=FVTT目录: "
) else (
    set "FVTT_DIR=%~1"
)

:: 去除引号
set "FVTT_DIR=!FVTT_DIR:"=!"

:: 检查目录是否存在
if not exist "!FVTT_DIR!" (
    echo [错误] 目录不存在: !FVTT_DIR!
    pause
    exit /b 1
)

echo.
echo [信息] FVTT 目录: !FVTT_DIR!
echo.

:: 搜索目标文件
echo [搜索] 正在查找 package.mjs 和 views.mjs ...
echo.

set "FOUND_PACKAGE="
set "FOUND_VIEWS="

:: 递归搜索 package.mjs
for /r "!FVTT_DIR!" %%f in (package.mjs) do (
    echo %%f | findstr /i "dist\\packages" >nul
    if !errorlevel! equ 0 (
        set "FOUND_PACKAGE=%%f"
    )
)

:: 递归搜索 views.mjs
for /r "!FVTT_DIR!" %%f in (views.mjs) do (
    echo %%f | findstr /i "dist\\packages" >nul
    if !errorlevel! equ 0 (
        set "FOUND_VIEWS=%%f"
    )
)

:: 检查是否找到文件
if "!FOUND_PACKAGE!"=="" (
    echo [错误] 找不到 dist\packages\package.mjs
    echo 请确保 FVTT 目录正确
    pause
    exit /b 1
)

if "!FOUND_VIEWS!"=="" (
    echo [错误] 找不到 dist\packages\views.mjs
    echo 请确保 FVTT 目录正确
    pause
    exit /b 1
)

echo [找到] !FOUND_PACKAGE!
echo [找到] !FOUND_VIEWS!
echo.

:: 获取目标目录
for %%f in ("!FOUND_PACKAGE!") do set "TARGET_DIR=%%~dpf"

:: 创建备份目录
set "BACKUP_DIR=!TARGET_DIR!backup_%date:~0,4%%date:~5,2%%date:~8,2%_%time:~0,2%%time:~3,2%%time:~6,2%"
set "BACKUP_DIR=!BACKUP_DIR: =0!"

echo [备份] 创建备份目录: !BACKUP_DIR!
mkdir "!BACKUP_DIR!" 2>nul

:: 备份原文件
echo [备份] 备份 package.mjs ...
copy "!FOUND_PACKAGE!" "!BACKUP_DIR!\package.mjs.bak" >nul
if !errorlevel! neq 0 (
    echo [错误] 备份 package.mjs 失败
    pause
    exit /b 1
)

echo [备份] 备份 views.mjs ...
copy "!FOUND_VIEWS!" "!BACKUP_DIR!\views.mjs.bak" >nul
if !errorlevel! neq 0 (
    echo [错误] 备份 views.mjs 失败
    pause
    exit /b 1
)

echo [成功] 备份完成
echo.

:: 安装补丁
echo [安装] 正在安装补丁...

copy /y "%CLIENT_DIR%\package.mjs" "!FOUND_PACKAGE!" >nul
if !errorlevel! neq 0 (
    echo [错误] 安装 package.mjs 失败
    pause
    exit /b 1
)

copy /y "%CLIENT_DIR%\views.mjs" "!FOUND_VIEWS!" >nul
if !errorlevel! neq 0 (
    echo [错误] 安装 views.mjs 失败
    pause
    exit /b 1
)

echo.
echo ╔═══════════════════════════════════════════════════════════╗
echo ║                      安装完成！                            ║
echo ╚═══════════════════════════════════════════════════════════╝
echo.
echo [信息] 补丁已安装到:
echo   - !FOUND_PACKAGE!
echo   - !FOUND_VIEWS!
echo.
echo [信息] 原文件已备份到:
echo   - !BACKUP_DIR!
echo.
echo [提示] 请重启 FoundryVTT 使补丁生效
echo.
echo [注意] 如需恢复原文件，请运行:
echo   copy "!BACKUP_DIR!\*.bak" "!TARGET_DIR!"
echo.

pause
