import { ClaudeRequest, ClaudeMessage, ClaudeToolDef } from "./types";
import { StreamParser, StreamEvent } from "../../core/streamParser";

export class ClaudeAPIService {
  private proxyBaseUrl: string;

  constructor(proxyPort: number = 23121) {
    this.proxyBaseUrl = `http://127.0.0.1:${proxyPort}`;
  }

  async sendStreamingRequest(
    messages: ClaudeMessage[],
    options: {
      model: string;
      system?: string;
      tools?: ClaudeToolDef[];
      maxTokens?: number;
      onDelta?: (text: string) => void;
      onToolUse?: (
        id: string,
        name: string,
        input: Record<string, unknown>,
      ) => void;
      onComplete?: (
        stopReason: string | null,
        usage: { input_tokens: number; output_tokens: number },
      ) => void;
      onError?: (error: Error) => void;
      signal?: AbortSignal;
    },
  ): Promise<{
    content: string;
    stopReason: string | null;
    toolUseBlocks: Array<{
      id: string;
      name: string;
      input: Record<string, unknown>;
    }>;
  }> {
    const request: ClaudeRequest = {
      model: options.model,
      max_tokens: options.maxTokens || 4096,
      system: options.system,
      messages,
      stream: true,
    };

    if (options.tools && options.tools.length > 0) {
      request.tools = options.tools;
    }

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `${this.proxyBaseUrl}/v1/messages`, true);
      xhr.setRequestHeader("Content-Type", "application/json");

      let fullText = "";
      let stopReason: string | null = null;
      let usage = { input_tokens: 0, output_tokens: 0 };
      const toolUseBlocks: Array<{
        id: string;
        name: string;
        input: Record<string, unknown>;
      }> = [];
      let currentToolInput = "";
      let lastIndex = 0;

      const parser = new StreamParser((event: StreamEvent) => {
        switch (event.type) {
          case "content_block_delta":
            if (event.delta.type === "text_delta" && event.delta.text) {
              fullText += event.delta.text;
              options.onDelta?.(event.delta.text);
            } else if (
              event.delta.type === "input_json_delta" &&
              (event.delta as any).partial_json
            ) {
              currentToolInput += (event.delta as any).partial_json;
            }
            break;
          case "content_block_start":
            if (event.content_block.type === "tool_use") {
              currentToolInput = "";
              options.onToolUse?.(
                event.content_block.id,
                event.content_block.name,
                {},
              );
            }
            break;
          case "content_block_stop": {
            if (currentToolInput) {
              try {
                const input = JSON.parse(currentToolInput);
                toolUseBlocks.push({
                  id:
                    toolUseBlocks.length > 0
                      ? toolUseBlocks[toolUseBlocks.length - 1].id
                      : "",
                  name:
                    toolUseBlocks.length > 0
                      ? toolUseBlocks[toolUseBlocks.length - 1].name
                      : "",
                  input,
                });
              } catch {
                // ignore JSON parse error for incomplete tool input
              }
              currentToolInput = "";
            }
            break;
          }
          case "message_delta":
            stopReason = event.delta?.stop_reason || null;
            if (event.usage) {
              usage = {
                input_tokens:
                  usage.input_tokens + (event.usage.output_tokens || 0),
                output_tokens: event.usage.output_tokens || 0,
              };
            }
            break;
          case "message_start":
            if (event.message?.usage) {
              usage.input_tokens = event.message.usage.input_tokens || 0;
            }
            break;
          case "error":
            options.onError?.(new Error(event.error.message));
            break;
        }
      });

      xhr.onprogress = () => {
        const newData = (xhr.responseText || "").substring(lastIndex);
        lastIndex = (xhr.responseText || "").length;
        if (newData) {
          parser.feed(newData);
        }
      };

      xhr.onload = () => {
        parser.flush();
        if (xhr.status >= 200 && xhr.status < 300) {
          options.onComplete?.(stopReason, usage);
          resolve({ content: fullText, stopReason, toolUseBlocks });
        } else {
          const error = new Error(`API error: ${xhr.status}`);
          options.onError?.(error);
          reject(error);
        }
      };

      xhr.onerror = () => {
        const error = new Error("Connection to proxy failed");
        options.onError?.(error);
        reject(error);
      };

      if (options.signal) {
        options.signal.addEventListener("abort", () => {
          xhr.abort();
          reject(Object.assign(new Error("Aborted"), { name: "AbortError" }));
        });
      }

      xhr.send(JSON.stringify(request));
    });
  }

  async healthCheck(): Promise<boolean> {
    return new Promise((resolve) => {
      const xhr = new XMLHttpRequest();
      xhr.open("GET", `${this.proxyBaseUrl}/health`, true);
      xhr.timeout = 3000;
      xhr.onload = () => resolve(xhr.status === 200);
      xhr.onerror = () => resolve(false);
      xhr.ontimeout = () => resolve(false);
      xhr.send();
    });
  }
}
