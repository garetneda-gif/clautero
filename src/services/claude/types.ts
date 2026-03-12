export interface ClaudeMessage {
  role: "user" | "assistant";
  content: string | ContentBlock[];
}

export interface ContentBlock {
  type: "text" | "tool_use" | "tool_result";
  text?: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
  tool_use_id?: string;
  content?: string;
}

export interface ClaudeRequest {
  model: string;
  max_tokens: number;
  system?: string;
  messages: ClaudeMessage[];
  tools?: ClaudeToolDef[];
  stream: boolean;
}

export interface ClaudeToolDef {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

export interface ClaudeResponse {
  id: string;
  type: string;
  role: string;
  content: ContentBlock[];
  model: string;
  stop_reason: string | null;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

export interface SSEEvent {
  event: string;
  data: string;
}
