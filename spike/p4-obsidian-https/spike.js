// P4: Obsidian HTTPS 连接验证
// 在 Zotero 7 JS Console 中运行
// 前置条件：Obsidian 已启动且安装了 Local REST API 插件
(async () => {
  Zotero.debug("[P4] Starting Obsidian connection test...");

  const results = {
    http: { success: false, status: 0, error: "" },
    https: { success: false, status: 0, error: "" },
  };

  // 测试 HTTP (端口 27123 或 27124)
  for (const port of [27123, 27124]) {
    try {
      const xhr = new XMLHttpRequest();
      xhr.open("GET", `http://127.0.0.1:${port}/`, false);
      xhr.timeout = 3000;
      xhr.send();
      if (xhr.status === 200) {
        results.http.success = true;
        results.http.status = xhr.status;
        Zotero.debug(`[P4] HTTP on port ${port}: SUCCESS (${xhr.status})`);
        break;
      }
    } catch (e) {
      Zotero.debug(`[P4] HTTP on port ${port}: ${e}`);
      results.http.error = String(e);
    }
  }

  // 测试 HTTPS (端口 27124)
  try {
    const xhr = new XMLHttpRequest();
    xhr.open("GET", "https://127.0.0.1:27124/", false);
    xhr.timeout = 3000;
    xhr.send();
    results.https.success = true;
    results.https.status = xhr.status;
    Zotero.debug(`[P4] HTTPS: SUCCESS (${xhr.status})`);
  } catch (e) {
    Zotero.debug(`[P4] HTTPS: ${e}`);
    results.https.error = String(e);

    // 尝试 nsIHttpChannel 证书覆盖
    try {
      Zotero.debug("[P4] Trying nsIHttpChannel with certificate override...");
      const uri = Services.io.newURI("https://127.0.0.1:27124/");
      const channel = Services.io.newChannelFromURI(uri, null,
        Services.scriptSecurityManager.getSystemPrincipal(), null,
        Components.interfaces.nsILoadInfo.SEC_ALLOW_CROSS_ORIGIN_SEC_CONTEXT_IS_NULL,
        Components.interfaces.nsIContentPolicy.TYPE_OTHER);
      Zotero.debug("[P4] nsIHttpChannel created, further testing needed");
    } catch (e2) {
      Zotero.debug(`[P4] nsIHttpChannel: ${e2}`);
    }
  }

  const passed = results.http.success || results.https.success;
  const recommended = results.http.success ? "HTTP" : results.https.success ? "HTTPS" : "none";

  Zotero.debug(`[P4] Result: ${passed ? "PASS" : "FAIL"}`);
  Zotero.debug(`[P4] Recommended protocol: ${recommended}`);

  return { passed, recommended, results };
})();
