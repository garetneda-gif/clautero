import {
  ConversationStorage,
  StoredConversation,
  StoredMessage,
} from "./conversationStorage";

interface ConversationMessage {
  role: "user" | "assistant";
  content: string | Array<{ type: string; text?: string }>;
}

/** 分类错误类型，用于 UI 展示和重试逻辑 */
export interface ClauteroError {
  message: string;
  retryable: boolean;
  /** 429 时的重试等待秒数 */
  retryAfterSeconds?: number;
}

export class ConversationManager {
  private conversationId: string;
  private messages: ConversationMessage[] = [];
  private abortController: AbortController | null = null;
  private systemPrompt: string;
  private storage: ConversationStorage;

  constructor() {
    this.conversationId = this.generateId();
    this.storage = new ConversationStorage();
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
        throw this.createError(
          "API Key not configured. Please set it in Clautero preferences.",
          false,
        );
      }

      const url = `http://127.0.0.1:${proxyPort}/v1/messages`;
      const body = JSON.stringify({
        model,
        max_tokens: 4096,
        system: this.systemPrompt,
        messages: this.messages,
        stream: true,
      });

      const assistantContent = await this.streamRequest(
        url,
        body,
        requestId,
        sendToIframe,
      );

      if (assistantContent) {
        this.messages.push({ role: "assistant", content: assistantContent });
      }

      sendToIframe({ type: "stream_end", requestId });

      // 异步持久化，不阻塞响应
      this.persistConversation().catch((e) =>
        Zotero.debug(`[Clautero] Persist failed: ${e}`),
      );
    } catch (error) {
      if ((error as { name?: string })?.name === "AbortError") {
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
      let retryAttempted = false;

      xhr.onprogress = () => {
        const responseText = xhr.responseText || "";
        const newData = responseText.substring(lastProcessedIndex);
        lastProcessedIndex = responseText.length;

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
              // 忽略不完整 chunk 的解析错误
            }
          }
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(fullContent);
        } else if (xhr.status === 401) {
          reject(
            this.createError(
              "API Key invalid or expired. Please update in Clautero preferences.",
              false,
            ),
          );
        } else if (xhr.status === 429) {
          const retryAfter = this.parseRetryAfter(xhr);

          if (!retryAttempted) {
            retryAttempted = true;
            const waitMs = retryAfter
              ? retryAfter * 1000
              : 2000; // 默认 2s

            Zotero.debug(
              `[Clautero] Rate limited, retrying after ${waitMs}ms`,
            );

            // 通知 iframe 正在等待重试
            sendToIframe({
              type: "stream_delta",
              requestId,
              text: `\n\n[Rate limited, retrying in ${Math.ceil(waitMs / 1000)}s...]\n\n`,
            });

            setTimeout(() => {
              // 重试一次
              const retryXhr = new XMLHttpRequest();
              retryXhr.open("POST", url, true);
              retryXhr.setRequestHeader("Content-Type", "application/json");

              retryXhr.onprogress = xhr.onprogress;
              retryXhr.onload = () => {
                if (retryXhr.status >= 200 && retryXhr.status < 300) {
                  resolve(fullContent);
                } else {
                  const err = this.createError(
                    `Rate limited (429). Please wait and try again.`,
                    true,
                    retryAfter || undefined,
                  );
                  reject(err);
                }
              };
              retryXhr.onerror = () =>
                reject(
                  this.createError(
                    "Connection failed during retry.",
                    true,
                  ),
                );

              if (this.abortController) {
                this.abortController.signal.addEventListener("abort", () => {
                  retryXhr.abort();
                  reject(
                    Object.assign(new Error("Aborted"), { name: "AbortError" }),
                  );
                });
              }

              retryXhr.send(body);
            }, waitMs);
          } else {
            reject(
              this.createError(
                `Rate limited (429). Please wait ${retryAfter || "a moment"} seconds and try again.`,
                true,
                retryAfter || undefined,
              ),
            );
          }
        } else if (xhr.status === 500 || xhr.status === 502 || xhr.status === 503) {
          reject(
            this.createError(
              `Claude API server error (${xhr.status}). Please try again later.`,
              true,
            ),
          );
        } else {
          reject(
            this.createError(`API request failed: ${xhr.status}`, true),
          );
        }
      };

      xhr.onerror = () => {
        // 连接失败：代理服务器未启动或网络断开
        if (fullContent) {
          // 已接收到部分内容，保存并通知
          Zotero.debug(
            "[Clautero] Stream disconnected with partial content",
          );
          resolve(fullContent);
        } else {
          reject(
            this.createError(
              "Connection failed. Please check that Clautero proxy is running.",
              true,
            ),
          );
        }
      };

      if (this.abortController) {
        this.abortController.signal.addEventListener("abort", () => {
          xhr.abort();
          reject(
            Object.assign(new Error("Aborted"), { name: "AbortError" }),
          );
        });
      }

      xhr.send(body);
    });
  }

  /**
   * 解析 Retry-After 响应头
   */
  private parseRetryAfter(xhr: XMLHttpRequest): number | null {
    try {
      const header = xhr.getResponseHeader("Retry-After");
      if (!header) return null;
      const seconds = parseInt(header, 10);
      return isNaN(seconds) ? null : seconds;
    } catch {
      return null;
    }
  }

  /**
   * 创建分类错误
   */
  private createError(
    message: string,
    retryable: boolean,
    retryAfterSeconds?: number,
  ): Error & ClauteroError {
    const err = new Error(message) as Error & ClauteroError;
    err.retryable = retryable;
    if (retryAfterSeconds !== undefined) {
      err.retryAfterSeconds = retryAfterSeconds;
    }
    return err;
  }

  cancelCurrentRequest(): void {
    this.abortController?.abort();
  }

  clearConversation(): void {
    this.messages = [];
    this.conversationId = this.generateId();
  }

  /**
   * 将当前对话持久化到磁盘
   */
  async persistConversation(): Promise<void> {
    if (this.messages.length === 0) return;

    const storedMessages: StoredMessage[] = this.messages.map((m) => ({
      role: m.role,
      content: typeof m.content === "string" ? m.content : JSON.stringify(m.content),
      timestamp: Date.now(),
    }));

    const conversation: StoredConversation = {
      id: this.conversationId,
      title: ConversationStorage.generateTitle(storedMessages),
      createdAt: storedMessages[0]?.timestamp || Date.now(),
      updatedAt: Date.now(),
      messages: storedMessages,
    };

    await this.storage.save(conversation);
  }

  /**
   * 从磁盘加载对话历史
   */
  async loadConversation(
    conversationId: string,
  ): Promise<StoredConversation | null> {
    const conv = await this.storage.load(conversationId);
    if (conv) {
      this.conversationId = conv.id;
      this.messages = conv.messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));
    }
    return conv;
  }

  /**
   * 列出所有已保存的对话
   */
  async listConversations(): Promise<
    Array<{ id: string; title: string; updatedAt: number; messageCount: number }>
  > {
    return this.storage.listConversations();
  }

  /**
   * 删除指定对话
   */
  async deleteConversation(conversationId: string): Promise<void> {
    await this.storage.deleteConversation(conversationId);
    // 如果删除的是当前对话，重置
    if (conversationId === this.conversationId) {
      this.clearConversation();
    }
  }

  /**
   * 清除所有对话历史
   */
  async clearAllHistory(): Promise<void> {
    await this.storage.clearAll();
    this.clearConversation();
  }

  private generateId(): string {
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
