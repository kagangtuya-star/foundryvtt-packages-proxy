#!/bin/bash

# ============================================================
# FVTT 下载加速补丁卸载脚本 (Linux/macOS)
# ============================================================

echo ""
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║          FVTT 下载加速补丁 - 卸载/恢复脚本                 ║"
echo "╚═══════════════════════════════════════════════════════════╝"
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

# 搜索目标目录
TARGET_DIR=$(find "$FVTT_DIR" -type d -path "*/dist/packages" 2>/dev/null | head -1)

if [ -z "$TARGET_DIR" ]; then
    echo "[错误] 找不到 dist/packages 目录"
    exit 1
fi

echo "[信息] 目标目录: $TARGET_DIR"
echo ""

# 查找备份目录
echo "[搜索] 查找备份目录..."
echo ""

BACKUPS=($(ls -d "$TARGET_DIR"/backup_* 2>/dev/null))

if [ ${#BACKUPS[@]} -eq 0 ]; then
    echo "[错误] 找不到备份目录"
    echo "无法恢复原文件"
    exit 1
fi

# 显示备份列表
for i in "${!BACKUPS[@]}"; do
    echo "  $((i+1)). $(basename "${BACKUPS[$i]}")"
done

echo ""
read -p "请选择要恢复的备份 (1-${#BACKUPS[@]}): " CHOICE

# 验证选择
if [ "$CHOICE" -lt 1 ] || [ "$CHOICE" -gt ${#BACKUPS[@]} ]; then
    echo "[错误] 无效的选择"
    exit 1
fi

SELECTED_BACKUP="${BACKUPS[$((CHOICE-1))]}"

echo ""
echo "[恢复] 从 $SELECTED_BACKUP 恢复..."

# 恢复文件
if [ -f "$SELECTED_BACKUP/package.mjs.bak" ]; then
    cp "$SELECTED_BACKUP/package.mjs.bak" "$TARGET_DIR/package.mjs"
    echo "[成功] 已恢复 package.mjs"
else
    echo "[跳过] 备份中没有 package.mjs.bak"
fi

if [ -f "$SELECTED_BACKUP/views.mjs.bak" ]; then
    cp "$SELECTED_BACKUP/views.mjs.bak" "$TARGET_DIR/views.mjs"
    echo "[成功] 已恢复 views.mjs"
else
    echo "[跳过] 备份中没有 views.mjs.bak"
fi

echo ""
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║                      恢复完成！                            ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""
echo "[提示] 请重启 FoundryVTT"
echo ""
