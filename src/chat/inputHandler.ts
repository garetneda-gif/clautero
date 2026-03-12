export class InputHandler {
  private static readonly SEND_ICON = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2L11 13"></path><path d="M22 2L15 22L11 13L2 9L22 2Z"></path></svg>`;

  private static readonly STOP_ICON = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"></rect></svg>`;

  private textarea: HTMLTextAreaElement;
  private sendBtn: HTMLButtonElement;
  private sendCallback: ((text: string) => void) | null = null;
  private cancelCallback: (() => void) | null = null;
  private isStreaming = false;

  constructor(textarea: HTMLTextAreaElement, sendBtn: HTMLButtonElement) {
    this.textarea = textarea;
    this.sendBtn = sendBtn;
    this.setupListeners();
    this.setStreamingState(false);
  }

  private setupListeners(): void {
    this.sendBtn.addEventListener("click", () => this.handleButtonClick());

    this.textarea.addEventListener("keydown", (e) => {
      // Enter 发送，Shift+Enter 换行
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        if (this.isStreaming) {
          this.cancel();
        } else {
          this.send();
        }
      }
    });

    // 自动调整高度
    this.textarea.addEventListener("input", () => {
      this.textarea.style.height = "auto";
      this.textarea.style.height =
        Math.min(this.textarea.scrollHeight, 150) + "px";
    });
  }

  private handleButtonClick(): void {
    if (this.isStreaming) {
      this.cancel();
    } else {
      this.send();
    }
  }

  private send(): void {
    if (this.isStreaming) return;
    const text = this.textarea.value.trim();
    if (!text) return;

    this.sendCallback?.(text);
    this.textarea.value = "";
    this.textarea.style.height = "auto";
  }

  private cancel(): void {
    this.cancelCallback?.();
  }

  onSend(callback: (text: string) => void): void {
    this.sendCallback = callback;
  }

  onCancel(callback: () => void): void {
    this.cancelCallback = callback;
  }

  setStreamingState(streaming: boolean): void {
    this.isStreaming = streaming;

    if (streaming) {
      this.sendBtn.innerHTML = InputHandler.STOP_ICON;
      this.sendBtn.setAttribute("aria-label", "停止生成");
      this.sendBtn.title = "停止生成";
      this.sendBtn.classList.add("is-stop");
      this.textarea.disabled = true;
    } else {
      this.sendBtn.innerHTML = InputHandler.SEND_ICON;
      this.sendBtn.setAttribute("aria-label", "发送消息");
      this.sendBtn.title = "发送消息";
      this.sendBtn.classList.remove("is-stop");
      this.textarea.disabled = false;
      this.textarea.focus();
    }
  }
}
