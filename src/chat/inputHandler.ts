export class InputHandler {
  private textarea: HTMLTextAreaElement;
  private sendBtn: HTMLButtonElement;
  private sendCallback: ((text: string) => void) | null = null;
  private cancelCallback: (() => void) | null = null;
  private isStreaming = false;

  constructor(
    textarea: HTMLTextAreaElement,
    sendBtn: HTMLButtonElement,
  ) {
    this.textarea = textarea;
    this.sendBtn = sendBtn;
    this.setupListeners();
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
      this.sendBtn.textContent = "停止";
      this.sendBtn.classList.add("is-stop");
      this.textarea.disabled = true;
    } else {
      this.sendBtn.textContent = "发送";
      this.sendBtn.classList.remove("is-stop");
      this.textarea.disabled = false;
      this.textarea.focus();
    }
  }
}
