export type StreamEvent =
  | { type: "message_start"; message: any }
  | {
      type: "content_block_start";
      index: number;
      content_block: any;
    }
  | {
      type: "content_block_delta";
      index: number;
      delta: { type: string; text?: string };
    }
  | { type: "content_block_stop"; index: number }
  | { type: "message_delta"; delta: any; usage: any }
  | { type: "message_stop" }
  | { type: "error"; error: { type: string; message: string } }
  | { type: "ping" };

/**
 * SSE 流解析器
 *
 * 接收原始 SSE 文本流，解析 `event:` 和 `data:` 行，
 * 处理跨 chunk 边界的不完整行。
 */
export class StreamParser {
  private buffer = "";
  private onEvent: (event: StreamEvent) => void;

  constructor(onEvent: (event: StreamEvent) => void) {
    this.onEvent = onEvent;
  }

  /**
   * 向解析器喂入新的文本块
   */
  feed(chunk: string): void {
    this.buffer += chunk;

    // SSE 事件以双换行分割
    const parts = this.buffer.split("\n\n");
    // 最后一个元素可能是不完整的事件
    this.buffer = parts.pop() || "";

    for (const part of parts) {
      this.processEvent(part);
    }
  }

  /**
   * 处理单个 SSE 事件块
   */
  private processEvent(raw: string): void {
    const lines = raw.split("\n");
    let data = "";

    for (const line of lines) {
      if (line.startsWith("event: ")) {
        // event type 已包含在 JSON data 的 type 字段中
        // 此处仅做记录，不单独处理
      } else if (line.startsWith("data: ")) {
        data += line.substring(6);
      } else if (line.startsWith("data:")) {
        data += line.substring(5);
      }
      // 忽略注释行（以 : 开头）和空行
    }

    if (!data) return;
    if (data === "[DONE]") return;

    try {
      const parsed = JSON.parse(data) as StreamEvent;
      this.onEvent(parsed);
    } catch {
      Zotero.debug(`[Clautero] Failed to parse SSE event: ${data}`);
    }
  }

  /**
   * 刷新缓冲区中剩余的内容
   */
  flush(): void {
    if (this.buffer.trim()) {
      this.processEvent(this.buffer);
      this.buffer = "";
    }
  }

  /**
   * 重置解析器状态
   */
  reset(): void {
    this.buffer = "";
  }
}
