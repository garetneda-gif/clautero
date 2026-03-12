/**
 * 对话历史持久化存储
 *
 * 将对话保存为 JSON 文件，存储在 Zotero profile 目录下
 * `clautero/conversations/{conversationId}.json`
 */

export interface StoredMessage {
  role: "user" | "assistant";
  content: string;
  /** tool_result 只保存摘要，不保存原始内容 */
  toolSummaries?: Array<{ name: string; summary: string }>;
  timestamp: number;
}

export interface StoredConversation {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: StoredMessage[];
}

export class ConversationStorage {
  private storageDir: string;

  constructor() {
    this.storageDir = PathUtils.join(
      Zotero.DataDirectory.dir,
      "clautero",
      "conversations",
    );
  }

  /**
   * 确保存储目录存在
   */
  async ensureDir(): Promise<void> {
    try {
      await IOUtils.makeDirectory(this.storageDir, { createAncestors: true });
    } catch (e) {
      Zotero.debug(`[Clautero] Failed to create storage dir: ${e}`);
    }
  }

  /**
   * 保存对话到磁盘
   */
  async save(conversation: StoredConversation): Promise<void> {
    await this.ensureDir();
    const filePath = PathUtils.join(
      this.storageDir,
      `${conversation.id}.json`,
    );
    const data = JSON.stringify(conversation, null, 2);
    const encoder = new TextEncoder();
    await IOUtils.write(filePath, encoder.encode(data));
  }

  /**
   * 从磁盘加载指定对话
   */
  async load(conversationId: string): Promise<StoredConversation | null> {
    const filePath = PathUtils.join(
      this.storageDir,
      `${conversationId}.json`,
    );
    try {
      const bytes = await IOUtils.read(filePath);
      const decoder = new TextDecoder();
      const data = decoder.decode(bytes);
      return JSON.parse(data) as StoredConversation;
    } catch {
      return null;
    }
  }

  /**
   * 列出所有已保存的对话摘要（按更新时间倒序）
   */
  async listConversations(): Promise<
    Array<{ id: string; title: string; updatedAt: number; messageCount: number }>
  > {
    await this.ensureDir();
    const result: Array<{
      id: string;
      title: string;
      updatedAt: number;
      messageCount: number;
    }> = [];

    try {
      const children = await IOUtils.getChildren(this.storageDir);
      for (const filePath of children) {
        if (!filePath.endsWith(".json")) continue;
        try {
          const bytes = await IOUtils.read(filePath);
          const decoder = new TextDecoder();
          const conv = JSON.parse(
            decoder.decode(bytes),
          ) as StoredConversation;
          result.push({
            id: conv.id,
            title: conv.title,
            updatedAt: conv.updatedAt,
            messageCount: conv.messages.length,
          });
        } catch {
          // 跳过损坏的文件
        }
      }
    } catch {
      // 目录不存在或不可读
    }

    return result.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  /**
   * 删除指定对话
   */
  async deleteConversation(conversationId: string): Promise<void> {
    const filePath = PathUtils.join(
      this.storageDir,
      `${conversationId}.json`,
    );
    try {
      await IOUtils.remove(filePath);
    } catch {
      // 文件不存在时忽略
    }
  }

  /**
   * 清除所有对话历史
   */
  async clearAll(): Promise<void> {
    try {
      const children = await IOUtils.getChildren(this.storageDir);
      for (const filePath of children) {
        if (filePath.endsWith(".json")) {
          await IOUtils.remove(filePath);
        }
      }
    } catch {
      // 忽略错误
    }
  }

  /**
   * 从对话第一条用户消息生成标题（截取前 30 字符）
   */
  static generateTitle(messages: StoredMessage[]): string {
    const firstUserMsg = messages.find((m) => m.role === "user");
    if (!firstUserMsg) return "New conversation";
    const text =
      typeof firstUserMsg.content === "string"
        ? firstUserMsg.content
        : "New conversation";
    return text.length > 30 ? text.substring(0, 30) + "..." : text;
  }
}
