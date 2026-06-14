# 04 — v3 Migration Playbook

A runbook for adopting API v3 the day HighLevel publishes it to the public OpenAPI specs. Thanks to the hardening in [`03`](./03-catalog-refresh-and-code-changes.md), the happy path is a single rebuild.

## Step 1 — Detect that v3 has shipped publicly

v3 is "shipped for this server" only when it lands in `GoHighLevel/highlevel-api-docs/apps/*.json`. Two signals:

1. **Changelog** — watch `https://marketplace.gohighlevel.com/docs/Changelog/` (it's a JS SPA; render it or read the DOM, don't trust search snippets).
2. **The specs themselves** — the authoritative, scriptable check. Run this and look for the v3 markers flipping:

```bash
# Are the public specs still v2? (verified true on 2026-06-14)
python3 - <<'PY'
import urllib.request, json
def spec(n):
    u=f"https://raw.githubusercontent.com/GoHighLevel/highlevel-api-docs/main/apps/{n}.json"
    return json.load(urllib.request.urlopen(u, timeout=30))
o=spec("opportunities")
q=[p["name"] for p in o["paths"]["/opportunities/search"]["get"]["parameters"] if p.get("in")=="query"]
print("opportunities/search params:", q)
print("  -> snake_case (assigned_to/location_id) = V2 ;  camelCase (assignedTo + required locationId) = V3")
oa=spec("oauth")
print("oauth paths:", list(oa["paths"]))
print("  -> /oauth/installedLocations,/oauth/locationToken = V2 ;  /oauth/installed-locations,/oauth/location-token = V3")
PY
```

> **Detect by path existence and exact param names — never by substring.** Response objects reuse request field names and will give false positives (this exact mistake happened during the audit; see [`01`](./01-investigation-and-evidence.md)).

## Step 2 — Preview before committing

You can build a catalog from a staging branch without merging anything:

```bash
GHL_DOCS_REF=latest_specs_sync npm run build-catalog   # or whichever branch carries v3
```

Then diff against the committed catalog to see exactly what v3 changes (added/removed/changed actions, path renames, param renames, version headers). A ready-made diff approach:

```bash
cp data/catalog.json /tmp/catalog.old.json
npm run build-catalog
# compare action-by-action
python3 - <<'PY'
import json
o=json.load(open('/tmp/catalog.old.json')); n=json.load(open('data/catalog.json'))
O={a['id']:a for a in o['actions']}; N={a['id']:a for a in n['actions']}
print("added:", sorted(set(N)-set(O)))
print("removed:", sorted(set(O)-set(N)))
print("changed:", [i for i in set(O)&set(N) if json.dumps(O[i],sort_keys=True)!=json.dumps(N[i],sort_keys=True)])
PY
```

## Step 3 — Adopt

```bash
npm run build-catalog     # from main once v3 is merged (default ref)
npm run typecheck
npm test
```

Most v3 changes flow through automatically because the catalog is generated from the specs and `executor.ts` routes params and passes through unknown body keys:

- **camelCase params / kebab paths** → captured verbatim from the new specs.
- **Required `Version` header (any case)** → now detected and sent (hardening #1).
- **Removed legacy paths** → drop out of the catalog; `execute_action` on an old ID returns "Unknown action" (correct).
- **New endpoints** (e.g. `/emails/locations/{locationId}/…`) → appear automatically.

## Step 4 — Things to watch (the parts a rebuild won't fully handle)

| Watch item | Why & what to do |
|---|---|
| **`catalog-overrides.ts`** | The override adds `options`/`parentId` to `locations__{create,update}-custom-field`. After a v3 rebuild, re-check the override still matches the new schema. If v3 fixes the upstream gap, the override may be redundant. |
| **`action-tips.ts` keys** | Tips are keyed by `category__operationId`. If v3 changes an `operationId`, the tip silently stops applying. Re-verify tip keys against the new catalog and update guidance to v3 conventions (now safe to do *after* the catalog is v3). |
| **Catalog completeness floor** | `assertCatalogCompleteness` requires ≥500 actions / ≥35 categories. v3 removes several endpoints; if the count dips, the build fails closed (intended). Re-baseline `MIN_ACTIONS`/`MIN_CATEGORIES` and the test's `assertCatalogCompleteness(576, 41)` to the new totals. |
| **New auth security schemes** (`Agency-Access-Only`, `Location-Access-Only`) | These imply per-endpoint scope/role requirements. PITs must be issued with the right scopes. Surface helpful errors if GHL returns 401/403 for missing scope. |
| **OAuth `/token` camelCase + `application/json`** | Only relevant if you ever add an OAuth flow. This server is PIT-based, so the token *exchange* isn't performed here — but if OAuth JWT access tokens become a goal, the `pit-` prefix check in `src/index.ts` must be relaxed to accept JWTs. |
| **AIP response envelope** (unconfirmed) | If v3 starts wrapping list responses in a new envelope (`{ data: [...], meta: {...} }` style), the response-shaping in `tools.ts` (`filterResponseData`/`paginateResponseData`) already walks the first array property generically, but verify against a real v3 response and adjust if the array nests deeper. |
| **`2023-02-21` version header** | Seen in the docs version switcher but not yet in `apps/*.json`. If v3 specs adopt it, the version detector already picks up whatever the spec declares — no code change needed. |

## Step 5 — Verify & ship

1. `npm run typecheck && npm test` (update the completeness baseline test first if counts changed).
2. Smoke-test a few representative actions with `dry_run: true` to confirm routed URLs/params look v3-correct (no leftover snake_case, kebab paths present).
3. Live-test one read endpoint per migrated domain (e.g. `opportunities__search…`, an emails list) with a real token.
4. Deploy: `npm run deploy` (Cloudflare Workers) and/or restart the local stdio server.

## Rollback

The catalog is a build artifact tracked in git:

```bash
git checkout -- data/catalog.json     # revert to the previous (v2) catalog
```

Because `executor.ts` is data-driven, reverting the catalog fully reverts the callable surface. The code changes in [`03`](./03-catalog-refresh-and-code-changes.md) are forward-compatible with both v2 and v3, so they don't need reverting.

## Suggested monitoring cadence

Until v3 publishes, re-run the Step-1 detection check **weekly** (or subscribe to the changelog). The migration itself is low-effort once detected; the value is catching it promptly so the server doesn't drift behind GHL's deprecation removals.
