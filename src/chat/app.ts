import { MessageRenderer } from "./messageRenderer";
import { InputHandler } from "./inputHandler";

// 从 URL query 获取 nonce
const params = new URLSearchParams(window.location.search);
const NONCE = params.get("nonce") || "";
const PROTOCOL_VERSION = 1;

interface Message {
  role: "user" | "assistant";
  content: string;
  toolCalls?: Array<{ name: string; status: string }>;
}

class ChatApp {
  private messages: Message[] = [];
  private renderer: MessageRenderer;
  private inputHandler: InputHandler;
  private currentRequestId: string | null = null;
  private currentAssistantContent = "";

  constructor() {
    this.renderer = new MessageRenderer(
      document.getElementById("message-list")!,
    );
    this.inputHandler = new InputHandler(
      document.getElementById("chat-input") as HTMLTextAreaElement,
      document.getElementById("send-btn") as HTMLButtonElement,
      document.getElementById("cancel-btn") as HTMLButtonElement,
    );

    this.setupEventListeners();
    this.setupMessageListener();
  }

  private setupEventListeners(): void {
    this.inputHandler.onSend((text) => this.sendMessage(text));
    this.inputHandler.onCancel(() => this.cancelRequest());

    const newChatBtn = document.getElementById("new-chat-btn");
    if (newChatBtn) {
      newChatBtn.addEventListener("click", () => this.clearConversation());
    }

    // 上下文预览折叠
    const contextToggle = document.getElementById("context-toggle");
    const contextBody = document.getElementById("context-body");
    if (contextToggle && contextBody) {
      contextToggle.addEventListener("click", () => {
        contextBody.classList.toggle("collapsed");
        contextToggle.classList.toggle("expanded");
      });
    }
  }

  private setupMessageListener(): void {
    window.addEventListener("message", (event) => {
      const data = event.data;
      if (!data || data.v !== PROTOCOL_VERSION || data.nonce !== NONCE) return;
      // 只接受 parent 窗口的消息
      if (event.source !== window.parent) return;

      switch (data.type) {
        case "stream_delta":
          this.handleStreamDelta(data);
          break;
        case "stream_end":
          this.handleStreamEnd(data);
          break;
        case "stream_error":
          this.handleStreamError(data);
          break;
        case "tool_start":
          this.handleToolStart(data);
          break;
        case "tool_result":
          this.handleToolResult(data);
          break;
        case "context_preview":
          this.handleContextPreview(data);
          break;
        case "context_updated":
          this.handleContextUpdated(data);
          break;
      }
    });
  }

  private sendMessage(text: string): void {
    if (!text.trim()) return;

    this.currentRequestId = this.generateId();
    this.currentAssistantContent = "";

    // 添加用户消息
    this.messages.push({ role: "user", content: text });
    this.renderer.addUserMessage(text);

    // 发送给主进程
    this.postToMain({
      type: "user_message",
      requestId: this.currentRequestId,
      text,
    });

    // 切换到流式状态
    this.inputHandler.setStreamingState(true);
    this.renderer.startAssistantMessage();
  }

  private cancelRequest(): void {
    if (this.currentRequestId) {
      this.postToMain({
        type: "cancel_request",
        requestId: this.currentRequestId,
      });
    }
    this.inputHandler.setStreamingState(false);
    this.currentRequestId = null;
  }

  private clearConversation(): void {
    this.postToMain({ type: "clear_conversation" });
    this.messages = [];
    this.renderer.clear();
    this.currentRequestId = null;
    this.currentAssistantContent = "";
    this.inputHandler.setStreamingState(false);
  }

  private handleStreamDelta(data: {
    requestId: string;
    text: string;
  }): void {
    if (data.requestId !== this.currentRequestId) return;
    this.currentAssistantContent += data.text;
    this.renderer.appendAssistantDelta(data.text);
  }

  private handleStreamEnd(data: { requestId: string }): void {
    if (data.requestId !== this.currentRequestId) return;
    this.messages.push({
      role: "assistant",
      content: this.currentAssistantContent,
    });
    this.renderer.finalizeAssistantMessage();
    this.inputHandler.setStreamingState(false);
    this.currentRequestId = null;
  }

  private handleStreamError(data: {
    requestId: string;
    error: string;
    retryable: boolean;
  }): void {
    if (data.requestId !== this.currentRequestId) return;
    this.renderer.showError(data.error, data.retryable);
    this.inputHandler.setStreamingState(false);
    this.currentRequestId = null;
  }

  private handleToolStart(data: {
    requestId: string;
    toolCallId: string;
    name: string;
  }): void {
    if (data.requestId !== this.currentRequestId) return;
    this.renderer.showToolStatus(data.name, "running");
  }

  private handleToolResult(data: {
    requestId: string;
    toolCallId: string;
    name: string;
    summary: string;
  }): void {
    if (data.requestId !== this.currentRequestId) return;
    this.renderer.showToolStatus(data.name, "completed", data.summary);
  }

  private handleContextPreview(data: {
    items: Array<{ type: string; source: string; content: string }>;
  }): void {
    this.renderer.updateContextPreview(data.items);
  }

  private handleContextUpdated(data: { summary: string }): void {
    const badge = document.getElementById("context-badge");
    if (badge) badge.textContent = data.summary;
  }

  private postToMain(msg: Record<string, unknown>): void {
    window.parent.postMessage(
      { v: PROTOCOL_VERSION, nonce: NONCE, ...msg },
      "*", // TODO: 在 PoC 后替换为确切 origin
    );
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
}

// 初始化
document.addEventListener("DOMContentLoaded", () => {
  new ChatApp();
});
