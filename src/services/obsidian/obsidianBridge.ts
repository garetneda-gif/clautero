export class ObsidianBridge {
  private baseUrl: string;
  private apiKey: string;
  private connected = false;

  constructor() {
    this.baseUrl = "http://127.0.0.1:27124";
    this.apiKey = "";
  }

  configure(apiKey: string): void {
    this.apiKey = apiKey;
  }

  async checkConnection(): Promise<boolean> {
    // Step 8 中完整实现，依赖 PoC P4
    try {
      const xhr = new XMLHttpRequest();
      xhr.open("GET", `${this.baseUrl}/`, false); // 同步请求检查
      xhr.timeout = 3000;
      if (this.apiKey) {
        xhr.setRequestHeader("Authorization", `Bearer ${this.apiKey}`);
      }
      xhr.send();
      this.connected = xhr.status === 200;
      return this.connected;
    } catch {
      this.connected = false;
      return false;
    }
  }

  isConnected(): boolean {
    return this.connected;
  }

  async pushNote(path: string, content: string): Promise<boolean> {
    // Step 8 中完整实现
    if (!this.connected) return false;

    return new Promise((resolve) => {
      const xhr = new XMLHttpRequest();
      xhr.open(
        "PUT",
        `${this.baseUrl}/vault/${encodeURIComponent(path)}`,
        true,
      );
      xhr.setRequestHeader("Content-Type", "text/markdown");
      if (this.apiKey) {
        xhr.setRequestHeader("Authorization", `Bearer ${this.apiKey}`);
      }
      xhr.onload = () => resolve(xhr.status >= 200 && xhr.status < 300);
      xhr.onerror = () => resolve(false);
      xhr.send(content);
    });
  }
}
