#!/bin/bash

# ============================================================
# FVTT 下载加速补丁安装脚本 (Linux/macOS)
# ============================================================

set -e

echo ""
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║          FVTT 下载加速补丁 - 一键安装脚本                  ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""

# 获取脚本所在目录
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CLIENT_DIR="$SCRIPT_DIR/client"

# 检查 client 目录
if [ ! -f "$CLIENT_DIR/package.mjs" ]; then
    echo "[错误] 找不到 client/package.mjs"
    echo "请确保此脚本在正确的目录中运行"
    exit 1
fi

if [ ! -f "$CLIENT_DIR/views.mjs" ]; then
    echo "[错误] 找不到 client/views.mjs"
    echo "请确保此脚本在正确的目录中运行"
    exit 1
fi

echo "[提示] 补丁文件已找到:"
echo "  - $CLIENT_DIR/package.mjs"
echo "  - $CLIENT_DIR/views.mjs"
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
echo "[搜索] 正在查找 package.mjs 和 views.mjs ..."
echo ""

FOUND_PACKAGE=$(find "$FVTT_DIR" -type f -name "package.mjs" -path "*/dist/packages/*" 2>/dev/null | head -1)
FOUND_VIEWS=$(find "$FVTT_DIR" -type f -name "views.mjs" -path "*/dist/packages/*" 2>/dev/null | head -1)

# 检查是否找到文件
if [ -z "$FOUND_PACKAGE" ]; then
    echo "[错误] 找不到 dist/packages/package.mjs"
    echo "请确保 FVTT 目录正确"
    exit 1
fi

if [ -z "$FOUND_VIEWS" ]; then
    echo "[错误] 找不到 dist/packages/views.mjs"
    echo "请确保 FVTT 目录正确"
    exit 1
fi

echo "[找到] $FOUND_PACKAGE"
echo "[找到] $FOUND_VIEWS"
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
cp "$FOUND_PACKAGE" "$BACKUP_DIR/package.mjs.bak"

echo "[备份] 备份 views.mjs ..."
cp "$FOUND_VIEWS" "$BACKUP_DIR/views.mjs.bak"

echo "[成功] 备份完成"
echo ""

# 安装补丁
echo "[安装] 正在安装补丁..."

cp "$CLIENT_DIR/package.mjs" "$FOUND_PACKAGE"
cp "$CLIENT_DIR/views.mjs" "$FOUND_VIEWS"

echo ""
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║                      安装完成！                            ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""
echo "[信息] 补丁已安装到:"
echo "  - $FOUND_PACKAGE"
echo "  - $FOUND_VIEWS"
echo ""
echo "[信息] 原文件已备份到:"
echo "  - $BACKUP_DIR"
echo ""
echo "[提示] 请重启 FoundryVTT 使补丁生效"
echo ""
echo "[注意] 如需恢复原文件，请运行:"
echo "  cp \"$BACKUP_DIR\"/*.bak \"$TARGET_DIR/\""
echo "  并移除 .bak 后缀"
echo ""
