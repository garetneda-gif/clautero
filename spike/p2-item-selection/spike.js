// P2: 选中项监听方案验证
// 在 Zotero 7 JS Console 中运行
(async () => {
  Zotero.debug("[P2] Starting item selection listener test...");

  const results = {
    method1_notifier: { received: 0, events: [] },
    method2_getSelected: { received: 0, items: [] },
  };

  // 方法 1: Zotero.Notifier
  const callback = {
    notify: (event, type, ids, extraData) => {
      if (event === "select" && type === "item") {
        results.method1_notifier.received++;
        results.method1_notifier.events.push({ event, type, ids: [...ids] });
        Zotero.debug(`[P2] Notifier select: ${ids.join(",")}`);
      }
    },
  };
  const notifierId = Zotero.Notifier.registerObserver(callback, ["item"]);

  // 方法 2: 轮询 getSelectedItems
  let lastSelectedKeys = "";
  const pollTimer = setInterval(() => {
    try {
      const pane = Zotero.getActiveZoteroPane();
      const items = pane.getSelectedItems();
      const keys = items.map(i => i.id).sort().join(",");
      if (keys !== lastSelectedKeys) {
        lastSelectedKeys = keys;
        results.method2_getSelected.received++;
        results.method2_getSelected.items.push(keys);
        Zotero.debug(`[P2] Poll detected change: ${keys}`);
      }
    } catch (e) {
      Zotero.debug(`[P2] Poll error: ${e}`);
    }
  }, 500);

  Zotero.debug("[P2] Listeners active. Select different items in Zotero for 15 seconds...");

  // 等待 15 秒让用户切换选中项
  await Zotero.Promise.delay(15000);

  // 清理
  Zotero.Notifier.unregisterObserver(notifierId);
  clearInterval(pollTimer);

  Zotero.debug("[P2] === Results ===");
  Zotero.debug(`[P2] Notifier events: ${results.method1_notifier.received}`);
  Zotero.debug(`[P2] Poll changes: ${results.method2_getSelected.received}`);
  Zotero.debug("[P2] Notifier details: " + JSON.stringify(results.method1_notifier.events.slice(0, 5)));
  Zotero.debug("[P2] Poll details: " + JSON.stringify(results.method2_getSelected.items.slice(0, 5)));

  return results;
})();
