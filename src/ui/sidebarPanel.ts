/**
 * 侧边栏面板注册
 *
 * 使用 Zotero.ItemPaneManager.registerSection 在 item pane 右侧
 * 注册一个聊天面板区域，内嵌 iframe 加载聊天 UI。
 */

import { MessageBridge } from "../core/messageBridge";

const SECTION_ID = "clautero-chat";
let currentNonce: string | null = null;
let onRenderCallback: ((browser: HTMLIFrameElement) => void) | null = null;

/**
 * 设置 iframe 渲染后的回调（由 hooks.ts 调用，避免循环依赖）
 */
export function setOnRenderCallback(
  cb: (browser: HTMLIFrameElement) => void,
): void {
  onRenderCallback = cb;
}

export function registerSidebarPanel(): string {
  const nonce = Zotero.Utilities.randomString(32);
  currentNonce = nonce;

  Zotero.ItemPaneManager.registerSection({
    paneID: SECTION_ID,
    pluginID: addon.data.config.addonID,
    header: {
      l10nID: `${addon.data.config.addonRef}-sidenav-clautero-tooltip`,
      icon: `chrome://${addon.data.config.addonRef}/content/icons/favicon.png`,
    },
    sidenav: {
      l10nID: `${addon.data.config.addonRef}-sidenav-clautero-tooltip`,
      icon: `chrome://${addon.data.config.addonRef}/content/icons/favicon.png`,
    },
    bodyXHTML: `<browser
      id="clautero-chat-browser"
      type="content"
      flex="1"
      disableglobalhistory="true"
      src="chrome://${addon.data.config.addonRef}/content/chat/index.html?nonce=${nonce}"
      style="width: 100%; height: 500px;"
    />`,
    onRender: ({ body }) => {
      const browser = body.querySelector(
        "#clautero-chat-browser",
      ) as HTMLIFrameElement | null;
      if (browser && onRenderCallback) {
        Zotero.Promise.delay(500).then(() => onRenderCallback!(browser));
      }
    },
    onItemChange: ({ setEnabled }) => {
      setEnabled(true);
      return true;
    },
  });

  return nonce;
}

export function unregisterSidebarPanel(): void {
  try {
    Zotero.ItemPaneManager.unregisterSection(SECTION_ID);
  } catch {
    // 忽略未注册时的错误
  }
  currentNonce = null;
  onRenderCallback = null;
}

export function getCurrentNonce(): string | null {
  return currentNonce;
}
