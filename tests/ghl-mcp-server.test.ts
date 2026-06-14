import test from "node:test";
import assert from "node:assert/strict";
import { buildSearchIndex } from "../src/search.js";
import { registerTools } from "../src/tools.js";
import { executeAction } from "../src/executor.js";
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

test("executeAction validates required path, query, and body fields", async () => {
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

  await assert.rejects(
    () => executeAction(action, { locationId: "loc_123", firstName: "Ada" }, "pit-test-token"),
    /Missing required parameter\(s\): contactId \(path\)/
  );
  await assert.rejects(
    () => executeAction(action, { contactId: "con_123", firstName: "Ada" }, "pit-test-token"),
    /Missing required parameter\(s\): locationId \(query\)/
  );
  await assert.rejects(
    () => executeAction(action, { contactId: "con_123", locationId: "loc_123" }, "pit-test-token"),
    /Missing required request body field\(s\): firstName/
  );
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
  assert.doesNotThrow(() => assertCatalogCompleteness(576, 41));
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
