# Agent Sidenote

无需 Python、无需本地后端。安装扩展 → 填写 API Key → 在 AI 对话网页选中文字即可旁注追问。

**已支持站点：** ChatGPT · 豆包

> 本目录为独立版本，位于 `chrome-extension/`。原 `extension/` + `backend/` 方案未做任何修改，可继续正常使用。

---

## 快速开始（3 步）

### 1. 加载扩展

1. 打开 Chrome → 地址栏输入 `chrome://extensions`
2. 开启右上角 **开发者模式**
3. 点击 **加载已解压的扩展程序**
4. 选择本项目的 **`chrome-extension/`** 文件夹

### 2. 配置 API Key

1. 点击浏览器工具栏中的扩展图标
2. 将模式切换为 **API（调用大模型）**
3. 选择服务商预设（DeepSeek / OpenAI），或选「自定义」
4. 填入 **API Key** 和 **模型名称**
5. 点击 **测试连接**，确认成功后 **保存设置**

旁注追问使用的模型与当前页面（ChatGPT / 豆包）无关，由你在这里配置的 API 决定。

### 3. 使用

1. 打开 [chatgpt.com](https://chatgpt.com) 或 [doubao.com](https://www.doubao.com/chat/)
2. 在任意 **AI 回答** 中选中一段文字（不要选输入框或侧边栏）
3. 点击 **「旁注追问」**
4. 在便签窗口中输入问题并发送

---

## 验证插件已加载

打开支持站点，按 `F12` → Console，应看到：

```
[CGIA-SA] content script loaded
[CGIA-SA] site adapter: chatgpt   // 或 doubao
```

---

## 架构说明

```
AI 对话页面 (Content Script + 站点适配器)
    ↓ chrome.runtime.sendMessage
Background Service Worker
    ↓ 组装 prompt + fetch
大模型 API（DeepSeek / OpenAI / 兼容服务）
```

每个站点有独立 DOM 适配器（`content/adapters/`），便签 UI 与 API 调用逻辑通用。

---

## 常见问题

**豆包上选中回答没反应？**

- 确认在 `www.doubao.com` 对话页，且选中的是 **AI 回复正文**，不是左侧边栏或底部输入框
- Console 应显示 `site adapter: doubao`；若没有，请刷新页面并重载扩展
- 豆包 DOM 会改版，若失效请反馈（见下方「适配器维护」）

**选中文字没出现按钮？**

- 选区至少 2 个字符
- 在输入框 / 侧边栏内选中不会触发

**重载扩展后异常？**

- 刷新 AI 对话页面让新代码重新注入

---

## 适配器维护（豆包 DOM 改版时）

若豆包更新后旁注失效，请在豆包对话页 `F12` → Console 运行：

```javascript
// 1. 消息条数
document.querySelectorAll('[data-message-id]').length

// 2. 选中 AI 回复文字后，看最近的消息节点
$0?.closest?.('[data-message-id]') || $0?.closest?.('[class*="receive"]')
```

把输出截图或 HTML 结构发给我们，用于更新 `content/adapters/doubao.js`。

---

## 目录结构

```
chrome-extension/
├── manifest.json
├── background/
├── content/
│   ├── adapters/        各站点 DOM 适配（chatgpt.js / doubao.js）
│   ├── note_manager.js
│   └── selection.js
├── popup/
└── README.md
```
