# 01 — Investigation & Evidence

This documents *how* the audit reached its conclusion, the primary sources used, and — for honesty and reproducibility — a wrong turn that was caught and corrected.

## The premise to test

> "GoHighLevel recently released v3 of their API — check every corner and update everything."

The premise has two testable claims: (a) v3 exists, and (b) it is **callable** in a way this server should target. (a) turned out true; (b) turned out **not yet** for the public API.

## Methodology

- **Primary sources over snippets.** Web-search summaries and the small-model reads of HighLevel's JS documentation site repeatedly produced *plausible but wrong* specifics (see "A wrong turn" below). The trustworthy sources were the machine-readable OpenAPI specs and the rendered changelog DOM.
- **The catalog's actual build input is the ground truth.** This server builds its catalog from `GoHighLevel/highlevel-api-docs` → `apps/*.json`. Whatever those files say *is* what the server can call. So the audit checked those files directly rather than the documentation website.
- **Rendered the changelog in a real browser.** The docs site is a JS SPA; `WebFetch` returned a misleading summary. Loading it with Playwright and reading `innerText` gave the real, dated entries.

## Sources consulted

| Source | What it told us |
|---|---|
| `apps/*.json` (all 41, `main`) | 100% host `services.leadconnectorhq.com`; version headers only `2021-07-28` / `2021-04-15`; **zero `/v3` paths**. |
| Repo description, `GoHighLevel/highlevel-api-docs` | *"This repo is our public documentation for API **v2**."* |
| Repo README | Mentions "GoHighLevel API V2" only. |
| Full repo tree (133 files) | `apps/` = 41 specs; `docs/` = 70 markdown guides; **no v3 specs, no v3 branch**. |
| Branches | `main`, plus sync branches (`latest_specs_sync`, `sync_latest_schemas`, `sync_public_api_docs`, …). None named v3; none carry v3 specs for oauth/emails/contacts. |
| `@gohighlevel/api-client` (npm) | Latest `3.0.0` (modified 2026-05-01); README example still uses `Version: '2021-07-28'`. The "3.0.0" is package semver, **not** API v3. |
| Docs website version switcher | Lists `v3` (current) + legacy `2023-02-21`, `2021-07-28`, `2021-04-15`. This is a *docs presentation* label. |
| **Rendered changelog** (`/docs/Changelog/`) | Real, dated v3 changes — **2026-06-11 / 2026-06-12**. This is the authoritative description of what v3 changes (see [`02-api-v3-explained.md`](./02-api-v3-explained.md)). |

## A wrong turn (and the correction)

Transparency matters for a load-bearing conclusion, so this is recorded explicitly:

1. A first pass over the upstream specs (checking for the substring `/v3` and the date version headers) found **no v3** → initial conclusion: "no callable v3."
2. After rendering the changelog and seeing concrete 2026-06-11 v3 entries, a quick branch sweep used **sloppy substring markers** (e.g. "does `opportunities.json` contain `assignedTo`?"). It reported "v3 detected" → an over-correction to "v3 is partly live on `main`."
3. That was a **false positive**: `assignedTo`/`pipelineId` exist as *response object fields* in the v2 spec too, and for `users` the marker logic was inverted. A **rigorous path/param-level check** then settled it:

| Domain | Definitive check on `main` | Verdict |
|---|---|---|
| opportunities | `GET /opportunities/search` query params = `assigned_to, location_id, pipeline_id, contact_id` (snake_case) | **v2** |
| oauth | paths `/oauth/locationToken`, `/oauth/installedLocations` (camelCase); `/oauth/token` is form-urlencoded, no `Version` header | **v2** |
| users | `GET /users/` still present (v3 removes it) | **v2** |
| contacts | `GET /contacts/` present; `…/campaigns/removeAll` (camelCase) | **v2** |
| emails | `/emails/builder` present; no `/emails/locations/{locationId}/…` | **v2** |

**The catalog rebuild independently confirmed this:** rebuilding from `main` produced a **byte-identical** catalog (0 added / 0 removed / 0 changed actions) versus the prior 2026-05-09 build. If any v3 change had landed publicly, the rebuild would have shown it.

## Conclusion

- **v3 is documented and imminent**, but **not yet published to the public OpenAPI specs** the catalog (and the official SDK) depend on. The changelog runs ahead of the public `apps/*.json`.
- **Everything callable today is v2.** The catalog accurately reflects that.
- The correct action was **(a)** confirm/refresh the catalog (done — already current), **(b)** make v3 adoption a one-command rebuild (done — see [`03`](./03-catalog-refresh-and-code-changes.md)), and **(c)** document the exact v3 shape and a migration runbook (this folder).

> **Lesson encoded for next time:** detect API versions by **path existence and exact param names**, never by substring presence — response objects share field names with request params and produce false positives.
