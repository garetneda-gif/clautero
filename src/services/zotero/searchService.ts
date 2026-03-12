export class SearchService {
  async quickSearch(query: string, maxResults: number = 20): Promise<number[]> {
    const s = new Zotero.Search();
    s.addCondition("quicksearch-titleCreatorYear", "contains", query);
    s.addCondition("itemType", "isNot", "attachment");
    const ids = await s.search();
    return (ids as number[]).slice(0, maxResults);
  }
}
