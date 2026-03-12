import { ConversationManager, ClauteroError } from "./conversationManager";

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
      case "load_history":
        this.handleLoadHistory(data);
        break;
      case "list_conversations":
        this.handleListConversations();
        break;
      case "delete_conversation":
        this.handleDeleteConversation(data);
        break;
      case "clear_all_history":
        this.handleClearAllHistory();
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

      const clauteroErr = error as Partial<ClauteroError>;
      const errMsg = error instanceof Error ? error.message : String(error);
      const retryable = clauteroErr.retryable !== false;

      Zotero.debug(`[Clautero] Request error: ${errMsg}`);

      this.sendToIframe({
        type: "stream_error",
        requestId: data.requestId,
        error: errMsg,
        retryable,
        retryAfterSeconds: clauteroErr.retryAfterSeconds,
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
    }
  }

  private handleClearConversation(): void {
    this.conversationManager.clearConversation();
    this.state = "IDLE";
    this.currentRequestId = null;
  }

  private handleGetContextPreview(): void {
    this.sendToIframe({
      type: "context_preview",
      items: [],
    });
  }

  private async handleLoadHistory(data: {
    conversationId: string;
  }): Promise<void> {
    try {
      const conv = await this.conversationManager.loadConversation(
        data.conversationId,
      );
      this.sendToIframe({
        type: "history_loaded",
        conversation: conv,
      });
    } catch (e) {
      Zotero.debug(`[Clautero] Failed to load history: ${e}`);
      this.sendToIframe({
        type: "history_loaded",
        conversation: null,
      });
    }
  }

  private async handleListConversations(): Promise<void> {
    try {
      const list = await this.conversationManager.listConversations();
      this.sendToIframe({
        type: "conversation_list",
        conversations: list,
      });
    } catch (e) {
      Zotero.debug(`[Clautero] Failed to list conversations: ${e}`);
      this.sendToIframe({
        type: "conversation_list",
        conversations: [],
      });
    }
  }

  private async handleDeleteConversation(data: {
    conversationId: string;
  }): Promise<void> {
    try {
      await this.conversationManager.deleteConversation(data.conversationId);
      this.handleListConversations();
    } catch (e) {
      Zotero.debug(`[Clautero] Failed to delete conversation: ${e}`);
    }
  }

  private async handleClearAllHistory(): Promise<void> {
    try {
      await this.conversationManager.clearAllHistory();
      this.sendToIframe({
        type: "conversation_list",
        conversations: [],
      });
    } catch (e) {
      Zotero.debug(`[Clautero] Failed to clear history: ${e}`);
    }
  }

  sendToIframe(msg: Record<string, unknown>): void {
    if (!this.iframe) return;
    const iframeWindow = (this.iframe as any).contentWindow;
    if (!iframeWindow) return;

    msg.nonce = this.nonce;
    msg.v = PROTOCOL_VERSION;

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
