export interface ContextItem {
  type: "metadata" | "annotation" | "note" | "fulltext";
  source: string;
  content: string;
  tokenEstimate: number;
}

/**
 * 上下文管理器
 *
 * 负责收集当前选中条目的上下文信息，构建系统上下文消息。
 * 骨架实现，将在 Step 4 中完善。
 */
export class ContextManager {
  private currentItems: ContextItem[] = [];

  /**
   * 收集指定条目的上下文信息
   */
  async collectContext(itemIds: number[]): Promise<ContextItem[]> {
    // Step 4 中实现完整的上下文收集逻辑
    this.currentItems = [];
    return this.currentItems;
  }

  /**
   * 获取当前上下文预览
   */
  getContextPreview(): ContextItem[] {
    return this.currentItems;
  }

  /**
   * 构建上下文消息（插入到对话中）
   */
  buildContextMessage(): string | null {
    if (this.currentItems.length === 0) return null;
    const parts = this.currentItems.map((item) => item.content);
    return `[Context]\n${parts.join("\n\n")}`;
  }

  /**
   * 估算文本 token 数
   *
   * 近似算法：英文约 4 字符/token，CJK 字符约 1.5 字符/token
   */
  estimateTokens(text: string): number {
    const cjkChars = (
      text.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g) || []
    ).length;
    const otherChars = text.length - cjkChars;
    return Math.ceil(otherChars / 4 + cjkChars / 1.5);
  }
}
