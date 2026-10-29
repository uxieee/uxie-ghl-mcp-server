import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { parseOpsList, parseOpSpec, deprecatedOps, cachedFetch, opKey } from "../scripts/live-docs.js";

const fx = (f: string) => readFileSync(fileURLToPath(new URL(`./fixtures/live-docs/${f}`, import.meta.url)), "utf8");

test("parseOpsList reads method, path, slug and service and skips index lines", () => {
  const ops = parseOpsList(fx("llms-v3.txt"));
  assert.ok(ops.length >= 40);
  const first = ops[0];
  assert.equal(first.service, "ad-publishing");
  assert.match(first.url, /^https:\/\/marketplace\.gohighlevel\.com\/docs\/ghl\/ad-publishing\/[a-z0-9-]+\.md$/);
  assert.equal(first.slug, first.url.split("/").at(-1)!.replace(/\.md$/, ""));
  assert.ok(ops.every((o) => /^(GET|POST|PUT|PATCH|DELETE)$/.test(o.method) && o.path.startsWith("/")));
  assert.ok(!ops.some((o) => /all \d+ endpoints/.test(o.slug)), "the per-service index line is not an op");
  const dated = parseOpsList(fx("llms-2021-07-28.txt"));
  assert.match(dated[0].url, /\/docs\/2021-07-28\/ghl\//);
});

test("parseOpSpec returns a self-contained OpenAPI doc for each fixture page", () => {
  for (const f of ["v3-contacts-update-contact.md", "v3-opportunities-create-pipeline.md", "v3-workflows-update-workflow-definition.md",
    "v3-ad-publishing-fb-get-reporting-list.md", "dated-calendars-create-appointment.md"]) {
    const doc = parseOpSpec(fx(f), f);
    assert.match(doc.openapi, /^3\./, f);
    assert.equal(Object.keys(doc.paths).length, 1, f);
    const refs = JSON.stringify(doc).match(/"\$ref":"([^"]+)"/g) ?? [];
    assert.ok(refs.every((r) => r.includes("#/components/")), `${f}: only internal refs`);
  }
});

test("parseOpSpec throws shape changed on a page with no OpenAPI section", () => {
  assert.throws(() => parseOpSpec("# Title\n\nNo spec here.\n", "x.md"), /shape changed: x\.md/);
  assert.throws(() => parseOpSpec("## OpenAPI Specification\n\n```json\n{\"openapi\":\"3.0.0\"}\n```\n", "y.md"), /shape changed: y\.md/);
});

test("deprecatedOps finds POST /emails/builder (no replacement) and a v3 ad op with its v4 replacement", () => {
  const dated = deprecatedOps(fx("llms-full-2021-07-28.txt"));
  assert.ok(dated.has(opKey("POST", "/emails/builder")));
  assert.equal(dated.get(opKey("POST", "/emails/builder")), null);
  const v3 = deprecatedOps(fx("llms-full-v3.txt"));
  assert.equal(v3.get(opKey("DELETE", "/ad-publishing/facebook/page")), "DELETE /ad-publishing/facebook/pages/{pageId}");
});

test("cachedFetch serves a cached URL without calling fetch, and offline mode fails on a miss", async () => {
  const dir = mkdtempSync(join(tmpdir(), "live-docs-"));
  let calls = 0;
  const fetchImpl = async () => { calls++; return new Response("hello", { status: 200 }); };
  const online = cachedFetch({ dir, fetchImpl });
  assert.equal(await online("https://example.test/a.md"), "hello");
  assert.equal(await online("https://example.test/a.md"), "hello");
  assert.equal(calls, 2, "fresh by default: an online fetch always asks the network, and refreshes the cache");
  const offline = cachedFetch({ dir, fetchImpl, offline: true });
  assert.equal(await offline("https://example.test/a.md"), "hello");
  assert.equal(calls, 2);
  await assert.rejects(offline("https://example.test/missing.md"), /offline: not in the cache/);
});

test("cachedFetch retries a 5xx once and throws on a second failure", async () => {
  const dir = mkdtempSync(join(tmpdir(), "live-docs-"));
  let calls = 0;
  const flaky = cachedFetch({ dir, retryDelayMs: 1, fetchImpl: async () => (++calls === 1 ? new Response("x", { status: 502 }) : new Response("ok")) });
  assert.equal(await flaky("https://example.test/b.md"), "ok");
  const down = cachedFetch({ dir, retryDelayMs: 1, fetchImpl: async () => new Response("x", { status: 503 }) });
  await assert.rejects(down("https://example.test/c.md"), /503 from example\.test/);
});

test("opKey treats :id, {id} and escaped \\{id\\} the same and drops the trailing slash", () => {
  assert.equal(opKey("get", "/courses/:id/"), opKey("GET", "/courses/{courseId}"));
  assert.equal(opKey("DELETE", "/workflows/\\{workflowId\\}"), "DELETE /workflows/{}");
});
