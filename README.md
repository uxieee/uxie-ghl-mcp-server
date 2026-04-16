# uxie-ghl-mcp-server

MCP server for the **entire** GoHighLevel API — all 413 endpoints across 35 categories.

The [official GHL MCP server](https://marketplace.gohighlevel.com/docs/other/mcp/index.html) only covers 36 tools across 9 categories. This one covers everything.

## How it works

Instead of registering 413 individual tools (which would flood the LLM's context window), this server uses a **search + execute** pattern:

| Tool | What it does |
|------|-------------|
| `list_categories` | Browse all 35 API categories with action counts |
| `search_actions` | Find actions by natural language, or enumerate every action in one category with `include_all=true` |
| `execute_action` | Run any action by ID with params, plus response shaping via `result_filter`, `result_fields`, `result_offset`, and `result_limit` |

Your MCP client searches for what it needs, gets the action ID and parameter schema, then executes it. Works for all 413 endpoints with just 3 tools.

This server is tuned for LLM usage:

- `search_actions` surfaces known GHL public-API gaps directly so the model does not keep searching for UI-only features.
- `execute_action` passes through undocumented but valid body keys to GHL so spec mismatches do not block working requests.
- `result_filter` searches nested strings inside arrays and objects, which makes tags and similar fields much easier to work with.

## Categories covered

associations, blogs, businesses, calendars, campaigns, companies, contacts, conversations, courses, custom-fields, custom-menus, email-isv, emails, forms, funnels, invoices, links, locations, marketplace, medias, oauth, objects, opportunities, payments, phone-system, products, proposals, saas-api, snapshots, social-media-posting, store, surveys, users, voice-ai, workflows

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

If you want Codex to load this MCP only inside one local project, add a `.codex/config.toml` file in that project instead of using the global `codex mcp add` command:

```toml
[mcp_servers.uxie_ghl]
url = "https://ghl-mcp-server.xanderjohnrazonroque.workers.dev/mcp"
bearer_token_env_var = "GHL_API_TOKEN"
```

Then set your token in the shell before starting Codex:

```bash
export GHL_API_TOKEN=pit-YOUR-TOKEN-HERE
```

This is project-local. Codex will load this MCP only in the local repo that contains that `.codex/config.toml` file.

For Claude Desktop / Claude.ai: Settings → Connectors → Add custom connector → paste the URL.

Each user passes their own GHL Private Integration Token via the `X-GHL-Token` header or `Authorization: Bearer <token>`. No tokens are stored on the server.

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

## Getting your GHL token

1. Log into GoHighLevel
2. Go to **Settings → Private Integrations**
3. Create a new Private Integration Token (PIT)
4. Enable the scopes you need (contacts, calendars, conversations, etc.)
5. Copy the token — it starts with `pit-`

## Usage examples

Once connected, just ask Claude or Codex naturally:

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

- **Conversation AI bots**: the public GHL API does not expose listing, reading, or updating Conversation AI bot configs, prompts, knowledge bases, or transfer rules. `voice-ai__*` endpoints are for Voice AI, not Conversation AI.
- **Workflow internals**: `workflows__get-workflow` is a minimal read-only list. Workflow triggers, steps, conditions, and AI-agent usage remain UI-only.
- **Pipelines and stages**: `opportunities__get-pipelines` is read-only. Creating or editing pipeline containers and stages still has to be done in the GHL UI.
- **SMS/email template creation**: the public API can list or delete templates, but template creation is still UI-only.
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
npm run build-catalog   # Downloads latest OpenAPI specs from GHL's GitHub
npx wrangler deploy     # Redeploy with updated catalog
```

## Architecture

```
Claude / Codex ──MCP──► Cloudflare Worker ──HTTPS──► GHL API
                    │
                    ├── search_actions (keyword search over 413-action catalog)
                    ├── execute_action (builds HTTP request, calls GHL, returns response)
                    └── list_categories (browse available categories)
```

- **Catalog**: Auto-generated from GHL's [official OpenAPI specs](https://github.com/GoHighLevel/highlevel-api-docs)
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
- Rate limited to prevent API abuse
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
  catalog.json      Auto-generated action catalog (413 actions)
tests/
  ghl-mcp-server.test.ts  Regression tests for MCP behavior and LLM-facing guidance
```

## License

MIT
