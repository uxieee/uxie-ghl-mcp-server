#!/usr/bin/env node
/**
 * Local stdio entry point for the GHL MCP server.
 * Runs on the user's machine — token stays local, never sent over the network.
 *
 * Usage:
 *   GHL_API_TOKEN=pit-xxx npx tsx src/stdio.ts
 *
 * Or in Claude Code:
 *   claude mcp add ghl-local -e GHL_API_TOKEN=pit-xxx -- npx tsx src/stdio.ts
 *
 * Or in Codex CLI:
 *   codex mcp add ghl-local --env GHL_API_TOKEN=pit-xxx -- npx tsx src/stdio.ts
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { buildSearchIndex } from "./search.js";
import { registerTools, buildCatalogData } from "./tools.js";
import { RateLimiter } from "./rate-limiter.js";
import { ACTION_TIPS, getSearchBoosts } from "./action-tips.js";
import type { Catalog } from "./types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const catalogPath = join(__dirname, "..", "data", "catalog.json");
const typedCatalog: Catalog = JSON.parse(readFileSync(catalogPath, "utf-8"));

const apiToken = process.env.GHL_API_TOKEN || "";
if (!apiToken) {
  console.error("Error: GHL_API_TOKEN environment variable is required.");
  console.error("Set it when adding to Claude Code or Codex CLI:");
  console.error(
    "  claude mcp add ghl -e GHL_API_TOKEN=pit-xxx -- npx tsx src/stdio.ts"
  );
  console.error(
    "  codex mcp add ghl --env GHL_API_TOKEN=pit-xxx -- npx tsx src/stdio.ts"
  );
  process.exit(1);
}

const searchIndex = buildSearchIndex(typedCatalog.actions, getSearchBoosts(ACTION_TIPS));
const { actionById, categorySummary } = buildCatalogData(typedCatalog);
const rateLimiter = new RateLimiter(60_000, 60);

const server = new McpServer(
  { name: "ghl-mcp-server", version: "0.1.0" },
  {
    instructions: [
      "GoHighLevel API MCP server — 413 endpoints across 35 categories.",
      "Flow: search_actions (find the action ID + params) → execute_action (call the API).",
      "execute_action has built-in response shaping — these are top-level params, NOT inside params:",
      "  result_filter: search array items by keyword (e.g. find a custom field by name).",
      "  result_fields: project specific fields (e.g. 'id,name,fieldKey' to reduce response size).",
      "  result_offset / result_limit: paginate large array responses (e.g. result_limit=10, result_offset=10 for page 2).",
      "  result_limit=0 returns only the item count without data.",
      "Rate limit: 60 execute calls per minute.",
      "Param routing: path params → URL, query params → query string, remainder → request body (based on action schema).",
    ].join("\n"),
  }
);

registerTools(server, {
  catalog: typedCatalog,
  searchIndex,
  actionById,
  categorySummary,
  getToken: () => apiToken,
  rateLimiter,
  actionTips: ACTION_TIPS,
});

const transport = new StdioServerTransport();
await server.connect(transport);
