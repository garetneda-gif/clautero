import { initLocale, getString } from "./utils/locale";
import { createZToolkit } from "./utils/ztoolkit";
import { registerPrefsScripts } from "./ui/preferencePane";
import {
  registerSidebarPanel,
  unregisterSidebarPanel,
} from "./ui/sidebarPanel";
import { MessageBridge } from "./core/messageBridge";

let messageBridge: MessageBridge | null = null;

async function onStartup() {
  await Promise.all([
    Zotero.initializationPromise,
    Zotero.unlockPromise,
    Zotero.uiReadyPromise,
  ]);

  initLocale();

  // 注册偏好设置面板
  Zotero.PreferencePanes.register({
    pluginID: addon.data.config.addonID,
    src: rootURI + "content/preferences.xhtml",
    label: getString("prefs-title"),
    image: `chrome://${addon.data.config.addonRef}/content/icons/favicon.png`,
  });

  // 注册 Notifier 监听条目选择
  const notifierCallback = {
    notify: async (
      event: string,
      type: string,
      ids: Array<string | number>,
      extraData: { [key: string]: any },
    ) => {
      onNotify(event, type, ids, extraData);
    },
  };
  Zotero.Notifier.registerObserver(notifierCallback, ["item", "tab"]);

  // 为已打开的窗口执行加载逻辑
  await Promise.all(
    Zotero.getMainWindows().map((win) => onMainWindowLoad(win)),
  );

  addon.data.initialized = true;
}

async function onMainWindowLoad(win: _ZoteroTypes.MainWindow): Promise<void> {
  // 为每个窗口创建新的 ztoolkit
  addon.data.ztoolkit = createZToolkit();

  // 注入 FTL 本地化文件
  win.MozXULElement.insertFTLIfNeeded(
    `${addon.data.config.addonRef}-mainWindow.ftl`,
  );

  // 注册样式表
  const doc = win.document;
  const link = doc.createElement("link");
  link.rel = "stylesheet";
  link.href = `chrome://${addon.data.config.addonRef}/content/clautero.css`;
  doc.documentElement?.appendChild(link);

  // 注册侧边栏面板并获取 nonce
  const nonce = registerSidebarPanel();

  // 初始化 MessageBridge（延迟到 iframe 加载完成后 attach）
  messageBridge = new MessageBridge(nonce);

  // 显示加载通知
  const popupWin = new ztoolkit.ProgressWindow(addon.data.config.addonName, {
    closeOnClick: true,
    closeTime: -1,
  })
    .createLine({
      text: getString("startup-begin"),
      type: "default",
      progress: 0,
    })
    .show();

  await Zotero.Promise.delay(500);
  popupWin.changeLine({
    progress: 100,
    text: `${getString("startup-finish")}`,
  });
  popupWin.startCloseTimer(3000);
}

async function onMainWindowUnload(_win: Window): Promise<void> {
  // 清理 MessageBridge
  if (messageBridge) {
    messageBridge.detach();
    messageBridge = null;
  }

  // 清理侧边栏面板
  unregisterSidebarPanel();

  ztoolkit.unregisterAll();
}

function onShutdown(): void {
  // 停止所有服务
  if (messageBridge) {
    messageBridge.detach();
    messageBridge = null;
  }

  unregisterSidebarPanel();

  ztoolkit.unregisterAll();

  addon.data.alive = false;
  // @ts-expect-error - Plugin instance is not typed
  delete Zotero[addon.data.config.addonInstance];
}

async function onNotify(
  event: string,
  type: string,
  ids: Array<string | number>,
  extraData: { [key: string]: any },
) {
  ztoolkit.log("notify", event, type, ids, extraData);

  // 监听条目选择事件，通知 ContextManager
  if (event === "select" && type === "item") {
    // 将在 ContextManager 完整实现后补充
    Zotero.debug("[Clautero] Item selection changed");
  }
}

async function onPrefsEvent(type: string, data: { [key: string]: any }) {
  switch (type) {
    case "load":
      registerPrefsScripts(data.window);
      break;
    default:
      return;
  }
}

/**
 * 获取当前 MessageBridge 实例（供其他模块使用）
 */
export function getMessageBridge(): MessageBridge | null {
  return messageBridge;
}

export default {
  onStartup,
  onShutdown,
  onMainWindowLoad,
  onMainWindowUnload,
  onNotify,
  onPrefsEvent,
};
