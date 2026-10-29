/**
 * Which calls need a confirmation before they run.
 *
 * Gated on what an action TOUCHES, not on how its description is worded: anything that
 * spends money, sends something a human will receive, or destroys data. A description-only
 * heuristic both over-fires on harmless reads and misses a destructive endpoint with a mild
 * summary.
 */
import type { CatalogAction, ActionRisk, ActionRiskKind } from "./types.js";

/**
 * `all` is the catalogue the action came from. GHL publishes most endpoints twice (a v2 and a v3
 * spec at the same method + path), and the two descriptions are worded differently, so the
 * text-reading rules below gated one twin and not the other: purchase-phone-number ran ungated
 * under its v2 id while its v3 twin asked first. With `all`, the STRICTER twin's gate wins.
 */
export function inferActionRisk(action: CatalogAction, all: CatalogAction[] = []): ActionRisk {
  const own = baseRisk(action);
  if (own.requiresConfirmation) return own;
  const twin = all.find((a) => a.id !== action.id && a.method === action.method && a.path === action.path
    && baseRisk(a).requiresConfirmation);
  if (!twin) return own;
  const strict = baseRisk(twin);
  return {
    level: "high",
    kinds: [...new Set([...own.kinds, ...strict.kinds])],
    notes: [...own.notes, ...strict.notes, `Same endpoint as ${twin.id}, which needs confirmation; the stricter gate applies.`],
    requiresConfirmation: true,
  };
}

function baseRisk(action: CatalogAction): ActionRisk {
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

  if (/\b(payment|payments|invoice|billing|subscription|coupon|order|charge|refund|saas|payout|commission)\b/.test(text)) {
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

  // The v3 twins carry the `ad-publishing-v3` category, and agents see those first, so the test
  // must name both families: matching `ad-manager` alone left 28 live-spend writes ungated (2026-10-29).
  // CONSEQUENCE, NOT KEYWORDS. The rules above read the description text, which misses
  // anything whose consequence is not spelled out in prose. Measured against the catalog,
  // 18 ad-manager mutations slipped through ungated — including fb-resume-campaign and
  // fb-upsert-campaign, which start and change LIVE ad spend — while blogs__create-blog-post
  // was gated because "post" appears in it. Advertising mutations are gated by what they
  // touch, regardless of how their summary is worded.
  if (method !== "GET" && /^(ad-manager|ad-publishing)/.test(action.category)) {
    kinds.add("billing");
    notes.push(
      "Touches a live advertising account: campaigns, ad sets, ads, audiences, or pixels. Can start, change, or stop real ad spend."
    );
  }

  // Same reasoning for anything that puts something live or takes it down, where the verb
  // lives in the action id rather than the description.
  if (method !== "GET" && /\b(resume|activate|launch|enable|go-live)\b/.test(action.id.toLowerCase())) {
    kinds.add("external_send");
    notes.push("Makes something live or resumes a paused system.");
  }

  // Calls the live-docs rebuild added (W3, 2026-10-29) whose consequence is in the PATH, not the prose: running a
  // managed agent, applying changes to or building a client-portal app, rewriting a location's permissions, and acting
  // in public on a social platform. gate-diff listed them as new ungated writes.
  let forced = false;
  if (method !== "GET") {
    const p = action.path.toLowerCase();
    if (/\/(execute|apk-builds)$|\/changes\/apply$/.test(p)) { kinds.add("external_send"); notes.push("Runs or ships something live."); }
    if (/\/permissions$/.test(p)) { forced = true; notes.push("Changes who can do what in the account."); }
    if (/\/comments\/\{[^}]+\}\/\{[^}]+\}\/like$/.test(p)) { kinds.add("external_send"); notes.push("Acts in public on a connected social account."); }
  }

  const requiresConfirmation =
    method !== "GET" && (
      forced ||
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

export function requiresActionConfirmation(risk: ActionRisk): boolean {
  return risk.requiresConfirmation;
}
