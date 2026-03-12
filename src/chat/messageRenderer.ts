export class MessageRenderer {
  private container: HTMLElement;
  private currentAssistantEl: HTMLElement | null = null;
  private currentContentEl: HTMLElement | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  addUserMessage(text: string): void {
    const msgEl = document.createElement("div");
    msgEl.className = "message message-user";

    const contentEl = document.createElement("div");
    contentEl.className = "message-content";
    contentEl.textContent = text;

    msgEl.appendChild(contentEl);
    this.container.appendChild(msgEl);
    this.scrollToBottom();
  }

  startAssistantMessage(): void {
    const msgEl = document.createElement("div");
    msgEl.className = "message message-assistant";

    const contentEl = document.createElement("div");
    contentEl.className = "message-content";

    // 加载动画
    const loader = document.createElement("div");
    loader.className = "typing-indicator";
    loader.innerHTML = "<span></span><span></span><span></span>";
    contentEl.appendChild(loader);

    msgEl.appendChild(contentEl);
    this.container.appendChild(msgEl);
    this.currentAssistantEl = msgEl;
    this.currentContentEl = contentEl;
    this.scrollToBottom();
  }

  appendAssistantDelta(text: string): void {
    if (!this.currentContentEl) return;

    // 移除加载动画
    const loader = this.currentContentEl.querySelector(".typing-indicator");
    if (loader) loader.remove();

    // 简单文本追加（Step 3 中替换为 Markdown 渲染）
    // 为了避免 HTML 注入，使用 textContent 追加
    const existingText = this.currentContentEl.textContent || "";
    this.currentContentEl.textContent = existingText + text;
    this.scrollToBottom();
  }

  finalizeAssistantMessage(): void {
    // Step 3 中这里会做完整的 Markdown 渲染
    // 目前已经是纯文本
    const loader = this.currentContentEl?.querySelector(".typing-indicator");
    if (loader) loader.remove();

    this.currentAssistantEl = null;
    this.currentContentEl = null;
  }

  showError(error: string, retryable: boolean): void {
    const errEl = document.createElement("div");
    errEl.className = "message message-error";
    errEl.textContent = error;

    if (retryable) {
      const retryBtn = document.createElement("button");
      retryBtn.className = "retry-btn";
      retryBtn.textContent = "Retry";
      retryBtn.addEventListener("click", () => {
        // 重试逻辑由 ChatApp 处理
        errEl.remove();
      });
      errEl.appendChild(retryBtn);
    }

    this.container.appendChild(errEl);
    this.scrollToBottom();
  }

  showToolStatus(
    name: string,
    status: "running" | "completed",
    summary?: string,
  ): void {
    let toolEl = this.container.querySelector(
      `[data-tool-name="${name}"]`,
    ) as HTMLElement;

    if (!toolEl) {
      toolEl = document.createElement("div");
      toolEl.className = "tool-status";
      toolEl.dataset.toolName = name;
      this.container.appendChild(toolEl);
    }

    if (status === "running") {
      toolEl.innerHTML = `<span class="tool-icon">&#9881;</span> Using tool: ${this.escapeHtml(name)}...`;
      toolEl.classList.add("tool-running");
      toolEl.classList.remove("tool-completed");
    } else {
      toolEl.innerHTML = `<span class="tool-icon">&#10003;</span> ${this.escapeHtml(name)}: ${this.escapeHtml(summary || "Done")}`;
      toolEl.classList.remove("tool-running");
      toolEl.classList.add("tool-completed");
    }

    this.scrollToBottom();
  }

  updateContextPreview(
    items: Array<{ type: string; source: string; content: string }>,
  ): void {
    const contextBody = document.getElementById("context-body");
    if (!contextBody) return;

    if (items.length === 0) {
      contextBody.innerHTML = '<p class="context-empty">No context items</p>';
      return;
    }

    contextBody.innerHTML = items
      .map(
        (item) =>
          `<div class="context-item"><strong>${this.escapeHtml(item.source)}</strong><p>${this.escapeHtml(item.content.substring(0, 200))}...</p></div>`,
      )
      .join("");
  }

  clear(): void {
    this.container.innerHTML = "";
    this.currentAssistantEl = null;
    this.currentContentEl = null;
  }

  private scrollToBottom(): void {
    this.container.scrollTop = this.container.scrollHeight;
  }

  private escapeHtml(text: string): string {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }
}
