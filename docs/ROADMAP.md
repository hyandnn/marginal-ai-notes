# 路线图

## 已完成

- 旁注追问、流式回答、多轮上下文
- 站点适配：ChatGPT、豆包
- 便签类型 / 标记 / 标签
- JSONL 导出（Save as Note、Popup 批量导出）
- `jsonl_to_md.py` 与 Vault 目录约定

## 待做

### 采集体验

- [ ] 同 URL 多便签合并导出
- [ ] 导出前预览（条数、主话题、类型）

### Markdown 工具

- [ ] `--merge`：同 topic + url 合并为一篇 md
- [ ] `--dry-run`、同 topic 追加章节而非覆盖
- [ ] 文件夹 watch：新 JSONL 自动生成 md

### 站点

- [ ] 豆包 DOM 持续维护
- [ ] 新站点适配（Claude、Kimi 等）

### 后期（可选）

- [ ] 从 JSONL 恢复便签
- [ ] LLM 自动总结（默认关闭）
- [ ] Chrome Web Store 上架

## 刻意不做

- 插件内 Markdown 编辑器
- 插件内自动总结
- 自动双链 / 自动归档到 Projects
