/**
 * The single source of truth for the server's instructions.
 *
 * These lived in BOTH src/index.ts (remote Worker) and src/stdio.ts (local stdio) as
 * duplicated literals, and had already drifted — stdio claimed a flat "60 execute calls
 * per minute" while the Worker correctly said "per token, per edge isolate". Both import
 * this now, so drift is not possible.
 */
export const SERVER_INSTRUCTIONS = [
  "GoHighLevel API MCP server — 671 distinct operations across 83 categories, covering GHL API v2 and the v3 surface published 2026-06-19.",
  "Flow: search_actions (find the operation) → describe_action (its full params + body schema) → execute_action (call it).",
  "search_actions returns COMPACT stubs by default. Call describe_action on the one id you chose rather than setting compact=false, which inlines a full OpenAPI schema for every hit.",
  "Most operations exist twice in GHL's specs — a v2 spec and a v3 twin at the same method+path. Keyword search returns ONE row per operation and names the other id as alsoAvailableAs; execute_action accepts either. Do not assume a -v3 category means the v3 header: 124 actions in -v3 categories do not carry Version: v3, so the collapse prefers the twin whose header is actually v3.",
  "execute_action has built-in response shaping — these are top-level params, NOT inside params:",
  "  result_filter: search array items by keyword (e.g. find a custom field by name).",
  "  result_fields: project specific fields (e.g. 'id,name,fieldKey' to reduce response size).",
  "  result_offset / result_limit: paginate large array responses (e.g. result_limit=10, result_offset=10 for page 2).",
  "  result_limit=0 returns only the item count without data.",
  "  dry_run=true previews non-GET request routing without calling GHL.",
  "High-risk actions such as send, publish, delete, remove, cancel, and billing/payment actions require confirm=true after preview.",
  "  search_actions also accepts include_all=true with a category to enumerate every action in that category (twins are NOT collapsed in that mode — it is an explicit enumeration).",
  "A spec-required field you omit is reported as a warning, not an error: GHL's OpenAPI specs mark fields required that the API accepts without, so the request is sent and GHL adjudicates. Only a missing PATH parameter is a hard failure.",
  "Rate limit: 60 execute calls per minute, per token, per edge isolate.",
  "Param routing: path params → URL, query params → query string, remainder → request body. Undocumented but valid body keys are passed through to GHL so OpenAPI spec gaps do not block valid requests.",
  "Pipelines are fully writable: opportunities-v3__create-pipeline / update-pipeline / delete-pipeline. Remaining public-API gaps such as workflow builder internals are surfaced explicitly in search notes so the model does not keep hunting for non-existent endpoints. Conversation AI agents are exposed under the conversation-ai category.",
  "For commerce setup, GHL's products__* and payments__* endpoints are the source of truth. Stripe is the underlying rail, but direct Stripe API access is usually not needed.",
].join("\n");
