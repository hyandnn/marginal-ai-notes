# Agent Sidenote

在 AI 对话网页（ChatGPT、豆包等）选中文字，用便签旁注追问，并将结构化笔记导出为 JSONL / Markdown。

---

## 快速开始

### 1. 安装扩展

1. 打开 `chrome://extensions`，开启 **开发者模式**
2. **加载已解压的扩展程序** → 选择**本仓库根目录**（含 `manifest.json` 的文件夹）

### 2. 配置 API

1. 点击扩展图标，模式选 **API**
2. 填写 API Key、模型（DeepSeek / OpenAI 等 OpenAI 兼容服务）
3. **测试连接** → **保存设置**

Mock 模式无需 Key，可体验 UI。

### 3. 使用

1. 打开 [chatgpt.com](https://chatgpt.com) 或 [doubao.com/chat](https://www.doubao.com/chat/)
2. 在 **AI 回答** 中选中文字 → 点击 **旁注追问**
3. 在便签中提问（流式显示回答），设置类型/标记/标签
4. **Save as Note** 或在 Popup 中 **导出 JSONL**

### 4. 本地笔记目录（可选）

```bash
./scripts/setup_dirs.sh
```

- JSONL 原始记录：`~/Downloads/Record/`
- Obsidian Markdown：`~/Note/00_Inbox/`（见 [`docs/VAULT.md`](docs/VAULT.md)）

JSONL 转 Markdown：

```bash
cd tools
python3 jsonl_to_md.py -i ~/Downloads/Record/xxx.jsonl -o ~/Note/00_Inbox/
```

详见 [`docs/TOOLS.md`](docs/TOOLS.md)。

---

## 验证

Console 应输出：

```
[CGIA-SA] content script loaded
[CGIA-SA] site adapter: chatgpt
```

---

## 项目结构

```
.
├── manifest.json
├── background/          Service Worker（API、导出、流式回答）
├── content/             注入页面的脚本与样式
│   └── adapters/        各站点 DOM 适配（chatgpt / doubao）
├── popup/               设置与批量导出
├── shared/              便签 Schema、JSONL 导出
├── scripts/             本地目录初始化
├── tools/               jsonl_to_md.py
└── docs/                格式说明、Vault 布局、路线图
```

---

## 文档

| 文件 | 说明 |
|------|------|
| [`docs/VAULT.md`](docs/VAULT.md) | `~/Note` 与 `~/Downloads/Record` 目录约定 |
| [`docs/jsonl-schema.md`](docs/jsonl-schema.md) | JSONL 字段与枚举 |
| [`docs/TOOLS.md`](docs/TOOLS.md) | JSONL → Markdown 脚本用法 |
| [`docs/ROADMAP.md`](docs/ROADMAP.md) | 后续计划 |

---

## 常见问题

**豆包上无反应？** 确认选中的是 AI 回复正文；Console 应有 `site adapter: doubao`；DOM 改版时需更新 `content/adapters/doubao.js`。

**选中无按钮？** 选区至少 2 字；输入框/侧边栏内选区不触发。

**重载扩展后异常？** 刷新 AI 对话页面。
