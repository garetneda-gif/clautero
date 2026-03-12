// P3: 全文读取 API 验证
// 在 Zotero 7 JS Console 中运行
// 前置条件：至少选中一个有 PDF 附件的条目
(async () => {
  Zotero.debug("[P3] Starting fulltext API test...");

  const pane = Zotero.getActiveZoteroPane();
  const items = pane.getSelectedItems();

  if (items.length === 0) {
    Zotero.debug("[P3] FAIL: No item selected. Please select an item with a PDF attachment.");
    return { passed: false, reason: "no_selection" };
  }

  const item = items[0];
  Zotero.debug(`[P3] Testing with item: ${item.getField("title")}`);

  const results = {
    method1_getItemContent: { success: false, length: 0, preview: "" },
    method2_attachmentText: { success: false, length: 0, preview: "" },
  };

  // 获取 PDF 附件
  const attachmentIds = item.getAttachments();
  if (attachmentIds.length === 0) {
    Zotero.debug("[P3] FAIL: No attachments found.");
    return { passed: false, reason: "no_attachments" };
  }

  for (const attId of attachmentIds) {
    const att = await Zotero.Items.getAsync(attId);
    const contentType = att.attachmentContentType;
    Zotero.debug(`[P3] Attachment ${attId}: ${contentType}`);

    if (contentType !== "application/pdf") continue;

    // 方法 1: Zotero.Fulltext.getItemContent
    try {
      const content = await Zotero.Fulltext.getItemContent(attId);
      if (content && content.content) {
        results.method1_getItemContent.success = true;
        results.method1_getItemContent.length = content.content.length;
        results.method1_getItemContent.preview = content.content.substring(0, 200);
        Zotero.debug(`[P3] Method 1 (getItemContent): SUCCESS, ${content.content.length} chars`);
      } else {
        Zotero.debug(`[P3] Method 1 (getItemContent): returned empty. Keys: ${Object.keys(content || {}).join(",")}`);
      }
    } catch (e) {
      Zotero.debug(`[P3] Method 1 (getItemContent): ERROR - ${e}`);
    }

    // 方法 2: item.attachmentText
    try {
      if (typeof att.attachmentText !== "undefined") {
        const text = await att.attachmentText;
        if (text) {
          results.method2_attachmentText.success = true;
          results.method2_attachmentText.length = text.length;
          results.method2_attachmentText.preview = text.substring(0, 200);
          Zotero.debug(`[P3] Method 2 (attachmentText): SUCCESS, ${text.length} chars`);
        }
      }
    } catch (e) {
      Zotero.debug(`[P3] Method 2 (attachmentText): ERROR - ${e}`);
    }

    break; // 只测试第一个 PDF
  }

  const passed = results.method1_getItemContent.success || results.method2_attachmentText.success;
  Zotero.debug(`[P3] Result: ${passed ? "PASS" : "FAIL"}`);
  Zotero.debug(`[P3] Recommended: ${results.method1_getItemContent.success ? "getItemContent" : results.method2_attachmentText.success ? "attachmentText" : "none"}`);

  return { passed, results };
})();
