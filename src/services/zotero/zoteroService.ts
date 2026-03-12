export class ZoteroService {
  async getSelectedItems(): Promise<Zotero.Item[]> {
    const zoteroPane = Zotero.getActiveZoteroPane();
    return zoteroPane.getSelectedItems();
  }

  async getItemMetadata(
    itemId: number,
  ): Promise<Record<string, string>> {
    const item = await Zotero.Items.getAsync(itemId);
    if (!item) throw new Error(`Item ${itemId} not found`);

    const metadata: Record<string, string> = {
      title: item.getField("title") as string,
      itemType: Zotero.ItemTypes.getName(item.itemTypeID) || "",
    };

    if (item.firstCreator) metadata.firstAuthor = item.firstCreator;

    const fields = [
      "date",
      "DOI",
      "abstractNote",
      "publicationTitle",
      "volume",
      "issue",
      "pages",
      "url",
    ];
    for (const field of fields) {
      const val = item.getField(field as any) as string;
      if (val) metadata[field] = val;
    }

    // 获取所有作者
    const creators = item.getCreators();
    if (creators.length > 0) {
      metadata.authors = creators
        .map((c) => `${c.firstName || ""} ${c.lastName || ""}`.trim())
        .join("; ");
    }

    return metadata;
  }

  async searchItems(
    query: string,
    limit: number = 20,
  ): Promise<
    Array<{ id: number; title: string; firstAuthor: string; year: string }>
  > {
    const s = new Zotero.Search();
    s.addCondition("quicksearch-titleCreatorYear", "contains", query);
    s.addCondition("itemType", "isNot", "attachment");
    const ids = await s.search();

    const results: Array<{
      id: number;
      title: string;
      firstAuthor: string;
      year: string;
    }> = [];
    const limitedIds = ids.slice(0, limit);

    for (const id of limitedIds) {
      const item = Zotero.Items.get(id as number);
      if (!item || !item.isRegularItem()) continue;

      let year = "";
      const date = item.getField("date", true, true) as string;
      if (date) year = date.substring(0, 4);

      results.push({
        id: item.id,
        title: item.getField("title") as string,
        firstAuthor: item.firstCreator || "",
        year,
      });
    }

    return results;
  }
}
