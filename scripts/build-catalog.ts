/**
 * Builds data/catalog.json from GHL's LIVE API docs (W3, 2026-10-29) — the v3 tree and the dated (2021-07-28) tree, as
 * twins. The rules live in scripts/build-live.ts; this file fetches, converts each op page's embedded OpenAPI doc with
 * extractActions, and writes the catalogue only when the build passes.
 *
 *   npm run build-catalog                         fetch fresh (about 1,600 pages, 1–2 minutes)
 *   npm run build-catalog -- --offline            rebuild from .cache/live-docs/ only
 *   npm run build-catalog -- --accept-undocumented  add newly undocumented previous ops to data/undocumented.json
 *
 * Until 2026-10-29 the source was GitHub's GoHighLevel/highlevel-api-docs, which stopped moving in June while the live
 * docs gained the Workflows and Courses APIs (203 operations behind).
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { applyCatalogOverrides } from "../src/catalog-overrides.js";
import { TREES, cachedFetch, listOps, fetchOpSpec, deprecatedOps, llmsFullUrl, type Tree, type OpenAPIDoc } from "./live-docs.js";
import { buildFromLive, type UndocumentedEntry } from "./build-live.js";

const MIN_ACTIONS = 1100;
const MIN_CATEGORIES = 75;
const FLOORS: Record<Tree, number> = { v3: 800, "2021-07-28": 700 };
const data = (f: string) => fileURLToPath(new URL(`../data/${f}`, import.meta.url));
const readJSON = <T>(f: string, fallback: T): T => (existsSync(data(f)) ? JSON.parse(readFileSync(data(f), "utf8")) : fallback);

interface CatalogAction {
  id: string;
  category: string;
  method: string;
  path: string;
  summary: string;
  description: string;
  tags: string[];
  scopes: string[];
  parameters: ParameterInfo[];
  requestBody: RequestBodyInfo | null;
  versionHeader: string | null;
}

interface ParameterInfo {
  name: string;
  in: string;
  required: boolean;
  description: string;
  type: string;
  enum?: string[];
}

interface RequestBodyInfo {
  required: boolean;
  contentType: string;
  schema: Record<string, unknown>;
}


function resolveRef(spec: any, ref: string): any {
  if (!ref.startsWith("#/")) return {};
  const parts = ref.replace("#/", "").split("/");
  let current = spec;
  for (const part of parts) {
    current = current?.[part];
    if (!current) return {};
  }
  return current;
}

function flattenSchema(spec: any, schema: any, depth = 0): Record<string, unknown> {
  if (depth > 3) return schema;
  if (schema?.$ref) {
    const resolved = resolveRef(spec, schema.$ref);
    return flattenSchema(spec, resolved, depth + 1);
  }
  if (schema?.type === "object" && schema?.properties) {
    const props: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(schema.properties)) {
      const prop = val as any;
      if (prop?.$ref) {
        const resolved = resolveRef(spec, prop.$ref);
        props[key] = flattenSchema(spec, resolved, depth + 1);
      } else {
        props[key] = {
          type: prop.type || "string",
          ...(prop.description && { description: prop.description }),
          ...(prop.enum && { enum: prop.enum }),
          ...(prop.example !== undefined && { example: prop.example }),
        };
      }
    }
    return {
      type: "object",
      properties: props,
      ...(schema.required && { required: schema.required }),
    };
  }
  return schema || {};
}

export function extractActions(spec: any, category: string): CatalogAction[] {
  const actions: CatalogAction[] = [];
  const paths = spec.paths || {};

  for (const [path, methods] of Object.entries(paths)) {
    for (const [method, details] of Object.entries(methods as Record<string, any>)) {
      if (!["get", "post", "put", "delete", "patch"].includes(method)) continue;

      const operationId = details.operationId || `${method}-${path.replace(/[^a-zA-Z0-9]/g, "-")}`;
      const id = `${category}__${operationId}`;

      // Extract scopes from security
      const scopes: string[] = [];
      if (details.security) {
        for (const sec of details.security) {
          for (const vals of Object.values(sec)) {
            scopes.push(...(vals as string[]));
          }
        }
      }

      // Extract parameters
      const parameters: ParameterInfo[] = (details.parameters || []).map((p: any) => ({
        name: p.name,
        in: p.in,
        required: p.required || false,
        description: p.description || "",
        type: p.schema?.type || "string",
        ...(p.schema?.enum && { enum: p.schema.enum }),
      }));

      // Check for a GHL API "Version" date header. Match case-insensitively:
      // GHL's v3 specs declare a lowercase `version` header on some endpoints,
      // and some specs pin the value via `schema.default` rather than an enum.
      const versionParam = (details.parameters || []).find(
        (p: any) => p.in === "header" && String(p.name).toLowerCase() === "version"
      );
      const versionHeader: string | null =
        versionParam?.schema?.enum?.[0] ?? versionParam?.schema?.default ?? null;

      // Extract request body schema (flattened)
      let requestBody: RequestBodyInfo | null = null;
      if (details.requestBody) {
        const content = details.requestBody.content || {};
        const contentType = Object.keys(content)[0] || "application/json";
        const rawSchema = content[contentType]?.schema || {};
        const schema = flattenSchema(spec, rawSchema);
        requestBody = {
          required: details.requestBody.required || false,
          contentType,
          schema,
        };
      }

      actions.push({
        id,
        category,
        method: method.toUpperCase(),
        path,
        summary: details.summary || "",
        description: details.description || "",
        tags: details.tags || [],
        scopes,
        // Drop header params the transport supplies itself. `version` was already stripped;
        // `Authorization` must be too — the executor only routes path/query, so a required
        // Authorization param made 75 actions unreachable (knowledge-base, store, saas-api,
        // proposals, links, social-planner-v3), and supplying it to satisfy the check pushed
        // the caller's PIT into the REQUEST BODY, where it was echoed back in responses.
        parameters: parameters.filter(
          (p) =>
            !(p.in === "header" &&
              ["version", "authorization"].includes(p.name.toLowerCase()))
        ),
        requestBody,
        versionHeader,
      });
    }
  }

  return actions;
}

async function main() {
  const offline = process.argv.includes("--offline");
  const acceptUndocumented = process.argv.includes("--accept-undocumented");
  const get = cachedFetch({ dir: fileURLToPath(new URL("../.cache/live-docs/", import.meta.url)), offline });
  const fetchedAt = new Date().toISOString();
  const trees = {} as Record<Tree, { ops: Awaited<ReturnType<typeof listOps>>["ops"]; specs: Map<string, OpenAPIDoc>; sha256: string }>;
  const deprecated = {} as Record<Tree, Map<string, string | null>>;
  const fetchFailures: string[] = [];
  for (const t of TREES) {
    const { ops, sha256 } = await listOps(t, get);
    console.log(`${t}: ${ops.length} operations listed; fetching their pages${offline ? " from the cache" : ""}…`);
    const specs = new Map<string, OpenAPIDoc>();
    await Promise.all(ops.map(async (o) => {
      try { specs.set(o.url, await fetchOpSpec(o, get)); } catch (e) { fetchFailures.push(`${o.url}: ${(e as Error).message}`); }
    }));
    trees[t] = { ops, specs, sha256 };
    deprecated[t] = deprecatedOps(await get(llmsFullUrl(t)));
    console.log(`${t}: ${specs.size} pages read, ${deprecated[t].size} marked DEPRECATED`);
  }
  const previous = readJSON("catalog.json", null as any);
  if (!previous) throw new Error("data/catalog.json is missing: the build needs the previous catalogue to keep every id");
  const result = buildFromLive({
    trees, deprecated, previous, fetchedAt, floors: FLOORS, today: fetchedAt.slice(0, 10), acceptUndocumented,
    undocumented: readJSON<UndocumentedEntry[]>("undocumented.json", []),
    headerHolds: readJSON<string[]>("header-holds.json", []),
    idOverrides: readJSON<Record<string, string>>("id-overrides.json", {}),
  });
  const failures = [...fetchFailures, ...result.failures];
  const r = result.report;
  console.log(`\nreport: ${JSON.stringify(r.counts)}`);
  console.log(`  new ids: ${r.newIds.length}, carried over: ${r.carried.length}, param aliases: ${r.aliases.length}, header changes: ${r.headerChanges.length}`);
  if (failures.length || !result.catalog) {
    console.error(`\nCatalog build FAILED — nothing written (${failures.length} problem(s)):`);
    for (const f of failures.slice(0, 50)) console.error(`- ${f}`);
    process.exit(1);
  }
  const catalog = applyCatalogOverrides(result.catalog);
  assertCatalogCompleteness(catalog.totalActions, catalog.categories.length);
  writeFileSync(data("catalog.json"), JSON.stringify(catalog, null, 2));
  writeFileSync(data("undocumented.json"), `${JSON.stringify(result.undocumented, null, 2)}\n`);
  writeFileSync(data("build-report.json"), `${JSON.stringify(r, null, 2)}\n`);
  console.log(`\nCatalog written: ${catalog.totalActions} actions across ${catalog.categories.length} categories (data/build-report.json has the details)`);
}

export function assertCatalogCompleteness(totalActions: number, totalCategories: number) {
  const failures: string[] = [];
  if (totalActions < MIN_ACTIONS) {
    failures.push(`expected at least ${MIN_ACTIONS} actions, got ${totalActions}`);
  }
  if (totalCategories < MIN_CATEGORIES) {
    failures.push(`expected at least ${MIN_CATEGORIES} categories, got ${totalCategories}`);
  }
  if (failures.length > 0) {
    throw new Error(`Catalog build produced an unexpectedly small catalog: ${failures.join("; ")}`);
  }
}

const isMain = process.argv[1]
  ? import.meta.url === new URL(process.argv[1], "file:").href
  : false;

if (isMain) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
