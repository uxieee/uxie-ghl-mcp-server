import test from "node:test";
import assert from "node:assert/strict";
import worker from "../src/retired.js";
import { REPO_URL, RETIRED_NOTICE } from "../src/retired-notice.js";

const BASE = "https://ghl-mcp-server.xanderjohnrazonroque.workers.dev";

function post(body: unknown): Promise<Response> {
  return Promise.resolve(
    worker.fetch(
      new Request(`${BASE}/mcp`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-ghl-token": "pit-fake-token" },
        body: JSON.stringify(body),
      })
    )
  );
}

test("retired: initialize echoes the client's protocol version and carries the notice", async () => {
  const res = await post({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "t", version: "0" } },
  });
  const body = (await res.json()) as any;
  assert.equal(res.status, 200);
  assert.equal(body.result.protocolVersion, "2025-03-26");
  assert.equal(body.result.instructions, RETIRED_NOTICE);
});

test("retired: every old tool is still listed, and calling one returns the notice as an error", async () => {
  const list = (await (await post({ jsonrpc: "2.0", id: 2, method: "tools/list" })).json()) as any;
  assert.deepEqual(
    list.result.tools.map((t: { name: string }) => t.name).sort(),
    ["describe_action", "execute_action", "list_categories", "list_locations", "search_actions"]
  );

  const call = (await (
    await post({
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: { name: "execute_action", arguments: { action_id: "contacts__get-contact", params: {} } },
    })
  ).json()) as any;
  assert.equal(call.result.isError, true);
  assert.equal(call.result.content[0].text, RETIRED_NOTICE);
  assert.ok(RETIRED_NOTICE.includes(REPO_URL));
});

test("retired: a notification gets 202 and no body", async () => {
  const res = await post({ jsonrpc: "2.0", method: "notifications/initialized" });
  assert.equal(res.status, 202);
  assert.equal(await res.text(), "");
});

test("retired: GET on /mcp is 405, and every other path 301s to the repository", async () => {
  const get = await worker.fetch(new Request(`${BASE}/mcp`));
  assert.equal(get.status, 405);

  for (const path of ["/", "/health", "/anything"]) {
    const res = await worker.fetch(new Request(`${BASE}${path}`));
    assert.equal(res.status, 301, path);
    assert.equal(res.headers.get("location"), REPO_URL, path);
  }
});
