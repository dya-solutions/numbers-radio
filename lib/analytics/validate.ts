/**
 * Checks what the browser sends to /api/track. Anything unexpected is refused.
 * Pure functions with no imports, so they are easy to test.
 *
 * The browser sends one small JSON object per event:
 *   { t: "pv", path, ref?, ret, app, land, touch }   a page view
 *   { t: "pl", id, ph: "start"|"beat"|"end", s, rc, er }   the radio player
 *   { t: "dp", id, mode: "ai"|"device" }              devotion audio started
 *   { t: "df", id }                                   devotion audio finished
 *   { t: "ck", kind: "sermon"|"prayer", id }          a sermon / prayer link click
 *   { t: "in", app }                                  the app was installed
 * (Form submissions are counted by the server itself, not sent by the browser.)
 */

/** No event is anywhere near this big. Bigger requests are refused unread. */
export const MAX_BODY_BYTES = 1024;

export type TrackEvent =
  | {
      kind: "pageview";
      path: string;
      referrer: string | null;
      returning: boolean;
      app: boolean;
      landing: boolean;
      touch: boolean;
    }
  | {
      kind: "player";
      id: string;
      phase: "start" | "beat" | "end";
      seconds: number;
      reconnects: number;
      errors: number;
    }
  | { kind: "devotion_play"; id: string; mode: "ai" | "device" }
  | { kind: "devotion_finish"; id: string }
  | { kind: "click"; what: "sermon" | "prayer"; id: string }
  | { kind: "install"; app: boolean };

export type ParseResult =
  | { ok: true; event: TrackEvent }
  | { ok: false; reason: "invalid" | "ignored" };

const INVALID: ParseResult = { ok: false, reason: "invalid" };
const IGNORED: ParseResult = { ok: false, reason: "ignored" };

/** Paths that are never public pages. */
const PRIVATE_PREFIXES = ["/admin", "/api", "/_next"];

/** Letters, digits and a few safe characters only; the query string never gets in. */
const PATH_PATTERN = /^\/[a-z0-9\-._~%/]*$/;

/**
 * "/Sermons/?x=1" -> "/sermons". Returns null when it is not a usable path and
 * "ignored" for pages that must never be recorded (the admin area).
 */
export function normalizePath(input: unknown): string | null | "ignored" {
  if (typeof input !== "string" || input.length === 0 || input.length > 200) return null;
  let path = input.split("?")[0].split("#")[0].toLowerCase();
  if (!path.startsWith("/")) return null;
  if (path.length > 1) path = path.replace(/\/+$/, "") || "/";
  if (path.includes("..") || path.includes("//")) return null;
  for (const prefix of PRIVATE_PREFIXES) {
    if (path === prefix || path.startsWith(prefix + "/")) return "ignored";
  }
  if (!PATH_PATTERN.test(path)) return null;
  if (path.split("/").length > 6) return null; // at most 5 segments
  return path;
}

/** "https://www.Google.com/search?q=x" or "google.com" -> "google.com". Host only, never a path. */
export function cleanHost(input: unknown): string | null {
  if (typeof input !== "string") return null;
  let host = input.trim().toLowerCase();
  if (host.length === 0 || host.length > 100) return null;
  if (host.includes("/") || host.includes("?") || host.includes("@") || host.includes(" ")) return null;
  host = host.replace(/:\d+$/, "").replace(/^www\./, "");
  if (!/^[a-z0-9]([a-z0-9.-]{0,98}[a-z0-9])?$/.test(host)) return null;
  return host;
}

function bool(value: unknown): boolean {
  return value === 1 || value === true;
}

function integer(value: unknown, min: number, max: number): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const n = Math.floor(value);
  return n < min || n > max ? null : n;
}

const ID_PATTERN = /^[A-Za-z0-9-]{8,64}$/;
const UUID_PATTERN = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

/**
 * `ownHost` is this website's own host name (e.g. "numbers-radio.vercel.app"),
 * so a referrer that is just ourselves is not counted as an outside site.
 */
export function parseTrackBody(raw: string, ownHost = ""): ParseResult {
  if (raw.length === 0 || raw.length > MAX_BODY_BYTES) return INVALID;

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return INVALID;
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) return INVALID;
  const b = body as Record<string, unknown>;

  switch (b.t) {
    case "pv": {
      const path = normalizePath(b.path);
      if (path === "ignored") return IGNORED;
      if (path === null) return INVALID;

      let referrer: string | null = null;
      if (b.ref !== undefined && b.ref !== null && b.ref !== "") {
        referrer = cleanHost(b.ref);
        if (referrer === null) referrer = null; // junk referrer: just drop it
      }
      const own = cleanHost(ownHost);
      const internal = !!referrer && !!own && referrer === own;
      if (internal) referrer = null;

      return {
        ok: true,
        event: {
          kind: "pageview",
          path,
          referrer,
          returning: bool(b.ret),
          app: bool(b.app),
          // The first page of a visit - but a page reached from our own site is not a new visit.
          landing: bool(b.land) && !internal,
          touch: bool(b.touch),
        },
      };
    }

    case "pl": {
      if (typeof b.id !== "string" || !ID_PATTERN.test(b.id)) return INVALID;
      if (b.ph !== "start" && b.ph !== "beat" && b.ph !== "end") return INVALID;
      const seconds = integer(b.s, 0, 172800);
      const reconnects = integer(b.rc ?? 0, 0, 1000);
      const errors = integer(b.er ?? 0, 0, 1000);
      if (seconds === null || reconnects === null || errors === null) return INVALID;
      return { ok: true, event: { kind: "player", id: b.id, phase: b.ph, seconds, reconnects, errors } };
    }

    case "dp": {
      if (typeof b.id !== "string" || !ID_PATTERN.test(b.id)) return INVALID;
      if (b.mode !== "ai" && b.mode !== "device") return INVALID;
      return { ok: true, event: { kind: "devotion_play", id: b.id, mode: b.mode } };
    }

    case "df": {
      if (typeof b.id !== "string" || !ID_PATTERN.test(b.id)) return INVALID;
      return { ok: true, event: { kind: "devotion_finish", id: b.id } };
    }

    case "ck": {
      if (b.kind !== "sermon" && b.kind !== "prayer") return INVALID;
      if (typeof b.id !== "string" || !UUID_PATTERN.test(b.id)) return INVALID;
      return { ok: true, event: { kind: "click", what: b.kind, id: b.id.toLowerCase() } };
    }

    case "in":
      return { ok: true, event: { kind: "install", app: bool(b.app) } };

    default:
      return INVALID;
  }
}
