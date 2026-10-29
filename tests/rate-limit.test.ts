// W3 (2026-10-29): GHL's documented rate limits — 100 / 10 s and 200,000 / day per app per sub-account, reported in
// X-RateLimit-* headers. A call waits at most once, and a 429 is retried only when GHL's gateway sent it or the body
// says retryable:true — never a confirmed write GHL called terminal.
import test from "node:test";
import assert from "node:assert/strict";
import { executeAction } from "../src/executor.js";
import { RateBudget } from "../src/rate-budget.js";
import type { CatalogAction } from "../src/types.js";

const action: CatalogAction = { id: "contacts-v3__get-contact", category: "contacts-v3", method: "GET", path: "/contacts/{contactId}",
  summary: "", description: "", tags: [], scopes: [], parameters: [{ name: "contactId", in: "path", required: true, description: "", type: "string" }],
  requestBody: null, versionHeader: "v3" };
const rl = (remaining: number, extra: Record<string, string> = {}) => ({
  "content-type": "application/json", "X-RateLimit-Max": "100", "X-RateLimit-Remaining": String(remaining),
  "X-RateLimit-Interval-Milliseconds": "10000", "X-RateLimit-Limit-Daily": "200000", "X-RateLimit-Daily-Remaining": "150000", ...extra,
});
function harness(responses: Array<{ status: number; headers?: Record<string, string>; body?: unknown }>) {
  let t = 1_000_000; const sleeps: number[] = []; let calls = 0;
  const budget = new RateBudget({ now: () => t });
  const fetchImpl = (async () => {
    const r = responses[Math.min(calls, responses.length - 1)]; calls++;
    return new Response(JSON.stringify(r.body ?? { ok: true }), { status: r.status, headers: r.headers ?? { "content-type": "application/json" } });
  }) as typeof fetch;
  const sleep = async (ms: number) => { sleeps.push(ms); t += ms; };
  const run = (key = "loc-a") => executeAction(action, { contactId: "c1" }, "pit-x", undefined, { budget, key, fetchImpl, sleep });
  return { run, sleeps, budget, calls: () => calls, advance: (ms: number) => { t += ms; } };
}

test("headers update the budget; rateLimit appears in the result only when it runs low", async () => {
  const h = harness([{ status: 200, headers: rl(95) }, { status: 200, headers: rl(5) }]);
  assert.equal((await h.run()).rateLimit, undefined);
  const low = await h.run();
  assert.equal(low.rateLimit?.remaining, 5); assert.equal(low.rateLimit?.max, 100);
});

test("a spent daily quota refuses the next call at once, with the reset, and sends nothing", async () => {
  const h = harness([{ status: 200, headers: rl(50, { "X-RateLimit-Daily-Remaining": "0", "X-RateLimit-Daily-Reset": "3600000" }) }]);
  await h.run();
  const r = await h.run();
  assert.equal(r.status, 429); assert.match(String(r.data), /daily quota.*resets in about 60 min/i);
  assert.equal(h.calls(), 1); assert.deepEqual(h.sleeps, []);
});

test("a gateway 429 waits once and retries once", async () => {
  const h = harness([{ status: 429, headers: rl(0), body: { message: "Too many requests" } }, { status: 200, headers: rl(99) }]);
  const r = await h.run();
  assert.equal(r.status, 200); assert.equal(h.calls(), 2);
  assert.equal(h.sleeps.length, 1); assert.ok(h.sleeps[0] > 0 && h.sleeps[0] <= 10000);
});

test("a 429 with retryable:false is returned, not retried", async () => {
  const h = harness([{ status: 429, headers: { "content-type": "application/json", "Retry-After": "5" }, body: { message: "agent busy", retryable: false } }]);
  const r = await h.run();
  assert.equal(r.status, 429); assert.equal(h.calls(), 1); assert.deepEqual(h.sleeps, []);
  assert.match(String(r.data), /agent busy/);
});

test("a 429 with Retry-After and retryable:true waits Retry-After and retries once", async () => {
  const h = harness([{ status: 429, headers: { "content-type": "application/json", "Retry-After": "3" }, body: { retryable: true } }, { status: 200 }]);
  assert.equal((await h.run()).status, 200); assert.deepEqual(h.sleeps, [3000]);
});

test("a bare 429 (no rate headers, no retryable flag) is not retried", async () => {
  const h = harness([{ status: 429, body: { message: "slow down" } }]);
  assert.equal((await h.run()).status, 429); assert.equal(h.calls(), 1);
});

test("a pre-wait and a 429 in one call never wait twice", async () => {
  const h = harness([{ status: 200, headers: rl(0) }, { status: 429, headers: rl(0) }, { status: 200, headers: rl(99) }]);
  await h.run();                      // learns: 0 remaining in this window
  const r = await h.run();            // waits for the window, then gets a 429: returned, no second wait
  assert.equal(r.status, 429); assert.equal(h.sleeps.length, 1);
});

test("two accounts do not share a budget", async () => {
  const h = harness([{ status: 200, headers: rl(0) }, { status: 200, headers: rl(99) }]);
  await h.run("loc-a");
  await h.run("loc-b");
  assert.deepEqual(h.sleeps, [], "loc-b is not held back by loc-a's empty window");
});

test("the client-side ceiling holds a key to 100 calls per 10 s", async () => {
  const h = harness([{ status: 200 }]);
  for (let i = 0; i < 100; i++) await h.run();
  assert.deepEqual(h.sleeps, []);
  await h.run();
  assert.equal(h.sleeps.length, 1); assert.ok(h.sleeps[0] <= 10000);
});

// ---- W3 final review fixes --------------------------------------------------------------------
test("a 429 on a write while the window still has room is NOT retried (not a gateway throttle; the write may have landed)", async () => {
  let t = 1_000_000; const sleeps: number[] = []; let calls = 0;
  const budget = new RateBudget({ now: () => t });
  const fetchImpl = (async () => { calls++; return new Response(JSON.stringify({ message: "busy" }), { status: 429, headers: rl(80) }); }) as typeof fetch;
  const post: CatalogAction = { ...action, id: "conversations__send-a-new-message", method: "POST", path: "/conversations/messages", parameters: [] };
  const r = await executeAction(post, { type: "SMS", message: "hi" }, "pit-x", undefined, { budget, key: "a", fetchImpl, sleep: async (ms) => { sleeps.push(ms); t += ms; } });
  assert.equal(r.status, 429); assert.equal(calls, 1); assert.deepEqual(sleeps, []);
});

test("a spent daily quota with no reset header refuses for 5 minutes, then lets one call through to read fresh limits", () => {
  let t = 1_000_000; const b = new RateBudget({ now: () => t });
  b.observe("a", new Headers({ "X-RateLimit-Daily-Remaining": "0" }));
  assert.equal(b.before("a").action, "refuse");
  t += 4 * 60_000; assert.equal(b.before("a").action, "refuse");
  t += 2 * 60_000; assert.equal(b.before("a").action, "go");
});
