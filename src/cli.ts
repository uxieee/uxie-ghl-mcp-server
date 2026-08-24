#!/usr/bin/env node
/**
 * `ghl-mcp` — the published entry point.
 *
 *   ghl-mcp                     run the MCP server over stdio (what .mcp.json invokes)
 *   ghl-mcp accounts add        add a sub-account, verifying the token before it is written
 *   ghl-mcp accounts list       show configured sub-accounts (never prints tokens)
 *   ghl-mcp accounts remove     remove one by id or name
 *
 * The `accounts` commands exist because the alternative is hand-editing JSON containing
 * credentials and 20-character opaque ids — where a mistyped id is not a syntax error but a
 * silent wrong-account write, which is the one failure this whole design is built to prevent.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, chmodSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";

const DEFAULT_FILE = join(homedir(), ".ghl", "accounts.json");
const BASE = process.env.GHL_BASE_URL || "https://services.leadconnectorhq.com";

interface Account { id: string; name: string; token: string }
interface File { accounts: Account[]; default?: string }

function filePath(): string {
  return process.env.GHL_ACCOUNTS_FILE || DEFAULT_FILE;
}
function load(p: string): File {
  if (!existsSync(p)) return { accounts: [] };
  try {
    return JSON.parse(readFileSync(p, "utf8")) as File;
  } catch (e) {
    console.error(`\n${p} is not valid JSON: ${(e as Error).message}`);
    console.error("Fix or delete it before adding accounts.\n");
    process.exit(1);
  }
}
function save(p: string, f: File): void {
  mkdirSync(dirname(p), { recursive: true });
  try { chmodSync(dirname(p), 0o700); } catch { /* pre-existing dir may not be ours */ }
  writeFileSync(p, JSON.stringify(f, null, 2));
  chmodSync(p, 0o600); // the file holds live credentials
}

/**
 * Ask GHL what this token can actually reach. Returns the sub-account's real name, which
 * doubles as proof the token belongs to that location: GHL answers 200 for a token's own
 * location and 403 ("The token does not have access to this location") for any other.
 */
async function verify(token: string, locationId: string): Promise<{ ok: true; name: string } | { ok: false; why: string }> {
  let res: Response;
  try {
    res = await fetch(`${BASE}/locations/${locationId}`, {
      headers: { Authorization: `Bearer ${token}`, Version: "2021-07-28", Accept: "application/json" },
    });
  } catch (e) {
    return { ok: false, why: `could not reach GHL (${(e as Error).message})` };
  }
  if (res.status === 401) return { ok: false, why: "the token is not valid (401) — it may have been revoked" };
  if (res.status === 403) return { ok: false, why: "this token has no access to that location (403) — the id and the token belong to different sub-accounts" };
  if (!res.ok) return { ok: false, why: `GHL answered ${res.status}` };
  const body = (await res.json()) as { location?: { name?: string }; name?: string };
  return { ok: true, name: body.location?.name || body.name || locationId };
}

function parseFlags(argv: string[]): Record<string, string | boolean> {
  const out: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith("--")) { out[key] = next; i++; } else { out[key] = true; }
  }
  return out;
}

/** Machine-readable when --json is passed, human-readable otherwise. */
function emit(json: boolean, ok: boolean, payload: Record<string, unknown>, human: string): void {
  if (json) console.log(JSON.stringify({ ok, ...payload }));
  else console.log(human);
  if (!ok) process.exit(1);
}

/**
 * Add a sub-account.
 *
 * Two modes on purpose. Most people install this WITH an AI agent, and an agent cannot type
 * into an interactive prompt — so flags plus --json exist for the agent, and the prompt
 * remains for a human working alone. The agent cannot obtain the token or the location id
 * itself either (both come from a browser), so the intended shape is collaborative: the agent
 * runs `doctor`, tells the human exactly where to click, the human pastes two values, the
 * agent runs `accounts add --token … --location … --json` and reports what GHL said.
 */
async function add(argv: string[]): Promise<void> {
  const flags = parseFlags(argv);
  const json = Boolean(flags.json);
  const p = filePath();
  const f = load(p);

  let token = typeof flags.token === "string" ? flags.token.trim() : "";
  let id = typeof flags.location === "string" ? flags.location.trim() : "";

  if (!token || !id) {
    if (json || !stdin.isTTY) {
      emit(true, false, {
        error: "missing --token and/or --location",
        need: ["--token pit-…", "--location <locationId>"],
        howToGet: {
          token: "In the sub-account: Settings > Private Integrations > Create. Tick the scopes you want.",
          location: "The long id in the browser URL while in that sub-account: app.gohighlevel.com/v2/location/<THIS>/dashboard",
        },
        hint: "Both values come from the GHL web UI, so a person has to fetch them. Ask for them, then re-run with the flags.",
      }, "");
      return;
    }
    const rl = createInterface({ input: stdin, output: stdout });
    console.log(`\nAdding a GoHighLevel sub-account to ${p}\n`);
    console.log("You need two things from the sub-account:");
    console.log("  1. a Private Integration Token — Settings > Private Integrations > Create");
    console.log("  2. its location id — the long string in the browser URL while you are in");
    console.log("     that sub-account: app.gohighlevel.com/v2/location/<THIS>/dashboard\n");
    if (!token) token = (await rl.question("Private Integration Token (pit-…): ")).trim();
    if (!id) id = (await rl.question("Location id: ")).trim();
    rl.close();
  }

  if (!token.startsWith("pit-")) {
    emit(json, false, { error: "not a Private Integration Token", detail: "Private Integration Tokens start with 'pit-'." },
      "\nThat does not look like a Private Integration Token (they start with 'pit-').\n");
    return;
  }

  if (!json) process.stdout.write("\nChecking the token really reaches that sub-account… ");
  const v = await verify(token, id);
  if (!v.ok) {
    emit(json, false, { error: "verification failed", detail: v.why, locationId: id, wrote: false },
      `no.\n\n  ${v.why}\n\nNothing was written.\n`);
    return;
  }

  const existing = f.accounts.findIndex((a) => a.id === id);
  const entry: Account = { id, name: v.name, token };
  const updated = existing >= 0;
  if (updated) f.accounts[existing] = entry; else f.accounts.push(entry);
  if (!f.default) f.default = id;
  save(p, f);

  emit(json, true, { action: updated ? "updated" : "added", name: v.name, locationId: id, file: p, total: f.accounts.length },
    `yes — "${v.name}".\n\n${updated ? "Updated" : "Added"} "${v.name}".\n${p} now holds ${f.accounts.length} sub-account(s).\n\n` +
    `Point an MCP client at it with:\n\n  claude mcp add ghl -e GHL_ACCOUNTS_FILE="${p}" -- npx -y @uxieee/ghl-mcp\n`);
}

function list(asJson = false): void {
  const p = filePath();
  const f = load(p);
  if (asJson) {
    console.log(JSON.stringify({ ok: true, file: p, count: f.accounts.length,
      accounts: f.accounts.map((a) => ({ id: a.id, name: a.name, isDefault: a.id === f.default })) }));
    return;   // tokens are never included
  }
  if (!f.accounts.length) { console.log(`\nNo sub-accounts configured in ${p}.\nRun: ghl-mcp accounts add\n`); return; }
  console.log(`\n${f.accounts.length} sub-account(s) in ${p}:\n`);
  for (const a of f.accounts) {
    console.log(`  ${a.name}${a.id === f.default ? "  (default)" : ""}`);
    console.log(`    ${a.id}\n`);           // tokens are never printed
  }
}

function remove(which: string): void {
  const p = filePath();
  const f = load(p);
  const before = f.accounts.length;
  f.accounts = f.accounts.filter((a) => a.id !== which && a.name !== which);
  if (f.accounts.length === before) { console.error(`\nNo account matched "${which}".\n`); process.exit(1); }
  if (f.default && !f.accounts.some((a) => a.id === f.default)) f.default = f.accounts[0]?.id;
  save(p, f);
  console.log(`\nRemoved. ${f.accounts.length} sub-account(s) remain.\n`);
}

/**
 * Say what is configured and what is missing, in the order it has to be fixed.
 *
 * This is the command an agent should run first. It cannot fetch a token or a location id —
 * both live behind a browser login — so its job is to work out exactly what is missing and
 * hand back precise instructions for the person to follow.
 */
async function doctor(asJson: boolean): Promise<void> {
  const p = filePath();
  const singleToken = process.env.GHL_API_TOKEN || "";
  const exists = existsSync(p);
  const f = exists ? load(p) : { accounts: [] as Account[] };
  const allowed = (process.env.GHL_ALLOWED_LOCATIONS || "").split(",").map((x) => x.trim()).filter(Boolean);

  const checks: Array<{ name: string; ok: boolean; detail: string }> = [];
  checks.push({ name: "node", ok: true, detail: process.version });

  const mode = f.accounts.length ? "multi" : singleToken ? "single" : "unconfigured";
  checks.push({
    name: "mode", ok: mode !== "unconfigured",
    detail: mode === "multi" ? `accounts file with ${f.accounts.length} sub-account(s)`
          : mode === "single" ? "GHL_API_TOKEN set (one sub-account)"
          : "nothing configured",
  });

  // Prove each configured token still reaches its sub-account, rather than assuming.
  const live: Array<{ name: string; id: string; ok: boolean; why?: string }> = [];
  for (const a of f.accounts) {
    const v = await verify(a.token, a.id);
    live.push(v.ok ? { name: v.name, id: a.id, ok: true } : { name: a.name, id: a.id, ok: false, why: v.why });
  }
  const dead = live.filter((l) => !l.ok);
  if (f.accounts.length) {
    checks.push({ name: "tokens", ok: dead.length === 0,
      detail: dead.length ? `${dead.length} of ${live.length} cannot reach their sub-account` : `all ${live.length} verified against GHL` });
  }
  const unknownAllowed = allowed.filter((id) => !f.accounts.some((a) => a.id === id));
  if (allowed.length) {
    checks.push({ name: "scope", ok: unknownAllowed.length === 0,
      detail: unknownAllowed.length ? `GHL_ALLOWED_LOCATIONS names ${unknownAllowed.join(", ")}, absent from the accounts file`
                                    : `scoped to ${allowed.length} of ${f.accounts.length}` });
  }

  const nextSteps: string[] = [];
  if (mode === "unconfigured") {
    nextSteps.push("Ask the person for a Private Integration Token: in GoHighLevel, open the sub-account, Settings > Private Integrations > Create, tick the scopes needed, copy the pit-… value.");
    nextSteps.push("Ask for that sub-account's location id: it is the long id in the browser URL while they are in it — app.gohighlevel.com/v2/location/<THIS>/dashboard");
    nextSteps.push("Then run: ghl-mcp accounts add --token <pit-…> --location <id> --json");
    nextSteps.push("For a single sub-account with no file, set GHL_API_TOKEN instead.");
  }
  for (const d of dead) {
    nextSteps.push(`"${d.name}" (${d.id}): ${d.why}. Re-add it with a current token, or remove it: ghl-mcp accounts remove ${d.id}`);
  }
  for (const id of unknownAllowed) {
    nextSteps.push(`GHL_ALLOWED_LOCATIONS lists ${id}, which is not in the accounts file — add it or drop it from the scope, or the server will refuse to start.`);
  }

  if (asJson) {
    console.log(JSON.stringify({ ok: checks.every((c) => c.ok), mode, file: p, fileExists: exists, checks, accounts: live, nextSteps }, null, 2));
    return;
  }
  console.log(`\nghl-mcp doctor\n`);
  for (const c of checks) console.log(`  ${c.ok ? "ok  " : "FAIL"}  ${c.name.padEnd(8)} ${c.detail}`);
  if (live.length) {
    console.log("\n  sub-accounts:");
    for (const l of live) console.log(`    ${l.ok ? "ok  " : "FAIL"}  ${l.name}  ${l.ok ? "" : "— " + l.why}`);
  }
  if (nextSteps.length) { console.log("\n  next:"); nextSteps.forEach((n, i) => console.log(`    ${i + 1}. ${n}`)); }
  console.log();
}

const argv = process.argv.slice(2);
const [cmd, sub, arg] = argv;

if (cmd === "accounts") {
  if (sub === "add") await add(argv.slice(2));
  else if (sub === "list") list(parseFlags(argv).json === true);
  else if (sub === "remove" && arg) remove(arg);
  else {
    console.log("\nUsage:");
    console.log("  ghl-mcp accounts add --token pit-… --location <id> [--json]");
    console.log("  ghl-mcp accounts add                 (interactive, for a person)");
    console.log("  ghl-mcp accounts list [--json]");
    console.log("  ghl-mcp accounts remove <id|name>\n");
    process.exit(1);
  }
} else if (cmd === "doctor") {
  await doctor(parseFlags(argv).json === true);
} else if (cmd === "--help" || cmd === "-h") {
  console.log("\nghl-mcp — GoHighLevel public API over MCP\n");
  console.log("  ghl-mcp                        run the server over stdio");
  console.log("  ghl-mcp doctor [--json]        check the setup and say what is missing");
  console.log("  ghl-mcp accounts add …         add a sub-account (verified before writing)");
  console.log("  ghl-mcp accounts list [--json] list configured sub-accounts");
  console.log("  ghl-mcp accounts remove <id>   remove one\n");
  console.log("Setting this up with an AI agent? Start with: ghl-mcp doctor --json\n");
  console.log("Single sub-account instead? Set GHL_API_TOKEN and skip the accounts file.\n");
} else {
  await import("./stdio.js");
}
