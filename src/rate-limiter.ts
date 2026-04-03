/**
 * Fixed-window rate limiter. O(1) time and space.
 * Shared between Workers and stdio entry points.
 */
export class RateLimiter {
  private windowStart = 0;
  private windowCount = 0;

  constructor(
    private readonly windowMs: number,
    private readonly maxCalls: number
  ) {}

  check(): boolean {
    const now = Date.now();
    if (now - this.windowStart >= this.windowMs) {
      this.windowStart = now;
      this.windowCount = 0;
    }
    if (this.windowCount >= this.maxCalls) return false;
    this.windowCount++;
    return true;
  }
}
