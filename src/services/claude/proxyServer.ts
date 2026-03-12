export class ProxyServer {
  private server: any; // nsIHttpServer
  private port: number;
  private running = false;

  constructor(port: number = 23121) {
    this.port = port;
  }

  start(): void {
    if (this.running) return;

    const { HttpServer } = ChromeUtils.importESModule(
      "resource://gre/modules/httpd.sys.mjs",
    );

    this.server = new HttpServer();
    this.server.registerPathHandler("/health", this.handleHealth.bind(this));
    this.server.registerPathHandler(
      "/v1/messages",
      this.handleMessages.bind(this),
    );

    // 绑定 127.0.0.1
    this.server.start(this.port);
    this.running = true;
    Zotero.debug(`[Clautero] Proxy server started on 127.0.0.1:${this.port}`);
  }

  stop(): void {
    if (!this.running) return;
    this.server.stop(() => {
      Zotero.debug("[Clautero] Proxy server stopped");
    });
    this.running = false;
  }

  private handleHealth(request: any, response: any): void {
    response.setStatusLine(request.httpVersion, 200, "OK");
    response.setHeader("Content-Type", "application/json", false);
    response.write(JSON.stringify({ status: "ok" }));
  }

  private handleMessages(request: any, response: any): void {
    if (request.method !== "POST") {
      response.setStatusLine(request.httpVersion, 405, "Method Not Allowed");
      return;
    }

    const apiKey = Zotero.Prefs.get(
      "extensions.clautero.apiKey",
      true,
    ) as string;
    if (!apiKey) {
      response.setStatusLine(request.httpVersion, 401, "Unauthorized");
      response.setHeader("Content-Type", "application/json", false);
      response.write(JSON.stringify({ error: "API Key not configured" }));
      return;
    }

    // 读取请求体
    const inputStream = request.bodyInputStream;
    const scriptableStream = (Components.classes as any)[
      "@mozilla.org/scriptableinputstream;1"
    ].createInstance(Components.interfaces.nsIScriptableInputStream);
    scriptableStream.init(inputStream);
    const body = scriptableStream.read(scriptableStream.available());
    scriptableStream.close();

    // 异步处理
    response.processAsync();

    // 转发到 Claude API
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "https://api.anthropic.com/v1/messages", true);
    xhr.setRequestHeader("Content-Type", "application/json");
    xhr.setRequestHeader("x-api-key", apiKey);
    xhr.setRequestHeader("anthropic-version", "2023-06-01");

    // 检查是否流式请求
    let isStream = false;
    try {
      const parsed = JSON.parse(body);
      isStream = parsed.stream === true;
    } catch {
      // ignore parse error
    }

    if (isStream) {
      response.setStatusLine("1.1", 200, "OK");
      response.setHeader("Content-Type", "text/event-stream", false);
      response.setHeader("Cache-Control", "no-cache", false);
      response.setHeader("Access-Control-Allow-Origin", "*", false);

      let lastIndex = 0;
      xhr.onprogress = () => {
        const newData = (xhr.responseText || "").substring(lastIndex);
        lastIndex = (xhr.responseText || "").length;
        if (newData) {
          try {
            response.write(newData);
          } catch (e) {
            Zotero.debug(`[Clautero] Error writing stream: ${e}`);
          }
        }
      };

      xhr.onload = () => {
        // 写入剩余数据
        const remaining = (xhr.responseText || "").substring(lastIndex);
        if (remaining) {
          try {
            response.write(remaining);
          } catch {
            // ignore write error on finalization
          }
        }
        response.finish();
      };

      xhr.onerror = () => {
        try {
          response.write(
            `data: ${JSON.stringify({ type: "error", error: { type: "proxy_error", message: "Failed to connect to Claude API" } })}\n\n`,
          );
        } catch {
          // ignore write error
        }
        response.finish();
      };
    } else {
      xhr.onload = () => {
        response.setStatusLine("1.1", xhr.status, xhr.statusText);
        response.setHeader("Content-Type", "application/json", false);
        response.write(xhr.responseText || "");
        response.finish();
      };

      xhr.onerror = () => {
        response.setStatusLine("1.1", 502, "Bad Gateway");
        response.setHeader("Content-Type", "application/json", false);
        response.write(
          JSON.stringify({ error: "Failed to connect to Claude API" }),
        );
        response.finish();
      };
    }

    xhr.send(body);
  }

  isRunning(): boolean {
    return this.running;
  }

  getPort(): number {
    return this.port;
  }
}
