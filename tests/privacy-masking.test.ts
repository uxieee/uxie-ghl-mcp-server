// rel-10b (QA finding): a refusal must never print the value it refused. This drives each path that carries a real value in
// the gate's hit list, using SYNTHETIC stand-ins: the location id and the client name that the gate reads from an accounts
// file (GHL_ACCOUNTS_FILE), and a token of a SHAPES form (its first ten characters must not be printed either).
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const GATE = fileURLToPath(new URL("../scripts/check-no-secrets.mjs", import.meta.url));
const SYN_LOC = "Lq7TestLoc0000000009";          // synthetic location id, in the accounts file
const SYN_NAME = "Synthetic Test Account";       // synthetic client name, in the accounts file
// Assembled from parts on separate lines: the gate matches token shapes per file, and a joined literal would be refused.
const SYN_TOKEN = [
  "pit-Zq9Xr7",
  "Lm2Kd8Vb3N",
].join("");   // synthetic Private Integration Token shape

// Runs the gate in a throwaway git repo holding one file, with a synthetic accounts file. Returns the refusal text, or ""
// when the gate passes.
const gateStderr = (name: string, content: string): string => {
  const dir = mkdtempSync(join(tmpdir(), "secrets-masking-"));
  const accounts = join(dir, "accounts.json");
  writeFileSync(accounts, JSON.stringify([{ id: SYN_LOC, name: SYN_NAME, token: "x" }]));
  execFileSync("git", ["init", "-q", dir]);
  writeFileSync(join(dir, name), content);
  try {
    execFileSync("node", [GATE], { cwd: dir, encoding: "utf8", stdio: "pipe", env: { ...process.env, GHL_ACCOUNTS_FILE: accounts } });
    return "";
  } catch (e: any) {
    return String(e.stderr ?? "") + String(e.stdout ?? "");
  }
};

test("the accounts-file location id path refuses and never prints the id", () => {
  const err = gateStderr("location.ts", `const r = { locationId: "${SYN_LOC}" };\n`);
  assert.match(err, /location\.ts:1/, "the refusal names the file and line");
  assert.ok(!err.includes(SYN_LOC), "the location id must not be printed");
});

test("the accounts-file client name path refuses and never prints the name", () => {
  const err = gateStderr("name.md", `Tested against ${SYN_NAME} last week.\n`);
  assert.match(err, /name\.md:1/, "the refusal names the file and line");
  assert.ok(!err.includes(SYN_NAME), "the client name must not be printed");
});

test("the token-shape path refuses and never prints the token or its first ten characters", () => {
  const err = gateStderr("token.ts", `const t = "${SYN_TOKEN}";\n`);
  assert.match(err, /token\.ts:1/, "the refusal names the file and line");
  assert.ok(!err.includes(SYN_TOKEN), "the token must not be printed");
  assert.ok(!err.includes(SYN_TOKEN.slice(0, 10)), "its first ten characters must not be printed");
});
