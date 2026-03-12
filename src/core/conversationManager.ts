import {
  ConversationStorage,
  StoredConversation,
  StoredMessage,
} from "./conversationStorage";
import { ClaudeCodeService } from "../services/claude/claudeCodeService";

interface ConversationMessage {
  role: "user" | "assistant";
  content: string | Array<{ type: string; text?: string }>;
}

/** 分类错误类型，用于 UI 展示和重试逻辑 */
export interface ClauteroError {
  message: string;
  retryable: boolean;
  retryAfterSeconds?: number;
}

type BackendMode = "claude-code" | "api";

export class ConversationManager {
  private conversationId: string;
  private messages: ConversationMessage[] = [];
  private systemPrompt: string;
  private storage: ConversationStorage;
  private claudeCode: ClaudeCodeService;
  private mode: BackendMode = "claude-code";

  // 用于取消
  private cancelRequested = false;

  constructor() {
    this.conversationId = this.generateId();
    this.storage = new ConversationStorage();
    this.claudeCode = new ClaudeCodeService();
    this.systemPrompt = `You are Clautero, an AI research assistant embedded in Zotero. You help researchers analyze literature, summarize papers, extract insights, and manage their knowledge base. Be concise, accurate, and cite sources when available. Respond in the same language as the user's message.`;
  }

  async handleUserMessage(
    text: string,
    requestId: string,
    sendToIframe: (msg: Record<string, unknown>) => void,
  ): Promise<void> {
    this.messages.push({ role: "user", content: text });
    this.cancelRequested = false;

    try {
      const model =
        (Zotero.Prefs.get("extensions.clautero.model", true) as string) ||
        "claude-sonnet-4-6";

      // 优先使用 Claude Code CLI
      if (this.mode === "claude-code") {
        await this.handleViaClaudeCode(text, requestId, sendToIframe, model);
      } else {
        await this.handleViaAPI(text, requestId, sendToIframe, model);
      }

      // 异步持久化
      this.persistConversation().catch((e) =>
        Zotero.debug(`[Clautero] Persist failed: ${e}`),
      );
    } catch (error) {
      if ((error as { name?: string })?.name === "AbortError") {
        return;
      }
      throw error;
    }
  }

  /**
   * 通过 Claude Code CLI 处理消息（默认模式，无需 API Key）
   */
  private async handleViaClaudeCode(
    text: string,
    requestId: string,
    sendToIframe: (msg: Record<string, unknown>) => void,
    model: string,
  ): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      let assistantContent = "";

      this.claudeCode.sendMessage(text, {
        onTextDelta: (delta) => {
          if (this.cancelRequested) return;
          assistantContent += delta;
          sendToIframe({
            type: "stream_delta",
            requestId,
            text: delta,
          });
        },
        onThinking: (thinking) => {
          if (this.cancelRequested) return;
          sendToIframe({
            type: "thinking",
            requestId,
            text: thinking,
          });
        },
        onToolStart: (id, name) => {
          if (this.cancelRequested) return;
          sendToIframe({
            type: "tool_start",
            requestId,
            toolCallId: id,
            name,
          });
        },
        onToolResult: (id, name, result) => {
          if (this.cancelRequested) return;
          sendToIframe({
            type: "tool_result",
            requestId,
            toolCallId: id,
            name,
            summary: result.substring(0, 200),
          });
        },
        onComplete: (fullText) => {
          if (fullText) {
            this.messages.push({ role: "assistant", content: fullText });
          }
          sendToIframe({ type: "stream_end", requestId });
          resolve();
        },
        onError: (errorMsg) => {
          Zotero.debug(`[Clautero] Claude Code error: ${errorMsg}`);

          // 如果 Claude Code 不可用，自动回退到 API 模式
          if (
            errorMsg.includes("ENOENT") ||
            errorMsg.includes("not found") ||
            errorMsg.includes("No such file")
          ) {
            Zotero.debug("[Clautero] Claude Code not found, falling back to API mode");
            this.mode = "api";
            // 重新尝试用 API 模式
            this.handleViaAPI(text, requestId, sendToIframe, model)
              .then(resolve)
              .catch(reject);
            return;
          }

          reject(
            this.createError(errorMsg, true),
          );
        },
      }, {
        model,
        systemPrompt: this.systemPrompt,
        maxTurns: 5,
      }).catch(reject);
    });
  }

  /**
   * 通过 API 代理处理消息（回退模式，需要 API Key）
   */
  private async handleViaAPI(
    text: string,
    requestId: string,
    sendToIframe: (msg: Record<string, unknown>) => void,
    model: string,
  ): Promise<void> {
    const apiKey = Zotero.Prefs.get(
      "extensions.clautero.apiKey",
      true,
    ) as string;
    const proxyPort =
      (Zotero.Prefs.get(
        "extensions.clautero.proxyPort",
        true,
      ) as number) || 8317;

    if (!apiKey) {
      throw this.createError(
        "Claude Code not available and API Key not configured. Please install Claude Code CLI or set API Key in preferences.",
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
      apiKey,
      requestId,
      sendToIframe,
    );

    if (assistantContent) {
      this.messages.push({ role: "assistant", content: assistantContent });
    }

    sendToIframe({ type: "stream_end", requestId });
  }

  private streamRequest(
    url: string,
    body: string,
    apiKey: string,
    requestId: string,
    sendToIframe: (msg: Record<string, unknown>) => void,
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", url, true);
      xhr.setRequestHeader("Content-Type", "application/json");
      xhr.setRequestHeader("x-api-key", apiKey);
      xhr.setRequestHeader("anthropic-version", "2023-06-01");

      let fullContent = "";
      let lastProcessedIndex = 0;

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
              // 忽略不完整 chunk
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
              "API Key invalid. Please update in Clautero preferences.",
              false,
            ),
          );
        } else if (xhr.status === 429) {
          reject(
            this.createError("Rate limited. Please wait and try again.", true),
          );
        } else {
          reject(
            this.createError(`API error: ${xhr.status}`, true),
          );
        }
      };

      xhr.onerror = () => {
        if (fullContent) {
          resolve(fullContent);
        } else {
          reject(
            this.createError("Connection failed. Check proxy server.", true),
          );
        }
      };

      xhr.send(body);
    });
  }

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
    this.cancelRequested = true;
    this.claudeCode.cancel();
  }

  clearConversation(): void {
    this.messages = [];
    this.conversationId = this.generateId();
  }

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

  async listConversations(): Promise<
    Array<{ id: string; title: string; updatedAt: number; messageCount: number }>
  > {
    return this.storage.listConversations();
  }

  async deleteConversation(conversationId: string): Promise<void> {
    await this.storage.deleteConversation(conversationId);
    if (conversationId === this.conversationId) {
      this.clearConversation();
    }
  }

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

  getMode(): BackendMode {
    return this.mode;
  }
}
