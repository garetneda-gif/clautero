export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
  handler: (input: Record<string, unknown>) => Promise<string>;
  enabled: boolean;
}

/**
 * 工具编排器
 *
 * 管理可用工具的注册、执行和结果处理。
 * 骨架实现，将在后续步骤中添加具体工具。
 */
export class ToolOrchestrator {
  private tools: Map<string, ToolDefinition> = new Map();
  private static MAX_TOOL_ROUNDS = 5;
  private static TOOL_TIMEOUT_MS = 10000;
  private static MAX_RESULT_CHARS = 8000;

  /**
   * 注册一个工具
   */
  registerTool(tool: ToolDefinition): void {
    this.tools.set(tool.name, tool);
  }

  /**
   * 获取所有已启用的工具定义（用于 API 请求）
   */
  getEnabledTools(): Array<{
    name: string;
    description: string;
    input_schema: Record<string, unknown>;
  }> {
    return Array.from(this.tools.values())
      .filter((t) => t.enabled)
      .map(({ name, description, input_schema }) => ({
        name,
        description,
        input_schema,
      }));
  }

  /**
   * 执行指定工具
   */
  async executeTool(
    name: string,
    input: Record<string, unknown>,
  ): Promise<string> {
    const tool = this.tools.get(name);
    if (!tool || !tool.enabled) {
      return JSON.stringify({
        error: `Tool "${name}" not found or disabled`,
      });
    }

    try {
      const result = await Promise.race([
        tool.handler(input),
        new Promise<string>((_, reject) =>
          setTimeout(
            () => reject(new Error("timeout")),
            ToolOrchestrator.TOOL_TIMEOUT_MS,
          ),
        ),
      ]);

      if (result.length > ToolOrchestrator.MAX_RESULT_CHARS) {
        return (
          result.substring(0, ToolOrchestrator.MAX_RESULT_CHARS) +
          "\n[truncated, showing first 8000 chars]"
        );
      }
      return result;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      const sanitized = this.sanitizeError(msg);
      return JSON.stringify({ error: sanitized });
    }
  }

  /**
   * 脱敏错误信息，移除本地路径和 IP 地址
   */
  private sanitizeError(msg: string): string {
    return msg
      .replace(/\/[^\s]+/g, "[local_path]")
      .replace(
        /\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d+)?/g,
        "[local_endpoint]",
      )
      .replace(/:\d{4,5}/g, ":[port]");
  }

  /**
   * 获取最大工具轮次
   */
  getMaxToolRounds(): number {
    return ToolOrchestrator.MAX_TOOL_ROUNDS;
  }
}
