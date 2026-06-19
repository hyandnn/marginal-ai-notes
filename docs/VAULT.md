# 本地笔记目录

```text
~/Downloads/Record/   # 插件导出的 JSONL
~/Note/               # Obsidian Markdown Vault
```

> macOS 中文界面「下载」对应路径 `~/Downloads`。

## ~/Note

```text
~/Note/
├── 00_Inbox/       ← jsonl_to_md.py 输出，每周从这里整理
├── 10_Projects/
├── 20_Concepts/
├── 30_Code/
├── 90_Archive/
└── README.md
```

`00_Index/` 与 `00_Inbox/` 作用相同，在 `tools/config.yaml` 中设置 `inbox_dir` 即可。

## ~/Downloads/Record

插件 Popup 中 **JSONL 保存子目录** 保持默认 `Record`，文件会出现在：

```text
~/Downloads/Record/note-20260618-xxx.jsonl
```

## 初始化

```bash
./scripts/setup_dirs.sh
```

## 工作流

```text
插件 Save as Note / 导出 JSONL
    → ~/Downloads/Record/*.jsonl
python3 tools/jsonl_to_md.py -i … -o ~/Note/00_Inbox/
    → Obsidian 阅读、手动整理到 Projects / Concepts …
```
