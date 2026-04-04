import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpAgent } from "agents/mcp";
import { buildSearchIndex } from "./search.js";
import { registerTools, buildCatalogData } from "./tools.js";
import { RateLimiter } from "./rate-limiter.js";
import catalog from "../data/catalog.json";
import type { Catalog } from "./types.js";

const typedCatalog = catalog as unknown as Catalog;
const searchIndex = buildSearchIndex(typedCatalog.actions);
const { actionById, categorySummary } = buildCatalogData(typedCatalog);

export interface Env {
  MCP_OBJECT: DurableObjectNamespace;
}

export class GHLServer extends McpAgent<Env> {
  server = new McpServer(
    {
      name: "ghl-mcp-server",
      version: "0.1.0",
    },
    {
      instructions: [
        "GoHighLevel API MCP server with access to all 413 API endpoints.",
        "Always call search_actions first to discover available actions before executing.",
        `Available categories: ${typedCatalog.categories.join(", ")}.`,
      ].join(" "),
    }
  );

  private rateLimiter = new RateLimiter(60_000, 60);
  private apiToken: string = "";

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const token = url.searchParams.get("_token") || "";

    // [FIX #1] Always overwrite — clear stale tokens when no token in request
    this.apiToken = token;

    // Strip the token param before passing to MCP handler
    if (token) {
      url.searchParams.delete("_token");
    }
    const cleanRequest = new Request(url.toString(), request);
    return super.fetch(cleanRequest);
  }

  async init() {
    registerTools(this.server, {
      catalog: typedCatalog,
      searchIndex,
      actionById,
      categorySummary,
      getToken: () => this.apiToken,
      rateLimiter: this.rateLimiter,
    });
  }
}

export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url);

    if (url.pathname === "/mcp") {
      const ghlToken = request.headers.get("x-ghl-token") || "";

      if (!ghlToken) {
        return new Response(
          JSON.stringify({
            error:
              "Missing authentication. Provide your GHL Private Integration Token via the X-GHL-Token header.",
          }),
          {
            status: 401,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      if (!ghlToken.startsWith("pit-") || ghlToken.length < 10) {
        return new Response(
          JSON.stringify({ error: "Invalid token format. GHL PITs start with 'pit-'." }),
          {
            status: 401,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      // Pass token to DO via internal URL param (stripped in DO's fetch override)
      // Note: this is an internal Worker→DO call, not exposed externally
      const internalUrl = new URL(request.url);
      internalUrl.searchParams.set("_token", ghlToken);
      const internalRequest = new Request(internalUrl.toString(), request);

      return GHLServer.serve("/mcp").fetch(internalRequest, env, ctx);
    }

    if (url.pathname === "/health") {
      return new Response(
        JSON.stringify({
          status: "ok",
          actions: typedCatalog.totalActions,
          categories: typedCatalog.categories.length,
          catalogGeneratedAt: typedCatalog.generatedAt,
        }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response("GHL MCP Server. Connect to /mcp", { status: 200 });
  },
};
