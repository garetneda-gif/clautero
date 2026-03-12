interface ConversationMessage {
  role: "user" | "assistant";
  content: string | Array<{ type: string; text?: string }>;
}

export class ConversationManager {
  private conversationId: string;
  private messages: ConversationMessage[] = [];
  private abortController: AbortController | null = null;
  private systemPrompt: string;

  constructor() {
    this.conversationId = this.generateId();
    this.systemPrompt = `You are Clautero, an AI research assistant embedded in Zotero. You help researchers analyze literature, summarize papers, extract insights, and manage their knowledge base. Be concise, accurate, and cite sources when available. Respond in the same language as the user's message.`;
  }

  async handleUserMessage(
    text: string,
    requestId: string,
    sendToIframe: (msg: Record<string, unknown>) => void,
  ): Promise<void> {
    this.messages.push({ role: "user", content: text });

    this.abortController = new AbortController();

    try {
      // 从偏好获取配置
      const apiKey = Zotero.Prefs.get(
        "extensions.clautero.apiKey",
        true,
      ) as string;
      const model =
        (Zotero.Prefs.get("extensions.clautero.model", true) as string) ||
        "claude-sonnet-4-5-20250514";
      const proxyPort =
        (Zotero.Prefs.get(
          "extensions.clautero.proxyPort",
          true,
        ) as number) || 23121;

      if (!apiKey) {
        throw new Error(
          "API Key not configured. Please set it in Clautero preferences.",
        );
      }

      // 构建请求（通过本地代理）
      const url = `http://127.0.0.1:${proxyPort}/v1/messages`;
      const body = JSON.stringify({
        model,
        max_tokens: 4096,
        system: this.systemPrompt,
        messages: this.messages,
        stream: true,
      });

      // 使用 XMLHttpRequest 发送流式请求
      const assistantContent = await this.streamRequest(
        url,
        body,
        requestId,
        sendToIframe,
      );

      // 将 AI 回复加入对话历史
      if (assistantContent) {
        this.messages.push({ role: "assistant", content: assistantContent });
      }

      sendToIframe({ type: "stream_end", requestId });
    } catch (error) {
      if ((error as any)?.name === "AbortError") {
        // 取消请求，不抛出
        return;
      }
      throw error;
    } finally {
      this.abortController = null;
    }
  }

  private streamRequest(
    url: string,
    body: string,
    requestId: string,
    sendToIframe: (msg: Record<string, unknown>) => void,
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", url, true);
      xhr.setRequestHeader("Content-Type", "application/json");

      let fullContent = "";
      let lastProcessedIndex = 0;

      xhr.onprogress = () => {
        const responseText = xhr.responseText || "";
        const newData = responseText.substring(lastProcessedIndex);
        lastProcessedIndex = responseText.length;

        // 解析 SSE 事件
        const lines = newData.split("\n");
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const jsonStr = line.substring(6);
            if (jsonStr === "[DONE]") continue;
            try {
              const event = JSON.parse(jsonStr);
              if (
                event.type === "content_block_delta" &&
                event.delta?.text
              ) {
                fullContent += event.delta.text;
                sendToIframe({
                  type: "stream_delta",
                  requestId,
                  text: event.delta.text,
                });
              }
            } catch {
              // 忽略解析错误（可能是不完整的 chunk）
            }
          }
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(fullContent);
        } else if (xhr.status === 401) {
          reject(
            new Error(
              "API Key invalid. Please update in Clautero preferences.",
            ),
          );
        } else if (xhr.status === 429) {
          reject(
            new Error("Rate limited. Please wait a moment and try again."),
          );
        } else {
          reject(new Error(`API request failed: ${xhr.status}`));
        }
      };

      xhr.onerror = () =>
        reject(new Error("Connection failed. Check proxy server."));

      // 设置取消
      if (this.abortController) {
        this.abortController.signal.addEventListener("abort", () => {
          xhr.abort();
          reject(Object.assign(new Error("Aborted"), { name: "AbortError" }));
        });
      }

      xhr.send(body);
    });
  }

  cancelCurrentRequest(): void {
    this.abortController?.abort();
  }

  clearConversation(): void {
    this.messages = [];
    this.conversationId = this.generateId();
  }

  private generateId(): string {
    // Firefox 115 支持 crypto.randomUUID()
    try {
      return crypto.randomUUID();
    } catch {
      return (
        Date.now().toString(36) + Math.random().toString(36).substring(2)
      );
    }
  }

  getConversationId(): string {
    return this.conversationId;
  }

  getMessages(): ConversationMessage[] {
    return [...this.messages];
  }
}
