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
import { readFileSync, statSync, existsSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { tmpdir, homedir } from "node:os";
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
  // rel-10 (2026-11-07): the GROM Sandbox LOCATION ID. Its account name may appear; this id may not. Hashed like the others.
  "2bdf35474a3ff3aa9018f37b6eefc8aec29897936b9ed54e9c5e9e86a02342e4",
  // rel-10 fix 2: the real ids QA's sweep found in the plugin, held by hash only (the same seven as the plugin gate).
  "227c416a100538ce1ef7a898cc1c665c081c1dcc5d725d05f6f6dc91e2258aec",
  "a7727880496782a29a047b9b03057b058a50a384da2deac1fa9235c6d3b608f5",
  "e182f7788601bf23696d15f60a0bcc8cc31b6617aa842b6461468543e46d90e2",
  "cb0f98c9a93d70901b42a8c7dca6fa2d55ab690623e77c1f8850e64f732d0d44",
  "a8c6cbd67b874b266733b0e37ed52829b19fe2adc5dd73252a1c55351539f50b",
  "615428735bf121f168cfdad2a8fb98ceea94e4a16708983a1fb089aec96d4529",
  "485965590c06848bbe1ec104a68845463379c5622ebee720740a84d7a87bf64f",
  "39532233b759cb1a688db2e1e4790eb0a9433963e3448e6c6b217aacdc5f53fc",
  "795a1261bc237a0c70db66386577dec1652cd3c7a93195f1863b3f1136c8cf70",
  "675ca3122d74acaa4039ca936085e1d2813dd63782010b2cc4302aedf7ce2497",
  "37180eb56e77d2ae7a489d4e5c6fd6dbb66584fcb642ebfe45c5f0d9bc2954d2",
  "730a8aa1915a7e0f0fead4ebad9a41c5173166c9a0c39a9ff4be828ce62850aa",
  "85e32da5960981d5f97ae6766aae331f0bb6c4ea3ceae5ec72b0f54a4aae4417",
  "7cf3b2ca244915d1525f20e43780b30ae3cab2aec0e30b7c6c7f6a14e75a7a91",
  "3359f7ad911127e59d840410c86bcfaaa8182d79d856921666b92a1a6dc97728",
  "7d0ed087c381932c392ceb5762e6042e01b7b248428fc6d94f11ef8069beb642",
  "a296fc956175b1cf2d5555fd7ff51a1cf0ca523709dc4ff2ee6b38de01149b59",
  "ec767b583e5ad935c3cf90e7a6987209a32364e6df639e63ed645bf10de034c6",
]);
// Extra deny hashes for a run (rel-10 fix): PRIVACY_EXTRA_DENY_HASHES=<sha256>,<sha256> adds to BRAND_HASHES for that run.
// It can only add refusals. The tests use it to prove the gate bites on a SYNTHETIC id by its hash.
for (const h of (process.env.PRIVACY_EXTRA_DENY_HASHES ?? "").split(",").map((s) => s.trim()).filter(Boolean)) {
  if (/^[0-9a-f]{64}$/.test(h)) BRAND_HASHES.add(h);
}
// Same normalisation as the knowledge corpus's check-privacy.mjs, so a hash computed by
// `node scripts/check-privacy.mjs --hash "Name"` over there can be pasted straight in here.
const norm = (x) => x.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const sha = (x) => createHash("sha256").update(norm(x)).digest("hex");

function brandHits(line) {
  const words = norm(line).split(" ").filter(Boolean);
  const found = [];
  // A listed id is matched as a whole token too: a UUID normalises to five words, beyond the 1-3 word grams below.
  for (const tok of line.match(/[A-Za-z0-9-]{20,36}/g) ?? []) {
    if (BRAND_HASHES.has(sha(tok))) found.push(tok);
  }
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

// Tracked AND new-but-not-ignored files (rel-10): tracked-only let a fresh untracked file with a real id pass the gate
// unseen, the same hole the plugin gate closed on 2026-09-08.
// ── Structural rule (rel-10b, 2026-11-07): the id cross-check ───────────────────────────────────
// A hash list only catches the ids someone has already found. When knowledge/ sits beside this checkout, every
// random-looking id in these files (a 20-character mixed-case token, or a UUID) is also checked against ALL of knowledge's
// captured data (sniffs/ and samples/, any date). A token knowledge lists in scripts/privacy-vendor-ids.json is a vendor
// value and is exempt. A cold scan takes minutes, so the result is cached in the OS temp directory, keyed by knowledge's
// HEAD, its uncommitted captures and the candidate set. The cache holds hashes only. Without knowledge/ beside the checkout
// the check is skipped, and the gate says so.
const KNOWLEDGE_DIR = fileURLToPath(new URL('../../knowledge/', import.meta.url));
const ID_SHAPE = /(?<![A-Za-z0-9-])([A-Za-z0-9-]{20,36})(?![A-Za-z0-9-])/g;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isRandomId = (t) => UUID_RE.test(t)
  || (t.length === 20 && /^[A-Za-z0-9]+$/.test(t) && /\d/.test(t) && /[A-Z]/.test(t) && /[a-z]/.test(t))
  // GHL's Mongo-style ids (products, prices, schema docs) are 24 hex characters (rel-10b, QA finding).
  || /^[0-9a-f]{24}$/i.test(t);
const sha256raw = (s) => createHash('sha256').update(s).digest('hex');

function knowledgeVendorIds() {
  const f = join(KNOWLEDGE_DIR, 'scripts', 'privacy-vendor-ids.json');
  return existsSync(f) ? new Set(Object.keys(JSON.parse(readFileSync(f, 'utf8')).ids ?? {})) : new Set();
}

// Returns the sha256 of each candidate (lowercased) that knowledge's data contains, or null when knowledge/ is not present.
// rel-10b: the search is an INDEX of every random-looking token in every file on disk under sniffs/ and samples/ (tracked,
// untracked or ignored alike), built once and cached in a private directory. The cache key is HEAD plus each file's path,
// size and mtime, so an edited, added or removed capture rebuilds the index. The index holds hashes only.
function knowledgeIdHashes(cands) {
  const roots = ['sniffs', 'samples'].map((d) => join(KNOWLEDGE_DIR, d)).filter((d) => existsSync(d));
  if (!roots.length) return null;
  const vendor = knowledgeVendorIds();
  const checkable = [...cands.keys()].filter((t) => !vendor.has(t));
  if (!checkable.length) return new Set();
  const files = [];
  for (const r of roots) {
    for (const rel of readdirSync(r, { recursive: true })) {
      const abs = join(r, rel);
      const st = statSync(abs);
      if (st.isFile()) files.push({ abs, fp: `${abs.slice(KNOWLEDGE_DIR.length)}\0${st.size}\0${st.mtimeMs}` });
    }
  }
  const head = execFileSync('git', ['-C', KNOWLEDGE_DIR, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  const key = sha256raw(`${head}\n${files.map((f) => f.fp).sort().join('\n')}`);
  const cacheDir = join(homedir(), '.cache', 'ghl-privacy-gate');
  const cacheFile = join(cacheDir, `index-${key.slice(0, 40)}.json`);
  let index = null;
  try {
    if (existsSync(cacheFile)) index = new Set(JSON.parse(readFileSync(cacheFile, 'utf8')).tokens);
  } catch { /* unreadable cache: rebuild */ }
  if (!index) {
    index = new Set();
    for (const f of files) {
      let text;
      try { text = readFileSync(f.abs, 'utf8'); } catch { continue; }
      for (const m of text.matchAll(ID_SHAPE)) if (isRandomId(m[1])) index.add(sha256raw(m[1].toLowerCase()));
    }
    try {
      mkdirSync(cacheDir, { recursive: true, mode: 0o700 });
      writeFileSync(cacheFile, JSON.stringify({ tokens: [...index] }), { mode: 0o600 });
    } catch { /* the cache is an optimisation; a failed write costs time, not correctness */ }
  }
  return new Set(checkable.map((t) => sha256raw(t.toLowerCase())).filter((h) => index.has(h)));
}

const files = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard"], { encoding: "utf8" }).split("\n").filter(Boolean);
const hits = [];
const idCands = new Map();   // token -> [{file,line}] for random-looking ids (the cross-check below)

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
    for (const m of line.matchAll(ID_SHAPE)) {
      if (!isRandomId(m[1])) continue;
      if (!idCands.has(m[1])) idCands.set(m[1], []);
      idCands.get(m[1]).push({ file: f, line: i + 1 });
    }
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

const knownIdHashes = knowledgeIdHashes(idCands);
if (knownIdHashes === null) {
  console.log(`knowledge/ is not beside this checkout; the id cross-check was skipped (${idCands.size} candidate ids)`);
} else {
  for (const [tok, locs] of idCands) {
    if (knownIdHashes.has(sha256raw(tok.toLowerCase()))) for (const l of locs) hits.push({ f: l.file, line: l.line, what: "id present in knowledge data", val: "(value not printed)" });
  }
}

if (hits.length) {
  console.error(`\n🚨 ${hits.length} thing(s) that must not be in a public repo:\n`);
  // Masked (rel-10b): a refusal names the file, the line and the kind of rule, never the matched value.
  for (const h of hits) console.error(`   ${h.f}:${h.line}  ${h.what}`);
  console.error(`\nReplace with a placeholder. Nothing was published.\n`);
  process.exit(1);
}
console.log(`✅ no client data or credentials in ${files.length} tracked files` +
            (ids.length ? ` (checked against ${ids.length} known sub-accounts)` : " (no local accounts file to check against)"));
