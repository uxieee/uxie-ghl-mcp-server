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

async function add(): Promise<void> {
  const p = filePath();
  const f = load(p);
  const rl = createInterface({ input: stdin, output: stdout });
  console.log(`\nAdding a GoHighLevel sub-account to ${p}\n`);
  console.log("You need two things from the sub-account:");
  console.log("  1. a Private Integration Token — Settings > Private Integrations > Create");
  console.log("  2. its location id — the long string in the browser URL while you are in");
  console.log("     that sub-account: app.gohighlevel.com/v2/location/<THIS>/dashboard\n");
  const token = (await rl.question("Private Integration Token (pit-…): ")).trim();
  const id = (await rl.question("Location id: ")).trim();
  rl.close();

  if (!token.startsWith("pit-")) {
    console.error("\nThat does not look like a Private Integration Token (they start with 'pit-').\n");
    process.exit(1);
  }
  process.stdout.write("\nChecking the token really reaches that sub-account… ");
  const v = await verify(token, id);
  if (!v.ok) {
    console.error(`no.\n\n  ${v.why}\n\nNothing was written.\n`);
    process.exit(1);
  }
  console.log(`yes — "${v.name}".\n`);

  const existing = f.accounts.findIndex((a) => a.id === id);
  const entry: Account = { id, name: v.name, token };
  if (existing >= 0) { f.accounts[existing] = entry; console.log(`Updated the existing entry for "${v.name}".`); }
  else { f.accounts.push(entry); console.log(`Added "${v.name}".`); }
  if (!f.default) f.default = id;
  save(p, f);
  console.log(`\n${p} now holds ${f.accounts.length} sub-account(s).`);
  console.log("Point an MCP client at it with:\n");
  console.log(`  claude mcp add ghl -e GHL_ACCOUNTS_FILE="${p}" -- npx -y @uxieee/ghl-mcp\n`);
}

function list(): void {
  const p = filePath();
  const f = load(p);
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

const [cmd, sub, arg] = process.argv.slice(2);
if (cmd === "accounts") {
  if (sub === "add") await add();
  else if (sub === "list") list();
  else if (sub === "remove" && arg) remove(arg);
  else {
    console.log("\nUsage:\n  ghl-mcp accounts add\n  ghl-mcp accounts list\n  ghl-mcp accounts remove <id|name>\n");
    process.exit(1);
  }
} else if (cmd === "--help" || cmd === "-h") {
  console.log("\nghl-mcp — GoHighLevel public API over MCP\n");
  console.log("  ghl-mcp                        run the server over stdio");
  console.log("  ghl-mcp accounts add           add a sub-account (verified before writing)");
  console.log("  ghl-mcp accounts list          list configured sub-accounts");
  console.log("  ghl-mcp accounts remove <id>   remove one\n");
  console.log("Single sub-account instead? Set GHL_API_TOKEN and skip the accounts file.\n");
} else {
  await import("./stdio.js");   // no subcommand: be the MCP server
}
