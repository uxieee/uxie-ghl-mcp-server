// 2026-11-08 (post-push review of 209c828): `wallet-v3__add-complimentary-credits` moves credit into a sub-account, and its
// description names no billing word, so it was gated as a plain write. The gate follows the consequence (the wallet family),
// not the prose, the same way the ad-manager rule does.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { applyCatalogOverrides } from "../src/catalog-overrides.js";
import { inferActionRisk } from "../src/risk.js";
import type { Catalog, CatalogAction } from "../src/types.js";

const shipped = (): Catalog => applyCatalogOverrides(JSON.parse(readFileSync(new URL("../data/catalog.json", import.meta.url), "utf8")));

// The wallet families, by category and by path: wallet-v3, the SaaS operations that touch a wallet balance or its
// transactions, and any path with a /wallet/ segment.
const isWalletFamily = (a: CatalogAction): boolean =>
  /^wallet/.test(a.category) || (/^saas/.test(a.category) && /wallet/i.test(a.path)) || /\/wallet\//.test(a.path);

test("every non-GET wallet-family operation requires confirmation, whatever its wording", () => {
  const c = shipped();
  const family = c.actions.filter((a) => a.method.toUpperCase() !== "GET" && isWalletFamily(a));
  // Pinned, so a new wallet write is noticed here rather than gated silently. The three list reads are sent as POST and
  // are gated too: the rule is the family, and an exception would need its own reviewed ruling.
  assert.deepEqual(family.map((a) => a.id).sort(), [
    "saas-api__update-location-wallet-balance",
    "saas-v3__list-agency-wallet-transactions",
    "saas-v3__list-location-wallet-transactions",
    "saas-v3__update-location-wallet-balance",
    "saas-v3__updateLocationWalletBalance",
    "wallet-v3__add-complimentary-credits",
    "wallet-v3__list-wallet-transactions",
  ]);
  for (const a of family) {
    const risk = inferActionRisk(a, c.actions);
    assert.equal(risk.requiresConfirmation, true, `${a.id} (${a.method} ${a.path})`);
    assert.ok(risk.kinds.includes("billing"), `${a.id} is classed billing`);
  }
});

test("the complimentary-credit grant is gated by what it touches, not by its description", () => {
  const c = shipped();
  const op = c.actions.find((a) => a.id === "wallet-v3__add-complimentary-credits");
  assert.ok(op, "the operation is in the shipped catalogue");
  assert.doesNotMatch(`${op.summary} ${op.description}`, /payment|billing|charge|refund|invoice/i, "its prose names no billing word");
  const risk = inferActionRisk(op, c.actions);
  assert.equal(risk.requiresConfirmation, true);
  assert.ok(risk.kinds.includes("billing"));
});

test("a wallet read sent as GET still needs no confirmation", () => {
  const c = shipped();
  const read = c.actions.find((a) => a.id === "wallet-v3__get-wallet-balance");
  assert.ok(read, "the read is in the shipped catalogue");
  assert.equal(inferActionRisk(read, c.actions).requiresConfirmation, false);
});
