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
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { buildSearchIndex } from "./search.js";
import { registerTools, buildCatalogData } from "./tools.js";
import { RateLimiter } from "./rate-limiter.js";
import type { Catalog } from "./types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const catalogPath = join(__dirname, "..", "data", "catalog.json");
const typedCatalog: Catalog = JSON.parse(readFileSync(catalogPath, "utf-8"));

const apiToken = process.env.GHL_API_TOKEN || "";
if (!apiToken) {
  console.error("Error: GHL_API_TOKEN environment variable is required.");
  console.error("Set it when adding to Claude Code:");
  console.error(
    "  claude mcp add ghl -e GHL_API_TOKEN=pit-xxx -- npx tsx src/stdio.ts"
  );
  process.exit(1);
}

const searchIndex = buildSearchIndex(typedCatalog.actions);
const { actionById, categorySummary } = buildCatalogData(typedCatalog);
const rateLimiter = new RateLimiter(60_000, 60);

const server = new McpServer(
  { name: "ghl-mcp-server", version: "0.1.0" },
  {
    instructions: [
      "GoHighLevel API MCP server with access to all 413 API endpoints.",
      "Always call search_actions first to discover available actions before executing.",
      `Available categories: ${typedCatalog.categories.join(", ")}.`,
    ].join(" "),
  }
);

registerTools(server, {
  catalog: typedCatalog,
  searchIndex,
  actionById,
  categorySummary,
  getToken: () => apiToken,
  rateLimiter,
});

const transport = new StdioServerTransport();
await server.connect(transport);
