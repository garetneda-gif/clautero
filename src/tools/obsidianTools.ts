import { ToolDefinition } from "../core/toolOrchestrator";

export function createObsidianPushTool(): ToolDefinition {
  return {
    name: "obsidian_push_literature",
    description: "Push a literature note to Obsidian vault.",
    input_schema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "File path in the vault",
        },
        content: {
          type: "string",
          description: "Markdown content",
        },
      },
      required: ["path", "content"],
    },
    enabled: false, // 默认禁用，Obsidian 连接后启用
    handler: async (_input) => {
      return JSON.stringify({ status: "not_implemented" });
    },
  };
}
