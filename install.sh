#!/bin/bash

# ============================================================
# FVTT 下载加速补丁安装脚本 (Linux/macOS)
# ============================================================

set -e

echo ""
echo "========================================================"
echo "         FVTT v13 下载加速补丁 - 一键安装脚本"
echo "========================================================"
echo ""

# 获取脚本所在目录
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CLIENT_ZIP="$SCRIPT_DIR/client.zip"
TEMP_DIR="/tmp/fvtt_patch_$$"

# 清理函数
cleanup() {
    rm -rf "$TEMP_DIR" 2>/dev/null
}
trap cleanup EXIT

# 检查 client.zip
if [ ! -f "$CLIENT_ZIP" ]; then
    echo "[错误] 找不到 client.zip"
    echo "请确保 client.zip 与此脚本在同一目录"
    exit 1
fi

echo "[提示] 找到补丁压缩包: $CLIENT_ZIP"
echo "[解压] 正在解压补丁文件..."

# 创建临时目录
mkdir -p "$TEMP_DIR"

# 解压
if command -v unzip >/dev/null 2>&1; then
    unzip -q "$CLIENT_ZIP" -d "$TEMP_DIR" || {
        echo "[错误] 解压失败"
        exit 1
    }
else
    echo "[错误] 未找到 unzip 命令"
    echo "请安装: apt-get install unzip 或 yum install unzip"
    exit 1
fi

# 查找解压后的文件
CLIENT_PACKAGE=$(find "$TEMP_DIR" -type f -name "package.mjs" 2>/dev/null | head -1)
CLIENT_VIEWS=$(find "$TEMP_DIR" -type f -name "views.mjs" 2>/dev/null | head -1)

if [ -z "$CLIENT_PACKAGE" ]; then
    echo "[错误] client.zip 中找不到 package.mjs"
    exit 1
fi

if [ -z "$CLIENT_VIEWS" ]; then
    echo "[错误] client.zip 中找不到 views.mjs"
    exit 1
fi

echo "[成功] 补丁文件已解压"
echo ""

# 获取 FVTT 目录
if [ -z "$1" ]; then
    echo "请输入 FoundryVTT 安装目录:"
    echo "例如: /home/user/foundryvtt"
    echo ""
    read -p "FVTT目录: " FVTT_DIR
else
    FVTT_DIR="$1"
fi

# 检查目录是否存在
if [ ! -d "$FVTT_DIR" ]; then
    echo "[错误] 目录不存在: $FVTT_DIR"
    exit 1
fi

echo ""
echo "[信息] FVTT 目录: $FVTT_DIR"
echo ""

# 搜索目标文件
echo "[搜索] 正在搜索 package.mjs 和 views.mjs ..."
echo ""

FOUND_PACKAGE=$(find "$FVTT_DIR" -type f -name "package.mjs" 2>/dev/null | head -1)
FOUND_VIEWS=$(find "$FVTT_DIR" -type f -name "views.mjs" 2>/dev/null | head -1)

# 显示找到的文件
if [ -n "$FOUND_PACKAGE" ]; then
    echo "[发现] $FOUND_PACKAGE"
fi
if [ -n "$FOUND_VIEWS" ]; then
    echo "[发现] $FOUND_VIEWS"
fi
echo ""

# 检查是否找到文件
if [ -z "$FOUND_PACKAGE" ]; then
    echo "[错误] 在目录中找不到 package.mjs"
    echo "请检查 FVTT 目录是否正确"
    exit 1
fi

if [ -z "$FOUND_VIEWS" ]; then
    echo "[错误] 在目录中找不到 views.mjs"
    echo "请检查 FVTT 目录是否正确"
    exit 1
fi

echo "[选中] $FOUND_PACKAGE"
echo "[选中] $FOUND_VIEWS"
echo ""

# 获取目标目录
TARGET_DIR=$(dirname "$FOUND_PACKAGE")

# 创建备份目录
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_DIR="$TARGET_DIR/backup_$TIMESTAMP"

echo "[备份] 创建备份目录: $BACKUP_DIR"
mkdir -p "$BACKUP_DIR"

# 备份原文件
echo "[备份] 备份 package.mjs ..."
cp "$FOUND_PACKAGE" "$BACKUP_DIR/package.mjs.bak" || {
    echo "[错误] 备份 package.mjs 失败"
    exit 1
}

echo "[备份] 备份 views.mjs ..."
cp "$FOUND_VIEWS" "$BACKUP_DIR/views.mjs.bak" || {
    echo "[错误] 备份 views.mjs 失败"
    exit 1
}

echo "[成功] 备份完成"
echo ""

# 安装补丁
echo "[安装] 正在安装补丁..."

cp "$CLIENT_PACKAGE" "$FOUND_PACKAGE" || {
    echo "[错误] 安装 package.mjs 失败"
    exit 1
}

cp "$CLIENT_VIEWS" "$FOUND_VIEWS" || {
    echo "[错误] 安装 views.mjs 失败"
    exit 1
}

echo ""
echo "========================================================"
echo "                     安装完成！"
echo "========================================================"
echo ""
echo "[信息] 补丁已安装到:"
echo "  $FOUND_PACKAGE"
echo "  $FOUND_VIEWS"
echo ""
echo "[信息] 原文件已备份到:"
echo "  $BACKUP_DIR"
echo ""
echo "[提示] 请重启 FoundryVTT 使补丁生效"
echo ""
