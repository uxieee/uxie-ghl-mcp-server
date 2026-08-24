/**
 * Downloads all GHL OpenAPI specs from GitHub and compiles them into
 * a compact action catalog for the search+execute MCP pattern.
 *
 * Usage: npx tsx scripts/build-catalog.ts
 */

import { applyCatalogOverrides } from "../src/catalog-overrides.js";

// Repo + ref are configurable so the catalog can be rebuilt from a fork or from
// a preview branch (e.g. to adopt API v3 specs before they merge to main).
const REPO = process.env.GHL_DOCS_REPO || "GoHighLevel/highlevel-api-docs";
const BRANCH = process.env.GHL_DOCS_REF || "main";
// GHL published API v3 as a parallel spec set (apps/v3/*-v3.json) on 2026-06-19,
// keeping the v2 specs in apps/*.json. Both surfaces are live on the same host,
// selected per-request via the Version header, so the catalog carries both.
const APPS_DIRS = ["apps", "apps/v3"];
const MIN_ACTIONS = 1100;
const MIN_CATEGORIES = 75;

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

async function fetchJSON(url: string): Promise<any> {
  const res = await fetch(url, {
    headers: {
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "ghl-mcp-catalog-builder",
    },
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}: ${url}`);
  return res.json();
}

async function fetchFileContent(path: string): Promise<any> {
  // Fetch via the raw CDN, which has no API rate limit. The GitHub contents API
  // is capped at 60 requests/hour unauthenticated, and a full build pulls 40+
  // specs — enough to risk a mid-build rate-limit failure.
  const url = `https://raw.githubusercontent.com/${REPO}/${BRANCH}/${path}`;
  const res = await fetch(url, {
    headers: { "User-Agent": "ghl-mcp-catalog-builder" },
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}: ${url}`);
  return res.json();
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

async function listSpecFiles(): Promise<string[]> {
  const paths: string[] = [];
  for (const dir of APPS_DIRS) {
    const url = `https://api.github.com/repos/${REPO}/contents/${dir}?ref=${BRANCH}`;
    const entries = await fetchJSON(url);
    paths.push(
      ...entries
        .filter((e: any) => e.type === "file" && e.name.endsWith(".json"))
        .map((e: any) => e.path)
    );
  }
  return paths;
}

async function main() {
  const allowPartial = process.argv.includes("--allow-partial");
  console.log("Fetching spec file list...");
  const specFiles = await listSpecFiles();
  console.log(`Found ${specFiles.length} OpenAPI specs\n`);

  const allActions: CatalogAction[] = [];
  const failedSpecs: Array<{ path: string; error: string }> = [];

  for (const specPath of specFiles) {
    // Category = spec basename: apps/opportunities.json -> "opportunities",
    // apps/v3/opportunities-v3.json -> "opportunities-v3".
    const category = specPath.split("/").pop()!.replace(".json", "");
    process.stdout.write(`  ${category}... `);

    try {
      const spec = await fetchFileContent(specPath);
      const actions = extractActions(spec, category);
      allActions.push(...actions);
      console.log(`${actions.length} actions`);
    } catch (err: any) {
      const message = err instanceof Error ? err.message : String(err);
      failedSpecs.push({ path: specPath, error: message });
      console.log(`FAILED: ${message}`);
    }

    // Rate limit courtesy
    await new Promise((r) => setTimeout(r, 100));
  }

  if (failedSpecs.length > 0 && !allowPartial) {
    console.error("\nCatalog build failed. Refusing to write a partial catalog.");
    for (const failure of failedSpecs) {
      console.error(`- ${failure.path}: ${failure.error}`);
    }
    console.error("\nPass --allow-partial only when you intentionally want to write a partial catalog.");
    process.exit(1);
  }

  // Build the catalog
  const rawCatalog = {
    generatedAt: new Date().toISOString(),
    baseUrl: process.env.GHL_BASE_URL || "https://services.leadconnectorhq.com",
    totalActions: allActions.length,
    categories: [...new Set(allActions.map((a) => a.category))].sort(),
    actions: allActions,
  };
  const catalog = applyCatalogOverrides(rawCatalog);

  assertCatalogCompleteness(catalog.totalActions, catalog.categories.length);

  const outPath = new URL("../data/catalog.json", import.meta.url);
  const { writeFileSync } = await import("fs");
  const { fileURLToPath } = await import("url");
  writeFileSync(fileURLToPath(outPath), JSON.stringify(catalog, null, 2));

  console.log(`\nCatalog written: ${catalog.totalActions} actions across ${catalog.categories.length} categories`);
  if (failedSpecs.length > 0) {
    console.log(`WARNING: wrote a partial catalog with ${failedSpecs.length} failed spec file(s) because --allow-partial was set.`);
  }
  console.log(`Categories: ${catalog.categories.join(", ")}`);
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
