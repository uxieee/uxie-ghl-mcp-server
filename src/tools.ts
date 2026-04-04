import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { searchActions, SearchIndex } from "./search.js";
import { executeAction } from "./executor.js";
import { RateLimiter } from "./rate-limiter.js";
import type { Catalog, CatalogAction } from "./types.js";

export interface ToolDeps {
  catalog: Catalog;
  searchIndex: SearchIndex;
  actionById: Map<string, CatalogAction>;
  categorySummary: string;
  getToken: () => string;
  rateLimiter: RateLimiter;
}

export function registerTools(server: McpServer, deps: ToolDeps) {
  const { catalog, searchIndex, actionById, categorySummary, getToken, rateLimiter } = deps;

  // Tool 1: List all categories
  server.registerTool(
    "list_categories",
    {
      description:
        "List all available GHL API categories. Call this first to understand what's available. Returns category names and action counts.",
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    async () => ({
      content: [
        {
          type: "text" as const,
          text: categorySummary,
        },
      ],
    })
  );

  // Tool 2: Search actions by intent
  server.registerTool(
    "search_actions",
    {
      description:
        "Search for GHL API actions by describing what you want to do in plain English. Returns matching actions with their IDs, parameters, and request body schemas. Call this before execute_action to find the right action ID and understand required params.",
      inputSchema: {
        intent: z
          .string()
          .max(200)
          .describe(
            "What you want to do, in plain English. E.g. 'create a contact', 'list invoices', 'send SMS'"
          ),
        category: z
          .string()
          .optional()
          .describe(
            "Filter to a specific category. Use list_categories to see options."
          ),
        limit: z
          .number()
          .int()
          .min(1)
          .max(25)
          .default(10)
          .describe("Max results to return"),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ intent, category, limit }) => {
      // Validate category if provided
      if (category && !catalog.categories.includes(category)) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Unknown category "${category.slice(0, 50)}". Use list_categories to see available categories.`,
            },
          ],
        };
      }

      let actions = catalog.actions;
      if (category) {
        actions = actions.filter((a) => a.category === category);
      }

      const results = searchActions(searchIndex, actions, intent, limit);

      if (results.length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: `No actions found for "${intent.slice(0, 100)}". Try broader keywords or use list_categories to browse.`,
            },
          ],
        };
      }

      const formatted = results.map((a) => ({
        id: a.id,
        method: a.method,
        path: a.path,
        summary: a.summary,
        category: a.category,
        parameters: a.parameters.map((p) => ({
          name: p.name,
          in: p.in,
          required: p.required,
          type: p.type,
          description: p.description,
          ...(p.enum && { enum: p.enum }),
        })),
        requestBody: a.requestBody
          ? { required: a.requestBody.required, schema: a.requestBody.schema }
          : null,
        scopes: a.scopes,
      }));

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(formatted),
          },
        ],
      };
    }
  );

  // Only DELETE requires confirmation — PUT/PATCH are idempotent updates
  const DESTRUCTIVE_METHODS = new Set(["DELETE"]);

  // Tool 3: Execute an action
  server.registerTool(
    "execute_action",
    {
      description:
        "Execute a GHL API action by its ID. Get the action ID and required params from search_actions first. Params are passed as a flat object — path params, query params, and body fields are all merged together and routed automatically. For destructive actions (DELETE, PUT, PATCH), you must first call without confirm=true to see what will happen, then call again with confirm=true to execute.",
      inputSchema: {
        action_id: z
          .string()
          .describe(
            "The action ID from search_actions, e.g. 'contacts__create-contact'"
          ),
        params: z
          .record(z.unknown())
          .default({})
          .describe(
            "Parameters object. Include path params (e.g. contactId), query params, and body fields as a flat object."
          ),
        confirm: z
          .boolean()
          .default(false)
          .describe(
            "Set to true to confirm a destructive action (DELETE/PUT/PATCH). First call without confirm to preview, then call with confirm=true to execute."
          ),
      },
      annotations: { openWorldHint: true },
    },
    async ({ action_id, params, confirm }) => {
      const apiToken = getToken();
      if (!apiToken) {
        return {
          isError: true,
          content: [
            {
              type: "text" as const,
              text: "No GHL API token found. Pass your token via the X-GHL-Token header (remote) or GHL_API_TOKEN env var (local).",
            },
          ],
        };
      }

      if (!rateLimiter.check()) {
        return {
          isError: true,
          content: [
            {
              type: "text" as const,
              text: "Rate limit exceeded (max 60 execute calls per minute). Please wait before retrying.",
            },
          ],
        };
      }

      const action = actionById.get(action_id);
      if (!action) {
        return {
          isError: true,
          content: [
            {
              type: "text" as const,
              text: `Unknown action: "${action_id.slice(0, 100)}". Use search_actions to find valid action IDs.`,
            },
          ],
        };
      }

      // Safe mode: require confirmation for destructive actions
      const isDestructive = DESTRUCTIVE_METHODS.has(action.method.toUpperCase());

      if (isDestructive && !confirm) {
        const paramSummary = Object.entries(params)
          .map(([k, v]) => `  ${k}: ${JSON.stringify(v)}`)
          .join("\n");

        return {
          content: [
            {
              type: "text" as const,
              text: [
                `⚠️ DESTRUCTIVE ACTION — Confirmation required`,
                ``,
                `Action: ${action.summary} (${action.method} ${action.path})`,
                `Category: ${action.category}`,
                paramSummary ? `Parameters:\n${paramSummary}` : `Parameters: none`,
                ``,
                `To execute this action, call execute_action again with the same action_id and params, plus confirm: true.`,
              ].join("\n"),
            },
          ],
        };
      }

      // confirm=true bypasses safe mode — Claude is responsible for asking the user
      try {
        const result = await executeAction(action, params, apiToken);

        const output =
          typeof result.data === "string"
            ? result.data
            : JSON.stringify(result.data);

        const maxLen = 8000;
        const truncated =
          output.length > maxLen
            ? output.slice(0, maxLen) +
              `\n\n... (truncated, ${output.length} chars total)`
            : output;

        return {
          content: [
            {
              type: "text" as const,
              text: `${action.method} ${action.path} → ${result.status}\n\n${truncated}`,
            },
          ],
        };
      } catch (err: unknown) {
        const msg =
          err instanceof Error ? err.message.slice(0, 200) : "Unknown error";
        return {
          isError: true,
          content: [
            {
              type: "text" as const,
              text: `Request failed: ${msg}`,
            },
          ],
        };
      }
    }
  );
}

/**
 * Pre-compute shared catalog data structures.
 */
export function buildCatalogData(catalog: Catalog) {
  // Action lookup map (O(1) instead of linear scan)
  const actionById = new Map(
    catalog.actions.map((a) => [a.id, a])
  );

  // Pre-computed category summary
  const counts: Record<string, number> = {};
  for (const action of catalog.actions) {
    counts[action.category] = (counts[action.category] || 0) + 1;
  }
  const categorySummary =
    `${catalog.totalActions} total actions across ${catalog.categories.length} categories:\n\n` +
    Object.entries(counts)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([cat, count]) => `${cat}: ${count} actions`)
      .join("\n");

  return { actionById, categorySummary };
}
