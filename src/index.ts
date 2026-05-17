import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpAgent } from "agents/mcp";
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

export interface Env {
  MCP_OBJECT: DurableObjectNamespace;
}

interface GHLSessionProps extends Record<string, unknown> {
  apiToken?: string;
}

export class GHLServer extends McpAgent<Env, unknown, GHLSessionProps> {
  server = new McpServer(
    {
      name: "ghl-mcp-server",
      version: "0.1.0",
    },
    {
      instructions: [
        "GoHighLevel API MCP server — 576 endpoints across 41 categories.",
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
        "Rate limit: 60 execute calls per minute.",
        "Param routing: path params → URL, query params → query string, remainder → request body. Undocumented but valid body keys are passed through to GHL so OpenAPI spec gaps do not block valid requests.",
        "Known public-API gaps such as workflow builder internals and pipeline creation are surfaced explicitly in search notes so the model does not keep hunting for non-existent endpoints. Conversation AI agents are now exposed under the conversation-ai category.",
        "For commerce setup, GHL's products__* and payments__* endpoints are the source of truth. Stripe is the underlying rail, but direct Stripe API access is usually not needed.",
      ].join("\n"),
    }
  );

  private rateLimiter = new RateLimiter(60_000, 60);
  private apiToken: string = "";

  override async updateProps(props?: GHLSessionProps): Promise<void> {
    // Keep the caller-provided PIT request/session-scoped. The base McpAgent
    // persists props in Durable Object storage; this server must not persist
    // user GHL tokens.
    this.props = props;
  }

  async init() {
    this.apiToken = this.props?.apiToken || "";

    registerTools(this.server, {
      catalog: typedCatalog,
      searchIndex,
      actionById,
      categorySummary,
      getToken: () => this.apiToken,
      rateLimiter: this.rateLimiter,
      actionTips: ACTION_TIPS,
    });
  }
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

      const mcpCtx = Object.assign(Object.create(ctx), {
        props: { apiToken: ghlToken } satisfies GHLSessionProps,
      }) as ExecutionContext & { props: GHLSessionProps };

      return GHLServer.serve("/mcp").fetch(request, env, mcpCtx);
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
