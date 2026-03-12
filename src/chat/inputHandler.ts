export class InputHandler {
  private textarea: HTMLTextAreaElement;
  private sendBtn: HTMLButtonElement;
  private cancelBtn: HTMLButtonElement;
  private sendCallback: ((text: string) => void) | null = null;
  private cancelCallback: (() => void) | null = null;
  private isStreaming = false;

  constructor(
    textarea: HTMLTextAreaElement,
    sendBtn: HTMLButtonElement,
    cancelBtn: HTMLButtonElement,
  ) {
    this.textarea = textarea;
    this.sendBtn = sendBtn;
    this.cancelBtn = cancelBtn;
    this.setupListeners();
  }

  private setupListeners(): void {
    this.sendBtn.addEventListener("click", () => this.send());
    this.cancelBtn.addEventListener("click", () => this.cancel());

    this.textarea.addEventListener("keydown", (e) => {
      // Enter 发送，Shift+Enter 换行
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        this.send();
      }
    });

    // 自动调整高度
    this.textarea.addEventListener("input", () => {
      this.textarea.style.height = "auto";
      this.textarea.style.height =
        Math.min(this.textarea.scrollHeight, 150) + "px";
    });
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
    this.sendBtn.style.display = streaming ? "none" : "";
    this.cancelBtn.style.display = streaming ? "" : "none";
    this.textarea.disabled = streaming;

    if (!streaming) {
      this.textarea.focus();
    }
  }
}
