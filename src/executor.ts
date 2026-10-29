import type { CatalogAction } from "./types.js";
import type { RateBudget, RateLimitInfo } from "./rate-budget.js";

const GHL_BASE_URL = "https://services.leadconnectorhq.com";
const ALLOWED_METHODS = new Set(["GET", "POST", "PUT", "PATCH", "DELETE"]);
const FETCH_TIMEOUT_MS = 15_000;
// 4xx bodies carry the per-field reasons an agent needs to fix its call; 200 chars cut them off.
const MAX_ERROR_HINT_LEN = 1000;
const MAX_BODY_SIZE = 1_048_576; // 1MB

/**
 * Executes a GHL API action by making the actual HTTP request.
 */
export interface RequestPreview {
  method: string;
  url: string;
  path: string;
  query: Record<string, string>;
  body: Record<string, unknown>;
  contentType: string | null;
  /** Spec-said-required-but-absent fields. The request is sent regardless; GHL adjudicates. */
  warnings?: string[];
}

export interface ExecuteOptions {
  /** GHL's rate budget (rate-budget.ts) and the key it is kept under — the selected account, or "single". */
  budget?: RateBudget;
  key?: string;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
}

const realSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * One call to GHL. With a budget, it waits AT MOST ONCE per call — before sending (the window is spent) or after a 429
 * — so a tool call never runs longer than one window plus the request timeouts. A 429 is retried only when GHL's
 * gateway sent it (it carries X-RateLimit-* headers) or the body says retryable:true; never when it says
 * retryable:false, and never when the daily quota is spent (W3, 2026-10-29).
 */
export async function executeAction(
  action: CatalogAction,
  params: Record<string, unknown>,
  apiToken: string,
  baseUrl: string = GHL_BASE_URL,
  opts: ExecuteOptions = {}
): Promise<{ status: number; data: unknown; rateLimit?: RateLimitInfo }> {
  const request = buildGhlRequest(action, params, apiToken, baseUrl);
  const { budget, key = "single", fetchImpl = fetch, sleep = realSleep } = opts;
  let waited = false;

  if (budget) {
    const d = budget.before(key);
    if (d.action === "refuse") {
      const mins = d.resetMs == null ? null : Math.ceil(d.resetMs / 60000);
      return { status: 429, data: `GHL rate limit: the daily quota for this sub-account is spent${mins == null ? "" : `; it resets in about ${mins} min`}. Nothing was sent.`, rateLimit: budget.info(key) };
    }
    if (d.action === "wait") { await sleep(d.ms); waited = true; }
  }

  for (let attempt = 0; ; attempt++) {
    budget?.sent(key);
    const { response, body } = await send(request, fetchImpl);
    budget?.observe(key, response.headers);
    if (response.status === 429 && budget && attempt === 0 && !waited) {
      const retry = retryDelay(response, body, budget, key);
      if (retry != null) { await sleep(retry); waited = true; continue; }
    }
    const result = toResult(response, body, action);
    if (budget && (response.status === 429 || budget.isLow(key))) result.rateLimit = budget.info(key);
    return result;
  }
}

async function send(request: ReturnType<typeof buildGhlRequest>, fetchImpl: typeof fetch): Promise<{ response: Response; body: string }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(new Error(`GHL API request timed out after ${FETCH_TIMEOUT_MS}ms`)),
    FETCH_TIMEOUT_MS
  );
  try {
    const response = await fetchImpl(request.url, {
      method: request.method,
      headers: request.headers,
      body: request.body,
      signal: controller.signal,
    });
    // A fetch-like response may offer only json() (some callers and test doubles); read whichever exists.
    const body = typeof response.text === "function" ? await response.text()
      : JSON.stringify(await (response as unknown as { json: () => Promise<unknown> }).json());
    return { response, body };
  } finally {
    clearTimeout(timeoutId);
  }
}

/** ms to wait before the one retry, or null when this 429 must not be retried. */
function retryDelay(response: Response, body: string, budget: RateBudget, key: string): number | null {
  let retryable: unknown;
  try { retryable = (JSON.parse(body) as Record<string, unknown>)?.retryable; } catch { /* not JSON */ }
  if (retryable === false) return null;
  const info = budget.info(key);
  if (info.dailyRemaining === 0) return null;
  // X-RateLimit-* rides on EVERY response, so its presence proves nothing. Only a spent window (Remaining 0) is the
  // gateway refusing before the call ran; a 429 with room left may come from the service after a write landed, so it is
  // never resent unless GHL says retryable:true (W3 review, 2026-10-29).
  const gateway = response.headers.get("x-ratelimit-remaining") === "0";
  const after = Number(response.headers.get("retry-after"));
  if (Number.isFinite(after) && after > 0 && (retryable === true || gateway)) return Math.min(after * 1000, 10_000);
  if (!gateway) return null;
  const d = budget.before(key);
  return d.action === "wait" ? d.ms : d.action === "go" ? 1000 : null;
}

function toResult(response: Response, body: string, action: CatalogAction): { status: number; data: unknown; rateLimit?: RateLimitInfo } {
  const contentType = response.headers.get("content-type") || "";
  // Sanitize error responses
  if (!response.ok) {
    let errorHint = "";
    try {
      if (contentType.includes("application/json")) {
        const errorBody = JSON.parse(body) as Record<string, unknown>;
        // GHL (NestJS) returns `message` as an ARRAY of per-field validation errors on a
        // 422. Collapsing that with String() comma-joined them and the old 200-char slice
        // cut the tail — discarding the single most useful signal for self-correction.
        const parts: string[] = [];
        const raw = errorBody.message ?? errorBody.error;
        if (Array.isArray(raw)) parts.push(...raw.map((m) => String(m)));
        else if (raw != null) parts.push(String(raw));
        for (const extra of ["errors", "details"] as const) {
          const v = errorBody[extra];
          if (v == null) continue;
          parts.push(typeof v === "string" ? v : JSON.stringify(v));
        }
        const msg = parts.filter(Boolean).join("; ");
        if (msg) errorHint = ` — ${msg.slice(0, MAX_ERROR_HINT_LEN)}`;
      }
    } catch {
      // Ignore parse errors on error responses
    }
    // Workflows (GHL's docs): the daily quota is shared by every token on the sub-account, and a separate 10 s budget
    // per sub-account is shared across tokens, reads and writes counted apart — no header reports it.
    const wfNote = response.status === 429 && /^\/workflows(\/|$)/.test(action.path)
      ? " (Workflows API: the daily quota and a per-sub-account 10-second budget are shared by every token on the sub-account; reads and writes are counted separately.)"
      : "";
    return { status: response.status, data: `GHL API error (HTTP ${response.status})${errorHint}${wfNote}` };
  }
  let data: unknown = body;
  if (contentType.includes("application/json")) {
    try { data = JSON.parse(body); } catch { data = body; }
  }
  return { status: response.status, data };
}

export function previewActionRequest(
  action: CatalogAction,
  params: Record<string, unknown>,
  baseUrl: string = GHL_BASE_URL
): RequestPreview {
  const request = buildGhlRequest(action, params, "pit-preview-token", baseUrl);
  const url = new URL(request.url);
  return {
    method: request.method,
    url: `${url.origin}${url.pathname}${url.search}`,
    path: url.pathname,
    query: Object.fromEntries(url.searchParams.entries()),
    body: request.bodyParams,
    contentType: request.contentType,
    ...(request.warnings.length > 0 && { warnings: request.warnings }),
  };
}

function buildGhlRequest(
  action: CatalogAction,
  params: Record<string, unknown>,
  apiToken: string,
  baseUrl: string = GHL_BASE_URL
): {
  method: string;
  url: string;
  headers: Record<string, string>;
  body: BodyInit | undefined;
  bodyParams: Record<string, unknown>;
  /** Spec-said-required-but-absent fields. Advisory: the request is sent regardless. */
  warnings: string[];
  contentType: string | null;
} {
  // A path placeholder GHL renamed (W3): a caller may still use the old name; it goes where the new one goes, never into the body.
  if (action.paramAliases) {
    params = { ...params };
    for (const [oldName, newName] of Object.entries(action.paramAliases)) {
      if (params[oldName] !== undefined && params[newName] === undefined) params[newName] = params[oldName];
      delete params[oldName];
    }
  }

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

  // Required-ness is ADVISORY, not a gate. The catalog's `required` arrays come from GHL's
  // OpenAPI specs, which are wrong often enough that enforcing them client-side blocked
  // requests GHL would have accepted — e.g. conversations__send-a-new-message declares
  // `status` (an INBOUND-message enum) required on an outbound send. This mirrors the
  // passthrough philosophy already applied to undocumented body keys: let GHL adjudicate,
  // and hand its verdict back. Only an unresolved PATH placeholder is a hard error, because
  // that literally cannot be turned into a URL.
  const warnings: string[] = [];

  const missingPath = action.parameters
    .filter((p) => p.in === "path" && params[p.name] === undefined)
    .map((p) => p.name);
  if (missingPath.length > 0) {
    throw new Error(
      `Missing required path parameter(s): ${missingPath.join(", ")} — these form the URL and cannot be omitted.`
    );
  }

  const missing = action.parameters
    .filter((p) => p.required && p.in !== "path" && params[p.name] === undefined)
    .map((p) => `${p.name} (${p.in})`);
  if (missing.length > 0) {
    warnings.push(
      `Spec marks these required but they were not supplied: ${missing.join(", ")}. Sent anyway; GHL will reject if it genuinely needs them.`
    );
  }

  const requiredBodyFields = getRequiredBodyFields(action);
  const missingBodyFields = requiredBodyFields.filter(
    (name) => params[name] === undefined
  );
  if (missingBodyFields.length > 0) {
    warnings.push(
      `Spec marks these body fields required but they were not supplied: ${missingBodyFields.join(", ")}. Sent anyway; GHL will reject if it genuinely needs them.`
    );
  }

  // Classify params into path, query, and body buckets
  let url = `${baseUrl}${action.path}`;
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
  let body: BodyInit | undefined;
  let contentType: string | null = null;
  // A DELETE carries a body only when its spec declares one: GHL's remove-tags,
  // remove-followers and coupon deletes, among others, read their arguments from it, and a
  // body on the other DELETEs would be a guess.
  const bodyParams: Record<string, unknown> = {};
  const sendsBody =
    ["POST", "PUT", "PATCH"].includes(method) ||
    (method === "DELETE" && Boolean(action.requestBody));
  const leftover = Object.entries(params).filter(([key]) => !usedParams.has(key));
  if (sendsBody) {
    for (const [key, val] of leftover) bodyParams[key] = val;
    if (Object.keys(bodyParams).length > 0) {
      contentType = action.requestBody?.contentType || "application/json";
      body = encodeRequestBody(bodyParams, contentType, headers);
    }
  } else if (leftover.length > 0) {
    warnings.push(
      `Not sent: ${leftover.map(([key]) => key).join(", ")}. A ${method} to this route has no body and these are not path or query parameters.`
    );
  }

  return { method, url, headers, body, bodyParams, contentType, warnings };
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

function getRequiredBodyFields(action: CatalogAction): string[] {
  const required = action.requestBody?.schema?.required;
  if (!Array.isArray(required)) return [];
  return required.filter((entry): entry is string => typeof entry === "string");
}

function encodeRequestBody(
  bodyParams: Record<string, unknown>,
  contentType: string,
  headers: Record<string, string>
): BodyInit {
  if (contentType.includes("multipart/form-data")) {
    assertBodySize(JSON.stringify(bodyParams).length);
    const form = new FormData();
    for (const [key, val] of Object.entries(bodyParams)) {
      appendFormDataValue(form, key, val);
    }
    return form;
  }

  if (contentType.includes("application/x-www-form-urlencoded")) {
    const form = new URLSearchParams();
    for (const [key, val] of Object.entries(bodyParams)) {
      appendUrlEncodedValue(form, key, val);
    }
    const encoded = form.toString();
    assertBodySize(encoded.length);
    headers["Content-Type"] = "application/x-www-form-urlencoded";
    return form;
  }

  const body = JSON.stringify(bodyParams);
  assertBodySize(body.length);
  headers["Content-Type"] = contentType || "application/json";
  return body;
}

function appendFormDataValue(form: FormData, key: string, val: unknown) {
  if (val === undefined || val === null) return;
  if (val instanceof Blob) {
    form.append(key, val);
    return;
  }
  if (Array.isArray(val)) {
    for (const item of val) appendFormDataValue(form, key, item);
    return;
  }
  if (typeof val === "object") {
    form.append(key, JSON.stringify(val));
    return;
  }
  form.append(key, String(val));
}

function appendUrlEncodedValue(
  form: URLSearchParams,
  key: string,
  val: unknown
) {
  if (val === undefined || val === null) return;
  if (Array.isArray(val)) {
    for (const item of val) appendUrlEncodedValue(form, key, item);
    return;
  }
  form.append(key, typeof val === "object" ? JSON.stringify(val) : String(val));
}

function assertBodySize(size: number) {
  if (size > MAX_BODY_SIZE) {
    throw new Error(`Request body too large (${size} bytes, max ${MAX_BODY_SIZE})`);
  }
}
