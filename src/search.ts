import type { CatalogAction } from "./types.js";

/**
 * Words that match hundreds of actions and carry no intent. Measured against the live
 * catalog: as substrings, "at" hit 911 of 1207 actions, "an" 574, "id" 860, "on" 810.
 */
const STOP_WORDS = new Set([
  "a", "an", "and", "any", "are", "as", "at", "be", "by", "do", "for", "from", "get",
  "how", "i", "in", "is", "it", "me", "my", "of", "on", "or", "s", "so", "that", "the",
  "their", "them", "then", "there", "this", "to", "up", "want", "was", "we", "what",
  "when", "which", "with", "you", "your",
]);

/**
 * Split text into whole-word lowercase tokens.
 *
 * The previous ranker joined every field into one string and scored with
 * `String.includes` — substring, not word. That made "book an appointment" return
 * Facebook ad-manager endpoints ("book" is inside face-BOOK, "an" inside ad-m-AN-ager)
 * while the correct calendar action did not appear at all. Splitting on non-alphanumerics
 * and matching whole tokens is what fixes it.
 */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 1 && !STOP_WORDS.has(t));
}

/**
 * Pre-computed search data for each action.
 * Built once at startup, reused on every query.
 */
export interface ActionSearchEntry {
  actionId: string;
  searchable: string; // all fields joined + lowercased (kept for substring fallback)
  /** Whole-word tokens from every indexed field. Matching is on these, not substrings. */
  tokens: Set<string>;
  summaryTokens: Set<string>;
  categoryTokens: Set<string>;
  idTokens: Set<string>;
  summaryLower: string;
  categoryLower: string;
  idLower: string;
}

export interface SearchIndex {
  entries: Map<string, ActionSearchEntry>;
}

/**
 * Build the search index once at startup.
 * @param searchBoosts Extra terms keyed by action ID (from action-tips).
 */
export function buildSearchIndex(
  actions: CatalogAction[],
  searchBoosts?: Record<string, string[]>
): SearchIndex {
  const entries = new Map<string, ActionSearchEntry>();
  for (const action of actions) {
    const boost = searchBoosts?.[action.id] ?? [];
    // Parameter names, their enum values, and request-body property names were NOT indexed.
    // That is why "send an SMS" scored zero on conversations__send-a-new-message: `SMS`
    // exists there only as requestBody.schema.properties.type.enum.
    const paramNames = action.parameters.map((p) => p.name);
    const paramEnums = action.parameters.flatMap((p) => (p.enum ?? []).map(String));
    const bodyProps = bodyPropertyNames(action);
    const fields = [
      action.id,
      action.summary,
      action.description,
      action.category,
      ...action.tags,
      action.method,
      action.path,
      ...paramNames,
      ...paramEnums,
      ...bodyProps,
      ...boost,
    ];
    entries.set(action.id, {
      actionId: action.id,
      searchable: fields.join(" ").toLowerCase(),
      tokens: new Set(fields.flatMap(tokenize)),
      summaryTokens: new Set(tokenize(action.summary)),
      categoryTokens: new Set(tokenize(action.category)),
      idTokens: new Set(tokenize(action.id)),
      summaryLower: action.summary.toLowerCase(),
      categoryLower: action.category.toLowerCase(),
      idLower: action.id.toLowerCase(),
    });
  }
  return { entries };
}

/** Property names (and their enum values) from an action's request-body schema. */
function bodyPropertyNames(action: CatalogAction): string[] {
  const schema = action.requestBody?.schema as Record<string, unknown> | undefined;
  const props = schema?.properties as Record<string, unknown> | undefined;
  if (!props || typeof props !== "object") return [];
  const out: string[] = [];
  for (const [name, def] of Object.entries(props)) {
    out.push(name);
    const e = (def as Record<string, unknown> | null)?.["enum"];
    if (Array.isArray(e)) out.push(...e.map(String));
  }
  return out;
}

/**
 * Search actions using pre-computed index.
 */
export function searchActions(
  index: SearchIndex,
  actions: CatalogAction[],
  intent: string,
  limit: number = 10
): CatalogAction[] {
  const terms = tokenize(intent);
  if (terms.length === 0) return [];

  const scored = actions.map((action) => {
    const entry = index.entries.get(action.id);
    if (!entry) return { action, score: 0 };

    let score = 0;
    let matched = 0;
    for (const term of terms) {
      // Whole-token match first. Falls back to a PREFIX match against indexed tokens so
      // "invoice" still finds "invoices" — but never a mid-word substring, which is what
      // made "book" match faceBOOK.
      const exact = entry.tokens.has(term);
      const prefix = !exact && [...entry.tokens].some((t) => t.startsWith(term) || term.startsWith(t));
      if (!exact && !prefix) continue;

      matched += 1;
      score += exact ? 2 : 1;
      if (entry.summaryTokens.has(term)) score += 3;
      if (entry.idTokens.has(term)) score += 2;
      if (entry.categoryTokens.has(term)) score += 1;
    }

    // Reward covering more of what was asked for. Without this a single strong field hit
    // outranks an action that matches every term the user actually typed.
    if (matched > 0) score += matched === terms.length ? 3 : 0;

    return { action, score };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.action);
}
