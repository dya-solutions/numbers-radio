import { createHmac } from "node:crypto";

/**
 * Anonymous visitor codes. SERVER ONLY.
 *
 * A visitor code is a one-way hash of (IP address + browser details), mixed
 * with a SECRET SALT that changes every day (at midnight Gulf Standard Time).
 *   - The IP address itself is never stored anywhere - only this hash.
 *   - Because the salt changes daily, the same person gets a different code
 *     tomorrow, so visitors can be counted for one day but not followed
 *     from day to day. Yesterday's codes can't be linked to today's.
 *   - Nobody can work the hash backwards (or guess it) without the secret.
 */

/** The day the salt belongs to, in Gulf Standard Time (UTC+4): "2026-11-12". */
export function gstDay(now: Date): string {
  return new Date(now.getTime() + 4 * 3600 * 1000).toISOString().slice(0, 10);
}

/**
 * The secret behind the daily salt. Set ANALYTICS_SECRET (16+ characters) to
 * use your own; otherwise one is derived from the Supabase service key, which
 * is just as private and needs no setup. Returns null if neither exists.
 */
export function analyticsSecret(): string | null {
  const own = (process.env.ANALYTICS_SECRET ?? "").trim();
  if (own.length >= 16) return own;
  const service = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();
  if (service) {
    return createHmac("sha256", service).update("numbers-radio-analytics-fallback-v1").digest("hex");
  }
  return null;
}

/** Today's salt. Different every GST day, and unguessable without the secret. */
export function daySalt(secret: string, now: Date): Buffer {
  return createHmac("sha256", secret)
    .update("numbers-radio-analytics-day|" + gstDay(now))
    .digest();
}

/** The anonymous code for one visitor on one day (32 hex characters). */
export function visitorId(salt: Buffer, ip: string, userAgent: string, language: string): string {
  return createHmac("sha256", salt)
    .update(`${ip}\n${userAgent}\n${language}`)
    .digest("hex")
    .slice(0, 32);
}

/**
 * A short code for the IP address alone. Used ONLY in memory, to slow down
 * floods from one network; it is never written to the database or any log.
 */
export function networkKey(salt: Buffer, ip: string): string {
  return createHmac("sha256", salt).update(`net|${ip}`).digest("hex").slice(0, 24);
}
