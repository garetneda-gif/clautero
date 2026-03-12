export class FulltextService {
  async getFulltext(itemId: number): Promise<string | null> {
    // Step 6 中完整实现，依赖 PoC P3 验证
    // 首选方案：Zotero.Fulltext.getItemContent
    try {
      const content = await (Zotero.Fulltext as any).getItemContent(itemId);
      if (content && (content as any).indexedChars > 0) {
        return (content as any).content || null;
      }
    } catch (e) {
      Zotero.debug(`[Clautero] Fulltext.getItemContent failed: ${e}`);
    }
    return null;
  }
}
