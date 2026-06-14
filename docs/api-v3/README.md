# GoHighLevel API v3 — Audit, Findings & Migration Playbook

**Audit date:** 2026-06-14
**Audited by:** Claude (Opus 4.8) for the `ghl-mcp-server` project
**Scope:** "GHL released v3 — check every corner of the API and update everything that needs updating, and document the findings."

---

## TL;DR

1. **API v3 is real and actively landing**, documented in HighLevel's changelog with entries dated **2026-06-11 / 2026-06-12** (two days before this audit).
2. **v3 is NOT a `/v3` URL prefix and NOT a new host.** It is a **breaking revision of the existing endpoints** on the same host `services.leadconnectorhq.com`: `snake_case → camelCase` params, `camelCase → kebab-case` paths, a now-**required** `Version` header on more endpoints, new typed `*V3` schemas, location-scoped paths, removal of legacy `/public/v1|v2/` paths, and two new auth security schemes.
3. **Crucially, v3 has NOT yet been published to the public OpenAPI specs** in `GoHighLevel/highlevel-api-docs` — the exact source this server's catalog is built from. As of 2026-06-14 every domain on `main` is still **v2** (verified at the path/param level). The changelog is generated from HighLevel's *internal* specs, which run ahead of the public repo.
4. **Therefore the catalog refresh produced an identical catalog** — it was already current with the latest *published* (v2) specs. There was nothing to "update to v3" because the public, callable surface is still v2. Forcing a v3 rewrite now would have broken the server against an API that isn't published yet.
5. **The high-value work was making the server v3-ready** so adoption is a single `npm run build-catalog` the day GHL publishes v3 — plus this documentation set.

> **One-line status:** Everything callable today is v2 and the catalog reflects it accurately; the server is now hardened to adopt v3 mechanically when (not if) GHL ships the public specs.

---

## What was done

| Area | Outcome |
|---|---|
| **Refresh** | Rebuilt `data/catalog.json` from upstream `main`. Result: **byte-identical** (576 actions / 41 categories, version split 408×`2021-07-28` / 139×`2021-04-15` / 29×none). Catalog was already current. |
| **Harden** | 5 changes to `build-catalog.ts` / `executor.ts` / `tools.ts` that make v3 adoptable via one rebuild, plus rate-limit robustness and configurable host/ref. No behavior change against v2. |
| **Tests** | 13 → 15 passing. Added coverage for case-insensitive `Version` detection and the `baseUrl` override. |
| **Docs** | This folder. |

---

## How to read this folder

| File | What's in it |
|---|---|
| [`01-investigation-and-evidence.md`](./01-investigation-and-evidence.md) | How the conclusion was reached: every source checked, the primary-source evidence, and an honest record of a wrong turn that was corrected. |
| [`02-api-v3-explained.md`](./02-api-v3-explained.md) | What "v3" actually is (the breaking-change taxonomy), the full per-domain changelog breakdown, and the verified current publication status. |
| [`03-catalog-refresh-and-code-changes.md`](./03-catalog-refresh-and-code-changes.md) | The refresh result and every code change made (with file refs and rationale), including what was deliberately *not* changed. |
| [`04-migration-playbook.md`](./04-migration-playbook.md) | The runbook: how to detect v3 publication, how to adopt it (env vars + steps), what to watch, verification, and rollback. |

---

## Quick reference — current API facts (verified 2026-06-14)

- **Host:** `https://services.leadconnectorhq.com` (all 41 categories)
- **API version headers in use:** `2021-07-28` (default, 408 actions), `2021-04-15` (139 actions), none (29 actions)
- **No `/v3`, `/v2`, or `/v1` path segments** anywhere in the specs
- **Auth this server uses:** Private Integration Token (`pit-…`) or `Authorization: Bearer` (bring-your-own-token proxy; no OAuth flow implemented)
- **Catalog source:** `GoHighLevel/highlevel-api-docs` → `apps/*.json` (one OpenAPI spec per category) → `scripts/build-catalog.ts`
- **Official SDK** `@gohighlevel/api-client` latest = `3.0.0` — note this is the *npm package* semver, **not** "API v3"; it still calls the v2 `2021-07-28` API
- **v1 API:** end-of-support **2025-12-31** (legacy `rest.gohighlevel.com`; not used by this server)

See [`04-migration-playbook.md`](./04-migration-playbook.md) to adopt v3 when it publishes.
