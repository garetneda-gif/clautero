import { ConversationManager } from "./conversationManager";

type RequestState = "IDLE" | "IN_FLIGHT" | "CANCELLING" | "ERROR";

const PROTOCOL_VERSION = 1;

export class MessageBridge {
  private nonce: string;
  private iframe: HTMLIFrameElement | null = null;
  private state: RequestState = "IDLE";
  private currentRequestId: string | null = null;
  private conversationManager: ConversationManager;
  private messageHandler: ((event: MessageEvent) => void) | null = null;

  constructor(nonce: string) {
    this.nonce = nonce;
    this.conversationManager = new ConversationManager();
  }

  attach(iframe: HTMLIFrameElement): void {
    this.iframe = iframe;
    this.messageHandler = this.handleMessage.bind(this);
    // 在 Zotero 主窗口上监听 message 事件
    const doc = iframe.ownerDocument;
    const win = doc?.defaultView;
    if (win) {
      win.addEventListener("message", this.messageHandler);
    }
  }

  detach(): void {
    if (this.iframe && this.messageHandler) {
      const doc = this.iframe.ownerDocument;
      const win = doc?.defaultView;
      if (win) {
        win.removeEventListener("message", this.messageHandler);
      }
    }
    this.iframe = null;
    this.messageHandler = null;
  }

  private handleMessage(event: MessageEvent): void {
    const data = event.data;

    // 安全校验：协议版本和 nonce
    if (!data || data.v !== PROTOCOL_VERSION || data.nonce !== this.nonce) {
      Zotero.debug("[Clautero] Rejected message: invalid version or nonce");
      return;
    }

    // event.source 校验（辅助，非硬依赖）
    if (event.source && this.iframe) {
      const iframeWindow = (this.iframe as any).contentWindow;
      if (iframeWindow && event.source !== iframeWindow) {
        Zotero.debug("[Clautero] Rejected message: source mismatch");
        return;
      }
    }

    switch (data.type) {
      case "user_message":
        this.handleUserMessage(data);
        break;
      case "cancel_request":
        this.handleCancelRequest(data);
        break;
      case "clear_conversation":
        this.handleClearConversation();
        break;
      case "get_context_preview":
        this.handleGetContextPreview();
        break;
      default:
        Zotero.debug(`[Clautero] Unknown message type: ${data.type}`);
    }
  }

  private async handleUserMessage(data: {
    requestId: string;
    text: string;
  }): Promise<void> {
    if (this.state !== "IDLE" && this.state !== "ERROR") {
      Zotero.debug("[Clautero] Rejected user_message: not in IDLE/ERROR state");
      return;
    }
    this.state = "IN_FLIGHT";
    this.currentRequestId = data.requestId;

    try {
      await this.conversationManager.handleUserMessage(
        data.text,
        data.requestId,
        (msg) => this.sendToIframe(msg),
      );
      this.state = "IDLE";
    } catch (error) {
      this.state = "ERROR";
      const errMsg = error instanceof Error ? error.message : String(error);
      this.sendToIframe({
        v: PROTOCOL_VERSION,
        nonce: this.nonce,
        type: "stream_error",
        requestId: data.requestId,
        error: errMsg,
        retryable: true,
      });
    }
    this.currentRequestId = null;
  }

  private handleCancelRequest(data: { requestId: string }): void {
    if (
      this.state === "IN_FLIGHT" &&
      this.currentRequestId === data.requestId
    ) {
      this.state = "CANCELLING";
      this.conversationManager.cancelCurrentRequest();
      // 取消完成后，handleUserMessage 的 catch/finally 会将状态重置为 IDLE
    }
  }

  private handleClearConversation(): void {
    this.conversationManager.clearConversation();
    this.state = "IDLE";
    this.currentRequestId = null;
  }

  private handleGetContextPreview(): void {
    // 将在 ContextManager 实现后补充
    this.sendToIframe({
      v: PROTOCOL_VERSION,
      nonce: this.nonce,
      type: "context_preview",
      items: [],
    });
  }

  sendToIframe(msg: Record<string, unknown>): void {
    if (!this.iframe) return;
    const iframeWindow = (this.iframe as any).contentWindow;
    if (!iframeWindow) return;

    // 确保消息携带协议版本和 nonce
    msg.nonce = this.nonce;
    msg.v = PROTOCOL_VERSION;

    // targetOrigin 在 PoC 确认后设置具体值
    // TODO: PoC P1 后替换为确切 origin
    iframeWindow.postMessage(msg, "*");
  }

  getState(): RequestState {
    return this.state;
  }

  resetState(): void {
    this.state = "IDLE";
    this.currentRequestId = null;
  }
}
