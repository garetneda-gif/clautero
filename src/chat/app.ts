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

interface ConversationSummary {
  id: string;
  title: string;
  updatedAt: number;
  messageCount: number;
}

interface SlashCommand {
  name: string;
  desc: string;
}

const SLASH_COMMANDS: SlashCommand[] = [
  { name: "/summarize", desc: "总结选中的论文" },
  { name: "/analyze", desc: "分析论文方法论和结论" },
  { name: "/cite", desc: "生成引用格式" },
  { name: "/compare", desc: "比较多篇论文" },
  { name: "/extract", desc: "提取关键数据和发现" },
  { name: "/translate", desc: "翻译选中内容" },
  { name: "/notes", desc: "整理研究笔记" },
  { name: "/review", desc: "文献综述助手" },
];

class ChatApp {
  private messages: Message[] = [];
  private renderer: MessageRenderer;
  private inputHandler: InputHandler;
  private currentRequestId: string | null = null;
  private currentAssistantContent = "";
  private lastUserText = "";

  private textarea: HTMLTextAreaElement;
  private sendBtn: HTMLButtonElement;
  private slashPopup: HTMLElement | null = null;
  private slashSelectedIndex = 0;
  private filteredCommands: SlashCommand[] = [];

  constructor() {
    this.textarea = document.getElementById(
      "chat-input",
    ) as HTMLTextAreaElement;
    this.sendBtn = document.getElementById("send-btn") as HTMLButtonElement;

    this.renderer = new MessageRenderer(
      document.getElementById("message-list")!,
    );
    this.inputHandler = new InputHandler(this.textarea, this.sendBtn);

    this.setupEventListeners();
    this.setupMessageListener();
    this.setupSlashCommands();
    this.setupResizeHandle();

    // 启动时请求对话列表
    this.postToMain({ type: "list_conversations" });
  }

  private setupEventListeners(): void {
    this.inputHandler.onSend((text) => this.sendMessage(text));
    this.inputHandler.onCancel(() => this.cancelRequest());

    const newChatBtn = document.getElementById("new-chat-btn");
    if (newChatBtn) {
      newChatBtn.addEventListener("click", () => this.clearConversation());
    }
  }

  // ── 斜杠命令 ──────────────────────────────────────────

  private setupSlashCommands(): void {
    this.textarea.addEventListener("input", () => this.onSlashInput());
    this.textarea.addEventListener("keydown", (e) => this.onSlashKeydown(e));
    this.textarea.addEventListener("blur", () => {
      // 延迟关闭，以便点击事件能先触发
      setTimeout(() => this.dismissSlashPopup(), 150);
    });
  }

  private onSlashInput(): void {
    const value = this.textarea.value;
    if (value.startsWith("/")) {
      const query = value.slice(1).toLowerCase();
      this.filteredCommands = SLASH_COMMANDS.filter(
        (cmd) =>
          cmd.name.toLowerCase().includes(query) ||
          cmd.desc.toLowerCase().includes(query),
      );
      if (this.filteredCommands.length > 0) {
        this.slashSelectedIndex = 0;
        this.showSlashPopup();
        return;
      }
    }
    this.dismissSlashPopup();
  }

  private onSlashKeydown(e: KeyboardEvent): void {
    if (!this.slashPopup) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      this.slashSelectedIndex = Math.min(
        this.slashSelectedIndex + 1,
        this.filteredCommands.length - 1,
      );
      this.renderSlashItems();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      this.slashSelectedIndex = Math.max(this.slashSelectedIndex - 1, 0);
      this.renderSlashItems();
    } else if (e.key === "Enter" && !e.shiftKey) {
      if (this.filteredCommands.length > 0) {
        e.preventDefault();
        e.stopPropagation();
        this.selectSlashCommand(this.slashSelectedIndex);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      this.dismissSlashPopup();
    }
  }

  private showSlashPopup(): void {
    if (!this.slashPopup) {
      this.slashPopup = document.createElement("div");
      this.slashPopup.className = "claudian-slash-popup";
      // 插入到 input-wrapper 中，定位在 textarea 上方
      const wrapper = document.getElementById("input-wrapper");
      if (wrapper) {
        wrapper.style.position = "relative";
        wrapper.appendChild(this.slashPopup);
      } else {
        document.body.appendChild(this.slashPopup);
      }
    }
    this.renderSlashItems();
    this.slashPopup.style.display = "block";
  }

  private renderSlashItems(): void {
    if (!this.slashPopup) return;
    this.slashPopup.innerHTML = "";
    this.filteredCommands.forEach((cmd, i) => {
      const item = document.createElement("div");
      item.className =
        "claudian-slash-item" +
        (i === this.slashSelectedIndex ? " claudian-slash-item-active" : "");
      const nameSpan = document.createElement("span");
      nameSpan.className = "claudian-slash-item-name";
      nameSpan.textContent = cmd.name;
      const descSpan = document.createElement("span");
      descSpan.className = "claudian-slash-item-desc";
      descSpan.textContent = cmd.desc;
      item.appendChild(nameSpan);
      item.appendChild(descSpan);
      item.addEventListener("mousedown", (e) => {
        e.preventDefault(); // 防止 blur 先触发
        this.selectSlashCommand(i);
      });
      this.slashPopup!.appendChild(item);
    });
  }

  private selectSlashCommand(index: number): void {
    const cmd = this.filteredCommands[index];
    if (!cmd) return;
    this.textarea.value = cmd.name + " ";
    this.textarea.focus();
    this.dismissSlashPopup();
  }

  private dismissSlashPopup(): void {
    if (this.slashPopup) {
      this.slashPopup.style.display = "none";
    }
  }

  // ── Resize handle ────────────────────────────────────

  private setupResizeHandle(): void {
    const handle = document.getElementById("resize-handle");
    const wrapper = document.getElementById("input-wrapper");
    if (!handle || !wrapper) return;

    let startY = 0;
    let startHeight = 0;

    handle.addEventListener("mousedown", (e: MouseEvent) => {
      startY = e.clientY;
      startHeight = wrapper.offsetHeight;
      const onMove = (ev: MouseEvent) => {
        const delta = startY - ev.clientY;
        wrapper.style.height =
          Math.max(90, Math.min(300, startHeight + delta)) + "px";
      };
      const onUp = () => {
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
      };
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    });
  }

  // ── 发送按钮状态切换（委托给 InputHandler）──────────

  private setStreamingUI(streaming: boolean): void {
    this.inputHandler.setStreamingState(streaming);
  }

  // ── 消息逻辑 ─────────────────────────────────────────

  private setupMessageListener(): void {
    window.addEventListener("message", (event) => {
      const data = event.data;
      if (!data || data.v !== PROTOCOL_VERSION || data.nonce !== NONCE) return;
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
        case "thinking":
          this.handleThinking(data);
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
        case "history_loaded":
          this.handleHistoryLoaded(data);
          break;
        case "conversation_list":
          this.handleConversationList(data);
          break;
      }
    });
  }

  private sendMessage(text: string): void {
    if (!text.trim()) return;

    this.currentRequestId = this.generateId();
    this.currentAssistantContent = "";
    this.lastUserText = text;

    this.messages.push({ role: "user", content: text });
    this.renderer.addUserMessage(text);

    this.postToMain({
      type: "user_message",
      requestId: this.currentRequestId,
      text,
    });

    this.setStreamingUI(true);
    this.renderer.startAssistantMessage();
  }

  private cancelRequest(): void {
    if (this.currentRequestId) {
      this.postToMain({
        type: "cancel_request",
        requestId: this.currentRequestId,
      });
    }
    this.renderer.finalizeAssistantMessage();
    this.setStreamingUI(false);
    this.currentRequestId = null;
  }

  private clearConversation(): void {
    this.postToMain({ type: "clear_conversation" });
    this.messages = [];
    this.renderer.clear();
    this.currentRequestId = null;
    this.currentAssistantContent = "";
    this.lastUserText = "";
    this.setStreamingUI(false);
  }

  private handleStreamDelta(data: { requestId: string; text: string }): void {
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
    this.setStreamingUI(false);
    this.currentRequestId = null;
  }

  private handleStreamError(data: {
    requestId: string;
    error: string;
    retryable: boolean;
    retryAfterSeconds?: number;
  }): void {
    if (data.requestId !== this.currentRequestId) return;

    this.renderer.finalizeAssistantMessage();

    if (data.retryAfterSeconds && data.retryAfterSeconds > 0) {
      this.renderer.showErrorWithCountdown(
        data.error,
        data.retryAfterSeconds,
        () => this.retryLastMessage(),
      );
    } else {
      this.renderer.showError(
        data.error,
        data.retryable,
        data.retryable ? () => this.retryLastMessage() : undefined,
      );
    }

    this.setStreamingUI(false);
    this.currentRequestId = null;
  }

  private retryLastMessage(): void {
    if (this.lastUserText) {
      this.currentRequestId = this.generateId();
      this.currentAssistantContent = "";

      this.postToMain({
        type: "user_message",
        requestId: this.currentRequestId,
        text: this.lastUserText,
      });

      this.setStreamingUI(true);
      this.renderer.startAssistantMessage();
    }
  }

  private handleToolStart(data: {
    requestId: string;
    toolCallId: string;
    name: string;
  }): void {
    if (data.requestId !== this.currentRequestId) return;
    this.renderer.showToolStatus(data.name, "running");
  }

  private handleThinking(data: { requestId: string; text: string }): void {
    if (data.requestId !== this.currentRequestId) return;
    this.renderer.updateAssistantThinking(data.text);
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

  private handleHistoryLoaded(data: {
    conversation: {
      id: string;
      messages: Array<{ role: string; content: string }>;
    } | null;
  }): void {
    if (!data.conversation) return;

    this.renderer.clear();
    this.messages = [];

    for (const msg of data.conversation.messages) {
      if (msg.role === "user") {
        this.messages.push({ role: "user", content: msg.content });
        this.renderer.addUserMessage(msg.content);
      } else if (msg.role === "assistant") {
        this.messages.push({ role: "assistant", content: msg.content });
        this.renderer.addRestoredAssistantMessage(msg.content);
      }
    }
  }

  private handleConversationList(data: {
    conversations: ConversationSummary[];
  }): void {
    this.renderer.updateHistoryPanel(data.conversations, (id) => {
      this.postToMain({ type: "load_history", conversationId: id });
    });
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
      return Date.now().toString(36) + Math.random().toString(36).substring(2);
    }
  }
}

// 初始化
document.addEventListener("DOMContentLoaded", () => {
  new ChatApp();
});
