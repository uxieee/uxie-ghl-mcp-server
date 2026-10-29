/**
 * The single source of truth for the server's instructions.
 *
 * These lived in BOTH src/index.ts (remote Worker) and src/stdio.ts (local stdio) as
 * duplicated literals, and had already drifted on the rate limit. Both import this now, so
 * drift is not possible.
 */
import type { Catalog } from "./types.js";

/**
 * Counts are computed from the catalogue the server ships with, never typed: the typed operation and missing-header
 * counts went stale the day the catalogue was rebuilt from GHL's live docs (W3, 2026-10-29).
 */
export function serverInstructions(catalog: Catalog): string {
  const ops = new Set(catalog.actions.map((a) => `${a.method} ${a.path.replace(/\{[^}]*\}/g, "{}")}`)).size;
  const lacking = catalog.actions.filter((a) => a.category.endsWith("-v3") && a.versionHeader !== "v3").length;
  return [
    `GoHighLevel API MCP \u2014 ${ops} distinct operations, GHL API v2 + v3, built from GHL's live API docs.`,
    "Flow: search_actions (find it) -> describe_action (its schema) -> execute_action (call it).",
    "search_actions returns compact stubs. Call describe_action on the ONE id you chose; do not set compact=false, which inlines a full schema per hit.",
    `GHL publishes most endpoints twice (a v2 spec and a v3 twin at the same method+path). Search returns one row per operation and names the other as alsoAvailableAs; either id works.${lacking ? ` A -v3 CATEGORY does not guarantee the v3 header \u2014 ${lacking} lack it \u2014 so prefer the id search gives you.` : ""}`,
    "describe_action shows GHL's own marks: deprecated (with the replacement GHL names) and notes such as private beta or undocumented since a date. Prefer an op that is not deprecated.",
    "execute_action extras are TOP-LEVEL, not inside params: result_filter, result_fields, result_offset, result_limit (0 = count only), dry_run, confirm, locationId.",
    "Sends, publishes, deletes, cancels, billing, payout, advertising and permission mutations, and calls that run or ship something live, need confirm=true after a dry_run preview.",
    "Conversation AI agent create/update with mode other than \"off\" (auto-pilot or suggestive) also needs confirm=true: an agent with enabled outbound triggers will start texting contacts on CRM events, with no workflow.",
    "A spec-required field you omit returns a WARNING, not an error: GHL marks fields required that the API accepts without. The call is sent and GHL decides. Only a missing PATH param is fatal.",
    "Undocumented body keys pass through, so spec gaps do not block valid requests.",
    "Rate limits are GHL's: 100 requests per 10 seconds and 200,000 per day per sub-account. A rate-limited call waits once and retries once when GHL says it may; a spent daily quota is reported with its reset time.",
    "Pipelines are writable (opportunities-v3__create-pipeline / update / delete). Workflows have a public API in private beta: GHL allow-lists locations, others get 403 WORKFLOW_API_NOT_ENABLED_FOR_LOCATION.",
    "Commerce: products__* and payments__* are the source of truth; direct Stripe access is rarely needed.",
  ].join("\n");
}

/**
 * Appended by the hosted Cloudflare Worker only (src/index.ts). Users of the npm package have
 * already migrated, so telling them to migrate would be noise — and noise in the instructions
 * is paid on every session.
 */
export const WORKER_DEPRECATION_NOTICE =
  "NOTICE: this hosted endpoint is being retired in a few weeks. Move to the npm package: " +
  "`claude mcp add ghl -e GHL_API_TOKEN=pit-... -- npx -y @uxieee/ghl-mcp`. It also supports " +
  "many sub-accounts on one connection, and your token stays on your machine. See " +
  "https://github.com/uxieee/uxie-ghl-mcp-server";
