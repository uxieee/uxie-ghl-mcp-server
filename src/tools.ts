import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { searchActions, SearchIndex } from "./search.js";
import { executeAction } from "./executor.js";
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
          .describe("Max results to return"),
        include_all: z
          .boolean()
          .default(false)
          .describe("When true and category is provided, return every action in that category (paginated by offset/limit) instead of relevance-ranked matches."),
        compact: z
          .boolean()
          .default(false)
          .describe("When true, return only id/method/path/summary/category per result. Omits parameters, requestBody, and scopes to reduce response size."),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ intent, category, offset, limit, include_all, compact }) => {
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

      if (include_all && !category) {
        return {
          content: [
            {
              type: "text" as const,
              text: "include_all=true requires a category so the result set stays bounded. Use list_categories first, then pass category plus include_all=true.",
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
      let crossCategoryHint = "";
      if (category && !include_all) {
        const allResults = searchActions(searchIndex, catalog.actions, intent, 3);
        const outsideResults = allResults.filter((a) => a.category !== category);
        if (outsideResults.length > 0) {
          const hints = outsideResults.map((a) => `${a.id} (${a.category})`);
          crossCategoryHint = `\n\nAlso found in other categories: ${hints.join(", ")}. Remove the category filter to see them.`;
        }
      }

      const guidance = formatGuidanceNotes(
        buildIntentGuidance(intent, category, results)
      );

      const includeAllHint =
        include_all && category
          ? formatGuidanceNotes([
              `Showing ${results.length} action(s) from category "${category}"${allCategoryActions.length > results.length ? ` (use offset=${offset + results.length} to continue through ${allCategoryActions.length} total actions)` : ""}.`,
            ])
          : "";

      if (results.length === 0) {
        const msg = category
          ? `No actions found for "${intent.slice(0, 100)}" in category "${category}".${crossCategoryHint || " Try removing the category filter or using broader keywords."}`
          : `No actions found for "${intent.slice(0, 100)}". Try broader keywords or use list_categories to browse.`;
        return {
          content: [{ type: "text" as const, text: msg + guidance }],
        };
      }

      const formatted = results.map((a) => {
        const tip = actionTips[a.id];
        return {
          id: a.id,
          method: a.method,
          path: a.path,
          summary: a.summary,
          category: a.category,
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

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(formatted) + includeAllHint + guidance + crossCategoryHint,
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
        "Execute a GHL API action by its ID. Get the action ID and required params from search_actions first. Params are passed as a flat object — path params, query params, and body fields are all merged together and routed automatically. For destructive actions (DELETE), you must first call without confirm=true to see what will happen, then call again with confirm=true to execute. For large responses: use result_filter to search by keyword, or result_offset/result_limit to paginate.",
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
            "GHL API parameters only (path, query, and body fields as a flat object). Do NOT put result_filter, result_fields, result_offset, or result_limit here — those are separate top-level params."
          ),
        confirm: z
          .boolean()
          .default(false)
          .describe(
            "Set to true to confirm a destructive action (DELETE). First call without confirm to preview, then call with confirm=true to execute."
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
    async ({ action_id, params, confirm, result_filter, result_fields, result_offset, result_limit }) => {
      const apiToken = getToken();
      if (!apiToken) {
        return {
          isError: true,
          content: [
            {
              type: "text" as const,
              text: "No GHL API token found. Pass your token via the X-GHL-Token header, Authorization: Bearer <token> (remote), or GHL_API_TOKEN env var (local).",
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

      // confirm=true bypasses safe mode — Claude is responsible for asking the user
      try {
        const result = await executeAction(action, params, apiToken);

        let data = result.data;
        let filterLine = "";
        let pageLine = "";
        const actionNote = actionTips[action.id]?.note;

        // Apply result_filter to narrow array responses
        if (result_filter && typeof data === "object" && data !== null) {
          const filtered = filterResponseData(data, result_filter);
          if (filtered.total > 0) {
            data = filtered.data;
            filterLine = `\nFiltered: ${filtered.matched} of ${filtered.total} items matching "${result_filter}"`;
          }
        }

        // Apply pagination to slice array responses
        const needsPagination = result_offset > 0 || result_limit != null;
        if (needsPagination && typeof data === "object" && data !== null) {
          // Count-only mode: result_limit=0 returns just the count
          if (result_limit === 0) {
            const countInfo = countArrayItems(data);
            const countResponse = countInfo.total > 0
              ? `Total items: ${countInfo.total}` + (countInfo.sampleKeys.length > 0 ? `\nFields per item: ${countInfo.sampleKeys.join(", ")}` : "")
              : JSON.stringify(data);
            return {
              content: [{
                type: "text" as const,
                text: buildResponseHeader(action.method, action.path, result.status, actionNote, filterLine, "") + countResponse,
              }],
            };
          }

          const paged = paginateResponseData(data, result_offset, result_limit);
          if (paged.total > 0) {
            data = paged.data;
            const start = paged.offset + 1;
            const end = paged.offset + paged.showing;
            pageLine = `\nShowing items ${start}–${end} of ${paged.total}`;
          }
        }

        // Apply field projection to reduce item size
        if (result_fields && typeof data === "object" && data !== null) {
          data = projectResponseFields(data, result_fields);
        }

        const header = buildResponseHeader(
          action.method,
          action.path,
          result.status,
          actionNote,
          filterLine,
          pageLine
        );
        const maxOutputLen = 8000 - header.length;

        let output: string;
        if (typeof data === "string") {
          output = truncateString(data, maxOutputLen);
        } else if (needsPagination && pageLine) {
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

        return {
          content: [
            {
              type: "text" as const,
              text: header + output,
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
  filterLine: string,
  pageLine: string
): string {
  let header = `${method} ${path} → ${status}`;
  if (note) header += `\nNote: ${note}`;
  header += `${filterLine}${pageLine}\n\n`;
  return header;
}

function formatGuidanceNotes(notes: string[]): string {
  if (notes.length === 0) return "";
  return `\n\nNotes:\n- ${notes.join("\n- ")}`;
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
      "Pipeline containers and stages are read-only via the public GHL API. Use opportunities__get-pipelines to inspect them, but create or edit them in the GHL UI."
    );
  }

  if (
    normalized.includes("template") &&
    /(create|add|new)/.test(normalized) &&
    (normalized.includes("sms") || normalized.includes("email"))
  ) {
    pushNote(
      "The public GHL API can list or delete email/SMS templates, but creating them is still UI-only."
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
