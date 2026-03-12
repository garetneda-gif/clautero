/* Clautero Chat Panel — UI Controller */

(function () {
  "use strict";

  // ---- DOM References ----
  const messagesEl = document.getElementById("chat-messages");
  const welcomeEl = document.getElementById("welcome-screen");
  const inputEl = document.getElementById("chat-input");
  const btnSend = document.getElementById("btn-send");
  const btnCancel = document.getElementById("btn-cancel");
  const btnNewChat = document.getElementById("btn-new-chat");
  const contextPreview = document.getElementById("context-preview");
  const contextHeader = document.getElementById("context-header");
  const contextLabel = document.getElementById("context-label");
  const contextItems = document.getElementById("context-items");

  // ---- Auto-resize textarea ----
  inputEl.addEventListener("input", function () {
    this.style.height = "auto";
    this.style.height = Math.min(this.scrollHeight, 120) + "px";
  });

  // ---- Send on Enter (Shift+Enter for newline) ----
  inputEl.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  btnSend.addEventListener("click", sendMessage);
  btnNewChat.addEventListener("click", newConversation);
  btnCancel.addEventListener("click", cancelRequest);

  // ---- Context toggle ----
  contextHeader.addEventListener("click", function () {
    contextPreview.classList.toggle("collapsed");
    contextPreview.classList.toggle("expanded");
  });

  // ---- Public API (called from plugin code) ----
  window.clauteroChat = {
    addUserMessage,
    addAIMessage,
    addToolCall,
    updateToolCall,
    showLoading,
    hideLoading,
    showError,
    setContext,
    clearMessages,
    setStreaming,
  };

  let _streaming = false;
  let _streamBubble = null;

  function sendMessage() {
    const text = inputEl.value.trim();
    if (!text) return;

    addUserMessage(text);
    inputEl.value = "";
    inputEl.style.height = "auto";

    // Dispatch event for plugin to handle
    const event = new CustomEvent("clautero-send", { detail: { text } });
    document.dispatchEvent(event);
  }

  function cancelRequest() {
    const event = new CustomEvent("clautero-cancel");
    document.dispatchEvent(event);
    btnCancel.classList.remove("visible");
  }

  function newConversation() {
    const event = new CustomEvent("clautero-new-chat");
    document.dispatchEvent(event);
    clearMessages();
  }

  function clearMessages() {
    messagesEl.innerHTML = "";
    messagesEl.appendChild(welcomeEl);
    welcomeEl.style.display = "";
    _streaming = false;
    _streamBubble = null;
    btnCancel.classList.remove("visible");
  }

  function hideWelcome() {
    if (welcomeEl) {
      welcomeEl.style.display = "none";
    }
  }

  function addUserMessage(text) {
    hideWelcome();
    const msg = createMessageEl("user", text);
    messagesEl.appendChild(msg);
    scrollToBottom();
  }

  function addAIMessage(text) {
    hideWelcome();
    if (_streaming && _streamBubble) {
      _streamBubble.textContent = text;
    } else {
      const msg = createMessageEl("ai", text);
      messagesEl.appendChild(msg);
    }
    scrollToBottom();
  }

  function setStreaming(active) {
    _streaming = active;
    if (active) {
      btnCancel.classList.add("visible");
      hideWelcome();
      const msg = createMessageEl("ai", "");
      messagesEl.appendChild(msg);
      _streamBubble = msg.querySelector(".message-bubble");
      showLoading();
    } else {
      btnCancel.classList.remove("visible");
      _streamBubble = null;
      hideLoading();
    }
  }

  function addToolCall(id, name, status) {
    const el = document.createElement("div");
    el.className = "tool-call " + (status || "tool-running");
    el.id = "tool-" + id;
    el.innerHTML =
      '<span class="tool-call-icon">&#x2699;</span>' +
      '<span class="tool-call-name">' + escapeHtml(name) + "</span>";
    messagesEl.appendChild(el);
    scrollToBottom();
  }

  function updateToolCall(id, status) {
    const el = document.getElementById("tool-" + id);
    if (el) {
      el.className = "tool-call " + status;
    }
  }

  function showLoading() {
    if (document.getElementById("loading-indicator")) return;
    const el = document.createElement("div");
    el.id = "loading-indicator";
    el.className = "message message-ai";
    el.innerHTML =
      '<div class="loading-dots"><span></span><span></span><span></span></div>';
    messagesEl.appendChild(el);
    scrollToBottom();
  }

  function hideLoading() {
    const el = document.getElementById("loading-indicator");
    if (el) el.remove();
  }

  function showError(text) {
    hideLoading();
    const msg = document.createElement("div");
    msg.className = "message message-ai message-error";
    msg.innerHTML =
      '<div class="message-bubble">' + escapeHtml(text) + "</div>";
    messagesEl.appendChild(msg);
    scrollToBottom();
  }

  function setContext(items) {
    if (!items || items.length === 0) {
      contextPreview.classList.add("context-hidden");
      return;
    }

    contextPreview.classList.remove("context-hidden");
    contextLabel.textContent = "Injected " + items.length + " item(s) as context";
    contextItems.innerHTML = "";

    items.forEach(function (item) {
      const el = document.createElement("div");
      el.className = "context-item";
      el.innerHTML =
        '<span class="context-item-icon">&#x1F4C4;</span>' +
        '<span class="context-item-title">' +
        escapeHtml(item.title || "Untitled") +
        "</span>";
      contextItems.appendChild(el);
    });
  }

  // ---- Helpers ----

  function createMessageEl(role, text) {
    const msg = document.createElement("div");
    msg.className = "message message-" + role;

    const bubble = document.createElement("div");
    bubble.className = "message-bubble";
    bubble.textContent = text;

    const ts = document.createElement("div");
    ts.className = "message-timestamp";
    ts.textContent = formatTime(new Date());

    msg.appendChild(bubble);
    msg.appendChild(ts);
    return msg;
  }

  function scrollToBottom() {
    requestAnimationFrame(function () {
      messagesEl.scrollTop = messagesEl.scrollHeight;
    });
  }

  function formatTime(date) {
    const h = String(date.getHours()).padStart(2, "0");
    const m = String(date.getMinutes()).padStart(2, "0");
    return h + ":" + m;
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }
})();
