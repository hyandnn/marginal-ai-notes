# ChatGPT 旁注追问助手（纯插件版）

无需 Python、无需本地后端。安装扩展 → 填写 API Key → 在 ChatGPT 页面选中文字即可旁注追问。

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

**DeepSeek 示例：**

| 字段 | 值 |
|------|-----|
| 服务商 | DeepSeek |
| API Key | 在 [platform.deepseek.com](https://platform.deepseek.com) 申请 |
| 模型 | `deepseek-chat` |
| API 地址 | `https://api.deepseek.com` |

**OpenAI 示例：**

| 字段 | 值 |
|------|-----|
| 服务商 | OpenAI |
| API Key | 你的 OpenAI Key |
| 模型 | `gpt-4.1-mini` |
| API 地址 | `https://api.openai.com` |

其他 OpenAI 兼容服务（如 Ollama）选「自定义」，填写对应的 Base URL 和模型名即可。

### 3. 使用

1. 打开 [chatgpt.com](https://chatgpt.com)
2. 在任意回答中 **选中一段文字**
3. 点击出现的 **「旁注追问」** 按钮
4. 在便签窗口中输入问题并发送

---

## Mock 模式（无需 Key）

默认是 **Mock 模式**，不填 API Key 也能体验完整 UI：选中文字 → 创建便签 → 发送问题 → 返回固定测试回答。

---

## 验证插件已加载

打开 ChatGPT 页面，按 `F12` → Console，应看到：

```
[CGIA-SA] content script loaded
```

---

## 架构说明

```
ChatGPT 页面 (Content Script)
    ↓ chrome.runtime.sendMessage
Background Service Worker
    ↓ 组装 prompt + fetch
大模型 API（DeepSeek / OpenAI / 兼容服务）
```

- API Key 存储在 `chrome.storage.local`，仅本机浏览器可读
- 不经过任何第三方中转服务器
- 与原 backend 方案使用独立的 storage key，两个版本可同时安装互不干扰

---

## 常见问题

**测试连接失败？**

- 确认 API Key 正确且有余额
- 确认模型名称与服务商匹配
- 本地 Ollama 等需填写 `http://127.0.0.1:11434` 类地址

**选中文字没出现按钮？**

- 确认在 chatgpt.com 页面
- 选区至少 2 个字符
- 在 ChatGPT 输入框内选中不会触发（设计如此）

**重载扩展后异常？**

- 刷新 ChatGPT 页面让新代码重新注入

---

## 目录结构

```
chrome-extension/
├── manifest.json
├── background/          Service Worker + prompt/LLM 调用
├── content/             注入 ChatGPT 页面的脚本
├── popup/               设置面板
└── README.md
```
