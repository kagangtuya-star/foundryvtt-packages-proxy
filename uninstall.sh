#!/bin/bash

# ============================================================
# FVTT 下载加速补丁卸载脚本 (Linux/macOS)
# ============================================================

echo ""
echo "========================================================"
echo "         FVTT v13 下载加速补丁 - 卸载/恢复脚本"
echo "========================================================"
echo ""

# 获取 FVTT 目录
if [ -z "$1" ]; then
    echo "请输入 FoundryVTT 安装目录:"
    read -p "FVTT目录: " FVTT_DIR
else
    FVTT_DIR="$1"
fi

if [ ! -d "$FVTT_DIR" ]; then
    echo "[错误] 目录不存在: $FVTT_DIR"
    exit 1
fi

echo ""
echo "[信息] FVTT 目录: $FVTT_DIR"
echo ""

# 搜索 package.mjs 获取目标目录
echo "[搜索] 正在搜索 package.mjs ..."

FOUND_PACKAGE=$(find "$FVTT_DIR" -type f -name "package.mjs" 2>/dev/null | head -1)

if [ -z "$FOUND_PACKAGE" ]; then
    echo "[错误] 找不到 package.mjs"
    exit 1
fi

echo "[发现] $FOUND_PACKAGE"

# 获取目标目录
TARGET_DIR=$(dirname "$FOUND_PACKAGE")

echo ""
echo "[信息] 目标目录: $TARGET_DIR"
echo ""

# 查找备份目录
echo "[搜索] 查找备份目录..."
echo ""

BACKUPS=()
i=0
for dir in "$TARGET_DIR"/backup_*; do
    if [ -d "$dir" ]; then
        i=$((i+1))
        BACKUPS+=("$dir")
        echo "  $i. $(basename "$dir")"
    fi
done

if [ ${#BACKUPS[@]} -eq 0 ]; then
    echo "[错误] 找不到备份目录"
    echo "没有可恢复的备份"
    exit 1
fi

echo ""
echo "找到 ${#BACKUPS[@]} 个备份"
echo ""
read -p "请选择要恢复的备份 (1-${#BACKUPS[@]}): " CHOICE

# 验证选择
if [ "$CHOICE" -lt 1 ] 2>/dev/null || [ "$CHOICE" -gt ${#BACKUPS[@]} ] 2>/dev/null; then
    echo "[错误] 无效的选择"
    exit 1
fi

SELECTED_BACKUP="${BACKUPS[$((CHOICE-1))]}"

echo ""
echo "[恢复] 从以下目录恢复:"
echo "  $SELECTED_BACKUP"
echo ""

# 恢复文件
if [ -f "$SELECTED_BACKUP/package.mjs.bak" ]; then
    cp "$SELECTED_BACKUP/package.mjs.bak" "$TARGET_DIR/package.mjs" && \
        echo "[成功] 已恢复 package.mjs" || \
        echo "[错误] 恢复 package.mjs 失败"
else
    echo "[跳过] 备份中没有 package.mjs.bak"
fi

if [ -f "$SELECTED_BACKUP/views.mjs.bak" ]; then
    cp "$SELECTED_BACKUP/views.mjs.bak" "$TARGET_DIR/views.mjs" && \
        echo "[成功] 已恢复 views.mjs" || \
        echo "[错误] 恢复 views.mjs 失败"
else
    echo "[跳过] 备份中没有 views.mjs.bak"
fi

echo ""
echo "========================================================"
echo "                     恢复完成！"
echo "========================================================"
echo ""
echo "[提示] 请重启 FoundryVTT"
echo ""

# 询问是否删除备份目录
read -p "是否删除此备份目录? (y/N): " DELETE_BACKUP
if [ "$DELETE_BACKUP" = "y" ] || [ "$DELETE_BACKUP" = "Y" ]; then
    rm -rf "$SELECTED_BACKUP" && echo "[信息] 已删除备份目录"
fi

echo ""
