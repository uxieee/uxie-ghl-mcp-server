#!/usr/bin/env node
// Blocks a publish or a commit that would put real client data into this PUBLIC repo.
//
// It reads the machine's own ~/.ghl/accounts.json for the ids and names to look for, so the
// denylist is never itself checked in. A machine with no accounts file still gets the
// credential-shape checks.
//
// This exists because a real client's name reached README.md and was caught by hand. Hands miss.
import { execFileSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const accountsFile = process.env.GHL_ACCOUNTS_FILE || join(homedir(), ".ghl", "accounts.json");
let ids = [], names = [];
try {
  const raw = JSON.parse(readFileSync(accountsFile, "utf8"));
  const rows = Array.isArray(raw) ? raw : (raw.accounts ?? []);
  ids = rows.map((r) => r.id).filter(Boolean);
  // Short names produce false positives against ordinary prose; a real business name is longer.
  names = rows.map((r) => r.name).filter((n) => typeof n === "string" && n.length > 4);
} catch { /* no accounts on this machine — shape checks still run */ }

// A credential's *shape*, not a specific value. Placeholders are exempt by pattern, not by
// listing them, so a new placeholder does not need a code change.
const PLACEHOLDER = /^(pit-)?(your|xxx|yyy|zzz|test|preview|fake|sample|example|dummy|\.\.\.|…|<)/i;
const SHAPES = [
  { label: "Private Integration Token", re: /pit-[A-Za-z0-9._-]{8,}/g },
  { label: "JWT", re: /\bey[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g },
  { label: "GHL API key", re: /\b[A-Za-z0-9]{40,}-[A-Za-z0-9]{6,}\b/g },
];

const files = execFileSync("git", ["ls-files"], { encoding: "utf8" }).split("\n").filter(Boolean);
const hits = [];

for (const f of files) {
  if (f.startsWith("scripts/check-no-secrets")) continue; // this file names the patterns
  let text;
  try {
    if (statSync(f).size > 8_000_000) continue;
    text = readFileSync(f, "utf8");
  } catch { continue; }

  const lineOf = (idx) => text.slice(0, idx).split("\n").length;

  for (const id of ids) {
    let i = text.indexOf(id);
    while (i !== -1) { hits.push({ f, line: lineOf(i), what: "real location id", val: id }); i = text.indexOf(id, i + 1); }
  }
  for (const n of names) {
    let i = text.indexOf(n);
    while (i !== -1) { hits.push({ f, line: lineOf(i), what: "real client name", val: n }); i = text.indexOf(n, i + 1); }
  }
  for (const { label, re } of SHAPES) {
    for (const m of text.matchAll(re)) {
      const v = m[0];
      if (PLACEHOLDER.test(v.replace(/^pit-/, "")) || PLACEHOLDER.test(v)) continue;
      hits.push({ f, line: lineOf(m.index), what: label, val: v.slice(0, 10) + "…" });
    }
  }
}

if (hits.length) {
  console.error(`\n🚨 ${hits.length} thing(s) that must not be in a public repo:\n`);
  for (const h of hits) console.error(`   ${h.f}:${h.line}  ${h.what}: ${h.val}`);
  console.error(`\nReplace with a placeholder. Nothing was published.\n`);
  process.exit(1);
}
console.log(`✅ no client data or credentials in ${files.length} tracked files` +
            (ids.length ? ` (checked against ${ids.length} known sub-accounts)` : " (no local accounts file to check against)"));
