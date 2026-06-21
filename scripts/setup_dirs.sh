#!/usr/bin/env bash
# 初始化 ~/Note Vault 与 ~/Downloads/Record

set -euo pipefail

NOTE_DIR="${HOME}/Note"
RECORD_DIR="${HOME}/Downloads/Record"

DIRS=(
  "00_Inbox"
  "10_Projects"
  "20_Concepts"
  "30_Code"
  "90_Archive"
)

write_if_missing() {
  local path="$1"
  local content="$2"
  if [[ ! -f "${path}" ]]; then
    printf '%s\n' "${content}" > "${path}"
  fi
}

echo "创建 Vault 目录…"
for d in "${DIRS[@]}"; do
  mkdir -p "${NOTE_DIR}/${d}"
done
mkdir -p "${RECORD_DIR}"

# 旧目录 00_Index → 00_Inbox 迁移
if [[ -d "${NOTE_DIR}/00_Index" ]]; then
  echo "发现旧目录 00_Index，迁移到 00_Inbox…"
  mkdir -p "${NOTE_DIR}/00_Inbox"
  shopt -s nullglob
  for f in "${NOTE_DIR}/00_Index"/*; do
    [[ -f "${f}" ]] || continue
    base="$(basename "${f}")"
    if [[ -e "${NOTE_DIR}/00_Inbox/${base}" ]]; then
      echo "  跳过（目标已存在）: ${base}"
    else
      mv "${f}" "${NOTE_DIR}/00_Inbox/${base}"
      echo "  已移动: ${base}"
    fi
  done
  if [[ -z "$(ls -A "${NOTE_DIR}/00_Index" 2>/dev/null)" ]]; then
    rmdir "${NOTE_DIR}/00_Index"
    echo "  已删除空目录 00_Index"
  else
    echo "  00_Index 仍有文件，请手动检查后删除"
  fi
fi

write_if_missing "${NOTE_DIR}/README.md" "# Note Vault

Agent Sidenote 的 Obsidian 笔记库。

| 目录 | 用途 |
|------|------|
| \`00_Inbox/\` | 脚本 / Pipeline 自动生成的 Markdown，待整理 |
| \`10_Projects/\` | 项目笔记（按项目分子文件夹） |
| \`20_Concepts/\` | 概念卡片 |
| \`30_Code/\` | 代码方案、调试记录 |
| \`90_Archive/\` | 归档 |

原始 JSONL：\`~/Downloads/Record/\`

工作流：插件导出 JSONL → Pipeline 转 md 到 Inbox → Obsidian 阅读并手动归档。
"

write_if_missing "${NOTE_DIR}/00_Inbox/README.md" "# Inbox

Pipeline / \`jsonl_to_md.py\` 的输出目录。每周从此处整理到 Projects / Concepts 等。
"

write_if_missing "${NOTE_DIR}/10_Projects/README.md" "# Projects

按项目建子文件夹，例如 \`10_Projects/stereo-ground/\`。
"

write_if_missing "${NOTE_DIR}/20_Concepts/README.md" "# Concepts

概念解释、术语卡片。
"

write_if_missing "${NOTE_DIR}/30_Code/README.md" "# Code

可复用代码片段、调试过程记录。
"

write_if_missing "${NOTE_DIR}/90_Archive/README.md" "# Archive

不再活跃但需保留的笔记。
"

TOOLS_DIR="$(cd "$(dirname "$0")/../tools" && pwd)"
if [[ ! -f "${TOOLS_DIR}/config.yaml" ]]; then
  cp "${TOOLS_DIR}/config.example.yaml" "${TOOLS_DIR}/config.yaml"
  echo "已生成 tools/config.yaml"
else
  echo "tools/config.yaml 已存在，未覆盖"
fi

echo ""
echo "完成。"
echo "  Vault:  ${NOTE_DIR}"
echo "  Record: ${RECORD_DIR}"
echo ""
echo "目录结构："
find "${NOTE_DIR}" -maxdepth 2 -type d ! -path '*/.obsidian*' | sort | sed "s|${HOME}|~|g"
