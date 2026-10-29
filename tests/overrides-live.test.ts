// W3 (2026-10-29): proven rules survive a live-docs rebuild as patches; every tip and override key resolves; renamed
// path params still accept their old name; deprecation and notes reach the agent.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { applyCatalogOverrides } from "../src/catalog-overrides.js";
import { ACTION_TIPS } from "../src/action-tips.js";
import { previewActionRequest } from "../src/executor.js";
import { registerTools } from "../src/tools.js";
import { buildSearchIndex } from "../src/search.js";
import type { Catalog, CatalogAction } from "../src/types.js";

const act = (o: Partial<CatalogAction> & Pick<CatalogAction, "id" | "method" | "path">): CatalogAction => ({
  category: o.id.split("__")[0], summary: o.id, description: o.id, tags: [], scopes: [], parameters: [], requestBody: null, versionHeader: "v3", ...o,
});
const cat = (actions: CatalogAction[]): Catalog => ({ generatedAt: "", baseUrl: "https://services.leadconnectorhq.com", totalActions: actions.length,
  categories: [...new Set(actions.map((a) => a.category))], actions });

// What GHL's live docs say about pipelines: stages are strings, locationId sits in the update body.
const upstreamCreate = act({ id: "opportunities-v3__create-pipeline", method: "POST", path: "/opportunities/pipelines",
  requestBody: { required: true, contentType: "application/json", schema: { type: "object", required: ["name", "stages", "locationId"],
    properties: { name: { type: "string" }, locationId: { type: "string" }, stages: { type: "array", items: { type: "string" } } } } } });
const upstreamUpdate = act({ id: "opportunities-v3__update-pipeline", method: "PUT", path: "/opportunities/pipelines/{pipelineId}",
  parameters: [{ name: "pipelineId", in: "path", required: true, description: "", type: "string" }],
  requestBody: { required: true, contentType: "application/json", schema: { type: "object", required: ["name", "locationId"],
    properties: { name: { type: "string" }, locationId: { type: "string" }, stages: { type: "array", items: { type: "string" } } } } } });

test("with upstream stages as strings, create-pipeline still requires stage name and position and carries the probability rule", () => {
  const out = applyCatalogOverrides(cat([upstreamCreate])).actions;
  const create = out.filter((a) => a.method === "POST" && a.path === "/opportunities/pipelines");
  assert.equal(create.length, 1, "the hand-authored copy is not appended beside the upstream one");
  const stages = (create[0].requestBody!.schema.properties as any).stages;
  assert.deepEqual(stages.items.required, ["name", "position"]);
  assert.match(stages.items.properties.stageWinProbability.description, /even ramp/);
  assert.match(create[0].notes!.join(" "), /position/);
});

test("update-pipeline takes locationId in the query, not the body", () => {
  const u = applyCatalogOverrides(cat([upstreamUpdate])).actions.find((a) => a.path === "/opportunities/pipelines/{pipelineId}")!;
  assert.ok(u.parameters.some((p) => p.name === "locationId" && p.in === "query"));
  const body = u.requestBody!.schema as any;
  assert.ok(!("locationId" in body.properties)); assert.ok(!body.required.includes("locationId"));
  const req = previewActionRequest(u, { pipelineId: "p1", locationId: "L1", name: "n", stages: [] });
  assert.match(req.url, /locationId=L1/); assert.ok(!JSON.stringify(req.body ?? {}).includes("L1"));
});

test("the hand-authored pipeline ops are still appended when upstream lacks them", () => {
  const out = applyCatalogOverrides(cat([])).actions;
  assert.ok(out.some((a) => a.id === "opportunities-v3__create-pipeline"));
});

test("every ACTION_TIPS key and every id-keyed override resolves in the shipped catalogue", () => {
  const shipped = applyCatalogOverrides(JSON.parse(readFileSync(new URL("../data/catalog.json", import.meta.url), "utf8")));
  const ids = new Set(shipped.actions.map((a) => a.id));
  for (const k of Object.keys(ACTION_TIPS)) assert.ok(ids.has(k), `tip ${k}`);
  for (const k of ["locations__create-custom-field", "locations-v3__create-custom-field", "locations__update-custom-field", "locations-v3__update-custom-field"])
    assert.ok(ids.has(k), `override ${k}`);
});

test("a call using an old placeholder name reaches the new path, and the old name is not sent in the body", () => {
  const a = act({ id: "ad-manager-v3__x", method: "POST", path: "/ad-publishing/facebook/audiences/{customAudienceId}/members", paramAliases: { audienceId: "customAudienceId" },
    parameters: [{ name: "customAudienceId", in: "path", required: true, description: "", type: "string" }] });
  const req = previewActionRequest(a, { audienceId: "aud1", email: "x" });
  assert.match(req.url, /\/audiences\/aud1\/members/);
  assert.ok(!JSON.stringify(req.body ?? {}).includes("aud1"));
});

test("search marks a deprecated op and prefers its non-deprecated twin; describe returns deprecated and notes", async () => {
  const dep = act({ id: "emails__create-template", category: "emails", method: "POST", path: "/emails/builder", versionHeader: "v3", deprecated: { replacement: null }, summary: "Create a new template" });
  const ok = act({ id: "emails-v3__create-template", category: "emails-v3", method: "POST", path: "/emails/builder", versionHeader: "2021-07-28", summary: "Create a new template" });
  const wf = act({ id: "workflows-v3__update-workflow", category: "workflows-v3", method: "PUT", path: "/workflows/{workflowId}", notes: ["private beta: allow-listed"] });
  const actions = [dep, ok, wf];
  const tools = new Map<string, any>();
  registerTools({ registerTool: (n: string, _m: unknown, h: any) => tools.set(n, h) } as never, {
    catalog: cat(actions), searchIndex: buildSearchIndex(actions, {}), actionById: new Map(actions.map((a) => [a.id, a])),
    categorySummary: "", getToken: () => "pit-test", rateLimiter: { check: () => true } as never, actionTips: {},
  });
  const s = await tools.get("search_actions")({ intent: "create email template", offset: 0, limit: 10, compact: true });
  const hits = s.structuredContent.results as any[];
  const row = hits.find((h) => h.path === "/emails/builder");
  assert.equal(row.id, "emails-v3__create-template", "the non-deprecated twin represents the pair, even against a real-v3 deprecated one");
  const d = await tools.get("describe_action")({ action_id: "emails__create-template" });
  const body = JSON.parse(d.content[0].text);
  assert.deepEqual(body.deprecated, { replacement: null });
  const w = JSON.parse((await tools.get("describe_action")({ action_id: "workflows-v3__update-workflow" })).content[0].text);
  assert.deepEqual(w.notes, ["private beta: allow-listed"]);
  const depOnly = await tools.get("search_actions")({ intent: "", category: "emails", include_all: true, offset: 0, limit: 10, compact: true });
  assert.equal((depOnly.structuredContent.results as any[]).find((h) => h.id === "emails__create-template")?.deprecated, true);
});
