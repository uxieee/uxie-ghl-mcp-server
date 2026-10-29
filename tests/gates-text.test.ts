// W3 (2026-10-29): text an agent reads must state current truth, counts are computed not typed, and the writes the
// live-docs rebuild added are gated where they touch money, run something live, change permissions or act in public.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { applyCatalogOverrides } from "../src/catalog-overrides.js";
import { inferActionRisk } from "../src/risk.js";
import { serverInstructions } from "../src/instructions.js";
import { gateDiff } from "../scripts/gate-diff.js";
import type { Catalog, CatalogAction } from "../src/types.js";

const read = (f: string) => readFileSync(new URL(`../${f}`, import.meta.url), "utf8");
const shipped = (): Catalog => applyCatalogOverrides(JSON.parse(read("data/catalog.json")));

test("no instruction, tip, tool text or README line says workflows are UI-only or states a fixed operation count", () => {
  const files = ["src/instructions.ts", "src/action-tips.ts", "src/tools.ts", "src/twins.ts", "README.md", "package.json", "docs/api-v3/05-v3-adoption.md"];
  for (const f of files) {
    const t = read(f);
    assert.doesNotMatch(t, /workflow[^.\n]*UI-only|UI-only[^.\n]*workflow|Workflow builder configuration is still UI-only/i, `${f}: workflows UI-only`);
    assert.doesNotMatch(t, /\b671\b/, `${f}: a typed operation count`);
    assert.doesNotMatch(t, /\b124 (actions|lack)/, `${f}: a typed header count`);
    assert.doesNotMatch(t, /per edge isolate/, `${f}: the retired Worker's limit`);
    assert.doesNotMatch(t, /Conversation AI bot configuration is not exposed/, `${f}: CAI config claim`);
  }
});

test("the instructions count operations and missing v3 headers from the catalogue they ship with", () => {
  const c = shipped();
  const ops = new Set(c.actions.map((a) => `${a.method} ${a.path.replace(/\{[^}]*\}/g, "{}")}`)).size;
  const text = serverInstructions(c);
  assert.match(text, new RegExp(`\\b${ops} distinct operations\\b`));
  const lacking = c.actions.filter((a) => a.category.endsWith("-v3") && a.versionHeader !== "v3").length;
  if (lacking) assert.match(text, new RegExp(`\\b${lacking} lack it\\b`));
  else assert.doesNotMatch(text, /lack it/, "no '0 lack it' claim (W3 review)");
  assert.match(text, /private beta/);
});

test("on the rebuilt catalogue, the new writes that touch money, run something live, change permissions or act in public need confirmation", () => {
  const c = shipped();
  const must: [string, RegExp][] = [
    ["PUT", /^\/workflows\/\{workflowId\}\/status$/],
    ["POST", /^\/agent-studio\/managed-agents\/\{managedAgentId\}\/execute$/],
    ["POST", /^\/affiliate-manager\/\{locationId\}\/commission$/],
    ["POST", /^\/affiliate-manager\/\{locationId\}\/affiliate\/\{affiliateId\}\/payout-method$/],
    ["PUT", /^\/affiliate-manager\/\{locationId\}\/commission\/\{commissionId\}\/status$/],
    ["POST", /^\/ai-builder-api\/projects\/\{projectId\}\/changes\/apply$/],
    ["POST", /^\/ai-builder-api\/projects\/\{projectId\}\/app-config\/apk-builds$/],
    ["PUT", /^\/locations\/\{locationId\}\/permissions$/],
    ["POST", /^\/social-media-posting\/comments\/\{platform\}\/\{id\}\/like$/],
  ];
  for (const [m, p] of must) {
    const hits = c.actions.filter((a) => a.method === m && p.test(a.path));
    assert.ok(hits.length, `${m} ${p} is in the catalogue`);
    for (const a of hits) assert.equal(inferActionRisk(a, c.actions).requiresConfirmation, true, a.id);
  }
  // and the plan-only call stays a free preview
  const plan = c.actions.find((a) => a.method === "POST" && a.path === "/ai-builder-api/projects/{projectId}/changes/plan")!;
  assert.equal(inferActionRisk(plan, c.actions).requiresConfirmation, false);
});

test("gate-diff lists weakened matched ids and new ungated writes", () => {
  const act = (id: string, method: string, path: string, description: string): CatalogAction => ({ id, category: id.split("__")[0], method, path,
    summary: id, description, tags: [], scopes: [], parameters: [], requestBody: null, versionHeader: "v3" });
  const cat = (a: CatalogAction[]): Catalog => ({ generatedAt: "", baseUrl: "", totalActions: a.length, categories: [], actions: a });
  const d = gateDiff(cat([act("x-v3__notify", "POST", "/x", "send an SMS")]),
    cat([act("x-v3__notify", "POST", "/x", "update a record"), act("x-v3__new", "PUT", "/y", "update a thing")]));
  assert.deepEqual(d.weakened.map((w) => w.id), ["x-v3__notify"]);
  assert.deepEqual(d.newWrites.map((w) => w.id), ["x-v3__new"]);
});

test("plural payouts/commissions and production promotion are gated on the shipped catalogue", () => {
  const c = shipped();
  for (const [m, p] of [["PUT", /\/suspension$/], ["POST", /\/agent\/versions\/\{[^}]+\}\/publish$/]] as const) {
    const hits = c.actions.filter((a) => a.method === m && p.test(a.path));
    assert.ok(hits.length, String(p));
    for (const a of hits) assert.equal(inferActionRisk(a, c.actions).requiresConfirmation, true, a.id);
  }
});

test("the instructions drop the missing-v3-header clause when nothing lacks it", () => {
  const act = { id: "x-v3__a", category: "x-v3", method: "GET", path: "/a", summary: "", description: "", tags: [], scopes: [], parameters: [], requestBody: null, versionHeader: "v3" };
  const text = serverInstructions({ generatedAt: "", baseUrl: "", totalActions: 1, categories: [], actions: [act] });
  assert.doesNotMatch(text, /lack it/);
});
