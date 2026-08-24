# uxie-ghl-mcp-server

MCP server for the **entire** GoHighLevel API — all 1207 endpoints across 83 categories (GHL API v2 + v3).

The [official GHL MCP server](https://marketplace.gohighlevel.com/docs/other/mcp/index.html) only covers 36 tools across 9 categories. This one covers everything.

**API v3 support** (since 2026-07-11): GHL published its API v3 spec set on 2026-06-19 as a parallel surface — same host, selected per request via the `Version: v3` header. The catalog carries both: categories ending in `-v3` (e.g. `opportunities-v3`) are the current v3 API, and the unsuffixed twins are the legacy v2 specs kept for compatibility. This includes the long-requested **pipeline create/update/delete** endpoints (added by GHL on 2026-06-26), plus the new `chat-widget` category, calendar service bookings, location-scoped email campaigns/templates, social-planner category queues, and brand voices. See [`docs/api-v3/`](./docs/api-v3/) for the full story.

## How it works

Instead of registering 1207 individual tools (which would flood the LLM's context window), this server uses a **search + execute** pattern:

| Tool | What it does |
|------|-------------|
| `list_categories` | Browse all 83 API categories with action counts |
| `search_actions` | Find actions by natural language, or enumerate every action in one category with `include_all=true` |
| `execute_action` | Run any action by ID with params, preview writes with `dry_run`, confirm high-risk actions, and shape responses via `result_filter`, `result_fields`, `result_offset`, and `result_limit` |

Your MCP client searches for what it needs, gets the action ID and parameter schema, then executes it. Works for all 1207 endpoints with just 3 tools.

This server is tuned for LLM usage:

- `search_actions` surfaces known GHL public-API gaps directly so the model does not keep searching for UI-only features.
- `execute_action` passes through undocumented but valid body keys to GHL so spec mismatches do not block working requests.
- `execute_action` returns structured MCP output and requires confirmation for high-risk sends, deletes, publishes, cancels, and billing/payment actions.
- `result_filter` searches nested strings inside arrays and objects, which makes tags and similar fields much easier to work with.

## Categories covered

**v2 (legacy):** ad-manager, affiliate-manager, agent-studio, associations, blogs, brand-boards, businesses, calendars, campaigns, companies, contacts, conversation-ai, conversations, courses, custom-fields, custom-menus, email-isv, emails, forms, funnels, invoices, knowledge-base, links, locations, marketplace, medias, oauth, objects, opportunities, payments, phone-system, products, proposals, saas-api, snapshots, social-media-posting, store, surveys, users, voice-ai, workflows

**v3 (current):** the same domains as `-v3` categories (e.g. `contacts-v3`, `opportunities-v3`), with `ad-publishing-v3`, `social-planner-v3`, and `saas-v3` replacing `ad-manager`, `social-media-posting`, and `saas-api`, plus the new `chat-widget-v3`.

## Setup

### Option A: Remote (Cloudflare Workers)

No installation needed.

Add it to Claude Code:

```bash
claude mcp add uxie-ghl-mcp --transport http https://ghl-mcp-server.xanderjohnrazonroque.workers.dev/mcp --header "X-GHL-Token: pit-YOUR-TOKEN-HERE"
```

Add it to Codex CLI:

```bash
codex mcp add uxie-ghl-mcp --url https://ghl-mcp-server.xanderjohnrazonroque.workers.dev/mcp --bearer-token-env-var GHL_API_TOKEN
```

`codex mcp add` writes to Codex's global config. If you want Codex to load this MCP only inside one local project, add a `.codex/config.toml` file in that project instead:

```toml
[mcp_servers.uxie_ghl]
url = "https://ghl-mcp-server.xanderjohnrazonroque.workers.dev/mcp"
bearer_token_env_var = "GHL_API_TOKEN"
```

Then set your token in the shell before starting Codex:

```bash
export GHL_API_TOKEN=pit-YOUR-TOKEN-HERE
```

This is project-local. Codex will load this MCP only in the local repo that contains that `.codex/config.toml` file. `GHL_API_TOKEN` must already exist in the environment when the Codex session starts; if you add or change it later, start a fresh Codex session.

If you want that project-local setup to feel automatic, pair it with `direnv`:

```bash
brew install direnv
```

Add a repo-local `.envrc`:

```bash
export GHL_API_TOKEN='pit-YOUR-TOKEN-HERE'
```

Then allow it once:

```bash
direnv allow .
```

Recommended pattern:

- Keep `.codex/config.toml` in the project root so Codex loads the MCP only for that repo.
- Keep the token in a repo-local `.envrc` so entering the repo loads `GHL_API_TOKEN`.
- Add `.envrc` to `.gitignore` if you are storing a real token there.

Important parent/child folder behavior:

- Parent folders do **not** inherit a child's `.envrc`.
- Child folders **do** inherit env vars from parent `.envrc` files.
- If a child folder has its **own** `.envrc`, do **not** rely on implicit merging with the parent.
- If the child defines `GHL_API_TOKEN`, that child value wins for that child context.
- A child `.envrc` does **not** change the parent folder's environment.

If you want a child `.envrc` to extend the parent instead of replacing it, source the parent explicitly:

```bash
source_up
export SOME_OTHER_VAR='value'
```

Two practical gotchas:

- After editing `.envrc`, run `direnv allow .` again.
- `AGENTS.md` can tell Codex to prefer this MCP, but it does **not** load the MCP by itself. The MCP still needs `.codex/config.toml` plus `GHL_API_TOKEN` present when the Codex session starts.

Add it to opencode:

opencode is config-file based (there is no `opencode mcp add` command). Add the server under the `mcp` key in your `opencode.json` — either global at `~/.config/opencode/opencode.json` or project-local in the repo root:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "uxie-ghl": {
      "type": "remote",
      "url": "https://ghl-mcp-server.xanderjohnrazonroque.workers.dev/mcp",
      "enabled": true,
      "oauth": false,
      "headers": {
        "X-GHL-Token": "{env:GHL_API_TOKEN}"
      }
    }
  }
}
```

`oauth: false` is required: opencode tries OAuth on remote servers by default, but this Worker is a BYO-token proxy, not an OAuth resource server. The `{env:GHL_API_TOKEN}` placeholder pulls the token from your environment, so set it before launching opencode (or hardcode the `pit-...` value directly in the header):

```bash
export GHL_API_TOKEN=pit-YOUR-TOKEN-HERE
```

`Authorization: Bearer {env:GHL_API_TOKEN}` works too — the Worker accepts either header.

For Claude Desktop / Claude.ai: Settings → Connectors → Add custom connector → paste the URL.

Each user passes their own GHL Private Integration Token via the `X-GHL-Token` header or `Authorization: Bearer <token>`. The Worker forwards that token to GHL for the current MCP request/session and does not persist it in Durable Object storage.

### Production/security note

The remote Worker is currently a BYO GHL token MCP proxy. It validates that callers provide a GHL Private Integration Token, forwards requests to the public GHL API, and does not implement first-party MCP OAuth/resource-server authorization yet. For higher-trust production use, put this behind real MCP OAuth/resource-server auth and issue scoped user/session credentials instead of accepting raw PITs directly from clients.

### Option B: Local (stdio)

Run on your machine — your token never leaves your device.

```bash
git clone https://github.com/uxieee/uxie-ghl-mcp-server.git
cd uxie-ghl-mcp-server
npm install
```

Then add to Claude Code:

```bash
claude mcp add uxie-ghl-mcp -e GHL_API_TOKEN=pit-YOUR-TOKEN-HERE -- npx tsx src/stdio.ts
```

Or add to Codex CLI:

```bash
codex mcp add uxie-ghl-mcp --env GHL_API_TOKEN=pit-YOUR-TOKEN-HERE -- npx tsx src/stdio.ts
```

Or add to opencode (`opencode.json`, run from the cloned repo so the relative path resolves):

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "uxie-ghl": {
      "type": "local",
      "command": ["npx", "tsx", "src/stdio.ts"],
      "enabled": true,
      "environment": {
        "GHL_API_TOKEN": "pit-YOUR-TOKEN-HERE"
      }
    }
  }
}
```

## Getting your GHL token

1. Log into GoHighLevel
2. Go to **Settings → Private Integrations**
3. Create a new Private Integration Token (PIT)
4. Enable the scopes you need (contacts, calendars, conversations, etc.)
5. Copy the token — it starts with `pit-`

## Usage examples

Once connected, just ask Claude, Codex, or opencode naturally:

- "List all my GHL contacts"
- "Create a new contact named John Doe with email john@example.com"
- "Show me all pipelines and opportunities"
- "Send an SMS to contact ID abc123"
- "List all invoices from this month"
- "Get my calendar events for today"

Your MCP client will automatically search for the right action, get the parameters, and execute it.

If you need every action inside a category instead of ranked matches, use `search_actions` with `category` plus `include_all=true`.

## Known Public-API Gaps

These are GHL platform limitations, not bugs in this MCP server. The server now tries to surface them explicitly in search results and action notes so an LLM can stop early instead of repeatedly hunting for endpoints that do not exist.

- **Workflow internals**: `workflows__get-workflow` is a minimal read-only list. Workflow triggers, steps, conditions, and AI-agent usage remain UI-only.
- **Pipelines and stages**: fully writable since GHL's 2026-06-26 API addition — `opportunities-v3__create-pipeline` / `update-pipeline` / `delete-pipeline`. (This line previously said read-only; it was stale.) Note th
- **SMS template creation**: still UI-only — `/locations/{locationId}/templates` supports list and delete only. EMAIL templates CAN be created: `emails-v3__create-email-template` / `import-email-template`, or the older `emails__create-template`.
- **Contact/opportunity custom-field folders**: folder containers must be created in the GHL UI. Once a folder exists, fields can be assigned or moved with `parentId` on `locations__create-custom-field` and `locations__update-custom-field`.
- **Sub-account security settings**: sender domains, A2P registration, and webhook signing keys are UI-only.

## Helpful Usage Notes

- **Conversation history for a contact**: use `conversations__search-conversation` to find the thread, then `conversations__get-messages` with the returned `conversationId`.
- **Custom-field option lists**: for location custom-field create/update, use `options: ["A", "B"]` for SINGLE_OPTIONS, MULTIPLE_OPTIONS, RADIO, and CHECKBOX fields. The upstream OpenAPI spec may still mention `textBoxListOptions`, but GHL validates `options`.
- **Commerce setup**: use GHL's `products__*` and `payments__*` endpoints as the source of truth. Stripe IDs may appear in payloads, but direct Stripe API access is usually not needed for normal GHL sub-account setup.
- **Full category enumeration**: if ranked search is too narrow, call `search_actions` with `category` plus `include_all=true` to page through every action in that category.

## Self-hosting

Want to deploy your own instance? Fork this repo and:

```bash
npm install
npx wrangler deploy
```

You'll need a [Cloudflare account](https://dash.cloudflare.com/sign-up) (free tier is enough — 100k requests/day).

Update `account_id` in `wrangler.jsonc` to your own Cloudflare account ID.

## Updating the API catalog

When GHL adds new API endpoints:

```bash
npm run build-catalog   # Downloads latest OpenAPI specs from GHL's GitHub (raw CDN, no API rate limit)
npx wrangler deploy     # Redeploy with updated catalog
```

The build is configurable via environment variables:

| Env var | Default | Purpose |
|---------|---------|---------|
| `GHL_DOCS_REF` | `main` | Branch/ref of `highlevel-api-docs` to build from. Point it at a preview branch to adopt new specs early, e.g. `GHL_DOCS_REF=latest_specs_sync npm run build-catalog`. |
| `GHL_DOCS_REPO` | `GoHighLevel/highlevel-api-docs` | Source repo (use a fork if needed). |
| `GHL_BASE_URL` | `https://services.leadconnectorhq.com` | API host baked into the catalog and used by the executor. |

### API versioning & v3 readiness

The GHL API is currently **v2** (host `services.leadconnectorhq.com`, date version headers `2021-07-28` / `2021-04-15`). HighLevel is rolling out a breaking **v3** revision (camelCase params, kebab-case paths, required `Version` headers, new `*V3` schemas, location-scoped paths), GHL published the v3 specs on 2026-06-19 and this catalog carries them: 42 `-v3` categories are present. (This paragraph previously said v3 was not yet published; it was stale.)

See [`docs/api-v3/`](docs/api-v3/) for the full audit, the per-domain v3 change breakdown, and the migration playbook.

## Architecture

```
Claude / Codex / opencode ──MCP──► Cloudflare Worker ──HTTPS──► GHL API
                    │              (or local stdio: src/stdio.ts)
                    ├── search_actions   ranked search -> COMPACT stubs, one row per operation
                    ├── describe_action  full params + body schema for the ONE id you chose
                    ├── execute_action   routes and calls GHL; dry_run, confirm, response shaping
                    ├── list_categories  45 category families
                    └── list_locations   configured sub-accounts (stdio + accounts file only)
```

**Three steps, not two.** `search_actions` returns stubs; `describe_action` returns the schema
for the single action you picked. Inlining every hit's schema cost ~15,800 tokens a search;
the split cycle costs ~14,000 bytes. Set `compact:false` only if you truly want every schema.

**671 distinct operations, 1207 catalog entries.** GHL publishes most endpoints twice — a v2
spec and a v3 twin at the same method+path. Search returns one row per operation and names the
other id as `alsoAvailableAs`; `execute_action` accepts either. Do not assume a `-v3` category
means the v3 header: 124 actions in `-v3` categories do not carry one.

**Multiple sub-accounts** from one connection: see [`docs/multi-sub-account.md`](docs/multi-sub-account.md).

- **Catalog**: Auto-generated from GHL's [official OpenAPI specs](https://github.com/GoHighLevel/highlevel-api-docs) (1207 actions across 83 categories: v2 specs in apps/ plus the v3 specs GHL published to apps/v3/ on 2026-06-19)
- **Catalog overrides**: Runtime patches correct a few high-value spec mismatches such as `parentId` / `options` on location custom fields
- **Search**: Pre-computed keyword index built at startup
- **Auth**: Per-user tokens via `X-GHL-Token` or `Authorization: Bearer <token>` (remote), or `GHL_API_TOKEN` env var (local)
- **Rate limiting**: 60 execute calls per minute per session
- **Error handling**: GHL errors sanitized before returning to LLM
- **Security**: SSRF protection, body size limits, input validation, method allowlisting

## Security

- No tokens stored server-side — each user provides their own
- GHL error responses are sanitized (no internal details leaked)
- Request body size capped at 1MB
- HTTP methods allowlisted (GET, POST, PUT, PATCH, DELETE only)
- SSRF protection on catalog paths
- Rate limited per token — **per edge isolate**, so the effective ceiling is 60/min multiplied by the number of live isolates. It smooths accidental loops; it is not an enforcement boundary and should not be described as one.
- 15-second timeout on all outbound requests

## Project structure

```
src/
  index.ts          Cloudflare Worker entry point (remote HTTP)
  stdio.ts          Local stdio entry point
  tools.ts          Shared tool registration (search, execute, list)
  catalog-overrides.ts  Runtime fixes for known OpenAPI/catalog mismatches
  executor.ts       HTTP request builder + GHL API caller
  search.ts         Pre-computed keyword search index
  rate-limiter.ts   Fixed-window rate limiter
  types.ts          TypeScript types
scripts/
  build-catalog.ts  Downloads GHL OpenAPI specs → catalog.json
  test-all-endpoints.ts  Full endpoint test suite
data/
  catalog.json      Auto-generated action catalog (1207 actions)
tests/
  ghl-mcp-server.test.ts  Regression tests for MCP behavior and LLM-facing guidance
```

## License

MIT
