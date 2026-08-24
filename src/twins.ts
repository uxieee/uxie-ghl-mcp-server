/**
 * The v2/v3 twin problem, and where a locationId belongs.
 *
 * GHL publishes most endpoints twice — a legacy spec and a v3 twin at the same method and
 * path — so an uncollapsed search spends half its results showing the same operation twice.
 * And a -v3 CATEGORY does not guarantee the v3 header: 124 actions in v3 categories lack it,
 * so the version has to be read off the action, never inferred from its category name.
 */
import type { CatalogAction } from "./types.js";

/**
 * How an action names its sub-account. Derived from the live catalog:
 *   locationId as a query param   301
 *   locationId as a path param    186
 *   locationId in the body schema 221   (no parameters[] entry — the executor routes it there)
 *   altId + altType pair           84
 *   none at all                   407
 * Injecting blindly into path/query would have broken the 305 body-only and altId actions,
 * including contacts__create-contact, the most-used write in the API.
 */
export function locationShapeOf(action: CatalogAction): "locationId" | "altId" | "none" {
  const names = new Set(action.parameters.map((p) => p.name));
  if (names.has("locationId")) return "locationId";
  if (names.has("altId") && names.has("altType")) return "altId";
  const schema = action.requestBody?.schema as Record<string, unknown> | undefined;
  const props = schema?.properties as Record<string, unknown> | undefined;
  if (props && Object.prototype.hasOwnProperty.call(props, "locationId")) return "locationId";
  if (props && Object.prototype.hasOwnProperty.call(props, "altId")) return "altId";
  return "none";
}

export function twinIdOf(action: CatalogAction, all: CatalogAction[]): string {
  const twin = all.find(
    (a) => a.id !== action.id && a.method === action.method && a.path === action.path
  );
  return twin?.id ?? "";
}

/** `contacts` and `contacts-v3` are one family — the same endpoints under two specs. */
export function categoryFamily(category: string): string {
  return category.endsWith("-v3") ? category.slice(0, -3) : category;
}

export function collapseTwins(actions: CatalogAction[]): CatalogAction[] {
  const seen = new Map<string, CatalogAction>();
  const order: string[] = [];
  for (const action of actions) {
    const key = `${action.method} ${action.path}`;
    const existing = seen.get(key);
    if (!existing) {
      seen.set(key, action);
      order.push(key);
      continue;
    }
    if (preferTwin(action, existing)) seen.set(key, action);
  }
  return order.map((k) => seen.get(k)!);
}

export function preferTwin(candidate: CatalogAction, incumbent: CatalogAction): boolean {
  // 1. A real `Version: v3` header beats everything.
  const realV3 = (a: CatalogAction) => a.versionHeader === "v3";
  if (realV3(candidate) !== realV3(incumbent)) return realV3(candidate);

  // 2. Otherwise prefer the twin that declares ANY version over one declaring none. When a
  //    -v3 twin carries no header at all (124 actions do this), the v2 spec with an explicit
  //    date version is the better-specified of the two, whatever the category is called.
  const hasVersion = (a: CatalogAction) => Boolean(a.versionHeader);
  if (hasVersion(candidate) !== hasVersion(incumbent)) return hasVersion(candidate);

  // 3. Only then fall back to the category name, which is the weakest signal.
  const namedV3 = (a: CatalogAction) => a.category.endsWith("-v3");
  if (namedV3(candidate) !== namedV3(incumbent)) return namedV3(candidate);
  return false;
}
