/**
 * Which confirmation gates a catalogue rebuild changed (W3, 2026-10-29). risk.ts gates partly on description words, so
 * new descriptions can quietly ungate a write. Lists:
 *   weakened  — an id in both catalogues whose gate went from required to not, or lost a risk kind
 *   newWrites — every id only in the new catalogue that writes (non-GET) without asking for confirmation
 * Each line needs a ruling: a risk.ts rule with a test, or a written reason it stands.
 *
 *   npx tsx scripts/gate-diff.ts [old-catalog.json]   (default: main's data/catalog.json via git)
 */
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { inferActionRisk } from "../src/risk.js";
import { applyCatalogOverrides } from "../src/catalog-overrides.js";
import type { Catalog } from "../src/types.js";

export interface GateDiff {
  weakened: { id: string; from: string[]; to: string[]; wasGated: boolean; isGated: boolean }[];
  newWrites: { id: string; method: string; path: string; summary: string }[];
}

export function gateDiff(oldCat: Catalog, newCat: Catalog): GateDiff {
  const before = new Map(oldCat.actions.map((a) => [a.id, inferActionRisk(a, oldCat.actions)]));
  const out: GateDiff = { weakened: [], newWrites: [] };
  for (const a of newCat.actions) {
    const now = inferActionRisk(a, newCat.actions);
    const was = before.get(a.id);
    if (!was) {
      if (a.method !== "GET" && !now.requiresConfirmation) out.newWrites.push({ id: a.id, method: a.method, path: a.path, summary: a.summary });
      continue;
    }
    const lost = was.kinds.filter((k) => !now.kinds.includes(k));
    if ((was.requiresConfirmation && !now.requiresConfirmation) || lost.length) {
      out.weakened.push({ id: a.id, from: was.kinds, to: now.kinds, wasGated: was.requiresConfirmation, isGated: now.requiresConfirmation });
    }
  }
  return out;
}

const isMain = process.argv[1] ? import.meta.url === new URL(process.argv[1], "file:").href : false;
if (isMain) {
  const root = fileURLToPath(new URL("..", import.meta.url));
  const oldRaw = process.argv[2] ? readFileSync(process.argv[2], "utf8")
    : execFileSync("git", ["-C", root, "show", "main:data/catalog.json"], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  const oldCat = applyCatalogOverrides(JSON.parse(oldRaw));
  const newCat = applyCatalogOverrides(JSON.parse(readFileSync(new URL("../data/catalog.json", import.meta.url), "utf8")));
  const d = gateDiff(oldCat, newCat);
  console.log(`weakened: ${d.weakened.length}`);
  for (const w of d.weakened) console.log(`  ${w.id}  gated ${w.wasGated}→${w.isGated}  kinds ${w.from.join(",")} → ${w.to.join(",")}`);
  console.log(`new ungated writes: ${d.newWrites.length}`);
  for (const w of d.newWrites) console.log(`  ${w.method.padEnd(6)} ${w.path}  ${w.id}  — ${w.summary}`);
}
