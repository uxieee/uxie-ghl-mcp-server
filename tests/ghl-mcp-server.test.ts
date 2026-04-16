import test from "node:test";
import assert from "node:assert/strict";
import { buildSearchIndex } from "../src/search.js";
import { registerTools } from "../src/tools.js";
import { executeAction } from "../src/executor.js";
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
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async (_url, init) => {
    capturedBody = String(init?.body ?? "");
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
    intent: "pipelines",
    category: "opportunities",
    include_all: true,
    offset: 0,
    limit: 50,
    compact: true,
  })) as { content: Array<{ text: string }> };

  const output = result.content[0]?.text ?? "";
  assert.match(output, /opportunities__get-pipelines/);
  assert.match(output, /opportunities__create-opportunity/);
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
