/**
 * Claude Code CLI 集成服务
 *
 * 通过 Subprocess API 直接调用 claude CLI，使用 JSON Lines 协议通信。
 * 无需 API Key，直接复用用户本地的 Claude Code 认证。
 *
 * 协议：
 *   输入（stdin）：每行一个 JSON 对象
 *   输出（stdout）：每行一个 JSON 事件对象
 *   启动参数：--input-format stream-json --output-format stream-json
 */

/** Claude Code 输出事件类型 */
interface ClaudeCodeEvent {
  type: string;
  subtype?: string;
  is_error?: boolean;
  error?: string;
  /** assistant 消息 */
  message?: {
    role: string;
    content: Array<{
      type: string;
      text?: string;
      id?: string;
      name?: string;
      input?: Record<string, unknown>;
    }>;
    stop_reason?: string;
  };
  /** 结果摘要 */
  result?: string;
  /** 会话 ID */
  session_id?: string;
  /** 工具使用 */
  tool_use?: {
    id: string;
    name: string;
    input: Record<string, unknown>;
  };
  /** 工具结果 */
  tool_result?: {
    tool_use_id: string;
    content: string;
  };
  /** 思考内容 */
  content_block?: {
    type: string;
    text?: string;
  };
}

export interface ClaudeCodeCallbacks {
  onTextDelta: (text: string) => void;
  onThinking?: (text: string) => void;
  onToolStart?: (id: string, name: string) => void;
  onToolResult?: (id: string, name: string, result: string) => void;
  onComplete: (fullText: string) => void;
  onError: (error: string) => void;
}

export class ClaudeCodeService {
  private claudePath: string;
  private currentProcess: { kill: () => void } | null = null;

  constructor(claudePath?: string) {
    this.claudePath = claudePath || this.findClaudePath();
  }

  private findClaudePath(): string {
    // 常见的 claude CLI 安装路径
    const candidates = ["/usr/local/bin/claude", "/opt/homebrew/bin/claude"];

    // 优先使用 HOME 目录下的安装
    try {
      const home = Cc["@mozilla.org/process/environment;1"]
        .getService(Ci.nsIEnvironment)
        .get("HOME");
      if (home) {
        candidates.unshift(`${home}/.local/bin/claude`);
        candidates.push(`${home}/.claude/local/claude`);
      }
    } catch {
      // 降级为硬编码路径
    }

    for (const path of candidates) {
      try {
        const file = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsIFile);
        file.initWithPath(path);
        if (file.exists() && file.isExecutable()) {
          return path;
        }
      } catch {
        continue;
      }
    }

    // 返回最常见的路径，让 Subprocess 在运行时报错
    return candidates[0] || "/usr/local/bin/claude";
  }

  /**
   * 发送消息到 Claude Code CLI
   */
  async sendMessage(
    text: string,
    callbacks: ClaudeCodeCallbacks,
    options?: {
      model?: string;
      sessionId?: string;
      maxTurns?: number;
      systemPrompt?: string;
    },
  ): Promise<void> {
    let settled = false;
    let sawEvent = false;
    let hasErrored = false;
    let stallTimer: ReturnType<typeof setTimeout> | null = null;

    const clearStallTimer = () => {
      if (stallTimer) {
        clearTimeout(stallTimer);
        stallTimer = null;
      }
    };

    const emitError = (message: string) => {
      if (settled || hasErrored) return;
      hasErrored = true;
      clearStallTimer();
      callbacks.onError(message);
    };

    const safeCallbacks: ClaudeCodeCallbacks = {
      ...callbacks,
      onError: emitError,
    };

    const args = [
      "-p",
      "--output-format",
      "stream-json",
      "--input-format",
      "stream-json",
      "--permission-mode",
      "dontAsk",
      "--verbose",
    ];

    if (options?.model) {
      args.push("--model", options.model);
    }

    if (options?.maxTurns) {
      args.push("--max-turns", String(options.maxTurns));
    }

    if (options?.sessionId) {
      args.push("--session-id", options.sessionId);
    }

    if (options?.systemPrompt) {
      args.push("--system-prompt", options.systemPrompt);
    }

    // 使用 Zotero/Gecko 的 Subprocess API
    try {
      const { Subprocess } = ChromeUtils.importESModule(
        "resource://gre/modules/Subprocess.sys.mjs",
      );

      const proc = await Subprocess.call({
        command: this.claudePath,
        arguments: args,
        stdin: "pipe",
        stdout: "pipe",
        environmentAppend: true,
        environment: this.getEnvironment(),
        stderr: "pipe",
      });

      this.currentProcess = {
        kill: () => {
          try {
            proc.kill();
          } catch {
            // 进程可能已退出
          }
        },
      };

      // 写入用户消息到 stdin
      const inputMessage =
        JSON.stringify({
          type: "user",
          session_id: options?.sessionId || "",
          message: {
            role: "user",
            content: [{ type: "text", text }],
          },
          parent_tool_use_id: null,
        }) + "\n";

      await proc.stdin.write(inputMessage);
      await proc.stdin.close();

      let fullText = "";
      let buffer = "";

      const startStallTimer = () => {
        clearStallTimer();
        stallTimer = setTimeout(() => {
          if (settled) return;
          try {
            proc.kill();
          } catch {
            // 进程可能已退出
          }
          emitError(
            sawEvent
              ? "Claude Code 长时间未继续输出，已自动终止。请重试。"
              : "Claude Code 未返回任何事件，已自动终止。请检查 CLI 配置后重试。",
          );
        }, 45000);
      };

      startStallTimer();

      const readLoop = async () => {
        try {
          while (true) {
            const chunk = await proc.stdout.readString();
            if (!chunk) break;

            startStallTimer();
            buffer += chunk;
            const lines = buffer.split("\n");
            // 保留最后一个可能不完整的行
            buffer = lines.pop() || "";

            for (const line of lines) {
              if (!line.trim()) continue;
              try {
                const event = JSON.parse(line) as ClaudeCodeEvent;
                sawEvent = true;
                fullText = this.handleEvent(event, fullText, safeCallbacks);
              } catch {
                Zotero.debug(
                  `[Clautero] Failed to parse Claude Code event: ${line.substring(0, 200)}`,
                );
              }
            }
          }

          // 处理 buffer 中剩余内容
          if (buffer.trim()) {
            try {
              const event = JSON.parse(buffer) as ClaudeCodeEvent;
              sawEvent = true;
              fullText = this.handleEvent(event, fullText, safeCallbacks);
            } catch {
              // 忽略
            }
          }
        } catch (e) {
          Zotero.debug(`[Clautero] readLoop error: ${e}`);
        }
      };

      // 同时读取 stderr 用于调试
      const readStderr = async () => {
        while (true) {
          const chunk = await proc.stderr.readString();
          if (!chunk) break;
          Zotero.debug(
            `[Clautero] Claude Code stderr: ${chunk.substring(0, 500)}`,
          );
        }
      };

      await Promise.all([readLoop(), readStderr()]);

      const exitCode = await proc.wait();
      settled = true;
      clearStallTimer();
      this.currentProcess = null;

      if (exitCode !== 0) {
        Zotero.debug(`[Clautero] Claude Code exited with code ${exitCode}`);
      }

      if (!hasErrored) {
        callbacks.onComplete(fullText);
      }
    } catch (error) {
      settled = true;
      clearStallTimer();
      this.currentProcess = null;
      const msg = error instanceof Error ? error.message : String(error);
      Zotero.debug(`[Clautero] Claude Code error: ${msg}`);
      emitError(msg);
    }
  }

  /**
   * 处理单个 Claude Code 输出事件
   */
  private handleEvent(
    event: ClaudeCodeEvent,
    fullText: string,
    callbacks: ClaudeCodeCallbacks,
  ): string {
    if (event.type === "result" && event.is_error) {
      const errorText = event.result || event.error || "Claude Code 请求失败";
      callbacks.onError(errorText);
      return fullText;
    }

    switch (event.type) {
      case "assistant": {
        if (event.error) {
          const assistantErrorText =
            event.message?.content
              .filter((block) => block.type === "text" && block.text)
              .map((block) => block.text)
              .join("\n") || event.error;
          callbacks.onError(assistantErrorText);
          break;
        }
        // 助手消息（包含文本和/或工具调用）
        if (event.message?.content) {
          for (const block of event.message.content) {
            if (block.type === "text" && block.text) {
              fullText += block.text;
              callbacks.onTextDelta(block.text);
            } else if (block.type === "tool_use" && block.name) {
              callbacks.onToolStart?.(block.id || "", block.name);
            }
          }
        }
        break;
      }
      case "content_block_delta": {
        // 增量文本
        if (event.content_block?.text) {
          fullText += event.content_block.text;
          callbacks.onTextDelta(event.content_block.text);
        }
        break;
      }
      case "result": {
        // 最终结果
        if (event.result && !fullText) {
          fullText = event.result;
          callbacks.onTextDelta(event.result);
        }
        break;
      }
      default:
        // 其他事件类型（thinking, tool_result 等），记录日志
        Zotero.debug(`[Clautero] Claude Code event: ${event.type}`);
    }
    return fullText;
  }

  /**
   * 取消当前请求
   */
  cancel(): void {
    if (this.currentProcess) {
      this.currentProcess.kill();
      this.currentProcess = null;
    }
  }

  /**
   * 获取进程环境变量
   */
  private getEnvironment(): Record<string, string> {
    return {
      CLAUDE_CODE_ENTRYPOINT: "sdk-ts",
    };
  }

  /**
   * 检查 claude CLI 是否可用
   */
  async isAvailable(): Promise<boolean> {
    try {
      const { Subprocess } = ChromeUtils.importESModule(
        "resource://gre/modules/Subprocess.sys.mjs",
      );
      const proc = await Subprocess.call({
        command: this.claudePath,
        arguments: ["--version"],
        stdout: "pipe",
        environmentAppend: true,
        environment: this.getEnvironment(),
        stderr: "pipe",
      });
      const output = await proc.stdout.readString();
      await proc.wait();
      return output.includes("Claude Code");
    } catch {
      return false;
    }
  }
}
