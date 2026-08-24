/**
 * Multi sub-account support.
 *
 * A GoHighLevel Private Integration Token is hard-bound to ONE sub-account — proven: passing
 * another location's id returns 403 "The token does not have access to this location". GHL's
 * own MCP server only does multi-account over OAuth; its list_locations returns
 * "dependencies are not configured" for any PIT, agency-scoped or not.
 *
 * So multi-account here means holding N PITs and choosing one per call. Every request GHL
 * receives is byte-identical to a single-token connection, which is what makes this safe:
 * no privilege is gained that GHL had not already granted to that individual token.
 *
 * Secrets live in a FILE, not in the MCP client config. Claude Code writes header and env
 * values verbatim into ~/.claude.json, so a token map placed there would ship every PIT on
 * every request — including tools/list — and land them in a file people paste into bug
 * reports. A path is not a secret. This mirrors the sibling internal MCP's GHL_TOK_FILE.
 */

export interface Account {
  /** The GHL sub-account (location) id this token belongs to. */
  id: string;
  /** Human label, used by list_locations so the agent can offer a choice. */
  name: string;
  token: string;
}

export interface AccountsFile {
  accounts: Account[];
  /** Optional id used when the caller omits locationId and more than one account exists. */
  default?: string;
}

export type BindingState = "unverified" | "verified" | "mismatched";

export class AccountsRegistry {
  private readonly byId = new Map<string, Account>();
  private readonly defaultId?: string;
  /** locationId -> binding outcome. Process-lifetime only; no storage, no Durable Object. */
  private readonly binding = new Map<string, BindingState>();

  /**
   * @param allowed Optional per-project allowlist of location ids. One shared accounts file
   *   can then be scoped down per folder: a client project sees only that client, while your
   *   own workspace sees everything. This restores the isolation that per-project token files
   *   gave — an agent working in one client's folder cannot reach another's data — without
   *   going back to one registration per client.
   */
  constructor(file: AccountsFile, allowed?: string[]) {
    if (!Array.isArray(file.accounts) || file.accounts.length === 0) {
      throw new Error("accounts file must contain a non-empty `accounts` array");
    }
    const allowSet = allowed && allowed.length > 0 ? new Set(allowed) : null;
    if (allowSet) {
      const known = new Set(file.accounts.map((a) => a?.id));
      const unknown = [...allowSet].filter((id) => !known.has(id));
      if (unknown.length > 0) {
        // A typo here would silently narrow access instead of erroring, so fail loudly.
        throw new Error(
          `allowed locations not present in the accounts file: ${unknown.join(", ")}`
        );
      }
    }
    for (const [i, a] of file.accounts.entries()) {
      if (!a?.id || !a?.token) {
        throw new Error(`accounts[${i}] needs both an "id" and a "token"`);
      }
      if (!a.token.startsWith("pit-")) {
        // Fail at load, not with a mystery 401 an hour later.
        throw new Error(`accounts[${i}] ("${a.name || a.id}") token does not look like a PIT`);
      }
      if (this.byId.has(a.id)) {
        throw new Error(`accounts contains ${a.id} twice`);
      }
      if (allowSet && !allowSet.has(a.id)) continue; // scoped out for this project
      this.byId.set(a.id, { ...a, name: a.name || a.id });
    }
    if (this.byId.size === 0) {
      throw new Error("the allowed-locations filter excluded every configured account");
    }
    // A default that is scoped out for this project is simply not the default here.
    if (file.default && !this.byId.has(file.default)) {
      if (!allowSet) {
        throw new Error(`default "${file.default}" is not one of the configured accounts`);
      }
      this.defaultId = this.byId.size === 1 ? [...this.byId.keys()][0] : undefined;
    } else {
      this.defaultId = file.default;
    }
  }

  get size(): number {
    return this.byId.size;
  }

  list(): Array<{ id: string; name: string; binding: BindingState; isDefault: boolean }> {
    return [...this.byId.values()].map((a) => ({
      id: a.id,
      name: a.name,
      binding: this.binding.get(a.id) ?? "unverified",
      isDefault: a.id === this.defaultId || this.byId.size === 1,
    }));
  }

  /**
   * Choose an account. Never falls back to a different token than the one asked for —
   * an unknown id is an error, because silently using another client's token is the
   * failure this whole mechanism exists to prevent.
   */
  resolve(locationId?: string): Account {
    if (locationId) {
      const hit = this.byId.get(locationId);
      if (!hit) {
        throw new Error(
          `No token configured for location "${locationId}". Call list_locations to see the ${this.byId.size} configured sub-account(s). This server will not substitute another account's token.`
        );
      }
      return hit;
    }
    if (this.byId.size === 1) return [...this.byId.values()][0];
    if (this.defaultId) return this.byId.get(this.defaultId)!;
    throw new Error(
      `${this.byId.size} sub-accounts are configured, so locationId is required. Call list_locations to choose one.`
    );
  }

  getBinding(locationId: string): BindingState {
    return this.binding.get(locationId) ?? "unverified";
  }

  /**
   * Assert the configured token really can reach the location it is filed under.
   *
   * Without this, a mis-keyed entry is silent for the ~407 actions that take no location
   * parameter at all: nothing is injected, nothing is checked, and the call succeeds against
   * whichever sub-account the token actually belongs to. The agent believes it wrote to
   * client A; it wrote to client B. GET /locations/{id} answers 200 for a token's own
   * location and 403 ("The token does not have access to this location") for any other.
   */
  async verify(locationId: string, baseUrl: string, fetchImpl: typeof fetch = fetch): Promise<BindingState> {
    const cached = this.binding.get(locationId);
    if (cached && cached !== "unverified") return cached;

    const account = this.byId.get(locationId);
    if (!account) return "mismatched";

    try {
      const res = await fetchImpl(`${baseUrl}/locations/${locationId}`, {
        headers: {
          Authorization: `Bearer ${account.token}`,
          Version: "2021-07-28",
          Accept: "application/json",
        },
      });
      const state: BindingState = res.ok ? "verified" : "mismatched";
      this.binding.set(locationId, state);
      return state;
    } catch {
      // A network failure is not proof of a bad binding; stay unverified and retry later.
      return "unverified";
    }
  }
}

export function parseAccountsFile(raw: string, allowed?: string[]): AccountsRegistry {
  let parsed: AccountsFile;
  try {
    parsed = JSON.parse(raw) as AccountsFile;
  } catch (err) {
    throw new Error(`accounts file is not valid JSON: ${(err as Error).message}`);
  }
  return new AccountsRegistry(parsed, allowed);
}
