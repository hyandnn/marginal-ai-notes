# 本地笔记与工作流

## 两个路径

| 路径 | 用途 |
|------|------|
| `~/Downloads/Record/` | 插件导出的 JSONL 原始记录 |
| `~/Note/` | Obsidian Markdown Vault |

macOS 中文系统「下载」= `~/Downloads`。

## Vault 结构

```text
~/Note/
├── 00_Inbox/       ← Pipeline / 脚本输出，待整理
├── 10_Projects/    ← 项目笔记（按项目分子文件夹）
├── 20_Concepts/    ← 概念卡片
├── 30_Code/        ← 代码与调试
├── 90_Archive/     ← 归档
└── README.md
```

一键初始化（含从旧 `00_Index/` 迁移到 `00_Inbox/`）：

```bash
./scripts/setup_dirs.sh
```

## 完整工作流

```text
1. 插件 Save as Note / Popup 导出
       ↓
   ~/Downloads/Record/*.jsonl（或 .ndjson，内容相同）
       ↓
2. Local Note Pipeline 或 CLI 转换
       ↓
   ~/Note/00_Inbox/*.md
       ↓
3. Obsidian 阅读，手动移到 10_Projects / 20_Concepts …
```

---

## 可视化转换（推荐）

```bash
mamba activate note-pipeline   # 或 ~/miniforge3/bin/mamba activate note-pipeline
cd tools
python3 pipeline_app.py
```

浏览器打开 **http://127.0.0.1:5179**

- 左侧选 JSONL → 右侧预览将生成哪些 md（含去重 skip）
- 勾选 merge / force → 执行转换

首次使用需安装依赖：

```bash
mamba create -n note-pipeline python=3.11 -y
mamba activate note-pipeline
pip install -r tools/requirements-pipeline.txt
```

配置在 `tools/config.yaml`（由 `setup_dirs.sh` 从 `config.example.yaml` 生成）：

```yaml
vault_path: ~/Note
inbox_dir: 00_Inbox
record_path: ~/Downloads/Record
timezone: Asia/Shanghai
```

---

## CLI（可选）

```bash
cd tools

# 转换
python3 jsonl_to_md.py -i ~/Downloads/Record/xxx.jsonl -o ~/Note/00_Inbox/

# 预览 / 合并 / 强制
python3 jsonl_to_md.py -i xxx.jsonl --dry-run
python3 jsonl_to_md.py -i xxx.jsonl --merge-by topic+url
python3 jsonl_to_md.py -i xxx.jsonl --force

# 监视 Record 目录
python3 watch_jsonl.py --once
```

**去重：** 输出目录有 `.pipeline-state.json`，已处理的 id / content_hash 默认跳过。

**JSONL 格式：** 一行一条 JSON，详见 [`jsonl-schema.md`](jsonl-schema.md)。

---

## 插件导出设置

Popup → **JSONL 保存子目录** 保持默认 `Record` → 文件在 `~/Downloads/Record/`。

文件名示例：`chatgpt-20260618-主题.jsonl`（Chrome 偶发改成 `.ndjson`，Pipeline 均支持）。
