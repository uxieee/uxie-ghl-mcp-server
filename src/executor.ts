import type { CatalogAction } from "./types.js";

const GHL_BASE_URL = "https://services.leadconnectorhq.com";
const ALLOWED_METHODS = new Set(["GET", "POST", "PUT", "PATCH", "DELETE"]);
const FETCH_TIMEOUT_MS = 15_000;
const MAX_ERROR_HINT_LEN = 200;
const MAX_BODY_SIZE = 1_048_576; // 1MB

/**
 * Executes a GHL API action by making the actual HTTP request.
 */
export async function executeAction(
  action: CatalogAction,
  params: Record<string, unknown>,
  apiToken: string
): Promise<{ status: number; data: unknown }> {
  // Validate HTTP method (normalize case)
  const method = action.method.toUpperCase();
  if (!ALLOWED_METHODS.has(method)) {
    throw new Error(`Disallowed HTTP method: ${method}`);
  }

  // Validate action path — prevent SSRF (catalog is a build artifact, but defense in depth)
  if (
    !action.path.startsWith("/") ||
    action.path.includes("://") ||
    action.path.includes("@") ||
    action.path.includes("#")
  ) {
    throw new Error("Invalid action path in catalog");
  }

  // Validate required params are present
  const missing = action.parameters
    .filter((p) => p.required && params[p.name] === undefined)
    .map((p) => `${p.name} (${p.in})`);
  if (missing.length > 0) {
    throw new Error(`Missing required parameter(s): ${missing.join(", ")}`);
  }

  // Detect likely param name typos
  const knownParamNames = new Set(action.parameters.map((p) => p.name));
  const bodyProps = getBodySchemaProperties(action);
  const allKnownNames = new Set([
    ...knownParamNames,
    ...(bodyProps ?? []),
  ]);
  for (const key of Object.keys(params)) {
    if (!allKnownNames.has(key)) {
      // Check for case-insensitive match (common typo: locationid vs locationId)
      const match = [...allKnownNames].find(
        (known) => known.toLowerCase() === key.toLowerCase()
      );
      if (match) {
        throw new Error(
          `Unknown parameter "${key}" — did you mean "${match}"?`
        );
      }
    }
  }

  // Classify params into path, query, and body buckets
  let url = `${GHL_BASE_URL}${action.path}`;
  const queryParams: Record<string, string> = {};
  const usedParams = new Set<string>();

  // Substitute path parameters
  for (const param of action.parameters) {
    const value = params[param.name];
    if (value === undefined) continue;

    if (param.in === "path") {
      url = url.replace(`{${param.name}}`, encodeURIComponent(String(value)));
      usedParams.add(param.name);
    } else if (param.in === "query") {
      queryParams[param.name] = String(value);
      usedParams.add(param.name);
    }
  }

  // Check for ALL unresolved path placeholders
  const unresolved = [...url.matchAll(/\{([^}]+)\}/g)].map((m) => m[1]);
  if (unresolved.length > 0) {
    throw new Error(
      `Missing required path parameter(s): ${unresolved.join(", ")}`
    );
  }

  // Append query parameters
  const qs = new URLSearchParams(queryParams).toString();
  if (qs) url += `?${qs}`;

  // Build headers
  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiToken}`,
    Accept: "application/json",
  };

  if (action.versionHeader) {
    headers["Version"] = action.versionHeader;
  }

  // Build request body.
  // Pass through all remaining keys so bad upstream OpenAPI schemas do not block
  // valid GHL requests such as `parentId` or `options`.
  let body: string | undefined;
  if (["POST", "PUT", "PATCH"].includes(method)) {
    const bodyParams: Record<string, unknown> = {};

    for (const [key, val] of Object.entries(params)) {
      if (usedParams.has(key)) continue;
      bodyParams[key] = val;
    }
    if (Object.keys(bodyParams).length > 0) {
      headers["Content-Type"] =
        action.requestBody?.contentType || "application/json";
      body = JSON.stringify(bodyParams);
      if (body.length > MAX_BODY_SIZE) {
        throw new Error(`Request body too large (${body.length} bytes, max ${MAX_BODY_SIZE})`);
      }
    }
  }

  // Execute with timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(new Error(`GHL API request timed out after ${FETCH_TIMEOUT_MS}ms`)),
    FETCH_TIMEOUT_MS
  );

  try {
    const response = await fetch(url, {
      method,
      headers,
      body,
      signal: controller.signal,
    });

    // Sanitize error responses
    if (!response.ok) {
      let errorHint = "";
      try {
        const contentType = response.headers.get("content-type") || "";
        if (contentType.includes("application/json")) {
          const errorBody = (await response.json()) as Record<string, unknown>;
          const msg = String(errorBody.message || errorBody.error || "");
          if (msg) {
            errorHint = ` — ${msg.slice(0, MAX_ERROR_HINT_LEN)}`;
          }
        }
      } catch {
        // Ignore parse errors on error responses
      }
      return {
        status: response.status,
        data: `GHL API error (HTTP ${response.status})${errorHint}`,
      };
    }

    // Parse successful response
    let data: unknown;
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    return { status: response.status, data };
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Extract known property names from an action's request body schema.
 * Used only for typo hints — valid extra keys still pass through at runtime.
 */
function getBodySchemaProperties(action: CatalogAction): Set<string> | null {
  const schema = action.requestBody?.schema;
  if (!schema) return null;

  const props = (schema as Record<string, unknown>).properties;
  if (!props || typeof props !== "object") return null;

  return new Set(Object.keys(props as Record<string, unknown>));
}
