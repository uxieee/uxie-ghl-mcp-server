# 03 — Catalog Refresh & Code Changes

## Catalog refresh

- **Before:** `data/catalog.json` generated 2026-05-09 — 576 actions, 41 categories.
- **Action:** backed up, ran `npm run build-catalog` against upstream `main`, diffed.
- **Result:** **byte-identical** content — 0 added, 0 removed, 0 changed actions. Same version-header split: `2021-07-28` ×408, `2021-04-15` ×139, none ×29. Host unchanged.
- **Meaning:** the catalog was already current with the latest *published* specs (still v2). The only field that changed on regeneration is `generatedAt` (now 2026-06-14), which records that the catalog was re-synced with the hardened build pipeline.

This is the concrete answer to "update everything that needs updating": **nothing in the catalog needed updating**, and that was verified rather than assumed.

## Code changes (the "harden" / v3-readiness work)

All changes are **behavior-preserving against today's v2 specs**. Their purpose is to (a) fix latent gaps that v3 will trip, and (b) make v3 adoption a single rebuild.

### 1. Case-insensitive, default-aware `Version` header detection — `scripts/build-catalog.ts`
v3 declares a **lowercase `version`** header on some endpoints (e.g. phone-system) and sometimes pins the value via `schema.default` instead of an `enum`. The old detector matched only `name === "Version"` with `enum[0]`, so it would have **silently dropped a required v3 version header**, causing those calls to fail.

```ts
// before
const versionParam = parameters.find((p) => p.name === "Version" && p.in === "header");
const versionHeader = versionParam?.enum?.[0] || null;

// after
const versionParam = (details.parameters || []).find(
  (p: any) => p.in === "header" && String(p.name).toLowerCase() === "version"
);
const versionHeader: string | null =
  versionParam?.schema?.enum?.[0] ?? versionParam?.schema?.default ?? null;
```
The param-list filter that strips the version header was likewise made case-insensitive (`p.name.toLowerCase() !== "version"`). On current v2 specs (all 547 are capital `Version` with enums) this changes nothing — confirmed by the byte-identical rebuild.

### 2. Configurable repo/ref — `scripts/build-catalog.ts`
```ts
const REPO   = process.env.GHL_DOCS_REPO || "GoHighLevel/highlevel-api-docs";
const BRANCH = process.env.GHL_DOCS_REF  || "main";
```
Lets you preview v3 from a branch the moment GHL stages it (`GHL_DOCS_REF=latest_specs_sync npm run build-catalog`) without editing source.

### 3. Rate-limit-proof spec fetching — `scripts/build-catalog.ts`
`fetchFileContent` now pulls each spec from the **raw CDN** (`raw.githubusercontent.com`) instead of the GitHub **contents API**. The contents API is capped at 60 req/hour unauthenticated; a full build fetches 40+ specs and risked a mid-build failure. The raw CDN has no such limit. (Listing still uses one contents-API call.)

### 4. Configurable host + single source of truth — `build-catalog.ts`, `executor.ts`, `tools.ts`
- The catalog's `baseUrl` is now `process.env.GHL_BASE_URL || "https://services.leadconnectorhq.com"`.
- `executor.ts` previously **hardcoded** `GHL_BASE_URL` and ignored the `baseUrl` already present in `catalog.json`. `executeAction` / `previewActionRequest` now accept an optional `baseUrl` (defaulting to the constant), and `tools.ts` passes `catalog.baseUrl`. The host is now controlled in one place. No behavior change (default is identical).

### 5. Tests — `tests/ghl-mcp-server.test.ts`
Added two tests (13 → 15, all passing):
- `build-catalog detects a case-insensitive Version header and keeps it out of params` — feeds a lowercase `version` header with a `schema.default` and asserts it becomes `versionHeader` and is excluded from the normal params.
- `executeAction targets the catalog baseUrl override` — asserts the request URL honors a passed `baseUrl`.

## Deliberately NOT changed (and why)

- **No v3 conventions in `action-tips.ts` or runtime guidance.** The live catalog is v2; telling the LLM to send `clientId`/`assignedTo` *today* would break real calls. v3 guidance belongs in the build pipeline (auto-adopted when specs flip) and in this documentation — not in runtime hints that drive live requests.
- **No speculative "AIP envelope" response unwrapper.** The changelog shows schema changes, not a new universal envelope. The existing response-shaping (`result_filter`/`result_fields`/pagination) already handles nested arrays generically. Building an unwrapper against an unconfirmed shape would be over-engineering. It's listed as a watch item in the playbook instead.
- **No change to the `pit-` token check in `index.ts`.** This server is intentionally a Private-Integration-Token proxy. v3's OAuth changes affect the `/oauth/token` *exchange* (which a PIT user doesn't perform). Flagged in the playbook in case OAuth JWT access tokens are ever needed.

## Verification

| Check | Result |
|---|---|
| `npm run typecheck` (`tsc --noEmit`) | clean |
| `npm test` | **15/15 pass** |
| `npm run build-catalog` (hardened, raw CDN) | 576 actions / 41 categories; byte-equivalent to pre-change |
