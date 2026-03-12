import { config } from "../../package.json";

/**
 * 偏好设置面板脚本注册
 *
 * 当用户打开偏好设置面板时调用，负责绑定 UI 事件。
 */
export async function registerPrefsScripts(_window: Window) {
  const doc = _window.document;

  // API Key 显示/隐藏切换
  const toggleBtn = doc.querySelector(
    `#${config.addonRef}-apikey-toggle`,
  ) as HTMLElement | null;
  const apiKeyInput = doc.querySelector(
    `#${config.addonRef}-apikey-input`,
  ) as HTMLInputElement | null;

  if (toggleBtn && apiKeyInput) {
    toggleBtn.addEventListener("command", () => {
      if (apiKeyInput.type === "password") {
        apiKeyInput.type = "text";
        toggleBtn.setAttribute("label", "Hide");
      } else {
        apiKeyInput.type = "password";
        toggleBtn.setAttribute("label", "Show");
      }
    });
  }

  // 代理端口输入验证
  const portInput = doc.querySelector(
    `#${config.addonRef}-proxy-port`,
  ) as HTMLInputElement | null;

  if (portInput) {
    portInput.addEventListener("change", (e: Event) => {
      const target = e.target as HTMLInputElement;
      const port = parseInt(target.value, 10);
      if (isNaN(port) || port < 1024 || port > 65535) {
        target.value = "23121";
        ztoolkit.log("Invalid port, reset to default 23121");
      }
    });
  }
}
