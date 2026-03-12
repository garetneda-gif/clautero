import { ToolDefinition } from "../core/toolOrchestrator";
import { ZoteroService } from "../services/zotero/zoteroService";

export function createZoteroSearchTool(
  service: ZoteroService,
): ToolDefinition {
  return {
    name: "zotero_search_items",
    description:
      "Search for items in the Zotero library by keywords. Returns a list of matching items with title, author, and year.",
    input_schema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search query (keywords, author name, or title)",
        },
        limit: {
          type: "number",
          description: "Maximum number of results (default 20, max 20)",
        },
      },
      required: ["query"],
    },
    enabled: true,
    handler: async (input) => {
      const query = input.query as string;
      const limit = Math.min((input.limit as number) || 20, 20);
      const results = await service.searchItems(query, limit);
      return JSON.stringify(results, null, 2);
    },
  };
}

export function createZoteroGetMetadataTool(
  service: ZoteroService,
): ToolDefinition {
  return {
    name: "zotero_get_metadata",
    description:
      "Get detailed metadata of a specific item by its ID. Returns title, authors, date, DOI, abstract, journal, and other fields.",
    input_schema: {
      type: "object",
      properties: {
        itemId: {
          type: "number",
          description: "The Zotero item ID",
        },
      },
      required: ["itemId"],
    },
    enabled: true,
    handler: async (input) => {
      const metadata = await service.getItemMetadata(input.itemId as number);
      return JSON.stringify(metadata, null, 2);
    },
  };
}
