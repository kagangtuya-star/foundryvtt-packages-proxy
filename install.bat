@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion

:: ============================================================
:: FVTT 下载加速补丁安装脚本 (Windows)
:: ============================================================

title FVTT 下载加速补丁安装器

echo.
echo ========================================================
echo          FVTT 下载加速补丁 - 一键安装脚本
echo ========================================================
echo.

:: 获取脚本所在目录
set "SCRIPT_DIR=%~dp0"
set "CLIENT_ZIP=%SCRIPT_DIR%client.zip"
set "TEMP_DIR=%TEMP%\fvtt_patch_%RANDOM%"

:: 检查 client.zip
if not exist "%CLIENT_ZIP%" (
    echo [错误] 找不到 client.zip
    echo 请确保 client.zip 与此脚本在同一目录
    pause
    exit /b 1
)

echo [提示] 找到补丁压缩包: %CLIENT_ZIP%
echo [解压] 正在解压补丁文件...

:: 创建临时目录
mkdir "%TEMP_DIR%" 2>nul

:: 使用 PowerShell 解压
powershell -NoProfile -Command "Expand-Archive -Path '%CLIENT_ZIP%' -DestinationPath '%TEMP_DIR%' -Force" 2>nul
if errorlevel 1 (
    tar -xf "%CLIENT_ZIP%" -C "%TEMP_DIR%" 2>nul
    if errorlevel 1 (
        echo [错误] 无法解压 client.zip
        rmdir /s /q "%TEMP_DIR%" 2>nul
        pause
        exit /b 1
    )
)

:: 查找解压后的文件
set "CLIENT_PACKAGE="
set "CLIENT_VIEWS="

for /r "%TEMP_DIR%" %%f in (package.mjs) do set "CLIENT_PACKAGE=%%f"
for /r "%TEMP_DIR%" %%f in (views.mjs) do set "CLIENT_VIEWS=%%f"

if not defined CLIENT_PACKAGE (
    echo [错误] client.zip 中找不到 package.mjs
    rmdir /s /q "%TEMP_DIR%" 2>nul
    pause
    exit /b 1
)

if not defined CLIENT_VIEWS (
    echo [错误] client.zip 中找不到 views.mjs
    rmdir /s /q "%TEMP_DIR%" 2>nul
    pause
    exit /b 1
)

echo [成功] 补丁文件已解压
echo.

:: 获取 FVTT 目录
if "%~1"=="" (
    echo 请输入 FoundryVTT 安装目录:
    echo 例如: C:\Program Files\FoundryVTT
    echo.
    set /p "FVTT_INPUT=FVTT目录: "
) else (
    set "FVTT_INPUT=%~1"
)

:: 去除引号并处理路径
set "FVTT_DIR=!FVTT_INPUT:"=!"

:: 检查目录是否存在
if not exist "!FVTT_DIR!\" (
    echo [错误] 目录不存在: !FVTT_DIR!
    rmdir /s /q "%TEMP_DIR%" 2>nul
    pause
    exit /b 1
)

echo.
echo [信息] FVTT 目录: !FVTT_DIR!
echo.

:: 切换到目标盘符
pushd "!FVTT_DIR!"

:: 搜索目标文件
echo [搜索] 正在搜索 package.mjs 和 views.mjs ...
echo.

set "FOUND_PACKAGE="
set "FOUND_VIEWS="

:: 使用 dir /s /b 搜索
for /f "delims=" %%f in ('dir /s /b "package.mjs" 2^>nul') do (
    if not defined FOUND_PACKAGE (
        echo [发现] %%f
        set "FOUND_PACKAGE=%%f"
    )
)

for /f "delims=" %%f in ('dir /s /b "views.mjs" 2^>nul') do (
    if not defined FOUND_VIEWS (
        echo [发现] %%f
        set "FOUND_VIEWS=%%f"
    )
)

:: 返回原目录
popd

echo.

:: 检查是否找到文件
if not defined FOUND_PACKAGE (
    echo [错误] 在目录中找不到 package.mjs
    echo 请检查 FVTT 目录是否正确
    rmdir /s /q "%TEMP_DIR%" 2>nul
    pause
    exit /b 1
)

if not defined FOUND_VIEWS (
    echo [错误] 在目录中找不到 views.mjs
    echo 请检查 FVTT 目录是否正确
    rmdir /s /q "%TEMP_DIR%" 2>nul
    pause
    exit /b 1
)

echo [选中] !FOUND_PACKAGE!
echo [选中] !FOUND_VIEWS!
echo.

:: 获取目标目录
for %%f in ("!FOUND_PACKAGE!") do set "TARGET_DIR=%%~dpf"

:: 使用 PowerShell 获取时间戳
for /f %%a in ('powershell -NoProfile -Command "Get-Date -Format yyyyMMdd_HHmmss"') do set "TIMESTAMP=%%a"

set "BACKUP_DIR=!TARGET_DIR!backup_!TIMESTAMP!"

echo [备份] 创建备份目录: !BACKUP_DIR!
mkdir "!BACKUP_DIR!" 2>nul

:: 备份原文件
echo [备份] 备份 package.mjs ...
copy "!FOUND_PACKAGE!" "!BACKUP_DIR!\package.mjs.bak" >nul
if errorlevel 1 (
    echo [错误] 备份 package.mjs 失败
    rmdir /s /q "%TEMP_DIR%" 2>nul
    pause
    exit /b 1
)

echo [备份] 备份 views.mjs ...
copy "!FOUND_VIEWS!" "!BACKUP_DIR!\views.mjs.bak" >nul
if errorlevel 1 (
    echo [错误] 备份 views.mjs 失败
    rmdir /s /q "%TEMP_DIR%" 2>nul
    pause
    exit /b 1
)

echo [成功] 备份完成
echo.

:: 安装补丁
echo [安装] 正在安装补丁...

copy /y "!CLIENT_PACKAGE!" "!FOUND_PACKAGE!" >nul
if errorlevel 1 (
    echo [错误] 安装 package.mjs 失败
    rmdir /s /q "%TEMP_DIR%" 2>nul
    pause
    exit /b 1
)

copy /y "!CLIENT_VIEWS!" "!FOUND_VIEWS!" >nul
if errorlevel 1 (
    echo [错误] 安装 views.mjs 失败
    rmdir /s /q "%TEMP_DIR%" 2>nul
    pause
    exit /b 1
)

:: 清理临时目录
rmdir /s /q "%TEMP_DIR%" 2>nul

echo.
echo ========================================================
echo                      安装完成！
echo ========================================================
echo.
echo [信息] 补丁已安装到:
echo   !FOUND_PACKAGE!
echo   !FOUND_VIEWS!
echo.
echo [信息] 原文件已备份到:
echo   !BACKUP_DIR!
echo.
echo [提示] 请重启 FoundryVTT 使补丁生效
echo.

pause
