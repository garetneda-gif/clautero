/**
 * 侧边栏面板注册
 *
 * 使用 Zotero.ItemPaneManager.registerSection 在 item pane 右侧
 * 注册一个聊天面板区域，内嵌 iframe 加载聊天 UI。
 */

const SECTION_ID = "clautero-chat";
let currentNonce: string | null = null;

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
      // iframe 加载后可在此初始化 MessageBridge 的 attach
      const browser = body.querySelector(
        "#clautero-chat-browser",
      ) as HTMLIFrameElement | null;
      if (browser) {
        // 延迟 attach，等 iframe 内容加载完成
        const tryAttach = () => {
          const { getMessageBridge } = require("../hooks");
          const bridge = getMessageBridge();
          if (bridge) {
            bridge.attach(browser);
          }
        };
        // 使用 Zotero.Promise.delay 等待 iframe 就绪
        Zotero.Promise.delay(500).then(tryAttach);
      }
    },
    onItemChange: ({ setEnabled }) => {
      // 始终启用聊天面板，不依赖选中条目
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
}

export function getCurrentNonce(): string | null {
  return currentNonce;
}
