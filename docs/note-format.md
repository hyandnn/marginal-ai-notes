# Markdown 导出格式

## 文件命名

`{YYYYMMDD-HHMM}-{主题}-{记录id}.md`

示例：`20260618-1520-地面分割算法-note_1739.md`

## 文件结构

1. YAML front matter：`source`、`url`、`type`、`id`、`content_hash`、`created`、`tags`、`marks`
2. `# 主话题`
3. `## 主问题`（如有）
4. `## 选中的原文`（blockquote）
5. `## 追问记录`（`### 问题` + 回答）
6. `## 元数据`

同 URL 合并导出时，每条便签以 `## 便签 N · 时间` 分节。

## 笔记类型（note_type）

| 值 | 含义 |
|----|------|
| `general` | 通用 |
| `concept` | 解释概念 |
| `debug` | 调试记录 |
| `code` | 代码方案 |
| `paper` | 论文/学习 |
| `interview` | 面试准备 |
| `todo` | TODO |

## 标记（marks）

| 值 | 含义 |
|----|------|
| `important` | 重要 |
| `concept` | 概念 |
| `reusable-code` | 代码 |
| `todo` | 待办 |

## 去重

插件用 `content_hash` 追踪已导出内容。勾选 Popup「仅导出变更条目」时，内容与上次相同的便签会被跳过。
