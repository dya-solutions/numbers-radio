/**
 * A tiny in-memory rate limiter ("token bucket"). Each key (a visitor code, or
 * a network code) has a bucket that holds up to `capacity` events and refills
 * at `perSecond`. An event takes one token; with none left, it is refused.
 *
 * This is the FIRST line of defence and lives in one server instance's memory
 * (so a restart forgets it). The database repeats a per-visitor limit as the
 * second line, which every instance shares.
 */
export class RateLimiter {
  private buckets = new Map<string, { tokens: number; at: number }>();

  constructor(
    private capacity: number,
    private perSecond: number,
    private maxKeys = 20000,
  ) {}

  /** True if the event is allowed. `now` is in milliseconds. */
  allow(key: string, now = Date.now()): boolean {
    let bucket = this.buckets.get(key);
    if (!bucket) {
      if (this.buckets.size >= this.maxKeys) this.makeRoom(now);
      bucket = { tokens: this.capacity, at: now };
      this.buckets.set(key, bucket);
    } else {
      const refill = ((now - bucket.at) / 1000) * this.perSecond;
      bucket.tokens = Math.min(this.capacity, bucket.tokens + refill);
      bucket.at = now;
    }
    if (bucket.tokens < 1) return false;
    bucket.tokens -= 1;
    return true;
  }

  /** Drop buckets that have refilled completely (nobody is being limited); if still full, start over. */
  private makeRoom(now: number) {
    for (const [key, bucket] of this.buckets) {
      if (bucket.tokens + ((now - bucket.at) / 1000) * this.perSecond >= this.capacity) {
        this.buckets.delete(key);
      }
    }
    if (this.buckets.size >= this.maxKeys) this.buckets.clear();
  }

  get size() {
    return this.buckets.size;
  }
}
