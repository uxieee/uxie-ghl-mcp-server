# 05 — v3 Adoption (2026-07-11)

The [June-14 playbook](./04-migration-playbook.md) assumed v3 would land by *replacing* `apps/*.json`. GHL did something different on **2026-06-19**: it published v3 as a **parallel spec set** in `apps/v3/*-v3.json` (42 specs) and left the v2 specs untouched. Both surfaces are live on the same host (`services.leadconnectorhq.com`), selected per request via the `Version` header (`2021-07-28`/`2021-04-15` for v2, `v3` for v3).

## What was adopted

- `scripts/build-catalog.ts` now scans **both** `apps/` and `apps/v3/`. v3 specs become categories with a `-v3` suffix (that's just the spec basename, e.g. `opportunities-v3`). Result: **576 → 1207 actions, 41 → 83 categories**. Completeness floors re-based to 1100/75.
- Nothing about v2 changed: every pre-existing action ID still resolves, so existing tips, saved prompts, and muscle memory keep working.
- `search_actions` adds a note when results mix a category and its `-v3` twin, steering the model to prefer v3.
- Server instructions (Worker + stdio) document the v2/v3 split.

### v3 counts by header (from the 2026-06-19 specs)

627 v3 actions: 503 declare `Version: v3`, 94 still declare `2021-07-28` (mostly ad-publishing), 30 declare none.

## Hand-authored catalog entries (changelog ahead of specs — again)

The GHL changelog keeps running ahead of the published specs. Two additions are live per the changelog + marketplace endpoint docs but absent from `apps/v3/`, so `src/catalog-overrides.ts` carries them by hand until upstream publishes them (each override auto-retires: it is skipped once the rebuilt catalog contains the same `METHOD path`):

| Change | Live since | Catalog entry |
|---|---|---|
| `POST /opportunities/pipelines` (create) | 2026-06-26 | `opportunities-v3__create-pipeline` |
| `GET /opportunities/pipelines/{pipelineId}` | 2026-06-26 | `opportunities-v3__get-pipeline` |
| `PUT /opportunities/pipelines/{pipelineId}` | 2026-06-26 | `opportunities-v3__update-pipeline` |
| `DELETE /opportunities/pipelines/{pipelineId}` (removes ALL opportunities in the pipeline) | 2026-06-26 | `opportunities-v3__delete-pipeline` |
| `after`/`limit` params on `GET /ad-publishing/facebook/pages` | 2026-07-07 | param override on both v2 + v3 variants |

Pipeline writes were previously a documented "public-API gap" — those stale notes in `tools.ts`, `action-tips.ts`, `index.ts`, and `stdio.ts` were updated in the same pass. Workflow builder internals remain UI-only.

## v2-only endpoints (still needed, hence the dual catalog)

The v3 specs do **not** cover everything v2 has. Notable v2-only surfaces as of 2026-06-19: conversations preferences/custom-subtypes (5), emails builder + schedule (5), per-platform social oauth start/accounts routes (20 — v3 replaces them with generic `{platform}` routes), `GET /users/`, `GET /contacts/` (both deprecated upstream), and the camelCase oauth paths (`/oauth/installedLocations`, `/oauth/locationToken`) which v3 renames to kebab-case.

## Verification

- `npm run typecheck` + `npm test` (15/15) after re-basing `assertCatalogCompleteness(1207, 83)`.
- Post-deploy live smoke test through the deployed Worker: v3 read endpoints confirmed callable (see deploy notes in the session that shipped this).

## Watch items

- When upstream publishes pipeline CRUD to `apps/v3/opportunities-v3.json`, a plain rebuild supersedes the hand-authored entries automatically — but re-verify the schema matches (`stages` replacement semantics).
- The changelog remains the early-warning channel: check `https://marketplace.gohighlevel.com/docs/Changelog/` when rebuilding.
