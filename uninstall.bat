@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion

:: ============================================================
:: FVTT 下载加速补丁卸载脚本 (Windows)
:: ============================================================

title FVTT 下载加速补丁卸载器

echo.
echo ========================================================
echo          FVTT v13 下载加速补丁 - 卸载/恢复脚本
echo ========================================================
echo.

:: 获取 FVTT 目录
if "%~1"=="" (
    echo 请输入 FoundryVTT 安装目录:
    set /p "FVTT_INPUT=FVTT目录: "
) else (
    set "FVTT_INPUT=%~1"
)

set "FVTT_DIR=!FVTT_INPUT:"=!"

if not exist "!FVTT_DIR!\" (
    echo [错误] 目录不存在: !FVTT_DIR!
    pause
    exit /b 1
)

echo.
echo [信息] FVTT 目录: !FVTT_DIR!
echo.

:: 切换到目标盘符
pushd "!FVTT_DIR!"

:: 搜索 package.mjs 获取目标目录
echo [搜索] 正在搜索 package.mjs ...
set "FOUND_PACKAGE="

for /f "delims=" %%f in ('dir /s /b "package.mjs" 2^>nul') do (
    if not defined FOUND_PACKAGE (
        echo [发现] %%f
        set "FOUND_PACKAGE=%%f"
    )
)

popd

if not defined FOUND_PACKAGE (
    echo [错误] 找不到 package.mjs
    pause
    exit /b 1
)

:: 获取目标目录
for %%f in ("!FOUND_PACKAGE!") do set "TARGET_DIR=%%~dpf"

echo.
echo [信息] 目标目录: !TARGET_DIR!
echo.

:: 查找备份目录
echo [搜索] 查找备份目录...
echo.

set "BACKUP_COUNT=0"
set "BACKUP_LIST="

for /d %%d in ("!TARGET_DIR!backup_*") do (
    set /a BACKUP_COUNT+=1
    echo   !BACKUP_COUNT!. %%~nxd
    set "BACKUP_!BACKUP_COUNT!=%%d"
    set "BACKUP_LIST=!BACKUP_LIST! !BACKUP_COUNT!"
)

if !BACKUP_COUNT! equ 0 (
    echo [错误] 找不到备份目录
    echo 没有可恢复的备份
    pause
    exit /b 1
)

echo.
echo 找到 !BACKUP_COUNT! 个备份
echo.
set /p "CHOICE=请选择要恢复的备份 (1-!BACKUP_COUNT!): "

:: 验证输入
set "SELECTED_BACKUP=!BACKUP_%CHOICE%!"

if not defined SELECTED_BACKUP (
    echo [错误] 无效的选择
    pause
    exit /b 1
)

echo.
echo [恢复] 从以下目录恢复:
echo   !SELECTED_BACKUP!
echo.

:: 恢复文件
if exist "!SELECTED_BACKUP!\package.mjs.bak" (
    copy /y "!SELECTED_BACKUP!\package.mjs.bak" "!TARGET_DIR!package.mjs" >nul
    if errorlevel 1 (
        echo [错误] 恢复 package.mjs 失败
    ) else (
        echo [成功] 已恢复 package.mjs
    )
) else (
    echo [跳过] 备份中没有 package.mjs.bak
)

if exist "!SELECTED_BACKUP!\views.mjs.bak" (
    copy /y "!SELECTED_BACKUP!\views.mjs.bak" "!TARGET_DIR!views.mjs" >nul
    if errorlevel 1 (
        echo [错误] 恢复 views.mjs 失败
    ) else (
        echo [成功] 已恢复 views.mjs
    )
) else (
    echo [跳过] 备份中没有 views.mjs.bak
)

echo.
echo ========================================================
echo                      恢复完成！
echo ========================================================
echo.
echo [提示] 请重启 FoundryVTT
echo.

:: 询问是否删除备份目录
set /p "DELETE_BACKUP=是否删除此备份目录? (y/N): "
if /i "!DELETE_BACKUP!"=="y" (
    rmdir /s /q "!SELECTED_BACKUP!" 2>nul
    echo [信息] 已删除备份目录
)

echo.
pause
