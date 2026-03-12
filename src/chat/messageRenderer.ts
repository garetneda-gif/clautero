export class MessageRenderer {
  private container: HTMLElement;
  private currentAssistantEl: HTMLElement | null = null;
  private currentContentEl: HTMLElement | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  addUserMessage(text: string): void {
    this.removeWelcomeScreen();

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
    this.removeWelcomeScreen();

    const msgEl = document.createElement("div");
    msgEl.className = "message message-assistant";

    const contentEl = document.createElement("div");
    contentEl.className = "message-content";

    // Thinking indicator (Claudian-style)
    const thinking = document.createElement("div");
    thinking.className = "thinking-indicator";
    thinking.textContent = "Thinking...";
    contentEl.appendChild(thinking);

    msgEl.appendChild(contentEl);
    this.container.appendChild(msgEl);
    this.currentAssistantEl = msgEl;
    this.currentContentEl = contentEl;
    this.scrollToBottom();
  }

  appendAssistantDelta(text: string): void {
    if (!this.currentContentEl) return;

    // Remove thinking indicator on first delta
    const thinking = this.currentContentEl.querySelector(".thinking-indicator");
    if (thinking) thinking.remove();

    // Simple text append (will be replaced with Markdown rendering in later step)
    const existingText = this.currentContentEl.textContent || "";
    this.currentContentEl.textContent = existingText + text;
    this.scrollToBottom();
  }

  finalizeAssistantMessage(): void {
    // Remove thinking indicator if still present (empty response)
    const thinking = this.currentContentEl?.querySelector(".thinking-indicator");
    if (thinking) thinking.remove();

    this.currentAssistantEl = null;
    this.currentContentEl = null;
  }

  /**
   * Render a restored assistant message (loaded from history)
   */
  addRestoredAssistantMessage(text: string): void {
    this.removeWelcomeScreen();

    const msgEl = document.createElement("div");
    msgEl.className = "message message-assistant";

    const contentEl = document.createElement("div");
    contentEl.className = "message-content";
    contentEl.textContent = text;

    msgEl.appendChild(contentEl);
    this.container.appendChild(msgEl);
    this.scrollToBottom();
  }

  showError(
    error: string,
    retryable: boolean,
    onRetry?: () => void,
  ): void {
    const errEl = document.createElement("div");
    errEl.className = "message message-error";
    errEl.textContent = error;

    if (retryable && onRetry) {
      const retryBtn = document.createElement("button");
      retryBtn.className = "retry-btn";
      retryBtn.textContent = "Retry";
      retryBtn.addEventListener("click", () => {
        errEl.remove();
        onRetry();
      });
      errEl.appendChild(retryBtn);
    }

    this.container.appendChild(errEl);
    this.scrollToBottom();
  }

  /**
   * Show error with countdown (429 Rate Limit scenario)
   */
  showErrorWithCountdown(
    error: string,
    seconds: number,
    onRetry: () => void,
  ): void {
    const errEl = document.createElement("div");
    errEl.className = "message message-error";

    const textSpan = document.createElement("span");
    textSpan.textContent = error;
    errEl.appendChild(textSpan);

    const countdownSpan = document.createElement("span");
    countdownSpan.className = "countdown";
    countdownSpan.textContent = ` (retry in ${seconds}s)`;
    errEl.appendChild(countdownSpan);

    this.container.appendChild(errEl);
    this.scrollToBottom();

    let remaining = seconds;
    const timer = setInterval(() => {
      remaining--;
      if (remaining <= 0) {
        clearInterval(timer);
        errEl.remove();
        onRetry();
      } else {
        countdownSpan.textContent = ` (retry in ${remaining}s)`;
      }
    }, 1000);
  }

  /**
   * Update history panel
   */
  updateHistoryPanel(
    conversations: Array<{
      id: string;
      title: string;
      updatedAt: number;
      messageCount: number;
    }>,
    onSelect: (id: string) => void,
  ): void {
    const panel = document.getElementById("history-panel");
    if (!panel) return;

    if (conversations.length === 0) {
      panel.innerHTML = '<p class="history-empty">No saved conversations</p>';
      return;
    }

    panel.innerHTML = "";
    for (const conv of conversations.slice(0, 20)) {
      const item = document.createElement("div");
      item.className = "history-item";
      item.addEventListener("click", () => onSelect(conv.id));

      const title = document.createElement("span");
      title.className = "history-title";
      title.textContent = conv.title;

      const meta = document.createElement("span");
      meta.className = "history-meta";
      const date = new Date(conv.updatedAt);
      meta.textContent = `${date.toLocaleDateString()} \u00B7 ${conv.messageCount} msgs`;

      item.appendChild(title);
      item.appendChild(meta);
      panel.appendChild(item);
    }
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
      toolEl.className = "tool-status tool-running";
      toolEl.innerHTML = "";

      const icon = document.createElement("span");
      icon.className = "tool-icon";
      icon.textContent = "\u25CF"; // filled circle, will pulse via CSS

      const nameSpan = document.createElement("span");
      nameSpan.className = "tool-name";
      nameSpan.textContent = this.escapeHtml(name);

      const dots = document.createElement("span");
      dots.textContent = "...";

      toolEl.appendChild(icon);
      toolEl.appendChild(nameSpan);
      toolEl.appendChild(dots);
    } else {
      toolEl.className = "tool-status tool-completed";
      toolEl.innerHTML = "";

      const icon = document.createElement("span");
      icon.className = "tool-icon";
      icon.textContent = "\u2713"; // checkmark

      const nameSpan = document.createElement("span");
      nameSpan.className = "tool-name";
      nameSpan.textContent = this.escapeHtml(name);

      const summarySpan = document.createElement("span");
      summarySpan.textContent = " \u2014 " + this.escapeHtml(summary || "Done");

      toolEl.appendChild(icon);
      toolEl.appendChild(nameSpan);
      toolEl.appendChild(summarySpan);
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

  private removeWelcomeScreen(): void {
    const welcome = this.container.querySelector("#welcome-screen");
    if (welcome) welcome.remove();
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
