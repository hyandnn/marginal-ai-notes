# JSONL → Markdown

将插件导出的 JSONL 转为 Obsidian 可读的 Markdown。

## 为什么 JSONL 是一行一条？

JSONL（NDJSON）标准格式：**一行 = 一条记录**，便于脚本逐行读取与追加。  
人眼阅读请用本工具生成 Markdown，见 [`VAULT.md`](VAULT.md)。

## 用法

```bash
cd tools

# 指定输入输出
python3 jsonl_to_md.py -i ~/Downloads/Record/note-20260618-xxx.jsonl -o ~/Note/00_Inbox/

# 使用 config.yaml（从 config.example.yaml 复制）
cp config.example.yaml config.yaml
python3 jsonl_to_md.py -i ~/Downloads/Record/xxx.jsonl

# 预览
python3 jsonl_to_md.py -i xxx.jsonl -o ./out --dry-run
```

## 测试

```bash
python3 -m unittest test_jsonl_to_md.py -v
```

## 输出

每行 JSONL → 一个 `.md` 文件：

- YAML front matter（source、url、tags、type…）
- 主问题、选中文本、追问 Q&A、元数据

文件名示例：`20260618-2115-地面分割算法-note_xxx.md`
