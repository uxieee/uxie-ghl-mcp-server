import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createMcpHandler } from "agents/mcp";
import { buildSearchIndex } from "./search.js";
import { registerTools, buildCatalogData } from "./tools.js";
import { RateLimiter } from "./rate-limiter.js";
import { ACTION_TIPS, getSearchBoosts } from "./action-tips.js";
import { applyCatalogOverrides } from "./catalog-overrides.js";
import catalog from "../data/catalog.json";
import type { Catalog } from "./types.js";

const typedCatalog = applyCatalogOverrides(catalog as unknown as Catalog);
const searchIndex = buildSearchIndex(typedCatalog.actions, getSearchBoosts(ACTION_TIPS));
const { actionById, categorySummary } = buildCatalogData(typedCatalog);

const SERVER_INSTRUCTIONS = [
  "GoHighLevel API MCP server — 1207 endpoints across 83 categories, covering both GHL API v2 and the API v3 surface published 2026-06-19.",
  "Categories ending in -v3 are API v3 (Version header v3, camelCase params) — prefer them; the same-named category without the suffix is the legacy v2 spec kept for compatibility.",
  "Flow: search_actions (find the action ID + params) → execute_action (call the API).",
  "execute_action has built-in response shaping — these are top-level params, NOT inside params:",
  "  result_filter: search array items by keyword (e.g. find a custom field by name).",
  "  result_fields: project specific fields (e.g. 'id,name,fieldKey' to reduce response size).",
  "  result_offset / result_limit: paginate large array responses (e.g. result_limit=10, result_offset=10 for page 2).",
  "  result_limit=0 returns only the item count without data.",
  "  dry_run=true previews non-GET request routing without calling GHL.",
  "High-risk actions such as send, publish, delete, remove, cancel, and billing/payment actions require confirm=true after preview.",
  "  search_actions also accepts include_all=true with a category to enumerate every action in that category.",
  "Tools return structuredContent plus JSON text fallback for older MCP clients.",
  "Rate limit: 60 execute calls per minute, per token, per edge isolate.",
  "Param routing: path params → URL, query params → query string, remainder → request body. Undocumented but valid body keys are passed through to GHL so OpenAPI spec gaps do not block valid requests.",
  "Pipelines are now fully writable: opportunities-v3__create-pipeline / update-pipeline / delete-pipeline (API addition of 2026-06-26). Remaining public-API gaps such as workflow builder internals are surfaced explicitly in search notes so the model does not keep hunting for non-existent endpoints. Conversation AI agents are exposed under the conversation-ai category.",
  "For commerce setup, GHL's products__* and payments__* endpoints are the source of truth. Stripe is the underlying rail, but direct Stripe API access is usually not needed.",
].join("\n");

/**
 * No bindings. `/mcp` is served statelessly, so the Worker holds no Durable
 * Object namespace and no persistent storage of any kind.
 */
export interface Env {}

/**
 * Rate limiters, keyed by token, held at module (isolate) scope.
 *
 * Previously these lived on the per-session Durable Object, which meant every
 * `initialize` handed the caller a fresh 60-call budget — the limit only ever
 * bound within a single session. Isolate scope is strictly closer to the stated
 * "60 execute calls per minute" contract while keeping tenants separated: two
 * different PITs never share a bucket.
 */
const rateLimiters = new Map<string, RateLimiter>();

function getRateLimiter(token: string): RateLimiter {
  // Cheap guard against unbounded growth if an isolate is ever sprayed with
  // distinct tokens. Real traffic is ~20 PITs, so this never trips in practice.
  if (rateLimiters.size > 500) rateLimiters.clear();

  let limiter = rateLimiters.get(token);
  if (!limiter) {
    limiter = new RateLimiter(60_000, 60);
    rateLimiters.set(token, limiter);
  }
  return limiter;
}

/**
 * Builds a fresh McpServer for a single request.
 *
 * `createMcpHandler` connects the server to a transport and throws if handed an
 * already-connected instance ("Create a new McpServer instance per request for
 * stateless handlers"), so this must not be hoisted or memoised. The expensive
 * state — catalog, search index, action lookup — stays at module scope and is
 * shared across every request the isolate serves; only the three tool
 * registrations are per-request, which is negligible.
 */
function buildServer(apiToken: string): McpServer {
  const server = new McpServer(
    { name: "ghl-mcp-server", version: "0.1.0" },
    { instructions: SERVER_INSTRUCTIONS }
  );

  registerTools(server, {
    catalog: typedCatalog,
    searchIndex,
    actionById,
    categorySummary,
    getToken: () => apiToken,
    rateLimiter: getRateLimiter(apiToken),
    actionTips: ACTION_TIPS,
  });

  return server;
}

export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url);

    if (url.pathname === "/mcp") {
      const authHeader = request.headers.get("authorization") || "";
      const bearerMatch = authHeader.match(/^Bearer\s+(.+)$/i);
      const bearerToken = bearerMatch?.[1]?.trim() || "";
      const ghlToken = request.headers.get("x-ghl-token") || bearerToken;

      if (!ghlToken) {
        return new Response(
          JSON.stringify({
            error:
              "Missing authentication. Provide your GHL Private Integration Token via the X-GHL-Token header or Authorization: Bearer <token>.",
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

      // Stateless: no `sessionIdGenerator`, so no session id is issued and no
      // Durable Object is created. The token is closed over by this request's
      // tool handlers rather than persisted anywhere.
      return createMcpHandler(buildServer(ghlToken), { route: "/mcp" })(request, env, ctx);
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
