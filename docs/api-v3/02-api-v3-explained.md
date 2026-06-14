# 02 — What GHL API v3 Actually Is

Source of truth for this file: HighLevel's API changelog at `https://marketplace.gohighlevel.com/docs/Changelog/`, rendered and read directly (entries dated **2026-06-11** and **2026-06-12**). All paths are on the existing host `https://services.leadconnectorhq.com`.

## v3 is a breaking *convention* revision — not a new route or host

There is **no `/v3` URL prefix** and **no new base host**. The "v3" label (seen in the docs site's version switcher) collectively names a set of breaking changes being rolled out endpoint-by-endpoint:

| Change type | v2 → v3 example |
|---|---|
| **Request params → camelCase** | `client_id` → `clientId`, `grant_type` → `grantType`, `assigned_to` → `assignedTo`, `contact_id` → `contactId` |
| **Paths → kebab-case** | `/oauth/installedLocations` → `/oauth/installed-locations`; `/oauth/locationToken` → `/oauth/location-token`; `…/campaigns/removeAll` → `…/campaigns/remove-all` |
| **`Version` header now required** | `POST /oauth/token`, `DELETE /users/{userId}`, phone-system endpoints (declared as lowercase `version` on some) |
| **New typed schemas** | `DndSettingsSchemaV3`, `GetContactByIdSchemaV3`, `customFieldsInput{String,Array,Object}SchemaV3`, `EmailVerifiedV3ResponseDto` |
| **Location-scoped resource paths** | `/emails/builder` & `/emails/public/v2/…` → `/emails/locations/{locationId}/…`; `/brand-boards/public/v1/…` → `/brand-boards/locations/{locationId}/…` |
| **Legacy `/public/v1/` & `/public/v2/` removed** | (deprecated, then deleted) |
| **New auth security schemes** | `Agency-Access-Only`, `Location-Access-Only` |

## Per-domain changes (from the 2026-06-11 / 06-12 changelog)

> ⚠️ = breaking. These describe HighLevel's *internal* v3 specs. **None are in the public `apps/*.json` yet** (see "Publication status" below).

### OAuth — `POST /oauth/token`
- ⚠️ new **required** `Version` header
- ⚠️ request: `client_id`→`clientId`, `client_secret`→`clientSecret`, `grant_type`→`grantType` (all required); `redirect_uri`→`redirectUri`, `refresh_token`→`refreshToken`, `user_type`→`userType` (optional)
- request body now also accepts `application/json` (in addition to form-urlencoded)
- ⚠️ response: `access_token`→`accessToken`, `expires_in`→`expiresIn`, `refresh_token`→`refreshToken`, `token_type`→`tokenType`
- ⚠️ paths renamed **without deprecation**: `/oauth/installedLocations`→`/oauth/installed-locations`, `/oauth/locationToken`→`/oauth/location-token`

### Opportunities
- ⚠️ `POST /opportunities/` and `PUT /opportunities/{id}`: `customFields` now use `customFieldsInput*SchemaV3` (old schemas removed)
- ⚠️ `GET /opportunities/search`: new **required** `locationId`; snake_case params **deleted** (`assigned_to`, `contact_id`, `location_id`, `pipeline_id`, `pipeline_stage_id`); camelCase added (`assignedTo`, `contactId`, `pipelineId`, `pipelineStageId`)

### Contacts
- ⚠️ `GET /contacts/` **removed** with deprecation
- ⚠️ `POST /contacts/`, `POST /contacts/upsert`, `PUT /contacts/{contactId}`: `dndSettings` → `DndSettingsSchemaV3`; response → `GetContactByIdSchemaV3`
- `DELETE /contacts/{contactId}/campaigns/remove-all` added; `…/removeAll` removed with deprecation

### Emails (largest migration)
- ⚠️ removed with deprecation: all `/emails/builder…`, `/emails/schedule`, `/emails/campaigns/*`, `/emails/stats/location/…`, and the entire `/emails/public/v2/…` set
- added: `/emails/locations/{locationId}/campaigns/…` (bulk-actions, emails CRUD, schedule, stats, workflows) and `/emails/locations/{locationId}/templates/…` (CRUD, folders, import)

### Users
- ⚠️ `GET /users/` **removed** with deprecation
- ⚠️ `DELETE /users/{userId}`: new **required** `Version` header; response typo fixed (`succeded`→`succeeded`)

### Phone System
- ⚠️ `GET /phone-system/numbers/location/{locationId}` and `POST …/purchase`: new **required** `version` header (note lowercase); `GET` adds `page`/`pageSize` query params

### Brand Boards
- added: `/brand-boards/locations/{locationId}/brand-voices` (GET/POST/PATCH/DELETE + `/default`)
- removed with deprecation: `/brand-boards/public/v1/locations/{locationId}/voices…`

### Email ISV — `POST /email/verify`
- ⚠️ response → `EmailVerifiedV3ResponseDto` (+ `LeadConnectorRecommendationDto`); old `EmailVerifiedResponseDto` removed
- new security schemes `Agency-Access-Only`, `Location-Access-Only` added

### Ad Publishing (2026-06-12)
- `GET /ad-publishing/facebook/reporting/list`: `campaignId` query param became optional (non-breaking)

## Publication status — verified 2026-06-14

Every domain above is **still v2** in the public `apps/*.json` that this server builds from. The changelog is generated from HighLevel's internal specs and runs ahead of the public repo.

| Domain | Public `apps/*.json` on `main` | Definitive evidence |
|---|---|---|
| opportunities | **v2** | `GET /search` still uses `assigned_to`, `location_id`, … |
| oauth | **v2** | `/oauth/locationToken`, `/oauth/installedLocations`; token is form-urlencoded, no `Version` header |
| contacts | **v2** | `GET /contacts/` present; `…/campaigns/removeAll` |
| emails | **v2** | `/emails/builder`; no `/emails/locations/{locationId}/…` |
| users | **v2** | `GET /users/` present |
| phone-system | **v2** | header param is capital `Version`, not the v3 lowercase `version` |
| all others | **v2** | host + `2021-07-28`/`2021-04-15` headers, no kebab/camel migration |

## Related version facts

- **v1 API** (`rest.gohighlevel.com`, API-key auth): **end-of-support 2025-12-31**. Existing integrations keep working but get no updates. This server never used v1.
- **Date version headers** (`2021-07-28`, `2021-04-15`, and the newer `2023-02-21` seen only in the docs switcher) are the v2-era versioning mechanism and coexist with the "v3" convention label.
- The docs site's "AIP-compliant responses" phrasing (Google API Improvement Proposals) appears in marketing/roadmap copy; **the changelog shows schema changes, not a new universal response envelope.** Treat an AIP envelope as a *watch item*, not a confirmed change — see [`04-migration-playbook.md`](./04-migration-playbook.md).
