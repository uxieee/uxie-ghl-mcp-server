# Multiple sub-accounts from one connection

One MCP registration, many GHL sub-accounts. Replaces the pattern of registering this server
once per client.

## Why it works this way

A GoHighLevel **Private Integration Token is hard-bound to one sub-account.** Proven: passing
another location's id returns `403 "The token does not have access to this location"`. GHL's
own MCP server does multi-account over **OAuth only** — its `list_locations` answers
`"dependencies are not configured"` for any PIT, agency-scoped or not, so their PIT path
still means one connection per sub-account.

So this server holds **N PITs and picks one per call**. Every request GHL receives is
byte-identical to a single-token connection. No privilege is gained that GHL had not already
granted that individual token, which is what makes it safe.

## Where the file lives — three ways

`GHL_ACCOUNTS_FILE` is a path, so you choose the trade between reach and isolation.

| Mode | Registration | Reach |
|---|---|---|
| **Global** | `GHL_ACCOUNTS_FILE=~/.ghl/accounts.json` | every client, from anywhere. One registration total. |
| **Global, scoped** | same file + `GHL_ALLOWED_LOCATIONS=<id>[,<id>]` | one shared file of secrets, narrowed per folder |
| **Per project** | `GHL_ACCOUNTS_FILE=<project>/.ghl/accounts.json` | only what that file lists |

**Why this matters.** The existing per-project `.ghl/` token files were not only convenient,
they were a boundary: an agent working in client A's folder physically could not reach client
B, because the credential was not there. A single global file removes that. `GHL_ALLOWED_LOCATIONS`
gives it back — one file to maintain, scoped down where it should be:

```bash
# your own workspace — everything
claude mcp add ghl -e GHL_ACCOUNTS_FILE="$HOME/.ghl/accounts.json" -- npx tsx …/src/stdio.ts

# inside a client folder — that client only
claude mcp add ghl \
  -e GHL_ACCOUNTS_FILE="$HOME/.ghl/accounts.json" \
  -e GHL_ALLOWED_LOCATIONS="wdzEoUZnXO9tB3PPzcot" \
  -- npx tsx …/src/stdio.ts
```

Scoped-out accounts do not appear in `list_locations` and are refused exactly like an unknown
id. A location id in the allowlist that is **not** in the accounts file is a startup error, so
a typo cannot silently narrow your access instead.

## Setting it up

### 1. Create the accounts file

Anywhere outside a git repo. `~/.ghl/accounts.json` is the convention for the global file:

```json
{
  "accounts": [
    { "id": "wdzEoUZnXO9tB3PPzcot", "name": "GROM AU",  "token": "pit-xxxxxxxx" },
    { "id": "yoQVVJFp6wyjxcxilA2H", "name": "GROM UK",  "token": "pit-yyyyyyyy" }
  ],
  "default": "wdzEoUZnXO9tB3PPzcot"
}
```

```bash
mkdir -p ~/.ghl && chmod 700 ~/.ghl
chmod 600 ~/.ghl/accounts.json
```

- `id` — the sub-account's **location id**. In the GHL UI it is the long string in the URL:
  `app.gohighlevel.com/v2/location/<THIS>/dashboard`.
- `name` — anything; it is what `list_locations` shows the agent, so use the client's name.
- `default` — optional. Used when a call omits `locationId`. With no default and more than
  one account, the server **asks rather than guesses**.

### 2. Register the server once

```bash
claude mcp add ghl \
  -e GHL_ACCOUNTS_FILE="$HOME/.ghl/accounts.json" \
  -- npx tsx /path/to/public-api-mcp/src/stdio.ts
```

**The registration holds a path, not a secret.** Claude Code writes env values verbatim into
`~/.claude.json`; putting tokens there ships every PIT on every request — including
`tools/list` — and parks them in the file people paste into bug reports.

`GHL_API_TOKEN=pit-...` still works for a single sub-account; nothing existing breaks.

## Adding a sub-account later

1. **Create a PIT in the sub-account.** GHL UI → *Settings → Private Integrations → Create*.
   Select the scopes you want; the token can do nothing you do not tick.
2. **Copy the location id** from the browser URL while you are in that sub-account.
3. **Append an entry** to `~/.ghl/accounts.json`:
   ```json
   { "id": "<locationId>", "name": "<Client Name>", "token": "pit-..." }
   ```
4. **Restart the MCP client.** The file is read at startup.

Then ask the agent to `list_locations` — the new account should appear. If you mistyped the
id, the first action that carries no location parameter will refuse with a binding error
rather than write to the wrong client (see below).

Validation happens at **load**, not at call time: a malformed file, a token that is not a
`pit-`, a duplicate id, or a `default` that is not in the list all fail immediately with a
message naming the entry.

## Using it

```
list_locations                      -> the configured sub-accounts and their binding state
execute_action { action_id, params, locationId }
```

- One account configured → `locationId` may be omitted.
- Several configured → `locationId` is required unless a `default` is set.
- An id with **no configured token** is refused. The server never substitutes another
  account's token, because silently operating on the wrong client is the failure this whole
  mechanism exists to prevent.

The location is injected the way each endpoint expects it, which is not uniform:

| how the action names its sub-account | actions | what happens |
|---|---|---|
| `locationId` in query, path, or request body | 717 | injected as `locationId` |
| `altId` + `altType` pair | 188 | injected as `altId` + `altType: "location"` |
| named nowhere at all | 302 | nothing to inject — **binding must be verified first** |

If you pass `params.locationId` yourself and it disagrees with the top-level `locationId`,
the call is refused rather than letting one choose the credential and the other choose the
target.

## The binding check, and why it exists

302 actions name no location anywhere. For those, nothing is injected and GHL has nothing to
reject — so a **mis-keyed token would succeed against whichever sub-account it actually
belongs to**, and the agent would report success on the wrong client's CRM.

Before running any such action, the server calls `GET /locations/{id}` with that account's
token. GHL answers `200` for the token's own location and `403` for any other. The result is
cached in memory for the process lifetime; no storage, no Durable Object.

- **verified** → proceed.
- **mismatched** → refused, naming the account whose id is wrong.
- **unverified** (network failure) → refused. A failure to check is not evidence that the
  mapping is fine.

Actions that *do* carry a location skip this: GHL itself rejects a cross-tenant call with a
403, so the check adds nothing.

## What this does not do

It is not OAuth. New sub-accounts do not appear on their own — you create a PIT and add a
line. For a fixed roster of clients that is a few minutes a year; if you ever need dynamic
authorisation across many agencies, that is when OAuth earns its build.
