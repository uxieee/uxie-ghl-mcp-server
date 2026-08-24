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
 *
 * Or in opencode (opencode.json):
 *   { "mcp": { "uxie-ghl": { "type": "local",
 *       "command": ["npx", "tsx", "src/stdio.ts"],
 *       "environment": { "GHL_API_TOKEN": "pit-xxx" } } } }
 */

import { SERVER_INSTRUCTIONS } from "./instructions.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { buildSearchIndex } from "./search.js";
import { registerTools, buildCatalogData } from "./tools.js";
import { RateLimiter } from "./rate-limiter.js";
import { ACTION_TIPS, getSearchBoosts } from "./action-tips.js";
import { applyCatalogOverrides } from "./catalog-overrides.js";
import type { Catalog } from "./types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const catalogPath = join(__dirname, "..", "data", "catalog.json");
const typedCatalog: Catalog = applyCatalogOverrides(
  JSON.parse(readFileSync(catalogPath, "utf-8"))
);

const apiToken = process.env.GHL_API_TOKEN || "";
if (!apiToken) {
  console.error("Error: GHL_API_TOKEN environment variable is required.");
  console.error("Set it when adding to Claude Code, Codex CLI, or opencode:");
  console.error(
    "  claude mcp add ghl -e GHL_API_TOKEN=pit-xxx -- npx tsx src/stdio.ts"
  );
  console.error(
    "  codex mcp add ghl --env GHL_API_TOKEN=pit-xxx -- npx tsx src/stdio.ts"
  );
  console.error(
    '  opencode: add to opencode.json under mcp -> { "type": "local", "command": ["npx", "tsx", "src/stdio.ts"], "environment": { "GHL_API_TOKEN": "pit-xxx" } }'
  );
  process.exit(1);
}

const searchIndex = buildSearchIndex(typedCatalog.actions, getSearchBoosts(ACTION_TIPS));
const { actionById, categorySummary } = buildCatalogData(typedCatalog);
const rateLimiter = new RateLimiter(60_000, 60);

const server = new McpServer(
  { name: "ghl-mcp-server", version: "0.1.0" },
  {
    instructions: SERVER_INSTRUCTIONS,
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
