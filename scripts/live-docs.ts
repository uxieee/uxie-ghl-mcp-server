/**
 * GHL's live API docs as a build source (W3, 2026-10-29).
 *
 *   https://marketplace.gohighlevel.com/docs/llms/<tree>/llms.txt        every operation of a tree, one line each
 *   https://marketplace.gohighlevel.com/docs/[<tree>/]ghl/<svc>/<slug>.md one operation; its "## OpenAPI Specification"
 *                                                                         section is a self-contained OpenAPI 3.0.0 doc
 *   https://marketplace.gohighlevel.com/docs/llms/<tree>/llms-full.txt   the compact reference; the only place that
 *                                                                         marks an op DEPRECATED (the embedded spec drops it)
 *
 * Trees: "v3" and "2021-07-28" (2023-02-21 and 2021-04-15 are identical to the dated tree, header aside).
 * Every parser throws "shape changed: …" on what it cannot read, so a partial read can never become a smaller catalogue.
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";

export type Tree = "v3" | "2021-07-28";
export const TREES: Tree[] = ["v3", "2021-07-28"];
export const DOCS = "https://marketplace.gohighlevel.com/docs";
export const llmsUrl = (tree: Tree) => `${DOCS}/llms/${tree}/llms.txt`;
export const llmsFullUrl = (tree: Tree) => `${DOCS}/llms/${tree}/llms-full.txt`;

export interface ListedOp { service: string; slug: string; method: string; path: string; url: string; name: string }
export interface OpenAPIDoc { openapi: string; paths: Record<string, Record<string, any>>; components?: any; [k: string]: unknown }

const METHODS = "GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS";

/** One key per operation whatever the parameter spelling: :id, {id} and \{id\} are the same slot. Copied from console/lib/watch-sources.mjs. */
export function opKey(method: string, path: string): string {
  const p = String(path).replace(/\\([{}_*[\]()#])/g, "$1").replace(/\{[^}]*\}/g, "{}").replace(/:[A-Za-z0-9_]+/g, "{}").replace(/\/+$/, "") || "/";
  return `${String(method).toUpperCase()} ${p}`;
}

/** llms.txt: "## <service>" then "- [Name](<page>.md): METHOD /path - desc". Lines with no METHOD are per-service index lines. */
export function parseOpsList(txt: string): ListedOp[] {
  const ops: ListedOp[] = [];
  let service: string | null = null;
  const re = new RegExp(`^- \\[(.+?)\\]\\((\\S+?\\.md)\\): (${METHODS}) (\\S+)`);
  for (const line of txt.split("\n")) {
    const s = /^## (.+?)\s*$/.exec(line);
    if (s) { service = s[1]; continue; }
    const m = re.exec(line);
    if (m && service) ops.push({ service, name: m[1], url: m[2], method: m[3], path: m[4], slug: m[2].split("/").at(-1)!.replace(/\.md$/, "") });
  }
  if (!ops.length) throw new Error("shape changed: llms.txt has no operations");
  return ops;
}

/** The fenced JSON under "## OpenAPI Specification". */
export function parseOpSpec(md: string, where: string): OpenAPIDoc {
  const at = md.indexOf("## OpenAPI Specification");
  const fence = at < 0 ? null : /```json\s*\n([\s\S]*?)\n```/.exec(md.slice(at));
  if (!fence) throw new Error(`shape changed: ${where} has no OpenAPI Specification section`);
  let doc: OpenAPIDoc;
  try { doc = JSON.parse(fence[1]); } catch { throw new Error(`shape changed: ${where} OpenAPI section is not JSON`); }
  if (!doc?.paths || !Object.keys(doc.paths).length) throw new Error(`shape changed: ${where} OpenAPI doc has no paths`);
  return doc;
}

/**
 * llms-full.txt blocks: "### Title", "METHOD /path", "URL: …", "Docs: …", then an optional "DEPRECATED." line and the
 * prose. The replacement is the first "use METHOD /path" in that prose, else null.
 */
export function deprecatedOps(full: string): Map<string, string | null> {
  const out = new Map<string, string | null>();
  const blocks = full.split(/\n(?=### )/);
  const opLine = new RegExp(`^(${METHODS}) (\\S+)\\s*$`, "m");
  const use = new RegExp(`\\buse (${METHODS}) (\\S+?)[\\s.,;)]`, "i");
  for (const b of blocks) {
    if (!/^DEPRECATED\./m.test(b)) continue;
    const op = opLine.exec(b);
    if (!op) continue;
    const r = use.exec(b);
    out.set(opKey(op[1], op[2]), r ? `${r[1].toUpperCase()} ${r[2]}` : null);
  }
  return out;
}

export interface FetchOpts { dir: string; fetchImpl?: typeof fetch; offline?: boolean; retryDelayMs?: number; concurrency?: number }

/**
 * Fresh by default: an online fetch always asks the network and refreshes the cache, so `fetchedAt` is true. Offline
 * reads only the cache (a reproducible rebuild) and fails on a miss. One retry on a 5xx or 429; a second failure throws.
 */
export function cachedFetch({ dir, fetchImpl = fetch, offline = false, retryDelayMs = 2000, concurrency = 6 }: FetchOpts) {
  mkdirSync(dir, { recursive: true });
  const file = (url: string) => join(dir, createHash("sha256").update(url).digest("hex").slice(0, 32));
  let active = 0; const queue: Array<() => void> = [];
  const slot = async () => { if (active >= concurrency) await new Promise<void>((r) => queue.push(r)); active++; };
  const free = () => { active--; queue.shift()?.(); };
  return async (url: string): Promise<string> => {
    const f = file(url);
    if (offline) {
      if (!existsSync(f)) throw new Error(`offline: not in the cache: ${url}`);
      return readFileSync(f, "utf8");
    }
    await slot();
    try {
      for (let attempt = 0; ; attempt++) {
        const r = await fetchImpl(url, { headers: { "User-Agent": "ghl-mcp-build-catalog" }, signal: AbortSignal.timeout(20000) });
        if (r.ok) { const body = await r.text(); writeFileSync(f, body); return body; }
        if ((r.status >= 500 || r.status === 429) && attempt === 0) { await new Promise((res) => setTimeout(res, retryDelayMs)); continue; }
        throw new Error(`${r.status} from ${new URL(url).host}`);
      }
    } finally { free(); }
  };
}

export async function listOps(tree: Tree, get: (url: string) => Promise<string>): Promise<{ ops: ListedOp[]; sha256: string }> {
  const txt = await get(llmsUrl(tree));
  return { ops: parseOpsList(txt), sha256: createHash("sha256").update(txt).digest("hex") };
}

export async function fetchOpSpec(op: ListedOp, get: (url: string) => Promise<string>): Promise<OpenAPIDoc> {
  return parseOpSpec(await get(op.url), op.url);
}
