# JSONL 导出格式（Schema v1）

每条记录占 JSONL 文件中的一行（NDJSON）。**一行 = 一条记录**是标准格式；人眼阅读请用 [`TOOLS.md`](TOOLS.md) 中的脚本转为 Markdown。

## 版本

- **schema_version**: `1`（整数，必填）

## 字段说明

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `schema_version` | number | 是 | 当前为 `1` |
| `id` | string | 是 | 唯一 ID，如 `rec_note_1739...` |
| `time` | string | 是 | ISO 8601 时间，取便签最后更新时间 |
| `source` | string | 是 | 站点 ID：`chatgpt` / `doubao` / … |
| `url` | string | 是 | 对话页完整 URL |
| `main_topic` | string | 否 | 会话主题（对话标题或首条用户问题摘要） |
| `main_question` | string | 否 | 主对话首条用户问题全文（截断至 500 字） |
| `selected_text` | string | 是 | 用户选中的原文 |
| `followups` | array | 是 | 旁注追问 Q&A 列表，见下表 |
| `note_type` | string | 是 | 笔记类型，见枚举 |
| `marks` | string[] | 是 | 用户标记，见枚举 |
| `tags` | string[] | 是 | 用户自定义标签 |
| `status` | string | 是 | 固定 `draft`（导出时） |

### followups 项

| 字段 | 类型 | 说明 |
|------|------|------|
| `q` | string | 用户问题 |
| `a` | string | 助手回答 |
| `time` | string | ISO 8601，该轮提问时间 |

## 枚举

### note_type

| 值 | 含义 |
|----|------|
| `general` | 通用 |
| `concept` | 解释概念 |
| `debug` | 调试记录 |
| `code` | 代码方案 |
| `paper` | 论文/学习笔记 |
| `interview` | 面试准备 |
| `todo` | TODO |

### marks

| 值 | 含义 |
|----|------|
| `important` | 重要 |
| `concept` | 概念解释 |
| `reusable-code` | 可复用代码 |
| `todo` | 待办 |

`note_type` 与 `marks` 可并存（类型是分类，标记是强调）。

## 示例

```json
{"schema_version":1,"id":"rec_note_1739123456_abc","time":"2026-06-16T15:20:00.000Z","source":"chatgpt","url":"https://chatgpt.com/c/xxx","main_topic":"地面分割算法","main_question":"我在调试 stereo ground detector 的流程","selected_text":"v-disparity ...","followups":[{"q":"v-disparity 是什么？","a":"...","time":"2026-06-16T15:21:00.000Z"}],"note_type":"concept","marks":["important"],"tags":["stereo","ground-detection"],"status":"draft"}
```
