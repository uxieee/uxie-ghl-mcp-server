import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { searchActions, SearchIndex } from "./search.js";
import { executeAction, previewActionRequest } from "./executor.js";
import type { AccountsRegistry } from "./accounts.js";
import { RateLimiter } from "./rate-limiter.js";
import type { ActionTip } from "./action-tips.js";
import type { Catalog, CatalogAction, ActionRisk } from "./types.js";
import { filterResponseData, projectResponseFields, countArrayItems, paginateResponseData, smartStringify, truncateString } from "./response-shaping.js";
import { locationShapeOf, twinIdOf, categoryFamily, collapseTwins, preferTwin } from "./twins.js";
import { inferActionRisk, requiresActionConfirmation } from "./risk.js";

export interface ToolDeps {
  catalog: Catalog;
  searchIndex: SearchIndex;
  actionById: Map<string, CatalogAction>;
  categorySummary: string;
  getToken: () => string;
  /** Present only when the server was started with an accounts file (multi sub-account). */
  accounts?: AccountsRegistry;
  rateLimiter: RateLimiter;
  actionTips: Record<string, ActionTip>;
}

export function registerTools(server: McpServer, deps: ToolDeps) {
  const { catalog, searchIndex, actionById, categorySummary, getToken, rateLimiter, actionTips, accounts } = deps;

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

  // Tool 0: list_locations — only exists when an accounts file is configured.
  // Reads the file's own entries; makes no API call, so it cannot hit the 403 that GHL's
  // /locations/search returns for a sub-account PIT.
  if (accounts) {
    server.registerTool(
      "list_locations",
      {
        description:
          "List the GHL sub-accounts (locations) this server holds a token for. Call this before execute_action when you do not already know which sub-account to operate on, and pass the chosen id as execute_action's locationId. `binding` reports whether the configured token has been proven to reach that location yet.",
        inputSchema: {},
        annotations: { readOnlyHint: true },
      },
      async () => {
        const structuredContent = {
          locations: accounts.list(),
          note:
            accounts.size === 1
              ? "One sub-account configured; locationId may be omitted."
              : "Pass locationId on execute_action to choose one. An id with no configured token is refused rather than silently sent with another account's token.",
        };
        return {
          structuredContent,
          content: [{ type: "text" as const, text: JSON.stringify(structuredContent) }],
        };
      }
    );
  }

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
        // Search collapses twins, but an agent can reach describe_action with either id
        // directly — it should learn the other exists here too, not only via search.
        ...(twinIdOf(action, catalog.actions) && {
          alsoAvailableAs: twinIdOf(action, catalog.actions),
          twinNote:
            "The same method+path is published twice by GHL (a v2 spec and a v3 twin). Either id works; they usually differ only in the Version header.",
        }),
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
      // ONE ranked pass over the whole catalog, then slice. A category-filtered query used to
      // rank `actions` and then rank `catalog.actions` AGAIN just to build cross-category
      // hints — scoring all 1207 entries twice per call. Ranking the full set once and
      // partitioning it gives the same two answers for half the work.
      //
      // COLLAPSE v2/v3 TWINS: 536 method+path pairs exist twice (410 byte-identical), so an
      // un-collapsed search spent half its rows showing the agent the same operation and made
      // it choose. include_all is deliberately left alone — it is an explicit enumeration.
      let results: CatalogAction[];
      let crossCategoryHints: string[] = [];
      let matchedTotal = 0;

      if (include_all) {
        results = allCategoryActions.slice(offset, offset + limit);
        matchedTotal = allCategoryActions.length;
      } else {
        // Rank once over everything, collapse twins, then partition by the category filter.
        const ranked = collapseTwins(
          searchActions(searchIndex, catalog.actions, intent, (offset + limit) * 2 + 20)
        );
        // Match the category FAMILY, not the exact string: `contacts` and `contacts-v3` are
        // the same endpoints. Comparing exact names made a twin of an already-returned result
        // show up under crossCategoryHints as if it were somewhere else to look.
        const inCategory = category
          ? ranked.filter((a) => categoryFamily(a.category) === categoryFamily(category))
          : ranked;
        matchedTotal = inCategory.length;
        results = inCategory.slice(offset, offset + limit);
        if (category) {
          crossCategoryHints = ranked
            .filter((a) => categoryFamily(a.category) !== categoryFamily(category))
            .slice(0, 3)
            .map((a) => `${a.id} (${a.category})`);
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
        // ACTION_TIPS are keyed by action id, and 14 of the 21 entries key the v2 id while
        // an untipped -v3 twin exists. Since search now prefers the v3 twin, look the tip up
        // under BOTH ids or every hand-written correction would be silently discarded.
        const tip = actionTips[a.id] ?? actionTips[twinIdOf(a, catalog.actions)];
        const risk = inferActionRisk(a);
        return {
          id: a.id,
          method: a.method,
          path: a.path,
          summary: a.summary,
          category: a.category,
          // A search stub carries only what the agent cannot derive from the row itself.
          // The full risk object repeated `kinds:["write"]` and the prose "POST can change
          // GHL account data." on every hit — restating the method printed two fields above,
          // for ~120 B x every result. `kind` and the confirmation flag are the signal;
          // describe_action still returns the full risk object with its notes.
          kind: a.method === "GET" ? "read" : "write",
          ...(risk.requiresConfirmation && { requiresConfirmation: true }),
          ...(tip?.note && { note: tip.note }),
          ...(twinIdOf(a, catalog.actions) && { alsoAvailableAs: twinIdOf(a, catalog.actions) }),
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
        // `total` and `nextOffset` used to be undefined in keyword mode, so they vanished
        // from the JSON and the agent could not tell whether more results existed — the same
        // tool answered with two different contracts depending on which mode it ran in.
        pagination: {
          offset,
          limit,
          returned: results.length,
          total: matchedTotal,
          hasMore: offset + results.length < matchedTotal,
          nextOffset:
            offset + results.length < matchedTotal ? offset + results.length : undefined,
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
            "GHL parameters as a flat object; routed to path/query/body automatically. The result_* options are TOP-LEVEL, not part of this."
          ),
        confirm: z
          .boolean()
          .default(false)
          .describe(
            "Set to true only after reviewing a preview for high-risk actions such as send, publish, delete, remove, cancel, payment, or billing actions."
          ),
        locationId: z
          .string()
          .optional()
          .describe(
            "Which configured GHL sub-account to operate on. Omit when only one is configured. Required when several are. Call list_locations to see them. An id with no configured token is refused — this server never substitutes another account's token."
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
            "Keyword filter over string fields in returned items (case-insensitive)."
          ),
        result_fields: z
          .string()
          .max(500)
          .optional()
          .describe(
            "Comma-separated fields to keep, e.g. 'id,name'. Applies to list items and to single records."
          ),
        result_offset: z
          .number()
          .int()
          .min(0)
          .default(0)
          .describe(
            "Start index for paginating array responses."
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
    async ({ action_id, params, confirm, dry_run, locationId, result_filter, result_fields, result_offset, result_limit }) => {
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

      // ── multi sub-account resolution ────────────────────────────────────────────────
      // Pick the token, inject the location the way THIS action expresses it, and refuse
      // outright when the action carries no location at all and the binding is unproven.
      let selectedAccount: { id: string; name: string; token: string } | null = null;
      if (accounts) {
        try {
          selectedAccount = accounts.resolve(locationId);
        } catch (err) {
          const structuredContent = {
            action: { id: action.id },
            status: "error",
            ok: false,
            error: err instanceof Error ? err.message : "Could not resolve a sub-account",
            nextStep: "Call list_locations, then retry with an explicit locationId.",
          };
          return {
            isError: true,
            structuredContent,
            content: [{ type: "text" as const, text: JSON.stringify(structuredContent) }],
          };
        }

        const shape = locationShapeOf(action);
        if (shape === "locationId") {
          // The executor routes by the catalog's `in`, and anything undeclared falls through
          // to the body — so one assignment covers the query (301), path (186) and
          // body-only (221) cases correctly.
          if (params.locationId === undefined) params.locationId = selectedAccount.id;
          else if (params.locationId !== selectedAccount.id) {
            const structuredContent = {
              action: { id: action.id },
              status: "error",
              ok: false,
              error: `Conflicting locations: locationId="${selectedAccount.id}" selects the token, but params.locationId="${String(params.locationId)}" would be sent to GHL. Refusing rather than letting one pick the credential and the other pick the target.`,
            };
            return {
              isError: true,
              structuredContent,
              content: [{ type: "text" as const, text: JSON.stringify(structuredContent) }],
            };
          }
        } else if (shape === "altId") {
          if (params.altId === undefined) params.altId = selectedAccount.id;
          if (params.altType === undefined) params.altType = "location";
        } else {
          // ~407 actions name no location anywhere. Nothing to inject and nothing for GHL to
          // reject, so a mis-keyed token would write to the WRONG client silently. Prove the
          // binding first; this is the one case where an unverified mapping is unsafe.
          const state = await accounts.verify(selectedAccount.id, catalog.baseUrl);
          if (state !== "verified") {
            const structuredContent = {
              action: { id: action.id },
              status: "error",
              ok: false,
              error:
                state === "mismatched"
                  ? `The token configured for "${selectedAccount.name}" (${selectedAccount.id}) cannot reach that location. The accounts file maps it to the wrong sub-account. Refusing: this action names no location, so GHL would have accepted the call against whichever sub-account the token really belongs to.`
                  : `Could not verify which sub-account the token for "${selectedAccount.name}" belongs to, and this action carries no location parameter for GHL to check. Refusing rather than risk writing to the wrong sub-account.`,
              nextStep: "Fix the id in the accounts file, or retry when GHL is reachable.",
            };
            return {
              isError: true,
              structuredContent,
              content: [{ type: "text" as const, text: JSON.stringify(structuredContent) }],
            };
          }
        }
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

      // The selected account's token when multi-account is configured; otherwise the single
      // connection token exactly as before.
      const apiToken = selectedAccount?.token ?? getToken();
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
  // 38 of the 42 "-v3" categories are a duplicate of a base category, so a bare list of 83
  // made an agent browsing categories choose between `contacts` and `contacts-v3` with no
  // basis. Pair them on one line instead, and state the real number of distinct operations.
  const distinctOps = new Set(catalog.actions.map((a) => `${a.method} ${a.path}`)).size;
  const names = new Set(Object.keys(counts));
  const lines: string[] = [];
  for (const cat of [...names].sort((a, b) => a.localeCompare(b))) {
    if (cat.endsWith("-v3") && names.has(cat.slice(0, -3))) continue; // folded into its base
    const twin = `${cat}-v3`;
    // The "+v3" marker is explained once in the header rather than repeated 38 times —
    // spelling it out per line cost more bytes than the 83-line list it replaced.
    lines.push(
      names.has(twin) ? `${cat}: ${counts[cat]} (+v3)` : `${cat}: ${counts[cat]}`
    );
  }
  const categorySummary =
    `${distinctOps} distinct operations across ${lines.length} categories. "(+v3)" means the same endpoints are also published under <category>-v3; search returns one row per operation and names the other id.\n\n` +
    lines.join("\n");

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

/**
 * One row per (method, path). GHL publishes most operations twice — a v2 spec in `apps/`
 * and a v3 twin in `apps/v3/` — which the catalog faithfully carries as two actions.
 *
 * Preference order is deliberately NOT "category ends in -v3": 124 actions sitting in -v3
 * categories do not actually carry a `Version: v3` header (94 of them in ad-publishing-v3),
 * so trusting the category name would tell agents to prefer a twin that is not v3 at all.
 * The real header wins first.
 */
/** The id of the other action sharing this method+path, if the catalog carries a twin. */

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
