# @uxieee/ghl-mcp

GoHighLevel's public API as an MCP server. **671 distinct operations** across 45 categories,
covering GHL API v2 and the v3 surface.

Built for agents: ranked search over the whole API, a describe step so schemas cost you nothing
until you want one, confirmation gates on anything that spends money or sends a message, and
**one connection across many sub-accounts**.

```bash
claude mcp add ghl -e GHL_API_TOKEN=pit-your-token -- npx -y @uxieee/ghl-mcp
```

---

> ### ⚠️ The hosted Cloudflare Worker is being retired
>
> `https://ghl-mcp-server.xanderjohnrazonroque.workers.dev/mcp` still works today and is running
> the current code, but it will be **switched off in a few weeks**. Move to the npm package.
>
> **Why:** the Worker can only ever hold one token per connection, so reaching ten sub-accounts
> means ten registrations — ten copies of the same tool schemas loaded into every session. It
> also means your token travels to a third-party host on every request. The npm package fixes
> both: many sub-accounts on one connection, and credentials that never leave your machine.
>
> **Migrating** is one line — see [From the hosted Worker](#from-the-hosted-worker).

---

## Install

Nothing to clone or build. `npx` fetches the current version each time it starts.

### One sub-account

```bash
claude mcp add ghl -e GHL_API_TOKEN=pit-your-token -- npx -y @uxieee/ghl-mcp
```

### Many sub-accounts

Tokens live in a file, and the MCP config holds only a **path** — never a credential.

```bash
npx -y @uxieee/ghl-mcp accounts add     # repeat per sub-account
claude mcp add ghl -e GHL_ACCOUNTS_FILE="$HOME/.ghl/accounts.json" -- npx -y @uxieee/ghl-mcp
```

`accounts add` asks for two things and **verifies them against GHL before writing anything**:

```
Private Integration Token (pit-…): ****
Location id: ****

Checking the token really reaches that sub-account… yes — "Riverside Dental Co".
Added "Riverside Dental Co".
```

- **200** → the pairing is real, and the sub-account's name comes back from GHL rather than you typing it
- **403** → that token has no access to that location; the id and token belong to different sub-accounts
- **401** → the token is revoked or invalid

Nothing is written unless it verifies. A mistyped location id is not a syntax error — it is a
silent write to the wrong client — so it is checked at the point you enter it.

```
npx -y @uxieee/ghl-mcp doctor                 # what is configured, what is missing
npx -y @uxieee/ghl-mcp accounts list          # names and ids; never prints tokens
npx -y @uxieee/ghl-mcp accounts remove <id>
```

Every command accepts `--json`, and `accounts add` accepts `--token` / `--location`, so an
agent can drive setup without an interactive prompt. See
[Setting this up with an AI agent](#setting-this-up-with-an-ai-agent).

### Setting this up with an AI agent

Most people install this alongside an agent, so the setup is built for the pair of you. The
agent cannot fetch either value — both live behind a browser login — so its job is to work out
what is missing, tell you exactly where to click, and verify what you paste back.

**Point your agent at this and it can drive the whole thing:**

```bash
npx -y @uxieee/ghl-mcp doctor --json
```

That returns the current state and an ordered `nextSteps` array. On a fresh machine:

```json
{
  "ok": false,
  "mode": "unconfigured",
  "file": "/Users/you/.ghl/accounts.json",
  "fileExists": false,
  "checks": [
    { "name": "node", "ok": true,  "detail": "v24.13.0" },
    { "name": "mode", "ok": false, "detail": "nothing configured" }
  ],
  "accounts": [],
  "nextSteps": [
    "Ask the person for a Private Integration Token: in GoHighLevel, open the sub-account, Settings > Private Integrations > Create, tick the scopes needed, copy the pit-… value.",
    "Ask for that sub-account's location id: it is the long id in the browser URL while they are in it — app.gohighlevel.com/v2/location/<THIS>/dashboard",
    "Then run: ghl-mcp accounts add --token <pit-…> --location <id> --json",
    "For a single sub-account with no file, set GHL_API_TOKEN instead."
  ]
}
```

On a machine that is already set up, `mode` is `multi` (or `single`), every account is
re-verified against GHL, and `nextSteps` is empty when nothing needs doing.

You paste the two values; the agent runs:

```bash
npx -y @uxieee/ghl-mcp accounts add --token pit-… --location <id> --json
```

```json
{ "ok": true, "action": "added", "name": "Riverside Dental Co",
  "locationId": "ve9EPM428h8vShlRW1KT", "total": 1 }
```

The `name` comes back **from GHL**, so it is proof the token reaches that sub-account rather
than something either of you typed. Failures are structured too, with a non-zero exit:

| | |
|---|---|
| `"the token is not valid (401)"` | revoked or mistyped token |
| `"this token has no access to that location (403)"` | the id and token belong to **different** sub-accounts |
| `"not a Private Integration Token"` | it does not start with `pit-` |

**Nothing is written unless it verifies.** A mistyped location id is not a syntax error — it is
a silent write to the wrong client — so it is caught here rather than in three weeks.

Re-run `doctor --json` afterwards to confirm, and any time something stops working: it
re-verifies every configured token against GHL and names the ones that have gone stale.

Every command takes `--json`, and `accounts list --json` never includes a token.

### Pointing a folder at one client

One accounts file, narrowed per folder. The agent names the client; it never types an id:

```bash
cd ~/Work/Clients/Riverside
npx -y @uxieee/ghl-mcp scope "Riverside Dental" "Riverside Med Spa" --json
```

```json
{ "ok": true, "file": "…/Riverside/.mcp.json", "created": true,
  "scopedTo": [ {"name": "Riverside Dental", "id": "…"},
                {"name": "Riverside Med Spa", "id": "…"} ],
  "preserved": ["playwright"] }
```

That writes the folder's `.mcp.json`, **merging** rather than replacing, so other MCP servers
in that folder survive (`preserved` lists them). The server started from it sees those two
sub-accounts and no others.

Why by name: a mistyped id fails loudly, since the server refuses to start on an id that is
not in the accounts file. But pasting a **different real** id fails silently forever, because
both ids are valid and the folder simply points at the wrong client. Naming removes the chance
instead of catching it afterwards. An ambiguous name is refused with the candidates listed
rather than guessed, and nothing is written.

```bash
npx -y @uxieee/ghl-mcp scope --list     # what this folder currently sees
npx -y @uxieee/ghl-mcp scope --all      # your own folder: every sub-account
```

`--all` omits the allowlist entirely rather than listing every id, so sub-accounts you add
later are picked up without re-scoping.

### Getting the two values

| | Where |
|---|---|
| **Private Integration Token** | In the sub-account: *Settings → Private Integrations → Create*. Tick the scopes you want; the token can do nothing you do not grant. |
| **Location id** | The long string in the browser URL while you are in that sub-account: `app.gohighlevel.com/v2/location/`**`<THIS>`**`/dashboard` |

A PIT is bound to **one** sub-account — passing another location's id returns
`403 "The token does not have access to this location"`. That is why many sub-accounts means
many tokens. An *agency* PIT cannot substitute: agency scopes cover locations, users, snapshots
and SaaS, but there is no `contacts`, `conversations`, `opportunities` or `calendars` scope to
grant, so an agency token structurally cannot read sub-account data.

## Scoping a shared file per project

One file of credentials, narrowed per folder. A client project sees only that client; your own
workspace sees everything.

```bash
# your workspace — everything
claude mcp add ghl -e GHL_ACCOUNTS_FILE="$HOME/.ghl/accounts.json" -- npx -y @uxieee/ghl-mcp

# inside a client folder — that client only
claude mcp add ghl \
  -e GHL_ACCOUNTS_FILE="$HOME/.ghl/accounts.json" \
  -e GHL_ALLOWED_LOCATIONS="ve9EPM428h8vShlRW1KT" \
  -- npx -y @uxieee/ghl-mcp
```

Scoped-out accounts are dropped at load — they never enter the process, so they cannot appear in
`list_locations` or be selected. An id in `GHL_ALLOWED_LOCATIONS` that is **not** in the accounts
file is a startup error, so a typo cannot silently narrow your access instead.

Putting this in a `.mcp.json` at a parent folder applies it to every folder beneath, which is
usually what you want for an agency directory holding several clients.

## The tools

```
search_actions    ranked search -> compact stubs, one row per operation
describe_action   full parameters + request body for the ONE id you chose
execute_action    routes and calls GHL; dry_run, confirm, response shaping, locationId
list_categories   45 category families
list_locations    configured sub-accounts (only when an accounts file is set)
```

**Three steps, not two.** `search_actions` returns stubs; `describe_action` returns the schema for
the single action you picked. Inlining every hit's schema cost ~15,800 tokens per search; the
split cycle costs about a fifth of that. `compact:false` restores the old behaviour if you
genuinely want every schema.

**One row per operation.** GHL publishes most endpoints twice — a v2 spec and a v3 twin at the
same method and path — so an uncollapsed search spent half its results showing the same thing
twice. Search returns one row and names the other id as `alsoAvailableAs`; either works. Do not
assume a `-v3` **category** means the v3 header: 124 actions in `-v3` categories do not carry
one, so prefer the id search hands you.

### Response shaping

Top-level arguments on `execute_action`, **not** inside `params`:

| | |
|---|---|
| `result_filter` | keyword filter over string fields in returned items |
| `result_fields` | comma-separated fields to keep — works on lists *and* single records |
| `result_offset` / `result_limit` | paginate array responses; `result_limit=0` returns just a count |
| `dry_run` | preview the routed request without calling GHL |
| `confirm` | required for sends, publishes, deletes, cancels, billing and advertising mutations |
| `locationId` | which sub-account to operate on |

### What the server does for you

- **Routes parameters** to path, query or body per the endpoint's own spec, and passes
  undocumented body keys through so spec gaps do not block valid requests.
- **Treats "required" as advisory.** GHL's OpenAPI marks fields required that the API accepts
  without — `conversations__send-a-new-message` demands `status`, an *inbound*-message enum, on
  an outbound send. Missing fields come back as a warning and GHL adjudicates. Only a missing
  **path** parameter is fatal, because it cannot be turned into a URL.
- **Keeps GHL's real error text.** Validation failures arrive as an array of per-field messages;
  they are preserved rather than flattened, because that is what an agent needs to fix its call.
- **Injects the sub-account** the way each endpoint expects — `locationId` in query, path or body
  (717 actions), or the `altId` + `altType` pair (188).
- **Refuses to guess.** An unknown `locationId` is an error, never quietly served with another
  account's token. If `params.locationId` disagrees with the top-level one, the call is refused
  rather than letting one pick the credential and the other pick the target.
- **Verifies bindings.** 302 actions name no sub-account anywhere, so nothing can be injected and
  GHL has nothing to reject — a mis-keyed token would succeed against whichever sub-account it
  really belongs to. Before running one, the server checks the token reaches its configured
  location and refuses if it cannot.

## Known GHL platform gaps

Limitations of GHL's public API, not of this server. Search results say so explicitly, so an
agent stops instead of hunting for endpoints that do not exist.

- **Workflow internals** — `workflows__get-workflow` is a minimal read-only list. Triggers,
  steps, conditions and AI-agent usage are UI-only.
- **SMS template creation** — UI-only; `/locations/{locationId}/templates` supports list and
  delete. Email templates *can* be created (`emails-v3__create-email-template`).
- **Custom-field folders** — the container must be made in the UI. Once it exists, fields move
  into it with `parentId`.
- **Sub-account security settings** — sender domains, A2P registration and webhook signing keys
  are UI-only.

Pipelines and stages *are* fully writable — `opportunities-v3__create-pipeline` / `update` /
`delete`.

## Useful to know

- **Conversation history**: `conversations__search-conversation` for the thread, then
  `conversations__get-messages` with the returned `conversationId`.
- **Custom-field options**: use `options: ["A","B"]` for SINGLE_OPTIONS, MULTIPLE_OPTIONS, RADIO
  and CHECKBOX. The spec may still mention `textBoxListOptions`; GHL validates `options`.
- **Commerce**: `products__*` and `payments__*` are the source of truth. Stripe ids appear in
  payloads but direct Stripe access is rarely needed.
- **Enumerate a category**: `search_actions` with `category` plus `include_all=true`.

## From the hosted Worker

Replace the URL registration with the package. Your token does not change.

```bash
claude mcp remove ghl-api                                  # or whatever you named it
claude mcp add ghl -e GHL_API_TOKEN=pit-your-token -- npx -y @uxieee/ghl-mcp
```

If you had several registrations for several sub-accounts, that is the case for
[many sub-accounts](#many-sub-accounts) — one registration replaces all of them.

| | Worker | npm package |
|---|---|---|
| Sub-accounts per connection | one | many |
| Token leaves your machine | yes, each request | no |
| Updates | we deploy | `npx` fetches latest |
| Needs Node locally | no | yes |

## Development

```bash
npm install
npm test          # 38 tests
npm run typecheck
npm run build     # -> dist/
npm run build-catalog   # regenerate from GHL's published OpenAPI specs
```

The catalog is generated from
[GoHighLevel/highlevel-api-docs](https://github.com/GoHighLevel/highlevel-api-docs). Set
`GHL_DOCS_REF` to build from a preview branch.

## Security

- Tokens are never logged, never returned in a response, and never included in a `dry_run`
  preview — previews build with a placeholder.
- The accounts file is written `0600` in a `0700` directory.
- MCP config holds a path, not a credential.
- Rate limiting is per token and smooths accidental loops; it is not an enforcement boundary.

This talks to GHL's **public, documented** API with a token you issue and scope yourself.

## License

MIT
