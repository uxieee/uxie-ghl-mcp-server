/**
 * The catalogue, built from GHL's live docs (W3, 2026-10-29). Pure: what the trees say + the previous catalogue in,
 * the new catalogue and a report out. scripts/build-catalog.ts fetches and writes.
 *
 * Families: a `-v3` category belongs to the v3 tree; every other category to the dated tree (2021-07-28).
 * - A previous action whose opKey its family's tree still lists keeps its id and category — so every tip, override key
 *   and id a user saved survives. A matched dated op keeps the Version header it sent (139 send 2021-04-15, proven);
 *   a matched v3 op takes the documented header unless data/header-holds.json holds its path prefix.
 * - A new op takes the category its matched siblings in the same service already use (ad-publishing → ad-manager in the
 *   dated tree), else <service>[-v3]; its id is <category>__<slug> (the URL slug — the embedded operationIds are camelCase
 *   and would rename everything).
 * - A previous action its family's tree no longer lists is carried over unchanged: "documented only under <tree>" when
 *   the other tree has it, else it must be on data/undocumented.json — or the build fails (acceptUndocumented appends it).
 * - Nothing is ever dropped. Any failure returns catalog: null, so a partial read can never ship as a smaller catalogue.
 */
import { extractActions } from "./build-catalog.js";
import { opKey, type ListedOp, type OpenAPIDoc, type Tree, DOCS } from "./live-docs.js";
import type { Catalog, CatalogAction } from "../src/types.js";

export interface UndocumentedEntry { id: string; opKey: string; since: string; note: string }
export interface TreeInput { ops: ListedOp[]; specs: Map<string, OpenAPIDoc>; sha256: string }
export interface BuildInput {
  trees: Record<Tree, TreeInput>;
  deprecated: Record<Tree, Map<string, string | null>>;
  previous: Catalog;
  undocumented: UndocumentedEntry[];
  acceptUndocumented: boolean;
  today: string;
  fetchedAt: string;
  floors: Record<Tree, number>;
  /** Path prefixes whose v3 ops keep their previous Version header (GHL refused the documented one live). */
  headerHolds?: string[];
  /** "<tree> <opKey>" → id, for a NEW op whose slug id is already taken (data/id-overrides.json; a collision fails the build until named here). */
  idOverrides?: Record<string, string>;
}
export interface BuildReport {
  counts: Record<string, number>;
  newIds: string[];
  carried: { id: string; why: string }[];
  aliases: { id: string; aliases: Record<string, string> }[];
  headerChanges: { id: string; from: string | null; to: string | null }[];
}

const TREES: Tree[] = ["v3", "2021-07-28"];
const familyOf = (category: string): Tree => (category.endsWith("-v3") ? "v3" : "2021-07-28");
const placeholders = (path: string) => [...path.replace(/\\([{}])/g, "$1").matchAll(/\{([^}]+)\}/g)].map((m) => m[1]);
const WORKFLOWS_NOTE = "private beta: GHL allow-lists locations; others get 403 WORKFLOW_API_NOT_ENABLED_FOR_LOCATION (ours, 2026-10-29)";

export function buildFromLive(input: BuildInput): { catalog: Catalog | null; report: BuildReport; failures: string[]; undocumented: UndocumentedEntry[] } {
  const failures: string[] = [];
  const report: BuildReport = { counts: {}, newIds: [], carried: [], aliases: [], headerChanges: [] };
  const holds = input.headerHolds ?? [];

  // previous actions by (family, opKey) — several may share one (twin categories of one family); all keep their ids
  const byKey = new Map<string, CatalogAction[]>();
  for (const a of input.previous.actions) {
    const k = `${familyOf(a.category)} ${opKey(a.method, a.path)}`;
    byKey.set(k, [...(byKey.get(k) ?? []), a]);
  }
  const listed: Record<Tree, Set<string>> = { v3: new Set(), "2021-07-28": new Set() };
  for (const t of TREES) for (const o of input.trees[t].ops) listed[t].add(opKey(o.method, o.path));

  // The category a service's new ops should join: the one its matched ops already use most.
  const homeOf = new Map<string, string>();
  for (const t of TREES) {
    const votes = new Map<string, Map<string, number>>();
    for (const o of input.trees[t].ops) for (const p of byKey.get(`${t} ${opKey(o.method, o.path)}`) ?? []) {
      const m = votes.get(o.service) ?? new Map(); m.set(p.category, (m.get(p.category) ?? 0) + 1); votes.set(o.service, m);
    }
    for (const [svc, m] of votes) homeOf.set(`${t} ${svc}`, [...m].sort((a, b) => b[1] - a[1])[0][0]);
  }

  const out: CatalogAction[] = [];
  for (const t of TREES) {
    const tree = input.trees[t];
    report.counts[`${t} ops`] = tree.ops.length;
    if (tree.ops.length < input.floors[t]) failures.push(`${t}: ${tree.ops.length} ops, floor ${input.floors[t]}`);
    for (const o of tree.ops) {
      const spec = tree.specs.get(o.url);
      if (!spec) { failures.push(`no spec for ${o.url}`); continue; }
      const fresh = extractActions(spec, "x").find((a) => a.method === o.method.toUpperCase() && opKey(a.method, a.path) === opKey(o.method, o.path));
      if (!fresh) { failures.push(`shape changed: ${o.url} does not describe ${o.method} ${o.path}`); continue; }
      const key = opKey(o.method, o.path);
      // Undeclared placeholders: 11 ops answered "missing path param" at call time because GHL never declared them.
      for (const name of placeholders(fresh.path)) {
        if (!fresh.parameters.some((p) => p.in === "path" && p.name === name)) {
          fresh.parameters.push({ name, in: "path", required: true, type: "string", description: "path parameter (undeclared in GHL docs)" });
        }
      }
      const dep = input.deprecated[t].get(key);
      const notes = t === "v3" && /^\/workflows(\/|$)/.test(fresh.path) ? [WORKFLOWS_NOTE] : [];
      const shape = (id: string, category: string, versionHeader: string | null, aliases?: Record<string, string>): CatalogAction => ({
        ...fresh, id, category, versionHeader,
        ...(dep !== undefined ? { deprecated: { replacement: dep } } : {}),
        ...(notes.length ? { notes } : {}),
        ...(aliases && Object.keys(aliases).length ? { paramAliases: aliases } : {}),
      });
      const matches = byKey.get(`${t} ${key}`) ?? [];
      if (matches.length) {
        for (const p of matches) {
          const held = t === "v3" && holds.some((h) => fresh.path.startsWith(h));
          const header = t === "v3" && !held ? fresh.versionHeader : p.versionHeader;
          if (header !== p.versionHeader) report.headerChanges.push({ id: p.id, from: p.versionHeader, to: header });
          const oldNames = placeholders(p.path); const newNames = placeholders(fresh.path);
          const aliases: Record<string, string> = {};
          oldNames.forEach((n, i) => { if (newNames[i] && newNames[i] !== n) aliases[n] = newNames[i]; });
          if (Object.keys(aliases).length) report.aliases.push({ id: p.id, aliases });
          out.push(shape(p.id, p.category, header, aliases));
        }
      } else {
        const category = homeOf.get(`${t} ${o.service}`) ?? `${o.service}${t === "v3" ? "-v3" : ""}`;
        const id = input.idOverrides?.[`${t} ${key}`] ?? `${category}__${o.slug}`;
        report.newIds.push(id);
        out.push(shape(id, category, fresh.versionHeader));
      }
    }
  }

  // Carry over every previous action its family's tree no longer lists. Nothing is removed (spec rule 7).
  const undocumented = [...input.undocumented];
  const listedIds = new Set(undocumented.map((u) => u.id));
  for (const p of input.previous.actions) {
    const fam = familyOf(p.category); const key = opKey(p.method, p.path);
    if (listed[fam].has(key)) continue;
    const other: Tree = fam === "v3" ? "2021-07-28" : "v3";
    if (listed[other].has(key)) {
      out.push({ ...p, notes: [...(p.notes ?? []).filter((n) => !/^documented only under/.test(n)), `documented only under ${other}`] });
      report.carried.push({ id: p.id, why: `documented only under ${other}` });
      continue;
    }
    let entry = undocumented.find((u) => u.id === p.id);
    if (!entry && input.acceptUndocumented) { entry = { id: p.id, opKey: key, since: input.today, note: "not in either live docs tree" }; undocumented.push(entry); }
    if (!entry && !listedIds.has(p.id)) { failures.push(`${p.id} (${key}) is not in the live docs and not on data/undocumented.json — add it or pass --accept-undocumented`); continue; }
    out.push({ ...p, notes: [...(p.notes ?? []).filter((n) => !/^undocumented since/.test(n)), `undocumented since ${entry!.since}`] });
    report.carried.push({ id: p.id, why: `undocumented since ${entry!.since}` });
  }

  const seen = new Map<string, number>();
  for (const a of out) seen.set(a.id, (seen.get(a.id) ?? 0) + 1);
  for (const [id, n] of seen) if (n > 1) failures.push(`id collision: ${id} (${n} actions)`);

  report.counts.actions = out.length;
  report.counts.opKeys = new Set(out.map((a) => opKey(a.method, a.path))).size;
  report.counts.new = report.newIds.length;
  report.counts.carried = report.carried.length;
  if (failures.length) return { catalog: null, report, failures, undocumented };
  const catalog: Catalog = {
    generatedAt: input.fetchedAt,
    source: { site: `${DOCS.replace(/^https:\/\//, "")}`, fetchedAt: input.fetchedAt, llms: Object.fromEntries(TREES.map((t) => [t, input.trees[t].sha256])) },
    baseUrl: input.previous.baseUrl || "https://services.leadconnectorhq.com",
    totalActions: out.length,
    categories: [...new Set(out.map((a) => a.category))].sort(),
    actions: out,
  };
  return { catalog, report, failures, undocumented };
}
