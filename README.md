# Agent Sidenote

在 AI 对话网页（ChatGPT、豆包等）选中文字，用便签旁注追问，并将笔记导出为 JSONL，再转为 Obsidian Markdown。

---

## 快速开始

### 1. 安装扩展

1. 打开 `chrome://extensions`，开启 **开发者模式**
2. **加载已解压的扩展程序** → 选择本目录（含 `manifest.json`）

### 2. 配置 API

1. 点击扩展图标，模式选 **API**
2. 填写 API Key、模型（DeepSeek / OpenAI 等）
3. **测试连接** → **保存设置**

Mock 模式无需 Key，可体验 UI。

### 3. 使用

1. 打开 [chatgpt.com](https://chatgpt.com) 或 [doubao.com/chat](https://www.doubao.com/chat/)
2. 在 **AI 回答** 中选中文字 → **旁注追问**
3. 便签中提问，设置类型/标记/标签
4. **Save as Note** 或 Popup **导出 JSONL**（可勾选「仅导出变更条目」）
5. Popup **打开 Pipeline** → 可视化转 Markdown

### 4. 本地笔记（推荐）

```bash
./scripts/setup_dirs.sh          # 创建 ~/Note 与 ~/Downloads/Record
```

JSONL → Markdown 用可视化界面（详见 [`docs/VAULT.md`](docs/VAULT.md)）：

```bash
mamba activate note-pipeline
cd tools && python3 pipeline_app.py
# 打开 http://127.0.0.1:5179
```

---

## 文档

| 文件 | 何时看 |
|------|--------|
| [`docs/VAULT.md`](docs/VAULT.md) | 目录结构、Pipeline、CLI、工作流 |
| [`docs/jsonl-schema.md`](docs/jsonl-schema.md) | JSONL 字段定义（开发/排查时用） |
| [`docs/TodoList.md`](docs/TodoList.md) | 后续开发任务（可忽略） |

---

## 常见问题

**Save as Note 报错？** 重载扩展后再试；文件应在 `~/Downloads/Record/`。

**Pipeline 列表为空？** 确认 Record 路径；`.jsonl` 与 `.ndjson` 均支持。

**豆包无反应？** 选中 AI 回复正文；Console 应有 `site adapter: doubao`。

**重载扩展后异常？** 刷新 AI 对话页面。
