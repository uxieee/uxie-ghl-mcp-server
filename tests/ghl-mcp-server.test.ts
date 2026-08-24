import test from "node:test";
import assert from "node:assert/strict";
import { buildSearchIndex, searchActions } from "../src/search.js";
import { registerTools } from "../src/tools.js";
import { executeAction, previewActionRequest } from "../src/executor.js";
import { applyCatalogOverrides } from "../src/catalog-overrides.js";
import { ACTION_TIPS } from "../src/action-tips.js";
import { AccountsRegistry } from "../src/accounts.js";
import { assertCatalogCompleteness, extractActions } from "../scripts/build-catalog.js";
import type { Catalog, CatalogAction } from "../src/types.js";

interface RegisteredTool {
  meta: unknown;
  handler: (input: Record<string, unknown>) => Promise<unknown>;
}

class FakeServer {
  tools = new Map<string, RegisteredTool>();

  registerTool(
    name: string,
    meta: unknown,
    handler: (input: Record<string, unknown>) => Promise<unknown>
  ) {
    this.tools.set(name, { meta, handler });
  }
}

function createCatalog(actions: CatalogAction[]): Catalog {
  return {
    generatedAt: new Date().toISOString(),
    baseUrl: "https://services.leadconnectorhq.com",
    totalActions: actions.length,
    categories: [...new Set(actions.map((action) => action.category))],
    actions,
  };
}

function createAction(
  overrides: Partial<CatalogAction> & Pick<CatalogAction, "id" | "category" | "method" | "path">
): CatalogAction {
  return {
    summary: overrides.id,
    description: overrides.summary ?? overrides.id,
    tags: [],
    scopes: [],
    parameters: [],
    requestBody: null,
    versionHeader: null,
    ...overrides,
  };
}

function registerTestTools(actions: CatalogAction[], actionTips: Record<string, { note?: string; searchBoost?: string[] }> = {}) {
  const fakeServer = new FakeServer();
  const catalog = createCatalog(actions);
  const searchIndex = buildSearchIndex(
    catalog.actions,
    Object.fromEntries(
      Object.entries(actionTips).map(([id, tip]) => [id, tip.searchBoost ?? []])
    )
  );

  registerTools(fakeServer as never, {
    catalog,
    searchIndex,
    actionById: new Map(actions.map((action) => [action.id, action])),
    categorySummary: "",
    getToken: () => "pit-test-token",
    rateLimiter: { check: () => true } as never,
    actionTips,
  });

  return fakeServer.tools;
}

test("executeAction keeps undocumented body keys so GHL can validate them", async () => {
  let capturedBody = "";
  let capturedContentType = "";
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async (_url, init) => {
    capturedBody = String(init?.body ?? "");
    capturedContentType = new Headers(init?.headers).get("content-type") || "";
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;

  try {
    await executeAction(
      createAction({
        id: "locations__create-custom-field",
        category: "locations",
        method: "POST",
        path: "/locations/{locationId}/customFields",
        parameters: [
          {
            name: "locationId",
            in: "path",
            required: true,
            description: "",
            type: "string",
          },
        ],
        requestBody: {
          required: true,
          contentType: "application/json",
          schema: {
            type: "object",
            properties: {
              name: { type: "string" },
            },
          },
        },
      }),
      {
        locationId: "loc_123",
        name: "Stage",
        parentId: "folder_456",
        options: ["a", "b"],
      },
      "pit-test-token"
    );
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(
    capturedBody,
    JSON.stringify({
      name: "Stage",
      parentId: "folder_456",
      options: ["a", "b"],
    })
  );
  assert.equal(capturedContentType, "application/json");
});

test("executeAction sends multipart/form-data actions as FormData", async () => {
  let capturedBody: BodyInit | null | undefined;
  let capturedContentType = "";
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async (_url, init) => {
    capturedBody = init?.body;
    capturedContentType = new Headers(init?.headers).get("content-type") || "";
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;

  try {
    await executeAction(
      createAction({
        id: "medias__upload-file",
        category: "medias",
        method: "POST",
        path: "/medias/upload-file",
        requestBody: {
          required: true,
          contentType: "multipart/form-data",
          schema: {
            type: "object",
            properties: {
              file: { type: "string" },
              locationId: { type: "string" },
            },
          },
        },
      }),
      { locationId: "loc_123", file: "hello", folder: "docs" },
      "pit-test-token"
    );
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.ok(capturedBody instanceof FormData);
  assert.equal(capturedBody.get("locationId"), "loc_123");
  assert.equal(capturedBody.get("file"), "hello");
  assert.equal(capturedContentType, "");
});

test("executeAction sends form-urlencoded actions as URLSearchParams", async () => {
  let capturedBody: BodyInit | null | undefined;
  let capturedContentType = "";
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async (_url, init) => {
    capturedBody = init?.body;
    capturedContentType = new Headers(init?.headers).get("content-type") || "";
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;

  try {
    await executeAction(
      createAction({
        id: "oauth__token",
        category: "oauth",
        method: "POST",
        path: "/oauth/token",
        requestBody: {
          required: true,
          contentType: "application/x-www-form-urlencoded",
          schema: {
            type: "object",
            properties: {
              grant_type: { type: "string" },
              code: { type: "string" },
            },
          },
        },
      }),
      { grant_type: "authorization_code", code: "abc" },
      "pit-test-token"
    );
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.ok(capturedBody instanceof URLSearchParams);
  assert.equal(capturedBody.toString(), "grant_type=authorization_code&code=abc");
  assert.equal(capturedContentType, "application/x-www-form-urlencoded");
});

// CHANGED 2026-08-24. This used to assert that missing query and body fields THROW. They no
// longer do. The catalog's `required` arrays come from GHL's OpenAPI specs, which are wrong
// often enough that enforcing them client-side blocked requests GHL would have accepted —
// conversations__send-a-new-message declares `status` (an inbound-message enum) required on an
// outbound send, so the README's own "send an SMS" example failed on the first try. Required-ness
// is now advisory and returned as a warning; GHL adjudicates. Only an unresolved PATH
// placeholder still throws, because it cannot be turned into a URL at all.
test("executeAction hard-fails only on missing PATH params; query and body are advisory", async () => {
  const action = createAction({
    id: "contacts__update-contact",
    category: "contacts",
    method: "PUT",
    path: "/contacts/{contactId}",
    parameters: [
      { name: "contactId", in: "path", required: true, description: "", type: "string" },
      { name: "locationId", in: "query", required: true, description: "", type: "string" },
    ],
    requestBody: {
      required: true,
      contentType: "application/json",
      schema: {
        type: "object",
        required: ["firstName"],
        properties: {
          firstName: { type: "string" },
        },
      },
    },
  });

  // A missing path param still throws — the URL cannot be formed without it.
  await assert.rejects(
    () => executeAction(action, { locationId: "loc_123", firstName: "Ada" }, "pit-test-token"),
    /Missing required path parameter\(s\): contactId/
  );

  // A missing required QUERY param no longer throws; it is previewed as a warning.
  const missingQuery = previewActionRequest(action, { contactId: "con_123", firstName: "Ada" });
  assert.match((missingQuery.warnings ?? []).join(" "), /locationId \(query\)/);

  // A missing required BODY field no longer throws either.
  const missingBody = previewActionRequest(action, { contactId: "con_123", locationId: "loc_123" });
  assert.match((missingBody.warnings ?? []).join(" "), /firstName/);

  // ...and a complete call carries no warnings at all.
  const complete = previewActionRequest(action, {
    contactId: "con_123", locationId: "loc_123", firstName: "Ada",
  });
  assert.equal(complete.warnings, undefined);
});

test("executeAction gives a typo hint for case-mismatched params", async () => {
  await assert.rejects(
    () => executeAction(
      createAction({
        id: "contacts__get-contacts",
        category: "contacts",
        method: "GET",
        path: "/contacts/",
        parameters: [
          { name: "locationId", in: "query", required: true, description: "", type: "string" },
        ],
      }),
      { locationid: "loc_123" },
      "pit-test-token"
    ),
    /did you mean "locationId"/
  );
});

test("execute_action result_filter matches text nested inside array values", async () => {
  const actions = [
    createAction({
      id: "contacts__get-contacts",
      category: "contacts",
      method: "GET",
      path: "/contacts/",
    }),
  ];
  const tools = registerTestTools(actions);
  const executeTool = tools.get("execute_action");
  assert.ok(executeTool);

  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify([
        { id: "1", firstName: "Alice", tags: ["hb_trial_started"] },
        { id: "2", firstName: "Bob", tags: ["customer"] },
      ]),
      {
        status: 200,
        headers: { "content-type": "application/json" },
      }
    )) as typeof fetch;

  try {
    const result = (await executeTool.handler({
      action_id: "contacts__get-contacts",
      params: {},
      confirm: false,
      result_filter: "hb_trial",
      result_offset: 0,
    })) as { content: Array<{ text: string }> };

    const output = result.content[0]?.text ?? "";
    assert.ok(result.structuredContent);
    assert.match(output, /hb_trial_started/);
    assert.doesNotMatch(output, /"customer"/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("search_actions can enumerate every action in a category when include_all is true", async () => {
  const actions = [
    createAction({
      id: "opportunities__get-pipelines",
      category: "opportunities",
      method: "GET",
      path: "/opportunities/pipelines",
      summary: "Get pipelines",
    }),
    createAction({
      id: "opportunities__create-opportunity",
      category: "opportunities",
      method: "POST",
      path: "/opportunities/",
      summary: "Create opportunity",
    }),
  ];
  const tools = registerTestTools(actions);
  const searchTool = tools.get("search_actions");
  assert.ok(searchTool);

  const result = (await searchTool.handler({
    intent: "",
    category: "opportunities",
    include_all: true,
    offset: 0,
    limit: 50,
    compact: true,
  })) as { content: Array<{ text: string }>; structuredContent: { results: unknown[]; pagination: { returned: number } } };

  const output = result.content[0]?.text ?? "";
  assert.equal(result.structuredContent.results.length, 2);
  assert.equal(result.structuredContent.pagination.returned, 2);
  assert.match(output, /opportunities__get-pipelines/);
  assert.match(output, /opportunities__create-opportunity/);
  assert.match(output, /"risk"/);
});

test("search_actions explains when a GHL feature has no public API endpoint", async () => {
  const actions = [
    createAction({
      id: "voice-ai__get-agents",
      category: "voice-ai",
      method: "GET",
      path: "/voice-ai/agents",
      summary: "Get voice AI agents",
    }),
  ];
  const tools = registerTestTools(actions);
  const searchTool = tools.get("search_actions");
  assert.ok(searchTool);

  const result = (await searchTool.handler({
    intent: "list conversation AI bots or agents",
    offset: 0,
    limit: 10,
    compact: true,
  })) as { content: Array<{ text: string }> };

  const output = result.content[0]?.text ?? "";
  assert.match(output, /Conversation AI/i);
  assert.match(output, /not exposed|not available|public API/i);
});

test("execute_action dry_run previews non-GET routing without calling fetch", async () => {
  const action = createAction({
    id: "contacts__create-contact",
    category: "contacts",
    method: "POST",
    path: "/contacts/",
    summary: "Create Contact",
    parameters: [
      { name: "locationId", in: "query", required: true, description: "", type: "string" },
    ],
    requestBody: {
      required: true,
      contentType: "application/json",
      schema: {
        type: "object",
        required: ["firstName"],
        properties: {
          firstName: { type: "string" },
        },
      },
    },
  });
  const tools = registerTestTools([action]);
  const executeTool = tools.get("execute_action");
  assert.ok(executeTool);

  const originalFetch = globalThis.fetch;
  let called = false;
  globalThis.fetch = (async () => {
    called = true;
    throw new Error("should not call fetch");
  }) as typeof fetch;

  try {
    const result = (await executeTool.handler({
      action_id: action.id,
      params: { locationId: "loc_123", firstName: "Ada" },
      dry_run: true,
      confirm: false,
      result_offset: 0,
    })) as { content: Array<{ text: string }>; structuredContent: { status: string; data: { path: string; query: Record<string, string>; body: Record<string, unknown> } } };

    assert.equal(called, false);
    assert.equal(result.structuredContent.status, "dry_run");
    assert.equal(result.structuredContent.data.path, "/contacts/");
    assert.equal(result.structuredContent.data.query.locationId, "loc_123");
    assert.equal(result.structuredContent.data.body.firstName, "Ada");
    assert.match(result.content[0]?.text ?? "", /Dry run only/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("execute_action requires confirmation for externally visible sends", async () => {
  const action = createAction({
    id: "conversations__send-message",
    category: "conversations",
    method: "POST",
    path: "/conversations/messages",
    summary: "Send a message",
  });
  const tools = registerTestTools([action]);
  const executeTool = tools.get("execute_action");
  assert.ok(executeTool);

  const originalFetch = globalThis.fetch;
  let called = false;
  globalThis.fetch = (async () => {
    called = true;
    throw new Error("should not call fetch");
  }) as typeof fetch;

  try {
    const result = (await executeTool.handler({
      action_id: action.id,
      params: { contactId: "con_123", type: "SMS", message: "hello" },
      confirm: false,
      result_offset: 0,
    })) as { structuredContent: { status: string; action: { risk: { requiresConfirmation: boolean; kinds: string[] } } }; content: Array<{ text: string }> };

    assert.equal(called, false);
    assert.equal(result.structuredContent.status, "confirmation_required");
    assert.equal(result.structuredContent.action.risk.requiresConfirmation, true);
    assert.ok(result.structuredContent.action.risk.kinds.includes("external_send"));
    assert.match(result.content[0]?.text ?? "", /confirm=true/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("execute_action includes action notes so read-only limitations stay visible after execution", async () => {
  const action = createAction({
    id: "workflows__get-workflow",
    category: "workflows",
    method: "GET",
    path: "/workflows/",
    summary: "Get workflow",
  });
  const tools = registerTestTools([action], {
    "workflows__get-workflow": {
      note: "Read-only workflow list. GHL public API does not expose workflow triggers or builder steps.",
    },
  });
  const executeTool = tools.get("execute_action");
  assert.ok(executeTool);

  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response(JSON.stringify([{ id: "wf_1", name: "Test", status: "published" }]), {
      status: 200,
      headers: { "content-type": "application/json" },
    })) as typeof fetch;

  try {
    const result = (await executeTool.handler({
      action_id: "workflows__get-workflow",
      params: {},
      confirm: false,
      result_offset: 0,
    })) as { content: Array<{ text: string }> };

    const output = result.content[0]?.text ?? "";
    assert.match(output, /Read-only workflow list/i);
    assert.match(output, /does not expose workflow triggers/i);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("execute_action shapes large responses instead of returning unbounded text", async () => {
  const action = createAction({
    id: "contacts__get-contacts",
    category: "contacts",
    method: "GET",
    path: "/contacts/",
  });
  const tools = registerTestTools([action]);
  const executeTool = tools.get("execute_action");
  assert.ok(executeTool);

  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({
        contacts: Array.from({ length: 30 }, (_, index) => ({
          id: `contact_${index}`,
          name: `Contact ${index}`,
          notes: "x".repeat(500),
        })),
      }),
      {
        status: 200,
        headers: { "content-type": "application/json" },
      }
    )) as typeof fetch;

  try {
    const result = (await executeTool.handler({
      action_id: action.id,
      params: {},
      confirm: false,
      result_offset: 0,
      result_limit: 2,
    })) as { structuredContent: { pagination: { showing: number; total: number } }; content: Array<{ text: string }> };

    assert.equal(result.structuredContent.pagination.showing, 2);
    assert.equal(result.structuredContent.pagination.total, 30);
    assert.match(result.content[0]?.text ?? "", /contact_0/);
    assert.doesNotMatch(result.content[0]?.text ?? "", /contact_29/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("catalog completeness assertion fails closed for tiny catalogs", () => {
  assert.throws(
    () => assertCatalogCompleteness(2, 1),
    /unexpectedly small catalog/
  );
  assert.doesNotThrow(() => assertCatalogCompleteness(1207, 83));
});

test("build-catalog detects a case-insensitive Version header and keeps it out of params", () => {
  // GHL's v3 specs declare a lowercase `version` header on some endpoints, and
  // sometimes pin the value via schema.default instead of an enum.
  const spec = {
    paths: {
      "/phone-system/numbers/location/{locationId}": {
        get: {
          operationId: "list-numbers",
          parameters: [
            { name: "version", in: "header", required: true, schema: { default: "2021-07-28" } },
            { name: "locationId", in: "path", required: true, schema: { type: "string" } },
          ],
        },
      },
    },
  };

  const actions = extractActions(spec, "phone-system");
  assert.equal(actions.length, 1);
  assert.equal(actions[0].versionHeader, "2021-07-28");
  assert.ok(!actions[0].parameters.some((p) => p.name.toLowerCase() === "version"));
});

test("executeAction targets the catalog baseUrl override", async () => {
  let capturedUrl = "";
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (url) => {
    capturedUrl = String(url);
    return new Response("{}", {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;

  try {
    await executeAction(
      createAction({
        id: "contacts__get-contacts",
        category: "contacts",
        method: "GET",
        path: "/contacts/",
      }),
      {},
      "pit-test-token",
      "https://staging.example.com"
    );
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.ok(capturedUrl.startsWith("https://staging.example.com/contacts/"));
});

// Both of these were discovered the expensive way — one 422 round trip each — while driving
// a live account on 2026-07-31. The executor sends every UNDECLARED key in the request body
// (deliberately, so bad upstream schemas cannot block valid requests), which is exactly why
// an endpoint that rejects a key in the body has to have that key declared somewhere else.
test("update-pipeline routes locationId to the query string, where GHL wants it", async () => {
  const catalog = applyCatalogOverrides(
    createCatalog([
      createAction({
        id: "opportunities-v3__get-pipelines",
        category: "opportunities-v3",
        method: "GET",
        path: "/opportunities/pipelines",
      }),
    ])
  );
  const action = catalog.actions.find(
    (candidate) => candidate.id === "opportunities-v3__update-pipeline"
  );
  assert.ok(action, "update-pipeline should be appended by the overrides");
  assert.equal(
    action.parameters.find((p) => p.name === "locationId")?.in,
    "query",
    "an undeclared locationId falls through to the body, which this endpoint 422s"
  );

  let capturedUrl = "";
  let capturedBody: unknown;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (url, init) => {
    capturedUrl = String(url);
    capturedBody = JSON.parse(String((init as RequestInit).body));
    return new Response("{}", { status: 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
  try {
    await executeAction(
      action,
      { pipelineId: "pipe_1", locationId: "loc_1", name: "Sales", stages: [{ id: "st_1", name: "New" }] },
      "pit-test-token"
    );
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.match(capturedUrl, /\/opportunities\/pipelines\/pipe_1\?locationId=loc_1/);
  assert.deepEqual(Object.keys(capturedBody as object).sort(), ["name", "stages"]);
});

test("update-agent's sleep fields say they are conditional on sleepEnabled", () => {
  const catalog = applyCatalogOverrides(
    createCatalog([
      createAction({
        id: "conversation-ai__update-agent",
        category: "conversation-ai",
        method: "PUT",
        path: "/conversation-ai/agents/{agentId}",
        parameters: [{ name: "agentId", in: "path", required: true, description: "", type: "string" }],
        requestBody: {
          required: true,
          contentType: "application/json",
          schema: {
            type: "object",
            properties: {
              sleepEnabled: { type: "boolean", description: "Enable sleep." },
              sleepTime: { type: "number", description: "How long to sleep." },
              sleepTimeUnit: { type: "string", description: "Sleep unit." },
            },
          },
        },
      }),
    ])
  );
  const props = catalog.actions[0].requestBody?.schema?.properties as Record<string, { description: string }>;
  for (const field of ["sleepTime", "sleepTimeUnit"]) {
    assert.match(props[field].description, /422/, `${field} must warn that it is conditional`);
    assert.match(props[field].description, /sleepEnabled is true/);
  }
  // the unconditional field is left alone
  assert.equal(props.sleepEnabled.description, "Enable sleep.");
});

test("the update-agent note warns off locationId, which the endpoint 422s in the body", () => {
  for (const id of ["conversation-ai__update-agent", "conversation-ai-v3__update-agent"]) {
    const note = ACTION_TIPS[id]?.note ?? "";
    assert.match(note, /locationId/, `${id} should warn about locationId`);
    assert.match(note, /422/, `${id} should say what happens`);
  }
  assert.match(ACTION_TIPS["opportunities-v3__update-pipeline"]?.note ?? "", /QUERY STRING/);
});

// ── 2026-08-24 regressions ───────────────────────────────────────────────────────────
// Each of these encodes a defect found by an external design review, so that fixing it
// once is permanent.

// A required `Authorization` header param made 75 actions UNREACHABLE: the executor only
// routes path and query, so the check could never be satisfied — and supplying the header
// to get past it pushed the caller's PIT into the request BODY, where it was echoed back
// in the response. Both halves are fixed by never emitting the param at all.
test("build-catalog strips Authorization header params, which made 75 actions unreachable", () => {
  const actions = extractActions({
    paths: {
      "/knowledge-base/": {
        get: {
          operationId: "list",
          summary: "List",
          parameters: [
            { name: "Authorization", in: "header", required: true, schema: { type: "string" } },
            { name: "Version", in: "header", required: true, schema: { type: "string" } },
            { name: "locationId", in: "query", required: true, schema: { type: "string" } },
          ],
        },
      },
    },
  } as never, "knowledge-base");
  const names = actions[0].parameters.map((p) => p.name.toLowerCase());
  assert.ok(!names.includes("authorization"), "Authorization must not reach the catalog");
  assert.ok(!names.includes("version"), "Version must not reach the catalog");
  assert.ok(names.includes("locationid"), "real params must survive");
});

// search_actions used to inline every hit's full OpenAPI schema AND return the whole payload
// twice (structuredContent + a pretty-printed text copy), costing ~15,800 tokens per call.
// Stubs are now the default; describe_action fetches the schema for the ONE chosen action.
test("search_actions returns stubs by default, and describe_action carries the full schema", async () => {
  const tools = registerTestTools([
    createAction({
      id: "contacts__create-contact",
      category: "contacts",
      method: "POST",
      path: "/contacts/",
      summary: "Create Contact",
      parameters: [
        { name: "locationId", in: "query", required: true, description: "", type: "string" },
      ],
      requestBody: {
        required: true,
        contentType: "application/json",
        schema: { type: "object", required: ["firstName"], properties: { firstName: { type: "string" } } },
      },
    }),
  ]);

  // NOTE: this fake server bypasses Zod, so schema defaults are not applied — pass them.
  const search = (await tools.get("search_actions")!.handler({
    intent: "create a contact", offset: 0, limit: 10, include_all: false, compact: true,
  })) as any;
  const first = search.structuredContent.results[0];
  assert.ok(first.id && first.method && first.path, "stub keeps identity fields");
  assert.equal(first.parameters, undefined, "stub must not inline parameters");
  assert.equal(first.requestBody, undefined, "stub must not inline the request body schema");

  const described = (await tools.get("describe_action")!.handler({ action_id: first.id })) as any;
  assert.ok(Array.isArray(described.structuredContent.parameters), "describe returns parameters");
  assert.ok("requestBody" in described.structuredContent, "describe returns the request body");
  assert.ok("kind" in described.structuredContent, "describe exposes read/write kind");
});

test("describe_action fails helpfully on an unknown id", async () => {
  const tools = registerTestTools([
    createAction({ id: "contacts__create-contact", category: "contacts", method: "POST", path: "/contacts/" }),
  ]);
  const res = (await tools.get("describe_action")!.handler({ action_id: "contacts__nope" })) as any;
  assert.match(String(res.structuredContent.error), /Unknown action_id/);
  assert.ok(Array.isArray(res.structuredContent.didYouMean));
});

// RELEVANCE. There was no search-quality test at all, which is how the ranker shipped
// scoring by raw substring: it joined every field into one string and used String.includes,
// so "book an appointment" matched faceBOOK and ad-mANager and returned ten Facebook
// ad-manager endpoints while calendars__create-appointment did not appear at all. These
// assert the queries that were provably broken.
test("search ranks by whole words, not substrings", () => {
  const actions = [
    createAction({ id: "calendars__create-appointment", category: "calendars", method: "POST",
      path: "/calendars/events/appointments", summary: "Create Appointment" }),
    createAction({ id: "ad-manager__fb-get-current-user", category: "ad-manager", method: "GET",
      path: "/ad-manager/facebook/user", summary: "Get Facebook Current User" }),
    createAction({ id: "ad-manager__fb-upsert-campaign", category: "ad-manager", method: "POST",
      path: "/ad-manager/facebook/campaign", summary: "Upsert Facebook Campaign" }),
  ];
  const index = buildSearchIndex(actions);
  const top = searchActions(index, actions, "book an appointment", 5).map((a) => a.id);
  assert.equal(top[0], "calendars__create-appointment",
    'the calendar action must win; "book" must not match faceBOOK');
  assert.ok(!top.includes("ad-manager__fb-get-current-user"),
    "substring noise from face-BOOK / ad-m-AN-ager must not rank at all");
});

// Parameter names, enum values and request-body property names were never indexed, so
// "send an SMS" scored ZERO on the send endpoint — `SMS` lives there only as an enum value.
test("search indexes request-body enums, so 'SMS' finds the send endpoint", () => {
  const actions = [
    createAction({ id: "conversations__send-a-new-message", category: "conversations",
      method: "POST", path: "/conversations/messages", summary: "Send a New Message",
      requestBody: { required: true, contentType: "application/json",
        schema: { type: "object", required: ["type"],
          properties: { type: { type: "string", enum: ["SMS", "Email", "WhatsApp"] } } } } }),
    createAction({ id: "contacts__add-contact-to-campaign", category: "contacts", method: "POST",
      path: "/contacts/{contactId}/campaigns/{campaignId}", summary: "Add Contact to Campaign" }),
  ];
  const index = buildSearchIndex(actions);
  const top = searchActions(index, actions, "send an SMS to a contact", 5).map((a) => a.id);
  assert.equal(top[0], "conversations__send-a-new-message");
});

test("stop words alone match nothing", () => {
  const actions = [createAction({ id: "contacts__get-contact", category: "contacts", method: "GET", path: "/contacts/{id}" })];
  const index = buildSearchIndex(actions);
  assert.equal(searchActions(index, actions, "at an on in to the", 5).length, 0);
});

// v2/v3 TWINS. GHL publishes most operations twice — a v2 spec and a v3 twin at the same
// method+path — so 536 of 671 operations appeared in search results twice and the agent had
// to choose. Keyword search now returns one row per operation.
test("keyword search collapses v2/v3 twins and names the alias", async () => {
  const tools = registerTestTools([
    createAction({ id: "contacts__create-contact", category: "contacts", method: "POST",
      path: "/contacts/", summary: "Create Contact", versionHeader: "2021-07-28" }),
    createAction({ id: "contacts-v3__create-contact", category: "contacts-v3", method: "POST",
      path: "/contacts/", summary: "Create Contact", versionHeader: "v3" }),
  ]);
  const res = (await tools.get("search_actions")!.handler({
    intent: "create a contact", offset: 0, limit: 10, include_all: false, compact: true,
  })) as any;
  const ids = res.structuredContent.results.map((r: any) => r.id);
  assert.equal(ids.length, 1, "one row per operation, not two");
  assert.equal(ids[0], "contacts-v3__create-contact", "the twin with a real v3 header wins");
  assert.equal(res.structuredContent.results[0].alsoAvailableAs, "contacts__create-contact");
});

// 124 actions sit in a -v3 category WITHOUT carrying Version: v3 (94 in ad-publishing-v3).
// Preferring on the category NAME would hand the agent a twin that is not v3 at all.
test("twin preference follows the real version header, not the category name", async () => {
  const tools = registerTestTools([
    createAction({ id: "store__list", category: "store", method: "GET", path: "/store/x",
      summary: "List Store", versionHeader: "2021-07-28" }),
    createAction({ id: "store-v3__list", category: "store-v3", method: "GET", path: "/store/x",
      summary: "List Store", versionHeader: null }),
  ]);
  const res = (await tools.get("search_actions")!.handler({
    intent: "list store", offset: 0, limit: 10, include_all: false, compact: true,
  })) as any;
  assert.equal(res.structuredContent.results[0].id, "store__list",
    "-v3 in the name must not beat a real version header");
});

// ── multi sub-account ────────────────────────────────────────────────────────────────
// A PIT is hard-bound to one sub-account (proven live: another location's id returns 403
// "The token does not have access to this location"). Multi-account here means holding N
// PITs and choosing one per call, so every request GHL sees is identical to a single-token
// connection. These tests pin the safety properties, not the convenience.

test("an unknown locationId is refused, never served with another account's token", () => {
  const reg = new AccountsRegistry({
    accounts: [
      { id: "loc_a", name: "Client A", token: "pit-aaa" },
      { id: "loc_b", name: "Client B", token: "pit-bbb" },
    ],
  });
  assert.throws(() => reg.resolve("loc_zzz"), /No token configured for location/);
  // and with several configured, omitting the id must not silently pick one
  assert.throws(() => reg.resolve(), /locationId is required/);
  assert.equal(reg.resolve("loc_b").token, "pit-bbb");
});

test("a single configured account keeps the old single-token behaviour", () => {
  const reg = new AccountsRegistry({ accounts: [{ id: "loc_a", name: "A", token: "pit-aaa" }] });
  assert.equal(reg.resolve().id, "loc_a");
  assert.equal(reg.list()[0].isDefault, true);
});

test("the accounts file is validated at load, not with a 401 an hour later", () => {
  assert.throws(() => new AccountsRegistry({ accounts: [] }), /non-empty/);
  assert.throws(
    () => new AccountsRegistry({ accounts: [{ id: "a", name: "A", token: "nope" }] }),
    /does not look like a PIT/
  );
  assert.throws(
    () => new AccountsRegistry({
      accounts: [{ id: "a", name: "A", token: "pit-1" }, { id: "a", name: "B", token: "pit-2" }],
    }),
    /twice/
  );
  assert.throws(
    () => new AccountsRegistry({ accounts: [{ id: "a", name: "A", token: "pit-1" }], default: "zzz" }),
    /not one of the configured accounts/
  );
});

// THE SILENT-WRONG-ACCOUNT HOLE. ~407 catalog actions name no location anywhere, so nothing
// is injected and GHL has nothing to reject: a mis-keyed token would succeed against
// whichever sub-account it really belongs to, and the agent would believe otherwise.
test("binding verification catches a mis-keyed token", async () => {
  const reg = new AccountsRegistry({ accounts: [{ id: "loc_a", name: "A", token: "pit-aaa" }] });
  assert.equal(reg.getBinding("loc_a"), "unverified");

  const forbidden = (async () =>
    ({ ok: false, status: 403 })) as unknown as typeof fetch;
  assert.equal(await reg.verify("loc_a", "https://x", forbidden), "mismatched");

  const reg2 = new AccountsRegistry({ accounts: [{ id: "loc_a", name: "A", token: "pit-aaa" }] });
  const allowed = (async () => ({ ok: true, status: 200 })) as unknown as typeof fetch;
  assert.equal(await reg2.verify("loc_a", "https://x", allowed), "verified");
  assert.equal(reg2.getBinding("loc_a"), "verified", "result is cached, not re-fetched");
});

test("a network failure leaves the binding unverified rather than asserting it is fine", async () => {
  const reg = new AccountsRegistry({ accounts: [{ id: "loc_a", name: "A", token: "pit-aaa" }] });
  const boom = (async () => { throw new Error("offline"); }) as unknown as typeof fetch;
  assert.equal(await reg.verify("loc_a", "https://x", boom), "unverified");
});

// PER-PROJECT SCOPE. A global accounts file removes the isolation that per-project token
// files gave: an agent in client A's folder could otherwise reach client B. The allowlist
// restores it without going back to one registration per client.
test("an allowlist scopes one shared accounts file down to a single project", () => {
  const file = {
    accounts: [
      { id: "loc_a", name: "Client A", token: "pit-aaa" },
      { id: "loc_b", name: "Client B", token: "pit-bbb" },
      { id: "loc_c", name: "Client C", token: "pit-ccc" },
    ],
    default: "loc_c",
  };
  const scoped = new AccountsRegistry(file, ["loc_a"]);
  assert.equal(scoped.size, 1);
  assert.equal(scoped.list()[0].id, "loc_a");
  // the others are simply not reachable from this project
  assert.throws(() => scoped.resolve("loc_b"), /No token configured for location/);
  // a single remaining account still resolves without an explicit id
  assert.equal(scoped.resolve().id, "loc_a");

  // unscoped, the same file exposes everything
  assert.equal(new AccountsRegistry(file).size, 3);
});

test("a typo in the allowlist fails loudly instead of silently narrowing access", () => {
  const file = { accounts: [{ id: "loc_a", name: "A", token: "pit-aaa" }] };
  assert.throws(() => new AccountsRegistry(file, ["loc_typo"]), /not present in the accounts file/);
});
