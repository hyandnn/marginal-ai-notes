# 开发任务（可选阅读）

用户向文档见 [`VAULT.md`](VAULT.md)。此处仅记录未完成功能。

## 已完成

- 插件采集、JSONL 导出、导出预览、同 URL 合并
- 稳定 id、content_hash、转换去重
- CLI：merge / dry-run / watch
- Local Note Pipeline MVP（`tools/pipeline_app.py`）

## 待做

### 插件

- [ ] 豆包 / 新站点 DOM 维护
- [ ] Popup「仅导出变更条目」

### Pipeline（Phase 4 增强）

- [ ] 批量多选 JSONL 一次转换
- [ ] 预览显示 topic / url 详情
- [ ] watch 开关（后台监视 Record）
- [ ] Popup 链接「打开 Pipeline」

### 后期

- [ ] LLM 二次加工（不碰 JSONL，显式触发）
- [ ] JSONL 恢复便签到插件（只读）
- [ ] Chrome Web Store 上架

## 刻意不做

- 插件内 Markdown 编辑器 / 自动总结
- Pipeline 替代 Obsidian 阅读与归档
- 未经确认的自动移动 Vault 文件
