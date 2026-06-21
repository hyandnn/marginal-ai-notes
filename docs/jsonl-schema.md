# JSONL 导出格式（Schema v1）

每条记录占 JSONL 文件中的一行（NDJSON）。**一行 = 一条记录**是标准格式；人眼阅读请用 Pipeline 或 [`VAULT.md`](VAULT.md) 中的 CLI 转为 Markdown。

## 版本

- **schema_version**: `1`（整数，必填）
- v1.1 追加字段：`content_hash`（可选）、`turns`（合并导出时）

## 字段说明

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `schema_version` | number | 是 | 当前为 `1` |
| `id` | string | 是 | 稳定 ID：`rec_{noteId}` 或合并时 `rec_url_{hash}` |
| `time` | string | 是 | ISO 8601 时间，取便签最后更新时间 |
| `source` | string | 是 | 站点 ID：`chatgpt` / `doubao` / … |
| `url` | string | 是 | 对话页完整 URL |
| `main_topic` | string | 否 | 会话主题（对话标题或首条用户问题摘要） |
| `main_question` | string | 否 | 主对话首条用户问题全文（截断至 500 字） |
| `selected_text` | string | 是* | 用户选中的原文（合并记录可为空，内容在 `turns`） |
| `followups` | array | 是 | 旁注追问 Q&A 列表；合并记录可为 `[]` |
| `note_type` | string | 是 | 笔记类型，见枚举 |
| `marks` | string[] | 是 | 用户标记，见枚举 |
| `tags` | string[] | 是 | 用户自定义标签 |
| `status` | string | 是 | 固定 `draft`（导出时） |
| `content_hash` | string | 否 | 去重指纹：`hash_{fnv}`，由 url + 正文 + followups 派生 |
| `turns` | array | 否 | 同 URL 合并导出时的分便签列表，见下表 |

### followups 项

| 字段 | 类型 | 说明 |
|------|------|------|
| `q` | string | 用户问题 |
| `a` | string | 助手回答 |
| `time` | string | ISO 8601，该轮提问时间 |

### turns 项（v1.1，合并导出）

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | string | 原便签 `rec_{noteId}` |
| `time` | string | 该便签最后更新时间 |
| `selected_text` | string | 选中文本 |
| `followups` | array | 该便签的追问列表 |
| `note_type` | string | 笔记类型 |
| `marks` | string[] | 标记 |
| `tags` | string[] | 标签 |

## id 与去重

| 场景 | id 格式 |
|------|---------|
| 单条便签 | `rec_{noteId}`（noteId 创建时固定） |
| 同 URL 合并 | `rec_url_{urlHash}` |

`content_hash` 用于转换层去重：同 url + 同 selected_text + 同 followups 不重复生成 md。状态保存在输出目录 `.pipeline-state.json`。

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

## 示例（单条）

```json
{"schema_version":1,"id":"rec_note_1739123456_abc","time":"2026-06-16T15:20:00.000Z","source":"chatgpt","url":"https://chatgpt.com/c/xxx","main_topic":"地面分割算法","main_question":"我在调试 stereo ground detector 的流程","selected_text":"v-disparity ...","followups":[{"q":"v-disparity 是什么？","a":"...","time":"2026-06-16T15:21:00.000Z"}],"note_type":"concept","marks":["important"],"tags":["stereo","ground-detection"],"status":"draft","content_hash":"hash_a1b2c3d4"}
```

## 示例（同 URL 合并）

见 `tools/fixtures/merged.jsonl`：顶层 `turns[]` 含多条便签，便于 md 按「便签 1 / 便签 2」分节。
