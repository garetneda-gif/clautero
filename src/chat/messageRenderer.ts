export class MessageRenderer {
  private container: HTMLElement;
  private currentAssistantEl: HTMLElement | null = null;
  private currentContentEl: HTMLElement | null = null;
  private cursorEl: HTMLElement | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
    this.showWelcomeScreen();
  }

  private showWelcomeScreen(): void {
    const welcome = document.createElement("div");
    welcome.className = "claudian-welcome";
    welcome.id = "welcome-screen";

    // Logo SVG
    const logoEl = document.createElement("div");
    logoEl.className = "claudian-welcome-logo";
    logoEl.innerHTML = `<svg width="64" height="64" viewBox="0 0 24 24" fill="none"><path d="M12 2C12.3 8 16 11.7 22 12C16 12.3 12.3 16 12 22C11.7 16 8 12.3 2 12C8 11.7 11.7 8 12 2Z" fill="#E95D3C"/></svg>`;
    welcome.appendChild(logoEl);

    // Title
    const title = document.createElement("h2");
    title.className = "claudian-welcome-title";
    title.textContent = "Clautero";
    welcome.appendChild(title);

    // Greeting
    const greeting = document.createElement("p");
    greeting.className = "claudian-welcome-greeting";
    greeting.textContent = "AI 研究助手，由 Claude 驱动";
    welcome.appendChild(greeting);

    // Spacer
    welcome.appendChild(document.createElement("div")).className =
      "claudian-welcome-spacer";

    // Examples
    const examplesEl = document.createElement("div");
    examplesEl.className = "claudian-welcome-examples";

    const header = document.createElement("p");
    header.className = "claudian-welcome-examples-header";
    header.textContent = "试试这些：";
    examplesEl.appendChild(header);

    const list = document.createElement("ul");
    list.className = "claudian-welcome-examples-list";
    const examples = [
      "总结选中的论文",
      "分析这篇文献的方法论",
      "帮我整理参考文献",
      "提取关键发现和结论",
    ];
    for (const text of examples) {
      const li = document.createElement("li");
      li.textContent = text;
      li.addEventListener("click", () => {
        const input = document.getElementById(
          "chat-input",
        ) as HTMLTextAreaElement;
        if (input) {
          input.value = text;
          input.focus();
        }
      });
      list.appendChild(li);
    }
    examplesEl.appendChild(list);
    welcome.appendChild(examplesEl);

    this.container.appendChild(welcome);
  }

  private removeWelcomeScreen(): void {
    const welcome = this.container.querySelector("#welcome-screen");
    if (welcome) welcome.remove();
  }

  addUserMessage(text: string): void {
    this.removeWelcomeScreen();
    const msgEl = document.createElement("div");
    msgEl.className = "claudian-message claudian-message-user";
    const contentEl = document.createElement("div");
    contentEl.className = "claudian-message-content";
    contentEl.textContent = text;
    msgEl.appendChild(contentEl);
    this.container.appendChild(msgEl);
    this.scrollToBottom();
  }

  startAssistantMessage(): void {
    this.removeWelcomeScreen();
    const msgEl = document.createElement("div");
    msgEl.className = "claudian-message claudian-message-assistant";
    const contentEl = document.createElement("div");
    contentEl.className = "claudian-message-content";

    // 闪烁光标（Claudian 风格）
    this.cursorEl = document.createElement("span");
    this.cursorEl.className = "claudian-cursor";
    contentEl.appendChild(this.cursorEl);

    msgEl.appendChild(contentEl);
    this.container.appendChild(msgEl);
    this.currentAssistantEl = msgEl;
    this.currentContentEl = contentEl;
    this.scrollToBottom();
  }

  appendAssistantDelta(text: string): void {
    if (!this.currentContentEl) return;
    // 在光标前插入文本
    if (this.cursorEl) {
      const textNode = document.createTextNode(text);
      this.currentContentEl.insertBefore(textNode, this.cursorEl);
    } else {
      this.currentContentEl.appendChild(document.createTextNode(text));
    }
    this.scrollToBottom();
  }

  finalizeAssistantMessage(): void {
    // 移除光标
    if (this.cursorEl) {
      this.cursorEl.remove();
      this.cursorEl = null;
    }

    // 添加消息操作按钮（复制）
    if (this.currentAssistantEl && this.currentContentEl) {
      const contentEl = this.currentContentEl;
      const actions = document.createElement("div");
      actions.className = "claudian-message-actions";

      const copyBtn = document.createElement("button");
      copyBtn.className = "claudian-action-btn";
      copyBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"></path></svg> 复制`;
      copyBtn.addEventListener("click", () => {
        const copyText = contentEl.textContent || "";
        navigator.clipboard.writeText(copyText).catch(() => {});
        copyBtn.textContent = "已复制";
        setTimeout(() => {
          copyBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"></path></svg> 复制`;
        }, 2000);
      });
      actions.appendChild(copyBtn);
      this.currentAssistantEl.appendChild(actions);
    }

    this.currentAssistantEl = null;
    this.currentContentEl = null;
  }

  addRestoredAssistantMessage(text: string): void {
    this.removeWelcomeScreen();
    const msgEl = document.createElement("div");
    msgEl.className = "claudian-message claudian-message-assistant";
    const contentEl = document.createElement("div");
    contentEl.className = "claudian-message-content";
    contentEl.textContent = text;
    msgEl.appendChild(contentEl);
    this.container.appendChild(msgEl);
    this.scrollToBottom();
  }

  showError(error: string, retryable: boolean, onRetry?: () => void): void {
    const errEl = document.createElement("div");
    errEl.className = "claudian-message claudian-error";
    errEl.textContent = error;
    if (retryable && onRetry) {
      const retryBtn = document.createElement("button");
      retryBtn.className = "claudian-action-btn";
      retryBtn.textContent = "重试";
      retryBtn.addEventListener("click", () => {
        errEl.remove();
        onRetry();
      });
      errEl.appendChild(retryBtn);
    }
    this.container.appendChild(errEl);
    this.scrollToBottom();
  }

  showErrorWithCountdown(
    error: string,
    seconds: number,
    onRetry: () => void,
  ): void {
    const errEl = document.createElement("div");
    errEl.className = "claudian-message claudian-error";
    const textSpan = document.createElement("span");
    textSpan.textContent = error;
    errEl.appendChild(textSpan);
    const countdownSpan = document.createElement("span");
    countdownSpan.className = "countdown";
    countdownSpan.textContent = ` (${seconds}s 后重试)`;
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
        countdownSpan.textContent = ` (${remaining}s 后重试)`;
      }
    }, 1000);
  }

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
      panel.innerHTML = '<p class="claudian-history-empty">暂无对话记录</p>';
      return;
    }
    panel.innerHTML = "";
    for (const conv of conversations.slice(0, 20)) {
      const item = document.createElement("div");
      item.className = "claudian-history-item";
      item.addEventListener("click", () => onSelect(conv.id));
      const title = document.createElement("span");
      title.className = "claudian-history-title";
      title.textContent = conv.title;
      const meta = document.createElement("span");
      meta.className = "claudian-history-meta";
      const date = new Date(conv.updatedAt);
      meta.textContent = `${date.toLocaleDateString()} \u00B7 ${conv.messageCount} 条消息`;
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
      toolEl.className = "claudian-tool-status";
      toolEl.dataset.toolName = name;
      this.container.appendChild(toolEl);
    }
    if (status === "running") {
      toolEl.className = "claudian-tool-status claudian-tool-running";
      toolEl.innerHTML = "";
      const icon = document.createElement("span");
      icon.className = "claudian-tool-icon";
      icon.textContent = "\u25CF";
      const nameSpan = document.createElement("span");
      nameSpan.className = "claudian-tool-name";
      nameSpan.textContent = this.escapeHtml(name);
      toolEl.appendChild(icon);
      toolEl.appendChild(nameSpan);
      toolEl.appendChild(document.createTextNode("..."));
    } else {
      toolEl.className = "claudian-tool-status claudian-tool-completed";
      toolEl.innerHTML = "";
      const icon = document.createElement("span");
      icon.className = "claudian-tool-icon";
      icon.textContent = "\u2713";
      const nameSpan = document.createElement("span");
      nameSpan.className = "claudian-tool-name";
      nameSpan.textContent = this.escapeHtml(name);
      const summarySpan = document.createElement("span");
      summarySpan.textContent =
        " \u2014 " + this.escapeHtml(summary || "完成");
      toolEl.appendChild(icon);
      toolEl.appendChild(nameSpan);
      toolEl.appendChild(summarySpan);
    }
    this.scrollToBottom();
  }

  updateContextPreview(
    _items: Array<{ type: string; source: string; content: string }>,
  ): void {
    // 不再需要单独的 context preview 区域
  }

  clear(): void {
    this.container.innerHTML = "";
    this.currentAssistantEl = null;
    this.currentContentEl = null;
    this.cursorEl = null;
    this.showWelcomeScreen();
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
