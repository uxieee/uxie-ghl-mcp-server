import { SERVER_INSTRUCTIONS, WORKER_DEPRECATION_NOTICE } from "./instructions.js";
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
    { instructions: `${WORKER_DEPRECATION_NOTICE}

${SERVER_INSTRUCTIONS}` }
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
