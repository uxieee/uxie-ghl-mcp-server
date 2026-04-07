# uxie-ghl-mcp-server

MCP server for the **entire** GoHighLevel API — all 413 endpoints across 35 categories.

The [official GHL MCP server](https://marketplace.gohighlevel.com/docs/other/mcp/index.html) only covers 36 tools across 9 categories. This one covers everything.

## How it works

Instead of registering 413 individual tools (which would flood the LLM's context window), this server uses a **search + execute** pattern:

| Tool | What it does |
|------|-------------|
| `list_categories` | Browse all 35 API categories with action counts |
| `search_actions` | Find actions by natural language (e.g., "create a contact") |
| `execute_action` | Run any action by ID with params |

Claude searches for what it needs, gets the action ID and parameter schema, then executes it. Works for all 413 endpoints with just 3 tools.

## Categories covered

associations, blogs, businesses, calendars, campaigns, companies, contacts, conversations, courses, custom-fields, custom-menus, email-isv, emails, forms, funnels, invoices, links, locations, marketplace, medias, oauth, objects, opportunities, payments, phone-system, products, proposals, saas-api, snapshots, social-media-posting, store, surveys, users, voice-ai, workflows

## Setup

### Option A: Remote (Cloudflare Workers)

No installation needed. Just add the URL to Claude Code:

```bash
claude mcp add uxie-ghl-mcp --transport http https://ghl-mcp-server.xanderjohnrazonroque.workers.dev/mcp --header "X-GHL-Token: pit-YOUR-TOKEN-HERE"
```

For Claude Desktop / Claude.ai: Settings → Connectors → Add custom connector → paste the URL.

Each user passes their own GHL Private Integration Token via the `X-GHL-Token` header. No tokens are stored on the server.

### Option B: Local (stdio)

Run on your machine — your token never leaves your device.

```bash
git clone https://github.com/uxie/uxie-ghl-mcp-server.git
cd uxie-ghl-mcp-server
npm install
```

Then add to Claude Code:

```bash
claude mcp add uxie-ghl-mcp -e GHL_API_TOKEN=pit-YOUR-TOKEN-HERE -- npx tsx src/stdio.ts
```

## Getting your GHL token

1. Log into GoHighLevel
2. Go to **Settings → Private Integrations**
3. Create a new Private Integration Token (PIT)
4. Enable the scopes you need (contacts, calendars, conversations, etc.)
5. Copy the token — it starts with `pit-`

## Usage examples

Once connected, just ask Claude naturally:

- "List all my GHL contacts"
- "Create a new contact named John Doe with email john@example.com"
- "Show me all pipelines and opportunities"
- "Send an SMS to contact ID abc123"
- "List all invoices from this month"
- "Get my calendar events for today"

Claude will automatically search for the right action, get the parameters, and execute it.

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
Claude ──MCP──► Cloudflare Worker ──HTTPS──► GHL API
                    │
                    ├── search_actions (keyword search over 413-action catalog)
                    ├── execute_action (builds HTTP request, calls GHL, returns response)
                    └── list_categories (browse available categories)
```

- **Catalog**: Auto-generated from GHL's [official OpenAPI specs](https://github.com/GoHighLevel/highlevel-api-docs)
- **Search**: Pre-computed keyword index built at startup
- **Auth**: Per-user tokens via `X-GHL-Token` header (remote) or `GHL_API_TOKEN` env var (local)
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
  executor.ts       HTTP request builder + GHL API caller
  search.ts         Pre-computed keyword search index
  rate-limiter.ts   Fixed-window rate limiter
  types.ts          TypeScript types
scripts/
  build-catalog.ts  Downloads GHL OpenAPI specs → catalog.json
  test-all-endpoints.ts  Full endpoint test suite
data/
  catalog.json      Auto-generated action catalog (413 actions)
```

## License

MIT
