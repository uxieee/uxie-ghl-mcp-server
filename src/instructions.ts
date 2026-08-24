/**
 * The single source of truth for the server's instructions.
 *
 * These lived in BOTH src/index.ts (remote Worker) and src/stdio.ts (local stdio) as
 * duplicated literals, and had already drifted — stdio claimed a flat "60 execute calls
 * per minute" while the Worker correctly said "per token, per edge isolate". Both import
 * this now, so drift is not possible.
 */
export const SERVER_INSTRUCTIONS = [
  "GoHighLevel API MCP — 671 distinct operations, GHL API v2 + v3.",
  "Flow: search_actions (find it) -> describe_action (its schema) -> execute_action (call it).",
  "search_actions returns compact stubs. Call describe_action on the ONE id you chose; do not set compact=false, which inlines a full schema per hit.",
  "GHL publishes most endpoints twice (a v2 spec and a v3 twin at the same method+path). Search returns one row per operation and names the other as alsoAvailableAs; either id works. A -v3 CATEGORY does not guarantee the v3 header \u2014 124 lack it \u2014 so prefer the id search gives you.",
  "execute_action extras are TOP-LEVEL, not inside params: result_filter, result_fields, result_offset, result_limit (0 = count only), dry_run, confirm, locationId.",
  "Sends, publishes, deletes, cancels, billing and advertising mutations need confirm=true after a dry_run preview.",
  "A spec-required field you omit returns a WARNING, not an error: GHL marks fields required that the API accepts without. The call is sent and GHL decides. Only a missing PATH param is fatal.",
  "Undocumented body keys pass through, so spec gaps do not block valid requests.",
  "Rate limit: 60 execute calls/min per token, per edge isolate.",
  "Pipelines are writable (opportunities-v3__create-pipeline / update / delete). Workflow builder internals are NOT in the public API \u2014 search notes say so rather than leaving you hunting.",
  "Commerce: products__* and payments__* are the source of truth; direct Stripe access is rarely needed.",
].join("\n");
