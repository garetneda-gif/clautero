// P1: nsIHttpServer + SSE Streaming 验证
// 在 Zotero 7 JS Console 中运行
(async () => {
  const { HttpServer } = ChromeUtils.importESModule("resource://gre/modules/httpd.sys.mjs");
  const PORT = 23199;
  const server = new HttpServer();
  let testCount = 0;
  const TOTAL_TESTS = 10;

  server.registerPathHandler("/sse-test", (request, response) => {
    response.processAsync();
    response.setStatusLine("1.1", 200, "OK");
    response.setHeader("Content-Type", "text/event-stream", false);
    response.setHeader("Cache-Control", "no-cache", false);

    let count = 0;
    const timer = setInterval(() => {
      try {
        response.write(`data: {"index":${count},"text":"chunk_${count}"}\n\n`);
        count++;
        if (count >= TOTAL_TESTS) {
          clearInterval(timer);
          response.write("data: [DONE]\n\n");
          response.finish();
        }
      } catch (e) {
        clearInterval(timer);
        Zotero.debug("[P1] Write error: " + e);
      }
    }, 100);
  });

  server.start(PORT);
  Zotero.debug("[P1] Server started on port " + PORT);

  // 发起请求
  const received = [];
  await new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("GET", `http://127.0.0.1:${PORT}/sse-test`, true);
    let lastIndex = 0;

    xhr.onprogress = () => {
      const newData = xhr.responseText.substring(lastIndex);
      lastIndex = xhr.responseText.length;
      const lines = newData.split("\n");
      for (const line of lines) {
        if (line.startsWith("data: ") && line !== "data: [DONE]") {
          try {
            received.push(JSON.parse(line.substring(6)));
          } catch {}
        }
      }
    };

    xhr.onload = () => resolve();
    xhr.onerror = () => reject(new Error("XHR error"));
    xhr.send();
  });

  server.stop(() => {});

  const passed = received.length === TOTAL_TESTS &&
    received.every((item, i) => item.index === i);

  Zotero.debug(`[P1] Result: ${passed ? "PASS" : "FAIL"}`);
  Zotero.debug(`[P1] Received ${received.length}/${TOTAL_TESTS} events`);
  Zotero.debug(`[P1] Data integrity: ${received.map(r => r.index).join(",")}`);

  return { passed, received: received.length, expected: TOTAL_TESTS };
})();
