#!/usr/bin/env node
/**
 * `ghl-mcp` — the published entry point.
 *
 *   ghl-mcp                     run the MCP server over stdio (what .mcp.json invokes)
 *   ghl-mcp accounts add        add a sub-account, verifying the token before it is written
 *   ghl-mcp accounts list       show configured sub-accounts (never prints tokens)
 *   ghl-mcp accounts remove     remove one by id or name
 *   ghl-mcp scope <name>…       point this folder at a subset of them, resolved by name
 *
 * The `accounts` commands exist because the alternative is hand-editing JSON containing
 * credentials and 20-character opaque ids — where a mistyped id is not a syntax error but a
 * silent wrong-account write, which is the one failure this whole design is built to prevent.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, chmodSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { createInterface } from "node:readline/promises";
import { probeLocation, validateAccountsFile, type Account, type AccountsFile } from "./accounts.js";
import { stdin, stdout } from "node:process";

const DEFAULT_FILE = join(homedir(), ".ghl", "accounts.json");
const BASE = process.env.GHL_BASE_URL || "https://services.leadconnectorhq.com";


function filePath(): string {
  return process.env.GHL_ACCOUNTS_FILE || DEFAULT_FILE;
}
function load(p: string): AccountsFile {
  if (!existsSync(p)) return { accounts: [] };
  try {
    return JSON.parse(readFileSync(p, "utf8")) as AccountsFile;
  } catch (e) {
    console.error(`\n${p} is not valid JSON: ${(e as Error).message}`);
    console.error("Fix or delete it before adding accounts.\n");
    process.exit(1);
  }
}
function save(p: string, f: AccountsFile): void {
  // The server refuses to start on a malformed accounts file. Catching it here means the
  // mistake surfaces at the point it is made, not at the next session start.
  const problem = validateAccountsFile(f);
  if (problem) {
    console.error(`\nRefusing to write ${p}: ${problem}\n`);
    process.exit(1);
  }
  mkdirSync(dirname(p), { recursive: true });
  try { chmodSync(dirname(p), 0o700); } catch { /* pre-existing dir may not be ours */ }
  writeFileSync(p, JSON.stringify(f, null, 2));
  chmodSync(p, 0o600); // the file holds live credentials
}

/**
 * Ask GHL whether this pairing is real. Delegates to the one shared probe in accounts.ts so
 * the write path and the read path cannot disagree about what "verified" means.
 */
async function verify(token: string, locationId: string): Promise<{ ok: true; name: string } | { ok: false; why: string }> {
  const r = await probeLocation(token, locationId, BASE);
  return r.ok ? { ok: true, name: r.name } : { ok: false, why: r.why };
}

/**
 * Flags that never take a value. Without this list `scope --json "Acme Dental"` would read
 * "Acme Dental" as the value of --json and then scope the folder to nothing.
 */
const BOOLEAN_FLAGS = new Set(["json", "all", "list", "dev", "help"]);

function parseFlags(argv: string[]): Record<string, string | boolean> {
  const out: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (!BOOLEAN_FLAGS.has(key) && next && !next.startsWith("--")) { out[key] = next; i++; }
    else out[key] = true;
  }
  return out;
}

/** Everything that is not a flag or a flag's value — e.g. the account names given to `scope`. */
function positionals(argv: string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) { out.push(a); continue; }
    const next = argv[i + 1];
    if (!BOOLEAN_FLAGS.has(a.slice(2)) && next && !next.startsWith("--")) i++; // skip its value
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

/**
 * Point a folder at a subset of the configured sub-accounts.
 *
 * The whole point is that the caller names accounts, never ids. An agent setting up a client
 * folder knows the client by name; the location id is a 20-character opaque string it would
 * have to copy by hand, and copying it by hand is how a project ends up quietly pointed at
 * the wrong client. A typo at least fails loudly (the server refuses to start), but picking
 * the wrong real id fails silently forever — both ids are valid. Resolving by name removes
 * the chance to get it wrong rather than catching it afterwards.
 */
function scope(argv: string[]): void {
  const flags = parseFlags(argv);
  const json = Boolean(flags.json);
  const wanted = positionals(argv);
  const dir = typeof flags.dir === "string" ? flags.dir : process.cwd();
  const target = join(dir, ".mcp.json");
  const SERVER = typeof flags.server === "string" ? flags.server : "ghl";

  const p = filePath();
  const f = load(p);
  if (!f.accounts.length) {
    emit(json, false, {
      error: "no sub-accounts are configured yet",
      file: p,
      nextStep: "ghl-mcp accounts add --token pit-… --location <id> --json",
    }, `\nNo sub-accounts configured yet. Add one first:\n  ghl-mcp accounts add\n`);
    return;
  }

  // --list: report what this folder is currently scoped to, resolving ids back to names.
  if (flags.list) {
    const cur = readMcpJson(target);
    const env = (cur?.mcpServers?.[SERVER]?.env ?? {}) as Record<string, string>;
    const ids = (env.GHL_ALLOWED_LOCATIONS || "").split(",").map((x) => x.trim()).filter(Boolean);
    const named = ids.map((id) => ({ id, name: f.accounts.find((a) => a.id === id)?.name ?? "(not in the accounts file)" }));
    // `scopedTo` must never read "all accounts" for a folder that has no server at all —
    // an agent reading that field concludes the folder sees everything, when it sees nothing.
    const configured = Boolean(cur?.mcpServers?.[SERVER]);
    emit(json, true, { file: target, configured,
        scopedTo: !configured ? "none — no ghl server in this folder" : named.length ? named : "all accounts" },
      named.length
        ? `\n${target}\n${named.map((n) => `  - ${n.name}`).join("\n")}\n`
        : cur?.mcpServers?.[SERVER]
          ? `\n${target}\n  (no scope set — this folder sees all ${f.accounts.length} sub-accounts)\n`
          : `\n${target}\n  (no ${SERVER} server configured in this folder)\n`);
    return;
  }

  // Resolve each requested name to exactly one account, or refuse.
  const chosen: Account[] = [];
  if (flags.all) {
    chosen.push(...f.accounts);
  } else {
    if (!wanted.length) {
      emit(json, false, {
        error: "name at least one sub-account, or pass --all",
        available: f.accounts.map((a) => a.name),
        usage: 'ghl-mcp scope "Acme Dental" "Acme Med Spa" --json',
      }, `\nName at least one sub-account, or pass --all.\n\nConfigured:\n${f.accounts.map((a) => `  - ${a.name}`).join("\n")}\n`);
      return;
    }
    for (const w of wanted) {
      const needle = w.toLowerCase();
      const exact = f.accounts.filter((a) => a.name.toLowerCase() === needle || a.id === w);
      const matches = exact.length ? exact : f.accounts.filter((a) => a.name.toLowerCase().includes(needle));
      if (matches.length === 0) {
        emit(json, false, {
          error: `no sub-account matches "${w}"`,
          available: f.accounts.map((a) => a.name),
        }, `\nNo sub-account matches "${w}".\n\nConfigured:\n${f.accounts.map((a) => `  - ${a.name}`).join("\n")}\n`);
        return;
      }
      if (matches.length > 1) {
        emit(json, false, {
          error: `"${w}" matches ${matches.length} sub-accounts`,
          matches: matches.map((a) => a.name),
          hint: "use the full name so there is no doubt which client this folder points at",
        }, `\n"${w}" matches ${matches.length} sub-accounts:\n${matches.map((a) => `  - ${a.name}`).join("\n")}\n\nUse the full name.\n`);
        return;
      }
      if (!chosen.some((c) => c.id === matches[0].id)) chosen.push(matches[0]);
    }
  }

  // Merge rather than overwrite: a client folder may already have other MCP servers, and
  // silently dropping them would be a far worse bug than anything this command fixes.
  const existing = readMcpJson(target) ?? {};
  const servers = (existing.mcpServers ?? {}) as Record<string, unknown>;
  const preserved = Object.keys(servers).filter((k) => k !== SERVER);

  servers[SERVER] = {
    command: flags.dev ? "node" : "npx",
    args: flags.dev ? [process.argv[1]] : ["-y", "@uxieee/ghl-mcp"],
    env: {
      GHL_ACCOUNTS_FILE: p,
      ...(flags.all ? {} : { GHL_ALLOWED_LOCATIONS: chosen.map((a) => a.id).join(",") }),
    },
  };
  const created = !existsSync(target);
  writeFileSync(target, JSON.stringify({ ...existing, mcpServers: servers }, null, 2) + "\n");

  emit(json, true, {
    file: target, server: SERVER, created,
    scopedTo: flags.all ? "all" : chosen.map((a) => ({ name: a.name, id: a.id })),
    preserved,
  }, `\n${created ? "Created" : "Updated"} ${target}\n\n  This folder now sees:\n${
      (flags.all ? f.accounts : chosen).map((a) => `    - ${a.name}`).join("\n")
    }\n${preserved.length ? `\n  Left alone: ${preserved.join(", ")}\n` : ""}`);
}

function readMcpJson(pth: string): { mcpServers?: Record<string, { env?: Record<string, string> }> } | null {
  if (!existsSync(pth)) return null;
  try { return JSON.parse(readFileSync(pth, "utf8")); }
  catch (e) {
    console.error(`\n${pth} is not valid JSON: ${(e as Error).message}\nFix or remove it first.\n`);
    process.exit(1);
  }
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
} else if (cmd === "scope") {
  scope(argv.slice(1));
} else if (cmd === "doctor") {
  await doctor(parseFlags(argv).json === true);
} else if (cmd === "--help" || cmd === "-h") {
  console.log("\nghl-mcp — GoHighLevel public API over MCP\n");
  console.log("  ghl-mcp                        run the server over stdio");
  console.log("  ghl-mcp doctor [--json]        check the setup and say what is missing");
  console.log("  ghl-mcp accounts add …         add a sub-account (verified before writing)");
  console.log("  ghl-mcp accounts list [--json] list configured sub-accounts");
  console.log("  ghl-mcp accounts remove <id>   remove one");
  console.log("  ghl-mcp scope \"Acme Dental\"    point this folder at one client (by name)");
  console.log("  ghl-mcp scope --list           what this folder is scoped to\n");
  console.log("Setting this up with an AI agent? Start with: ghl-mcp doctor --json\n");
  console.log("Single sub-account instead? Set GHL_API_TOKEN and skip the accounts file.\n");
} else {
  await import("./stdio.js");
}
