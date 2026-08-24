import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { searchActions, SearchIndex } from "./search.js";
import { executeAction, previewActionRequest } from "./executor.js";
import { RateLimiter } from "./rate-limiter.js";
import type { ActionTip } from "./action-tips.js";
import type { Catalog, CatalogAction } from "./types.js";

export interface ToolDeps {
  catalog: Catalog;
  searchIndex: SearchIndex;
  actionById: Map<string, CatalogAction>;
  categorySummary: string;
  getToken: () => string;
  rateLimiter: RateLimiter;
  actionTips: Record<string, ActionTip>;
}

export function registerTools(server: McpServer, deps: ToolDeps) {
  const { catalog, searchIndex, actionById, categorySummary, getToken, rateLimiter, actionTips } = deps;

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

  // Tool 1b: describe_action — the middle step of search -> describe -> execute.
  // search_actions now returns stubs; this is where the full schema for the ONE action the
  // agent chose gets fetched. Splitting it this way took a discovery cycle from ~63 KB to ~5 KB.
  server.registerTool(
    "describe_action",
    {
      description:
        "Get the full schema for ONE action id returned by search_actions: every path/query/body parameter with types, enums and required flags, the request-body schema, required scopes, risk metadata, and any known gotcha for this endpoint. Call this after search_actions and before execute_action whenever the action takes parameters you are unsure of.",
      inputSchema: {
        action_id: z
          .string()
          .describe("Action ID from search_actions, e.g. 'contacts__create-contact'."),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ action_id }) => {
      const action = actionById.get(action_id);
      if (!action) {
        const near = catalog.actions
          .filter((a: CatalogAction) => a.id.includes(action_id.split("__").pop() ?? action_id))
          .slice(0, 5)
          .map((a) => a.id);
        const structuredContent = {
          error: `Unknown action_id "${action_id.slice(0, 80)}".`,
          didYouMean: near,
          nextStep: "Call search_actions to find a valid action id.",
        };
        return {
          structuredContent,
          content: [{ type: "text" as const, text: JSON.stringify(structuredContent) }],
        };
      }

      const risk = inferActionRisk(action);
      const tip = actionTips[action.id];
      const structuredContent = {
        id: action.id,
        category: action.category,
        method: action.method,
        path: action.path,
        summary: action.summary,
        description: action.description,
        // MCP-standard-shaped safety hints, so a caller can reason about consequence
        // without re-deriving it from the method string.
        kind: action.method === "GET" ? "read" : "write",
        readOnly: action.method === "GET",
        destructive: action.method === "DELETE",
        requiresConfirmation: risk.requiresConfirmation,
        risk,
        scopes: action.scopes,
        versionHeader: action.versionHeader,
        parameters: action.parameters.map((p: CatalogAction["parameters"][number]) => ({
          name: p.name,
          in: p.in,
          required: p.required,
          type: p.type,
          description: p.description,
          ...(p.enum && { enum: p.enum }),
        })),
        requestBody: action.requestBody
          ? { required: action.requestBody.required, schema: action.requestBody.schema }
          : null,
        ...(tip?.note && { note: tip.note }),
        nextStep:
          action.method === "GET"
            ? "Call execute_action with these params."
            : "Call execute_action with dry_run=true first to preview the routed request.",
      };
      return {
        structuredContent,
        content: [{ type: "text" as const, text: JSON.stringify(structuredContent) }],
      };
    }
  );

  // Tool 2: Search actions by intent
  server.registerTool(
    "search_actions",
    {
      description:
        "Search for GHL API actions by describing what you want to do in plain English. Returns structured results with action IDs, params, request body schemas, notes, pagination, cross-category hints, and risk metadata. Call this before execute_action.",
      inputSchema: {
        intent: z
          .string()
          .max(200)
          .default("")
          .describe(
            "What you want to do, in plain English. E.g. 'create a contact', 'list invoices', 'send SMS'. Can be empty when category plus include_all=true is used."
          ),
        category: z
          .string()
          .optional()
          .describe(
            "Filter to a specific category. Use list_categories to see options."
          ),
        offset: z
          .number()
          .int()
          .min(0)
          .default(0)
          .describe("Skip this many results for pagination. Use with limit."),
        limit: z
          .number()
          .int()
          .min(1)
          .max(50)
          .default(10)
          .describe("Max results to return per page. Use offset to continue."),
        include_all: z
          .boolean()
          .default(false)
          .describe("When true and category is provided, enumerate every action in that category (paginated by offset/limit). intent can be empty in this mode."),
        // DEFAULT TRUE since 2026-08-24. Measured: full results cost ~15,800 tokens for a
        // 10-hit search because every hit carried its whole OpenAPI schema. Stubs cost ~2,100.
        // Callers that genuinely need the schema call describe_action on the one id they chose.
        compact: z
          .boolean()
          .default(true)
          .describe("Return compact stubs (id/method/path/summary/category/risk/note/kind). Default true — call describe_action for the full parameter and request-body schema of the one action you choose. Set false only to inline full schemas for every hit (expensive)."),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ intent, category, offset, limit, include_all, compact }) => {
      // Validate category if provided
      if (category && !catalog.categories.includes(category)) {
        const structuredContent = {
          results: [],
          notes: [`Unknown category "${category.slice(0, 50)}". Use list_categories to see available categories.`],
          pagination: { offset, limit, returned: 0, total: 0 },
          crossCategoryHints: [],
        };
        return {
          structuredContent,
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(structuredContent, null, 2),
            },
          ],
        };
      }

      if (include_all && !category) {
        const structuredContent = {
          results: [],
          notes: ["include_all=true requires a category so the result set stays bounded. Use list_categories first, then pass category plus include_all=true."],
          pagination: { offset, limit, returned: 0, total: 0 },
          crossCategoryHints: [],
        };
        return {
          structuredContent,
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(structuredContent, null, 2),
            },
          ],
        };
      }

      let actions = catalog.actions;
      if (category) {
        actions = actions.filter((a) => a.category === category);
      }

      const allCategoryActions = include_all
        ? actions
            .slice()
            .sort((a, b) => a.id.localeCompare(b.id))
        : [];
      const results = include_all
        ? allCategoryActions.slice(offset, offset + limit)
        : searchActions(searchIndex, actions, intent, offset + limit).slice(offset);

      // Cross-category hint: if a category filter is active, check if better results exist elsewhere
      let crossCategoryHints: string[] = [];
      if (category && !include_all) {
        const allResults = searchActions(searchIndex, catalog.actions, intent, 3);
        const outsideResults = allResults.filter((a) => a.category !== category);
        if (outsideResults.length > 0) {
          const hints = outsideResults.map((a) => `${a.id} (${a.category})`);
          crossCategoryHints = hints;
        }
      }

      const notes = buildIntentGuidance(intent, category, results);
      if (include_all && category) {
        notes.push(
          `Showing ${results.length} action(s) from category "${category}"${allCategoryActions.length > results.length ? ` (use offset=${offset + results.length} to continue through ${allCategoryActions.length} total actions)` : ""}.`
        );
      }

      if (results.length === 0) {
        notes.unshift(category
          ? `No actions found for "${intent.slice(0, 100)}" in category "${category}".${crossCategoryHints.length > 0 ? " Remove the category filter to see cross-category hints." : " Try removing the category filter or using broader keywords."}`
          : `No actions found for "${intent.slice(0, 100)}". Try broader keywords or use list_categories to browse.`);
        const structuredContent = {
          results: [],
          notes,
          pagination: { offset, limit, returned: 0, total: include_all ? allCategoryActions.length : 0 },
          crossCategoryHints,
        };
        return {
          structuredContent,
          content: [{ type: "text" as const, text: JSON.stringify(structuredContent, null, 2) }],
        };
      }

      const formatted = results.map((a) => {
        const tip = actionTips[a.id];
        const risk = inferActionRisk(a);
        return {
          id: a.id,
          method: a.method,
          path: a.path,
          summary: a.summary,
          category: a.category,
          risk,
          ...(tip?.note && { note: tip.note }),
          ...(compact ? {} : {
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
          }),
        };
      });

      const structuredContent = {
        results: formatted,
        notes,
        pagination: {
          offset,
          limit,
          returned: results.length,
          total: include_all ? allCategoryActions.length : undefined,
          nextOffset: include_all && offset + results.length < allCategoryActions.length
            ? offset + results.length
            : undefined,
        },
        crossCategoryHints,
      };

      // One copy, not two. This block used to also emit a pretty-printed JSON text duplicate
      // of structuredContent, doubling the cost of the single most-called tool.
      return {
        structuredContent,
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(structuredContent),
          },
        ],
      };
    }
  );

  // Tool 3: Execute an action
  server.registerTool(
    "execute_action",
    {
      description:
        "Execute a GHL API action by its ID. Get the action ID and required params from search_actions first. Params are a flat object and are routed automatically. Use dry_run=true to preview any non-GET action. High-risk actions such as send, publish, delete, remove, cancel, and billing/payment actions require confirm=true after reviewing the preview.",
      inputSchema: {
        action_id: z
          .string()
          .describe(
            "The action ID from search_actions, e.g. 'contacts__create-contact'"
          ),
        params: z
          .record(z.string(), z.unknown())
          .default({})
          .describe(
            "GHL API parameters only (path, query, and body fields as a flat object). Do NOT put result_filter, result_fields, result_offset, or result_limit here — those are separate top-level params."
          ),
        confirm: z
          .boolean()
          .default(false)
          .describe(
            "Set to true only after reviewing a preview for high-risk actions such as send, publish, delete, remove, cancel, payment, or billing actions."
          ),
        dry_run: z
          .boolean()
          .default(false)
          .describe(
            "Preview the routed method, URL path, query params, body, and risk notes without calling GHL. Recommended before any POST, PUT, PATCH, or DELETE."
          ),
        result_filter: z
          .string()
          .max(100)
          .optional()
          .describe(
            "Filter array results by keyword. Matches against string fields in each item (case-insensitive). Useful for finding specific items in large lists, e.g. searching custom fields by name."
          ),
        result_fields: z
          .string()
          .max(500)
          .optional()
          .describe(
            "Comma-separated list of fields to keep in each array item. Strips all other properties to reduce response size. E.g. 'id,name,fieldKey' returns only those 3 fields per item."
          ),
        result_offset: z
          .number()
          .int()
          .min(0)
          .default(0)
          .describe(
            "Starting index for paginating array responses. Use with result_limit to page through large result sets."
          ),
        result_limit: z
          .number()
          .int()
          .min(0)
          .max(100)
          .optional()
          .describe(
            "Max items to return from array responses. Use 0 for count-only (returns total + field names without data). E.g. result_limit=10 for first page, result_offset=10 result_limit=10 for second page."
          ),
      },
      annotations: { openWorldHint: true },
    },
    async ({ action_id, params, confirm, dry_run, result_filter, result_fields, result_offset, result_limit }) => {
      const action = actionById.get(action_id);
      if (!action) {
        const structuredContent = buildExecuteStructured({
          action: null,
          status: "error",
          ok: false,
          error: `Unknown action: "${action_id.slice(0, 100)}". Use search_actions to find valid action IDs.`,
        });
        return {
          isError: true,
          structuredContent,
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(structuredContent, null, 2),
            },
          ],
        };
      }

      // LLMs sometimes nest result_* params inside params — rescue them
      if ("result_filter" in params) {
        if (!result_filter) result_filter = String(params.result_filter);
        delete params.result_filter;
      }
      if ("result_fields" in params) {
        if (!result_fields) result_fields = String(params.result_fields);
        delete params.result_fields;
      }
      if ("result_offset" in params) {
        if (!result_offset) result_offset = Number(params.result_offset) || 0;
        delete params.result_offset;
      }
      if ("result_limit" in params) {
        if (result_limit == null) {
          const n = Number(params.result_limit);
          if (n >= 0) result_limit = n;
        }
        delete params.result_limit;
      }

      const risk = inferActionRisk(action);
      const requiresConfirmation = requiresActionConfirmation(risk);
      if (dry_run || (requiresConfirmation && !confirm)) {
        try {
          const preview = previewActionRequest(action, params, catalog.baseUrl);
          const status = dry_run ? "dry_run" : "confirmation_required";
          const note = requiresConfirmation && !confirm
            ? "Confirmation required before execution. Review the preview, then call execute_action again with the same action_id and params plus confirm=true."
            : "Dry run only. No request was sent to GHL.";
          const structuredContent = buildExecuteStructured({
            action: summarizeAction(action, risk),
            status,
            ok: false,
            data: preview,
            note,
          });
          return {
            structuredContent,
            content: [{ type: "text" as const, text: JSON.stringify(structuredContent, null, 2) }],
          };
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message.slice(0, 200) : "Unknown error";
          const structuredContent = buildExecuteStructured({
            action: summarizeAction(action, risk),
            status: "error",
            ok: false,
            error: msg,
          });
          return {
            isError: true,
            structuredContent,
            content: [{ type: "text" as const, text: JSON.stringify(structuredContent, null, 2) }],
          };
        }
      }

      const apiToken = getToken();
      if (!apiToken) {
        const structuredContent = buildExecuteStructured({
          action: summarizeAction(action, risk),
          status: "error",
          ok: false,
          error: "No GHL API token found. Pass your token via the X-GHL-Token header, Authorization: Bearer <token> (remote), or GHL_API_TOKEN env var (local).",
        });
        return {
          isError: true,
          structuredContent,
          content: [{ type: "text" as const, text: JSON.stringify(structuredContent, null, 2) }],
        };
      }

      if (!rateLimiter.check()) {
        const structuredContent = buildExecuteStructured({
          action: summarizeAction(action, risk),
          status: "rate_limited",
          ok: false,
          error: "Rate limit exceeded (max 60 execute calls per minute). Please wait before retrying.",
        });
        return {
          isError: true,
          structuredContent,
          content: [{ type: "text" as const, text: JSON.stringify(structuredContent, null, 2) }],
        };
      }

      try {
        const result = await executeAction(action, params, apiToken, catalog.baseUrl);

        let data = result.data;
        let filter: { term: string; matched: number; total: number } | null = null;
        let pagination: { offset: number; showing: number; total: number } | null = null;
        const actionNote = actionTips[action.id]?.note;

        // Apply result_filter to narrow array responses
        if (result_filter && typeof data === "object" && data !== null) {
          const filtered = filterResponseData(data, result_filter);
          if (filtered.total > 0) {
            data = filtered.data;
            filter = { term: result_filter, matched: filtered.matched, total: filtered.total };
          }
        }

        // Apply pagination to slice array responses
        const needsPagination = result_offset > 0 || result_limit != null;
        if (needsPagination && typeof data === "object" && data !== null) {
          // Count-only mode: result_limit=0 returns just the count
          if (result_limit === 0) {
            const countInfo = countArrayItems(data);
            const countResponse = countInfo.total > 0
              ? { totalItems: countInfo.total, fieldsPerItem: countInfo.sampleKeys }
              : data;
            const structuredContent = buildExecuteStructured({
              action: summarizeAction(action, risk),
              status: result.status,
              ok: result.status >= 200 && result.status < 300,
              data: countResponse,
              note: actionNote,
              filter,
              pagination: { offset: result_offset, showing: 0, total: countInfo.total },
            });
            return {
              structuredContent,
              content: [{
                type: "text" as const,
                text: JSON.stringify(structuredContent, null, 2),
              }],
            };
          }

          const paged = paginateResponseData(data, result_offset, result_limit);
          if (paged.total > 0) {
            data = paged.data;
            pagination = { offset: paged.offset, showing: paged.showing, total: paged.total };
          }
        }

        // Apply field projection to reduce item size
        if (result_fields && typeof data === "object" && data !== null) {
          data = projectResponseFields(data, result_fields);
        }

        const header = buildResponseHeader(action.method, action.path, result.status, actionNote, filter, pagination);
        const maxOutputLen = 8000 - header.length;

        let output: string;
        if (typeof data === "string") {
          output = truncateString(data, maxOutputLen);
        } else if (needsPagination && pagination) {
          // Pagination is active — avoid silent item drops from smart truncation.
          // Use compact JSON if pretty doesn't fit; only hard-truncate as last resort.
          const pretty = JSON.stringify(data, null, 2);
          if (pretty.length <= maxOutputLen) {
            output = pretty;
          } else {
            const compact = JSON.stringify(data);
            if (compact.length <= maxOutputLen) {
              output = compact;
            } else {
              output = truncateString(compact, maxOutputLen)
                + `\nTip: use result_fields to reduce item size, or a smaller result_limit.`;
            }
          }
        } else {
          output = smartStringify(data, maxOutputLen);
        }

        const structuredContent = buildExecuteStructured({
          action: summarizeAction(action, risk),
          status: result.status,
          ok: result.status >= 200 && result.status < 300,
          data,
          note: actionNote,
          filter,
          pagination,
        });
        return {
          structuredContent,
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                ...structuredContent,
                data: toTextFallbackData(data, output),
              }, null, 2),
            },
          ],
        };
      } catch (err: unknown) {
        const msg =
          err instanceof Error ? err.message.slice(0, 200) : "Unknown error";
        const structuredContent = buildExecuteStructured({
          action: summarizeAction(action, risk),
          status: "error",
          ok: false,
          error: msg,
        });
        return {
          isError: true,
          structuredContent,
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(structuredContent, null, 2),
            },
          ],
        };
      }
    }
  );
}

// ── Response filtering ─────────────────────────────────────────────

/**
 * Filter array items in a JSON response by keyword.
 * Searches all string-valued fields in each item (case-insensitive).
 */
function filterResponseData(
  data: unknown,
  filter: string
): { data: unknown; total: number; matched: number } {
  const term = filter.toLowerCase();

  if (Array.isArray(data)) {
    const matched = data.filter((item) => itemMatches(item, term));
    return { data: matched, total: data.length, matched: matched.length };
  }

  if (typeof data === "object" && data !== null) {
    const obj = data as Record<string, unknown>;
    const result: Record<string, unknown> = {};
    let total = 0;
    let matched = 0;
    let foundArray = false;

    for (const [key, val] of Object.entries(obj)) {
      if (Array.isArray(val)) {
        foundArray = true;
        total += val.length;
        const filtered = val.filter((item) => itemMatches(item, term));
        matched += filtered.length;
        result[key] = filtered;
      } else {
        result[key] = val;
      }
    }

    if (foundArray) return { data: result, total, matched };
  }

  return { data, total: 0, matched: 0 };
}

function itemMatches(item: unknown, term: string): boolean {
  return valueMatches(item, term, 0);
}

function valueMatches(value: unknown, term: string, depth: number): boolean {
  if (depth > 6) return false;
  if (typeof value === "string") return value.toLowerCase().includes(term);
  if (Array.isArray(value)) {
    return value.some((entry) => valueMatches(entry, term, depth + 1));
  }
  if (typeof value !== "object" || value === null) return false;
  return Object.values(value as Record<string, unknown>).some((entry) =>
    valueMatches(entry, term, depth + 1)
  );
}

// ── Field projection ──────────────────────────────────────────────

/**
 * Keep only the specified fields in each array item.
 * Handles both top-level arrays and objects with array properties.
 */
function projectResponseFields(data: unknown, fields: string): unknown {
  const keys = new Set(fields.split(",").map((f) => f.trim()).filter(Boolean));
  if (keys.size === 0) return data;

  const project = (item: unknown): unknown => {
    if (typeof item !== "object" || item === null) return item;
    const obj = item as Record<string, unknown>;
    const result: Record<string, unknown> = {};
    for (const key of keys) {
      if (key in obj) result[key] = obj[key];
    }
    return result;
  };

  if (Array.isArray(data)) return data.map(project);

  if (typeof data === "object" && data !== null) {
    const obj = data as Record<string, unknown>;
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(obj)) {
      result[key] = Array.isArray(val) ? val.map(project) : val;
    }
    return result;
  }

  return data;
}

// ── Count-only mode ───────────────────────────────────────────────

/**
 * Count array items and extract sample field names without returning data.
 */
function countArrayItems(data: unknown): { total: number; sampleKeys: string[] } {
  if (Array.isArray(data)) {
    const sample = data[0];
    const keys = typeof sample === "object" && sample !== null ? Object.keys(sample as Record<string, unknown>) : [];
    return { total: data.length, sampleKeys: keys };
  }

  if (typeof data === "object" && data !== null) {
    const obj = data as Record<string, unknown>;
    for (const val of Object.values(obj)) {
      if (Array.isArray(val)) {
        const sample = val[0];
        const keys = typeof sample === "object" && sample !== null ? Object.keys(sample as Record<string, unknown>) : [];
        return { total: val.length, sampleKeys: keys };
      }
    }
  }

  return { total: 0, sampleKeys: [] };
}

// ── Pagination ────────────────────────────────────────────────────

/**
 * Slice arrays in a response for server-side pagination.
 * Handles both top-level arrays and objects containing arrays (first array only).
 */
function paginateResponseData(
  data: unknown,
  offset: number,
  limit?: number
): { data: unknown; total: number; showing: number; offset: number } {
  const slice = (arr: unknown[]) => {
    const sliced = limit != null
      ? arr.slice(offset, offset + limit)
      : arr.slice(offset);
    return { sliced, total: arr.length };
  };

  if (Array.isArray(data)) {
    const { sliced, total } = slice(data);
    return { data: sliced, total, showing: sliced.length, offset };
  }

  if (typeof data === "object" && data !== null) {
    const obj = data as Record<string, unknown>;
    const result: Record<string, unknown> = {};
    let paged = false;
    let total = 0;
    let showing = 0;

    for (const [key, val] of Object.entries(obj)) {
      if (Array.isArray(val) && !paged) {
        paged = true;
        const { sliced, total: arrTotal } = slice(val);
        total = arrTotal;
        showing = sliced.length;
        result[key] = sliced;
      } else {
        result[key] = val;
      }
    }

    if (paged) return { data: result, total, showing, offset };
  }

  return { data, total: 0, showing: 0, offset };
}

// ── Smart truncation ──────────────────────────────────────────────

function truncateString(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen) + `\n\n... (truncated, ${text.length} chars total)`;
}

/**
 * JSON-stringify with array-aware truncation.
 * Instead of cutting mid-JSON, reduces arrays to fit and reports the count.
 */
function smartStringify(data: unknown, maxLen: number): string {
  const pretty = JSON.stringify(data, null, 2);
  if (pretty.length <= maxLen) return pretty;

  // Find the first array property and truncate it to fit
  if (typeof data === "object" && data !== null && !Array.isArray(data)) {
    const obj = data as Record<string, unknown>;
    for (const [key, val] of Object.entries(obj)) {
      if (Array.isArray(val) && val.length > 1) {
        return truncateArrayProp(obj, key, val, maxLen);
      }
    }
  }

  // Top-level array
  if (Array.isArray(data) && data.length > 1) {
    const firstSize = JSON.stringify(data[0]).length + 20;
    const budget = maxLen - 200;
    let n = Math.min(data.length, Math.max(1, Math.floor(budget / firstSize)));
    for (; n >= 1; n--) {
      const text = JSON.stringify(data.slice(0, n), null, 2);
      const suffix = `\n\n... showing ${n} of ${data.length} items. Use result_offset=${n} to continue, or result_filter/result_limit to refine the page.`;
      if (text.length + suffix.length <= maxLen) return text + suffix;
    }
    return truncateString(JSON.stringify(data.slice(0, 1), null, 2), maxLen);
  }

  // Fallback: hard truncation (pretty already computed above)
  return truncateString(pretty, maxLen);
}

function truncateArrayProp(
  obj: Record<string, unknown>,
  key: string,
  arr: unknown[],
  maxLen: number
): string {
  // Estimate how many items fit based on first item size
  const firstSize = JSON.stringify(arr[0]).length + 20;
  const budget = maxLen - 200; // reserve for wrapper + message
  let n = Math.min(arr.length, Math.max(1, Math.floor(budget / firstSize)));

  // Adjust down until it fits
  for (; n >= 1; n--) {
    const trial = { ...obj, [key]: arr.slice(0, n) };
    const text = JSON.stringify(trial, null, 2);
    const suffix = `\n\n... showing ${n} of ${arr.length} items in "${key}". Use result_offset=${n} to continue, or result_filter/result_limit to refine the page.`;
    if (text.length + suffix.length <= maxLen) {
      return text + suffix;
    }
  }

  // Even 1 item doesn't fit — hard truncate
  const single = { ...obj, [key]: arr.slice(0, 1) };
  const text = JSON.stringify(single, null, 2);
  return truncateString(text, maxLen);
}

// ── Catalog helpers ───────────────────────────────────────────────

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

function buildResponseHeader(
  method: string,
  path: string,
  status: number,
  note: string | undefined,
  filter: { term: string; matched: number; total: number } | null,
  pagination: { offset: number; showing: number; total: number } | null
): string {
  let header = `${method} ${path} → ${status}`;
  if (note) header += `\nNote: ${note}`;
  if (filter) {
    header += `\nFiltered: ${filter.matched} of ${filter.total} items matching "${filter.term}"`;
  }
  if (pagination) {
    const start = pagination.offset + 1;
    const end = pagination.offset + pagination.showing;
    header += `\nShowing items ${start}-${end} of ${pagination.total}`;
  }
  header += "\n\n";
  return header;
}

function buildIntentGuidance(
  intent: string,
  category: string | undefined,
  results: CatalogAction[]
): string[] {
  const normalized = intent.toLowerCase();
  const notes: string[] = [];
  const pushNote = (note: string) => {
    if (!notes.includes(note)) notes.push(note);
  };

  const mentionsConversationAi =
    normalized.includes("conversation ai") ||
    normalized.includes("conversation bot") ||
    normalized.includes("conversation bots") ||
    normalized.includes("conversation agent") ||
    normalized.includes("conversation agents");
  if (mentionsConversationAi) {
    pushNote(
      "Conversation AI bot configuration is not exposed in the public GHL API. Prompts, settings, transfer rules, and bot lists still have to be inspected in the GHL UI. The voice-ai endpoints are a different product surface."
    );
  }

  const asksForWorkflowInternals =
    normalized.includes("workflow") &&
    /(step|steps|trigger|triggers|condition|conditions|detail|details|ai agent|ai agents)/.test(normalized);
  if (asksForWorkflowInternals || category === "workflows") {
    pushNote(
      "The public GHL API only exposes a minimal workflow list via workflows__get-workflow. Workflow triggers, steps, conditions, and AI-agent usage details are UI-only today."
    );
  }

  const asksForPipelineWrites =
    (normalized.includes("pipeline") || normalized.includes("stage")) &&
    /(create|add|update|edit|delete)/.test(normalized);
  if (asksForPipelineWrites) {
    pushNote(
      "Pipelines and stages are now writable via the API (added 2026-06-26): opportunities-v3__create-pipeline, opportunities-v3__update-pipeline, and opportunities-v3__delete-pipeline. Deleting a pipeline permanently removes every opportunity in it."
    );
  }

  const v3Bases = new Set(
    results
      .filter((result) => result.category.endsWith("-v3"))
      .map((result) => result.category.slice(0, -3))
  );
  const mixesV2AndV3 = results.some((result) => v3Bases.has(result.category));
  if (mixesV2AndV3) {
    pushNote(
      "Results include both legacy (v2) and v3 variants of the same API. Categories ending in -v3 are GHL API v3 (Version header v3, camelCase params) — prefer them; the unsuffixed twin is the older spec kept for compatibility."
    );
  }

  if (
    normalized.includes("template") &&
    /(create|add|new)/.test(normalized) &&
    (normalized.includes("sms") || normalized.includes("email"))
  ) {
    pushNote(
      "Email templates CAN be created via the API: emails-v3__create-email-template / emails-v3__import-email-template (or the older emails__create-template builder endpoint). Only SMS template creation is still UI-only — /locations/{locationId}/templates supports list and delete only."
    );
  }

  if (
    normalized.includes("sender domain") ||
    normalized.includes("a2p") ||
    normalized.includes("signing key") ||
    normalized.includes("signing keys") ||
    normalized.includes("webhook key")
  ) {
    pushNote(
      "Sub-account security settings such as sender domain, A2P registration, and webhook signing keys are UI-only in GHL."
    );
  }

  if (
    (normalized.includes("conversation history") || normalized.includes("get messages for contact") || normalized.includes("read messages for contact")) &&
    !mentionsConversationAi
  ) {
    pushNote(
      "To read conversation history, first use conversations__search-conversation to locate the thread for the contact, then use conversations__get-messages with that conversationId."
    );
  }

  if (
    normalized.includes("stripe") &&
    (normalized.includes("product") ||
      normalized.includes("coupon") ||
      normalized.includes("payment") ||
      normalized.includes("subscription"))
  ) {
    pushNote(
      "For commerce setup, use GHL's products__* and payments__* endpoints. Stripe is the underlying rail, but direct Stripe API access is usually not needed for normal GHL configuration."
    );
  }

  if (
    mentionsConversationAi &&
    results.some((result) => result.category === "voice-ai")
  ) {
    pushNote(
      "If you only need Voice AI, use the voice-ai__* actions shown here. They do not expose Conversation AI bots."
    );
  }

  return notes;
}

type ActionRiskKind = "read" | "write" | "external_send" | "billing" | "delete";

interface ActionRisk {
  level: "low" | "medium" | "high";
  kinds: ActionRiskKind[];
  notes: string[];
  requiresConfirmation: boolean;
}

function inferActionRisk(action: CatalogAction): ActionRisk {
  const method = action.method.toUpperCase();
  const text = `${action.id} ${action.summary} ${action.description}`.toLowerCase();
  const kinds = new Set<ActionRiskKind>();
  const notes: string[] = [];

  if (method === "GET") {
    kinds.add("read");
  } else {
    kinds.add("write");
    notes.push(`${method} can change GHL account data.`);
  }

  if (method === "DELETE" || /\b(delete|remove|archive)\b/.test(text)) {
    kinds.add("delete");
    notes.push("Can delete, remove, archive, or otherwise destroy records.");
  }

  if (method !== "GET" && /\b(send|message|sms|email|call|publish|post|webhook|notification)\b/.test(text)) {
    kinds.add("external_send");
    notes.push("Can create externally visible communication or published content.");
  }

  if (/\b(payment|payments|invoice|billing|subscription|coupon|order|charge|refund|saas)\b/.test(text)) {
    kinds.add("billing");
    notes.push(
      method === "GET"
        ? "Reads payment, billing, subscription, invoice, coupon, order, or SaaS commerce data."
        : "Touches payment, billing, subscription, invoice, coupon, order, or SaaS commerce data."
    );
  }

  if (/\b(cancel|void|disable|disconnect|revoke)\b/.test(text)) {
    notes.push("Can cancel, disable, disconnect, revoke, or otherwise interrupt an active setup.");
  }

  const requiresConfirmation =
    method !== "GET" && (
      kinds.has("delete") ||
      kinds.has("external_send") ||
      kinds.has("billing") ||
      /\b(cancel|publish|remove|delete|send|payment|billing|charge|refund)\b/.test(text)
    );

  const level = requiresConfirmation
    ? "high"
    : kinds.has("write")
      ? "medium"
      : "low";

  return {
    level,
    kinds: [...kinds],
    notes,
    requiresConfirmation,
  };
}

function requiresActionConfirmation(risk: ActionRisk): boolean {
  return risk.requiresConfirmation;
}

function summarizeAction(action: CatalogAction, risk: ActionRisk) {
  return {
    id: action.id,
    method: action.method,
    path: action.path,
    summary: action.summary,
    category: action.category,
    risk,
  };
}

function buildExecuteStructured(input: {
  action: ReturnType<typeof summarizeAction> | null;
  status: number | string;
  ok: boolean;
  data?: unknown;
  note?: string;
  filter?: { term: string; matched: number; total: number } | null;
  pagination?: { offset: number; showing: number; total: number } | null;
  error?: string;
}) {
  return {
    action: input.action,
    status: input.status,
    ok: input.ok,
    data: input.data ?? null,
    note: input.note ?? null,
    filter: input.filter ?? null,
    pagination: input.pagination ?? null,
    error: input.error ?? null,
  };
}

function toTextFallbackData(data: unknown, output: string): unknown {
  if (typeof data === "string") return output;
  try {
    return JSON.parse(output);
  } catch {
    return output;
  }
}
