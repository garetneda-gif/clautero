import { marked } from "marked";

const CLAUDE_LOGO_SVG = `<svg width="18" height="18" viewBox="0 -.01 39.5 39.53" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="m7.75 26.27 7.77-4.36.13-.38-.13-.21h-.38l-1.3-.08-4.44-.12-3.85-.16-3.73-.2-.94-.2-.88-1.16.09-.58.79-.53 1.13.1 2.5.17 3.75.26 2.72.16 4.03.42h.64l.09-.26-.22-.16-.17-.16-3.88-2.63-4.2-2.78-2.2-1.6-1.19-.81-.6-.76-.26-1.66 1.08-1.19 1.45.1.37.1 1.47 1.13 3.14 2.43 4.1 3.02.6.5.24-.17.03-.12-.27-.45-2.23-4.03-2.38-4.1-1.06-1.7-.28-1.02c-.1-.42-.17-.77-.17-1.2l1.23-1.67.68-.22 1.64.22.69.6 1.02 2.33 1.65 3.67 2.56 4.99.75 1.48.4 1.37.15.42h.26v-.24l.21-2.81.39-3.45.38-4.44.13-1.25.62-1.5 1.23-.81.96.46.79 1.13-.11.73-.47 3.05-.92 4.78-.6 3.2h.35l.4-.4 1.62-2.15 2.72-3.4 1.2-1.35 1.4-1.49.9-.71h1.7l1.25 1.86-.56 1.92-1.75 2.22-1.45 1.88-2.08 2.8-1.3 2.24.12.18.31-.03 4.7-1 2.54-.46 3.03-.52 1.37.64.15.65-.54 1.33-3.24.8-3.8.76-5.66 1.34-.07.05.08.1 2.55.24 1.09.06h2.67l4.97.37 1.3.86.78 1.05-.13.8-2 1.02-2.7-.64-6.3-1.5-2.16-.54h-.3v.18l1.8 1.76 3.3 2.98 4.13 3.84.21.95-.53.75-.56-.08-3.63-2.73-1.4-1.23-3.17-2.67h-.21v.28l.73 1.07 3.86 5.8.2 1.78-.28.58-1 .35-1.1-.2-2.26-3.17-2.33-3.57-1.88-3.2-.23.13-1.11 11.95-.52.61-1.2.46-1-.76-.53-1.23.53-2.43.64-3.17.52-2.52.47-3.13.28-1.04-.02-.07-.23.03-2.36 3.24-3.59 4.85-2.84 3.04-.68.27-1.18-.61.11-1.09.66-.97 3.93-5 2.37-3.1 1.53-1.79-.01-.26h-.09l-10.44 6.78-1.86.24-.8-.75.1-1.23.38-.4 3.14-2.16z" fill="#d97757"/></svg>`;

export class MessageRenderer {
  private container: HTMLElement;
  private currentAssistantEl: HTMLElement | null = null;
  private currentContentEl: HTMLElement | null = null;
  private cursorEl: HTMLElement | null = null;
  private thinkingEl: HTMLElement | null = null;
  private currentAssistantRawText = "";

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
    logoEl.innerHTML = CLAUDE_LOGO_SVG;
    welcome.appendChild(logoEl);

    // Title
    const title = document.createElement("h2");
    title.className = "claudian-welcome-title";
    title.textContent = "Clautero";
    welcome.appendChild(title);

    // Greeting
    const greeting = document.createElement("p");
    greeting.className = "claudian-welcome-greeting";
    greeting.textContent = "Ask Clautero anything";
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

    this.thinkingEl = document.createElement("div");
    this.thinkingEl.className = "claudian-thinking";
    this.thinkingEl.textContent = "Thinking...";
    contentEl.appendChild(this.thinkingEl);

    msgEl.appendChild(contentEl);
    this.container.appendChild(msgEl);
    this.currentAssistantEl = msgEl;
    this.currentContentEl = contentEl;
    this.currentAssistantRawText = "";
    this.scrollToBottom();
  }

  appendAssistantDelta(text: string): void {
    if (!this.currentContentEl) return;
    this.currentAssistantRawText += text;
    if (this.thinkingEl) {
      this.thinkingEl.remove();
      this.thinkingEl = null;
    }
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
    if (this.thinkingEl) {
      this.thinkingEl.remove();
      this.thinkingEl = null;
    }

    // 添加消息操作按钮（复制）
    if (this.currentAssistantEl && this.currentContentEl) {
      const contentEl = this.currentContentEl;
      const rawText =
        this.currentAssistantRawText || contentEl.textContent || "";

      this.renderAssistantMarkdown(contentEl, rawText);

      const actions = document.createElement("div");
      actions.className = "claudian-message-actions";

      const copyBtn = document.createElement("button");
      copyBtn.className = "claudian-action-btn";
      copyBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"></path></svg> 复制`;
      copyBtn.addEventListener("click", () => {
        const copyText =
          contentEl.dataset.rawText || contentEl.textContent || "";
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
    this.currentAssistantRawText = "";
  }

  addRestoredAssistantMessage(text: string): void {
    this.removeWelcomeScreen();
    const msgEl = document.createElement("div");
    msgEl.className = "claudian-message claudian-message-assistant";
    const contentEl = document.createElement("div");
    contentEl.className = "claudian-message-content";
    this.renderAssistantMarkdown(contentEl, text);
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
      summarySpan.textContent = " \u2014 " + this.escapeHtml(summary || "完成");
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

  private renderAssistantMarkdown(contentEl: HTMLElement, text: string): void {
    contentEl.dataset.rawText = text;
    const html = marked.parse(text, {
      breaks: true,
      gfm: true,
    }) as string;
    contentEl.innerHTML = this.sanitizeRenderedHtml(html);

    for (const link of contentEl.querySelectorAll("a")) {
      link.setAttribute("target", "_blank");
      link.setAttribute("rel", "noopener noreferrer");
    }
  }

  updateAssistantThinking(text: string): void {
    if (!this.currentContentEl) return;
    if (!this.thinkingEl) {
      this.thinkingEl = document.createElement("div");
      this.thinkingEl.className = "claudian-thinking";
      this.currentContentEl.prepend(this.thinkingEl);
    }
    this.thinkingEl.textContent = text || "Thinking...";
  }

  private sanitizeRenderedHtml(html: string): string {
    const template = document.createElement("template");
    template.innerHTML = html;

    for (const element of template.content.querySelectorAll(
      "script,style,iframe,object,embed,link,meta",
    )) {
      element.remove();
    }

    for (const element of template.content.querySelectorAll("*")) {
      for (const attribute of [...element.attributes]) {
        const attributeName = attribute.name.toLowerCase();
        const attributeValue = attribute.value.trim();

        if (attributeName.startsWith("on")) {
          element.removeAttribute(attribute.name);
          continue;
        }

        if (attributeName === "href" || attributeName === "src") {
          const isAllowed = /^(https?:|mailto:|zotero:|#|\/)/i.test(
            attributeValue,
          );
          if (!isAllowed) {
            element.removeAttribute(attribute.name);
          }
        }
      }
    }

    return template.innerHTML;
  }
}
