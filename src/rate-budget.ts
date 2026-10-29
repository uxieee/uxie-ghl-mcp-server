/**
 * GHL's rate limits as GHL documents them (W3, 2026-10-29; marketplace.gohighlevel.com/docs/other/rate-limits):
 * 100 requests per 10 seconds and 200,000 per day, per app per resource (sub-account), reported on every response in
 *   X-RateLimit-Max, X-RateLimit-Remaining, X-RateLimit-Interval-Milliseconds (the window LENGTH, not time left),
 *   X-RateLimit-Limit-Daily, X-RateLimit-Daily-Remaining, and on workflow 429s X-RateLimit-Daily-Reset (ms to reset).
 * One budget per key — the selected account, or "single" — so one sub-account's empty window never holds back another.
 * Replaces the process-wide 60-per-minute limiter the npm server shared across every account.
 */
export type BudgetDecision = { action: "go" } | { action: "wait"; ms: number } | { action: "refuse"; resetMs: number | null };
export interface RateLimitInfo { remaining: number | null; max: number | null; dailyRemaining: number | null; dailyResetMs: number | null }

interface KeyState {
  calls: number[];                 // client-side timestamps inside the last window
  remaining: number | null; max: number | null; intervalMs: number | null; observedAt: number;
  dailyRemaining: number | null; dailyResetMs: number | null; dailyObservedAt: number;
}

const num = (v: string | null) => (v == null || v === "" || Number.isNaN(Number(v)) ? null : Number(v));

export class RateBudget {
  private readonly now: () => number;
  private readonly maxPerWindow: number;
  private readonly windowMs: number;
  private readonly keys = new Map<string, KeyState>();

  constructor({ now = Date.now, maxPerWindow = 100, windowMs = 10_000 }: { now?: () => number; maxPerWindow?: number; windowMs?: number } = {}) {
    this.now = now; this.maxPerWindow = maxPerWindow; this.windowMs = windowMs;
  }

  private state(key: string): KeyState {
    let s = this.keys.get(key);
    if (!s) { s = { calls: [], remaining: null, max: null, intervalMs: null, observedAt: 0, dailyRemaining: null, dailyResetMs: null, dailyObservedAt: 0 }; this.keys.set(key, s); }
    return s;
  }

  /** What to do before sending: go, wait (ms, at most one window), or refuse (daily quota spent). */
  before(key: string): BudgetDecision {
    const s = this.state(key); const t = this.now();
    if (s.dailyRemaining === 0) {
      const left = s.dailyResetMs == null ? null : s.dailyResetMs - (t - s.dailyObservedAt);
      if (left == null || left > 0) return { action: "refuse", resetMs: left };
      s.dailyRemaining = null;
    }
    let wait = 0;
    const interval = s.intervalMs ?? this.windowMs;
    if (s.remaining === 0) wait = Math.max(wait, interval - (t - s.observedAt));
    s.calls = s.calls.filter((c) => t - c < this.windowMs);
    if (s.calls.length >= this.maxPerWindow) wait = Math.max(wait, this.windowMs - (t - s.calls[0]));
    return wait > 0 ? { action: "wait", ms: Math.min(wait, this.windowMs) } : { action: "go" };
  }

  /** Record that a request is being sent now. */
  sent(key: string): void { this.state(key).calls.push(this.now()); }

  /** Read GHL's headers off a response. */
  observe(key: string, headers: Headers): void {
    const s = this.state(key); const t = this.now();
    const rem = num(headers.get("x-ratelimit-remaining"));
    if (rem != null) { s.remaining = rem; s.observedAt = t; }
    s.max = num(headers.get("x-ratelimit-max")) ?? s.max;
    s.intervalMs = num(headers.get("x-ratelimit-interval-milliseconds")) ?? s.intervalMs;
    const dr = num(headers.get("x-ratelimit-daily-remaining"));
    if (dr != null) { s.dailyRemaining = dr; s.dailyObservedAt = t; }
    const reset = num(headers.get("x-ratelimit-daily-reset"));
    if (reset != null) s.dailyResetMs = reset;
  }

  /** The last-seen limits, for a result that runs low or hit a 429. */
  info(key: string): RateLimitInfo {
    const s = this.state(key);
    const left = s.dailyResetMs == null ? null : Math.max(0, s.dailyResetMs - (this.now() - s.dailyObservedAt));
    return { remaining: s.remaining, max: s.max, dailyRemaining: s.dailyRemaining, dailyResetMs: left };
  }

  /** Remaining under 10% of the window, or the daily quota under 10% of 200,000. */
  isLow(key: string): boolean {
    const s = this.state(key);
    return (s.remaining != null && s.max != null && s.remaining < s.max * 0.1) || (s.dailyRemaining != null && s.dailyRemaining < 20_000);
  }
}
