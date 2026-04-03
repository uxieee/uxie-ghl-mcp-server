/**
 * Downloads all GHL OpenAPI specs from GitHub and compiles them into
 * a compact action catalog for the search+execute MCP pattern.
 *
 * Usage: npx tsx scripts/build-catalog.ts
 */

const REPO = "GoHighLevel/highlevel-api-docs";
const BRANCH = "main";
const APPS_DIR = "apps";

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
  const url = `https://api.github.com/repos/${REPO}/contents/${path}?ref=${BRANCH}`;
  const meta = await fetchJSON(url);
  const content = Buffer.from(meta.content, "base64").toString("utf-8");
  return JSON.parse(content);
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

function extractActions(spec: any, category: string): CatalogAction[] {
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

      // Check for Version header
      const versionParam = parameters.find(
        (p) => p.name === "Version" && p.in === "header"
      );
      const versionHeader = versionParam?.enum?.[0] || null;

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
        parameters: parameters.filter((p) => p.name !== "Version"),
        requestBody,
        versionHeader,
      });
    }
  }

  return actions;
}

async function listSpecFiles(): Promise<string[]> {
  const url = `https://api.github.com/repos/${REPO}/contents/${APPS_DIR}?ref=${BRANCH}`;
  const entries = await fetchJSON(url);
  return entries
    .filter((e: any) => e.name.endsWith(".json"))
    .map((e: any) => e.path);
}

async function main() {
  console.log("Fetching spec file list...");
  const specFiles = await listSpecFiles();
  console.log(`Found ${specFiles.length} OpenAPI specs\n`);

  const allActions: CatalogAction[] = [];

  for (const specPath of specFiles) {
    const category = specPath.replace("apps/", "").replace(".json", "");
    process.stdout.write(`  ${category}... `);

    try {
      const spec = await fetchFileContent(specPath);
      const actions = extractActions(spec, category);
      allActions.push(...actions);
      console.log(`${actions.length} actions`);
    } catch (err: any) {
      console.log(`FAILED: ${err.message}`);
    }

    // Rate limit courtesy
    await new Promise((r) => setTimeout(r, 100));
  }

  // Build the catalog
  const catalog = {
    generatedAt: new Date().toISOString(),
    baseUrl: "https://services.leadconnectorhq.com",
    totalActions: allActions.length,
    categories: [...new Set(allActions.map((a) => a.category))].sort(),
    actions: allActions,
  };

  const outPath = new URL("../data/catalog.json", import.meta.url);
  const { writeFileSync } = await import("fs");
  const { fileURLToPath } = await import("url");
  writeFileSync(fileURLToPath(outPath), JSON.stringify(catalog, null, 2));

  console.log(`\nCatalog written: ${catalog.totalActions} actions across ${catalog.categories.length} categories`);
  console.log(`Categories: ${catalog.categories.join(", ")}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
