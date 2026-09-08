#!/usr/bin/env node
// Blocks a publish or a commit that would put real client data into this PUBLIC repo.
//
// It reads the machine's own ~/.ghl/accounts.json for the ids and names to look for, so the
// denylist is never itself checked in. A machine with no accounts file still gets the
// credential-shape checks.
//
// This exists because a real client's name reached README.md and was caught by hand. Hands miss.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
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

// Names that identify the operator or a client but are NOT literal sub-account names in
// accounts.json — so the id/name loop above can never see them. "GROM AU" and "GROM UK" reached
// this repo's multi-sub-account example, survived a cleanup commit that fixed the location ids
// sitting on the same two lines, and were pushed to the public remote. Stored as SHA-256, never
// plaintext: a public repo must not carry the list of names it screens for.
//
// 🔴 THIS REPO SCREENS THE GROM NAMES AND THE PLUGIN REPO DOES NOT. That is deliberate, it is
// not drift, and it should not be "fixed" in either direction without reading this first.
//   uxieee/uxie-ghl-factory names "GROM AU" 147 times on purpose — its documented policy is that
//   a repo may name the account it tests against, and its own gate passes clean with those
//   mentions present.
//   This repo has no such need. Nothing here tests against GROM; the names appeared once, in a
//   worked example, where "Acme AU" reads exactly as well. So the cheap rule holds: screen them.
// Two repos, two policies, one reason — the plugin has a use for the name and this one never did.
//
// The related history question was settled on 2026-09-08 and answered NO. See the note below.
// Matching is on whole normalised words (1-3 word n-grams, each also tested de-spaced), so
// "grommet" does not collide with "grom".
const BRAND_HASHES = new Set([
  "5aa3e52217564bfba44147cf4bfefcbf0f9b78a0520dd7a7a20408a5182ab41a",
  "0036d6860307ae3a04e7cfea875855c8ca542c6847b3469762d038b7e011ed28",
  "14030c7515ed32064d54afcd91c0707ae735fd029425cb4d60787dd8e33cced8",
  "86c8a7871284f9d010e102d4a3d1e4ed27effec6b371629ab042420d1ceb9ec7",
]);
// Same normalisation as the knowledge corpus's check-privacy.mjs, so a hash computed by
// `node scripts/check-privacy.mjs --hash "Name"` over there can be pasted straight in here.
const norm = (x) => x.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const sha = (x) => createHash("sha256").update(norm(x)).digest("hex");

function brandHits(line) {
  const words = norm(line).split(" ").filter(Boolean);
  const found = [];
  for (let n = 1; n <= 3; n++) {
    for (let i = 0; i + n <= words.length; i++) {
      const gram = words.slice(i, i + n).join(" ");
      for (const cand of new Set([gram, gram.replace(/ /g, "")])) {
        if (BRAND_HASHES.has(sha(cand))) found.push(gram);
      }
    }
  }
  return found;
}

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
  text.split(/\r?\n/).forEach((line, i) => {
    for (const _ of brandHits(line)) {
      hits.push({ f, line: i + 1, what: "brand / client identifier", val: "<redacted>" });
    }
  });
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
