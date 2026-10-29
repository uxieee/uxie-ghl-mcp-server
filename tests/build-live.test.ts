import test from "node:test";
import assert from "node:assert/strict";
import { buildFromLive } from "../scripts/build-live.js";
import type { ListedOp, OpenAPIDoc, Tree } from "../scripts/live-docs.js";
import type { CatalogAction } from "../src/types.js";

// A one-operation OpenAPI doc, the shape every live op page embeds.
function doc(method: string, path: string, { params = [] as any[], version = "v3", body }: { params?: any[]; version?: string; body?: any } = {}): OpenAPIDoc {
  return {
    openapi: "3.0.0", info: { title: "t", version: "1" },
    paths: { [path]: { [method.toLowerCase()]: {
      operationId: "camelCaseId", summary: `${method} ${path}`, description: "d",
      parameters: [{ name: "Version", in: "header", required: true, schema: { type: "string", enum: [version] } }, ...params],
      ...(body ? { requestBody: { required: true, content: { "application/json": { schema: body } } } } : {}),
    } } },
  };
}
const op = (tree: Tree, service: string, slug: string, method: string, path: string): ListedOp => ({
  service, slug, method, path, name: slug,
  url: tree === "v3" ? `https://d/docs/ghl/${service}/${slug}.md` : `https://d/docs/2021-07-28/ghl/${service}/${slug}.md`,
});
const prev = (id: string, method: string, path: string, extra: Partial<CatalogAction> = {}): CatalogAction => ({
  id, category: id.split("__")[0], method, path, summary: "old", description: "old", tags: [], scopes: [], parameters: [],
  requestBody: null, versionHeader: id.split("__")[0].endsWith("-v3") ? "2021-07-28" : "2021-04-15", ...extra,
});

function world(over: { v3?: [ListedOp, OpenAPIDoc][]; dated?: [ListedOp, OpenAPIDoc][]; previous?: CatalogAction[]; undocumented?: any[]; acceptUndocumented?: boolean; deprecated?: any; idOverrides?: Record<string, string> } = {}) {
  const v3 = over.v3 ?? [
    [op("v3", "contacts", "update-contact", "PUT", "/contacts/{contactId}"), doc("PUT", "/contacts/{contactId}", { params: [{ name: "contactId", in: "path", required: true, schema: { type: "string" } }] })],
    [op("v3", "ad-publishing", "fb-get-pages", "GET", "/ad-publishing/facebook/pages"), doc("GET", "/ad-publishing/facebook/pages")],
    [op("v3", "ad-publishing", "fb-new-thing", "POST", "/ad-publishing/facebook/new"), doc("POST", "/ad-publishing/facebook/new")],
    [op("v3", "users", "update-user", "PUT", "/users/{userId}"), doc("PUT", "/users/{userId}")],
    [op("v3", "workflows", "update-workflow", "PUT", "/workflows/{workflowId}"), doc("PUT", "/workflows/{workflowId}", { params: [{ name: "workflowId", in: "path", required: true, schema: { type: "string" } }] })],
  ];
  const dated = over.dated ?? [
    [op("2021-07-28", "contacts", "update-contact", "PUT", "/contacts/{contactId}"), doc("PUT", "/contacts/{contactId}", { version: "2021-07-28" })],
    [op("2021-07-28", "brand-boards", "create-brand-board", "POST", "/brand-boards"), doc("POST", "/brand-boards", { version: "2021-07-28" })],
    [op("2021-07-28", "emails", "create-template", "POST", "/emails/builder"), doc("POST", "/emails/builder", { version: "2021-07-28" })],
  ];
  const previous = over.previous ?? [
    prev("contacts-v3__update-contact", "PUT", "/contacts/{contactId}"),
    prev("contacts__update-contact", "PUT", "/contacts/{contactId}", { versionHeader: "2021-04-15" }),
    prev("ad-publishing-v3__fb-get-pages", "GET", "/ad-publishing/facebook/pages"),
    prev("brand-boards-v3__createBrandBoard", "POST", "/brand-boards"),
  ];
  const tree = (rows: [ListedOp, OpenAPIDoc][]) => ({ ops: rows.map((r) => r[0]), specs: new Map(rows.map((r) => [r[0].url, r[1]])), sha256: "x" });
  return buildFromLive({
    trees: { v3: tree(v3), "2021-07-28": tree(dated) },
    deprecated: over.deprecated ?? { v3: new Map(), "2021-07-28": new Map([["POST /emails/builder", null]]) },
    previous: { generatedAt: "", baseUrl: "https://services.leadconnectorhq.com", totalActions: previous.length, categories: [], actions: previous },
    undocumented: over.undocumented ?? [], acceptUndocumented: over.acceptUndocumented ?? false,
    today: "2026-10-29", fetchedAt: "2026-10-29T00:00:00Z", floors: { v3: 1, "2021-07-28": 1 }, idOverrides: over.idOverrides,
  });
}
const get = (r: ReturnType<typeof world>, id: string) => r.catalog!.actions.find((a) => a.id === id)!;

test("a matched v3 op keeps its id and category; a matched dated op keeps its id and its previous versionHeader", () => {
  const r = world();
  assert.deepEqual(r.failures, []);
  assert.equal(get(r, "contacts-v3__update-contact").category, "contacts-v3");
  assert.equal(get(r, "contacts-v3__update-contact").versionHeader, "v3", "v3 takes the documented header");
  assert.equal(get(r, "contacts__update-contact").versionHeader, "2021-04-15", "a dated op keeps what it sent");
});

test("a new op lands in the category its matched siblings use, with a slug id", () => {
  const r = world();
  assert.ok(get(r, "ad-publishing-v3__fb-new-thing"), "ad-publishing's matched v3 sibling is in ad-publishing-v3");
  assert.ok(get(r, "users-v3__update-user"), "a service with no matched sibling: <service>-v3");
  assert.ok(get(r, "emails__create-template"));
});

test("a v3-family action found only in the dated tree is carried over, noted and listed", () => {
  const r = world();
  const a = get(r, "brand-boards-v3__createBrandBoard");
  assert.equal(a.summary, "old");
  assert.match(a.notes!.join(" "), /documented only under 2021-07-28/);
  assert.ok(r.report.carried.some((c) => c.id === "brand-boards-v3__createBrandBoard"));
});

test("a previous id in neither tree and not on the exception list fails the build; acceptUndocumented appends it", () => {
  const extra = prev("old-v3__gone", "GET", "/old/gone");
  const previous = [prev("contacts-v3__update-contact", "PUT", "/contacts/{contactId}"), extra];
  const failed = world({ previous });
  assert.equal(failed.catalog, null);
  assert.match(failed.failures.join("\n"), /old-v3__gone.*not in the live docs/);
  const listed = world({ previous, undocumented: [{ id: "old-v3__gone", opKey: "GET /old/gone", since: "2026-10-01", note: "x" }] });
  assert.deepEqual(listed.failures, []);
  assert.match(get(listed, "old-v3__gone").notes!.join(" "), /undocumented since 2026-10-01/);
  const accepted = world({ previous, acceptUndocumented: true });
  assert.deepEqual(accepted.failures, []);
  assert.deepEqual(accepted.undocumented.find((u) => u.id === "old-v3__gone")?.since, "2026-10-29");
});

test("an undeclared {userId} becomes a required path param", () => {
  const p = get(world(), "users-v3__update-user").parameters.find((x) => x.name === "userId")!;
  assert.equal(p.in, "path"); assert.equal(p.required, true);
});

test("a renamed placeholder is recorded as a param alias", () => {
  const r = world({ previous: [prev("contacts-v3__update-contact", "PUT", "/contacts/{id}"), prev("contacts__update-contact", "PUT", "/contacts/{contactId}"),
    prev("ad-publishing-v3__fb-get-pages", "GET", "/ad-publishing/facebook/pages"), prev("brand-boards-v3__createBrandBoard", "POST", "/brand-boards")] });
  assert.deepEqual(get(r, "contacts-v3__update-contact").paramAliases, { id: "contactId" });
  assert.equal(r.report.aliases.length, 1);
});

test("a DEPRECATED op gets the deprecated field; its description is unchanged", () => {
  const a = get(world(), "emails__create-template");
  assert.deepEqual(a.deprecated, { replacement: null });
  assert.equal(a.description, "d");
});

test("v3 workflows ops carry the private-beta note", () => {
  assert.match(get(world(), "workflows-v3__update-workflow").notes!.join(" "), /private beta/);
});

test("an id collision fails the build", () => {
  // A matched op keeps its old id users-v3__x; a NEW op in the same service whose slug is also x would take the same id.
  const r = world({ v3: [
    [op("v3", "users", "rename-user", "PUT", "/users/a"), doc("PUT", "/users/a")],
    [op("v3", "users", "x", "PUT", "/users/b"), doc("PUT", "/users/b")],
  ], dated: [], previous: [prev("users-v3__x", "PUT", "/users/a")] });
  assert.equal(r.catalog, null); assert.match(r.failures.join("\n"), /collision.*users-v3__x/);
});

test("a missing page or a count below the floor fails the build and returns no catalogue", () => {
  const listed = op("v3", "users", "x", "PUT", "/users/a");
  const r = buildFromLive({
    trees: { v3: { ops: [listed], specs: new Map(), sha256: "x" }, "2021-07-28": { ops: [], specs: new Map(), sha256: "x" } },
    deprecated: { v3: new Map(), "2021-07-28": new Map() },
    previous: { generatedAt: "", baseUrl: "", totalActions: 0, categories: [], actions: [] },
    undocumented: [], acceptUndocumented: false, today: "2026-10-29", fetchedAt: "x", floors: { v3: 800, "2021-07-28": 700 },
  });
  assert.equal(r.catalog, null);
  assert.match(r.failures.join("\n"), /no spec for https:\/\/d\/docs\/ghl\/users\/x\.md/);
  assert.match(r.failures.join("\n"), /v3: 1 ops, floor 800/);
});

test("a new op whose slug id is taken by a carried-over action gets the id data/id-overrides.json names", () => {
  // Real case (2026-10-29): ad-manager__fb-upsert-ad was PUT …/ads-v2 (now undocumented); the dated tree lists PUT …/ads as fb-upsert-ad.
  const previous = [prev("ad-manager__fb-upsert-ad", "PUT", "/ad-publishing/facebook/ads-v2"), prev("ad-manager__fb-get-pages", "GET", "/ad-publishing/facebook/pages")];
  const dated: [ListedOp, OpenAPIDoc][] = [
    [op("2021-07-28", "ad-publishing", "fb-get-pages", "GET", "/ad-publishing/facebook/pages"), doc("GET", "/ad-publishing/facebook/pages", { version: "2021-07-28" })],
    [op("2021-07-28", "ad-publishing", "fb-upsert-ad", "PUT", "/ad-publishing/facebook/ads"), doc("PUT", "/ad-publishing/facebook/ads", { version: "2021-07-28" })],
  ];
  const undocumented = [{ id: "ad-manager__fb-upsert-ad", opKey: "PUT /ad-publishing/facebook/ads-v2", since: "2026-10-29", note: "x" }];
  const clash = world({ dated, previous, undocumented });
  assert.match(clash.failures.join("\n"), /collision: ad-manager__fb-upsert-ad/);
  const named = world({ dated, previous, undocumented, idOverrides: { "2021-07-28 PUT /ad-publishing/facebook/ads": "ad-manager__fb-upsert-ad-2021-07-28" } });
  assert.deepEqual(named.failures, []);
  assert.ok(get(named, "ad-manager__fb-upsert-ad-2021-07-28")); assert.ok(get(named, "ad-manager__fb-upsert-ad"));
});
