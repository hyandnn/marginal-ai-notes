#!/usr/bin/env bash
# 初始化 ~/Note 与 ~/Downloads/Record

set -euo pipefail

NOTE_DIR="${HOME}/Note"
RECORD_DIR="${HOME}/Downloads/Record"

echo "创建目录结构…"
mkdir -p "${NOTE_DIR}/00_Inbox"
mkdir -p "${NOTE_DIR}/10_Projects"
mkdir -p "${NOTE_DIR}/20_Concepts"
mkdir -p "${NOTE_DIR}/30_Code"
mkdir -p "${NOTE_DIR}/90_Archive"
mkdir -p "${RECORD_DIR}"

if [[ ! -f "${NOTE_DIR}/README.md" ]]; then
  cat > "${NOTE_DIR}/README.md" <<'EOF'
# Note Vault

- `00_Inbox/` — 脚本自动生成的 Markdown，待整理
- `10_Projects/` — 项目笔记
- `20_Concepts/` — 概念卡片
- `30_Code/` — 代码与调试
- `90_Archive/` — 归档

原始 JSONL 在 `~/Downloads/Record/`。
EOF
fi

TOOLS_DIR="$(cd "$(dirname "$0")/../tools" && pwd)"
if [[ ! -f "${TOOLS_DIR}/config.yaml" ]]; then
  cp "${TOOLS_DIR}/config.example.yaml" "${TOOLS_DIR}/config.yaml"
  echo "已生成 tools/config.yaml，请按需修改"
fi

echo ""
echo "完成。"
echo "  Markdown Vault: ${NOTE_DIR}"
echo "  JSONL 原始记录: ${RECORD_DIR}"
echo "  （插件默认导出到 Chrome 下载目录下的 Record/ 子文件夹）"
