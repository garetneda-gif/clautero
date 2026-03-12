# Clautero Preflight PoC Spikes

## 运行方式
在 Zotero 7 中打开 Tools → Developer → Run JavaScript，粘贴对应 spike.js 的内容并执行。

## P1: nsIHttpServer + SSE Streaming
- **验证目标**：nsIHttpServer 能否稳定提供 SSE 流式响应
- **通过标准**：连续接收 10 个 SSE 事件，无数据丢失/乱序
- **阻塞范围**：Step 3（Claude 流式对话）
- **状态**：待验证

## P2: 选中项监听
- **验证目标**：确定可靠的选中项变化监听方案
- **测试方案**：Zotero.Notifier select 事件 vs 轮询 getSelectedItems()
- **通过标准**：切换选中条目时回调稳定触发，无遗漏/重复
- **阻塞范围**：Step 4（上下文注入）
- **状态**：待验证

## P3: 全文读取 API
- **验证目标**：确定可用的全文读取方案
- **测试方案**：Zotero.Fulltext.getItemContent vs item.attachmentText
- **通过标准**：对 PDF 附件返回非空文本内容
- **阻塞范围**：Step 6（全文工具）
- **状态**：待验证

## P4: Obsidian HTTPS 连接
- **验证目标**：从 Zotero 插件环境连接 Obsidian Local REST API
- **测试方案**：HTTP vs HTTPS vs nsIHttpChannel
- **通过标准**：连接成功或找到可行绕过方案
- **阻塞范围**：Step 8（Obsidian 桥接）
- **状态**：待验证
