import type { CatalogAction } from "./types.js";

/**
 * Pre-computed search data for each action.
 * Built once at startup, reused on every query.
 */
export interface ActionSearchEntry {
  actionId: string;
  searchable: string; // all fields joined + lowercased
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
    entries.set(action.id, {
      actionId: action.id,
      searchable: [
        action.id,
        action.summary,
        action.description,
        action.category,
        ...action.tags,
        action.method,
        action.path,
        ...boost,
      ]
        .join(" ")
        .toLowerCase(),
      summaryLower: action.summary.toLowerCase(),
      categoryLower: action.category.toLowerCase(),
      idLower: action.id.toLowerCase(),
    });
  }
  return { entries };
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
  const terms = intent
    .toLowerCase()
    .split(/[\s\-_/]+/)
    .filter((t) => t.length > 1);

  if (terms.length === 0) return [];

  const scored = actions.map((action) => {
    const entry = index.entries.get(action.id);
    if (!entry) return { action, score: 0 };

    let score = 0;
    for (const term of terms) {
      if (entry.searchable.includes(term)) {
        score += 1;
        if (entry.summaryLower.includes(term)) score += 2;
        if (entry.categoryLower.includes(term)) score += 1;
        if (entry.idLower.includes(term)) score += 1;
      }
    }

    return { action, score };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.action);
}
