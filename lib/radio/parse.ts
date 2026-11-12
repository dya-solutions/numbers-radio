/**
 * Turns AzuraCast's report responses into the small, tidy shapes the Statistics
 * page shows. Pure functions with no imports and no network, so they are easy to
 * test. Every function is defensive: AzuraCast sends many numbers as text
 * ("12") and a missing or odd value must never crash the page.
 *
 * The response shapes below were taken from AzuraCast's own source code
 * (backend/src/Controller/Api/Stations/Reports/Overview/*.php and ListenersAction.php).
 */

export function num(value: unknown): number {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(n) ? n : 0;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function rows(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter(isObject) : [];
}

/** Thrown when a response does not look like the AzuraCast report we asked for. */
export class UnexpectedShape extends Error {}

/* ------------------------------- dates -------------------------------- */

/** "2026-11-12" -> ["2026-11-12"], counting forward day by day (pure calendar maths, no time zones). */
export function daysBetween(from: string, to: string): string[] {
  const out: string[] = [];
  const start = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${to}T00:00:00Z`);
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return out;
  for (let t = start; t <= end && out.length < 400; t += 86400000) {
    out.push(new Date(t).toISOString().slice(0, 10));
  }
  return out;
}

/** Gulf Standard Time (fixed UTC+4) calendar date of a moment. */
export function gstDateOf(ms: number): string {
  return new Date(ms + 4 * 3600 * 1000).toISOString().slice(0, 10);
}

/* ------------------------------ live count ----------------------------- */

export interface LiveInfo {
  /** Connections right now (a person on two devices counts twice). */
  listeners: number;
  /** Different listeners right now. */
  unique: number;
  /** The station's own time zone, e.g. "Asia/Dubai". */
  timezone: string;
}

/** GET /api/nowplaying/{station_id} */
export function parseLive(json: unknown): LiveInfo {
  if (!isObject(json) || !isObject(json.listeners)) throw new UnexpectedShape("nowplaying");
  const l = json.listeners;
  const total = num(l.total ?? l.current);
  const unique = l.unique === undefined ? total : num(l.unique);
  const station = isObject(json.station) ? json.station : {};
  return {
    listeners: Math.max(0, Math.round(total)),
    unique: Math.max(0, Math.round(unique)),
    timezone: typeof station.timezone === "string" ? station.timezone : "",
  };
}

/* -------------------------------- charts ------------------------------- */

export interface DailyPoint {
  day: string;
  value: number;
}

/**
 * GET /station/{id}/reports/overview/charts - the daily line. Each point is
 * {x: milliseconds, y: number}; x is midnight in the station's time zone.
 * Days with no data are not sent, so they are filled in with 0 here.
 */
export function parseDaily(json: unknown, from: string, to: string): DailyPoint[] {
  if (!isObject(json) || !isObject(json.daily)) throw new UnexpectedShape("charts.daily");
  const metrics = Array.isArray(json.daily.metrics) ? json.daily.metrics : [];
  const first = isObject(metrics[0]) ? metrics[0] : null;
  const data = first && Array.isArray(first.data) ? first.data : null;
  if (!data) throw new UnexpectedShape("charts.daily.metrics");

  const byDay = new Map<string, number>();
  for (const p of data) {
    if (!isObject(p)) continue;
    const x = num(p.x);
    if (x <= 0) continue;
    byDay.set(gstDateOf(x), num(p.y));
  }
  return daysBetween(from, to).map((day) => ({ day, value: byDay.get(day) ?? 0 }));
}

/** The "all days of the week together" hourly line: 24 values, hour 0..23. */
export function parseHourly(json: unknown): number[] {
  if (!isObject(json) || !isObject(json.hourly)) throw new UnexpectedShape("charts.hourly");
  const all = json.hourly.all;
  const metrics = isObject(all) && Array.isArray(all.metrics) ? all.metrics : [];
  const first = isObject(metrics[0]) ? metrics[0] : null;
  const data = first && Array.isArray(first.data) ? first.data : null;
  if (!data) throw new UnexpectedShape("charts.hourly.metrics");
  return Array.from({ length: 24 }, (_, h) => Math.max(0, num(data[h])));
}

/* -------------------------------- reports ------------------------------ */

export type ClientKind = "mobile" | "desktop" | "non_browser" | "bot";

export interface ClientRow {
  client: ClientKind;
  listeners: number;
  seconds: number;
}

const CLIENT_KINDS: ClientKind[] = ["mobile", "desktop", "non_browser", "bot"];

/** GET .../reports/overview/by-client - `all` rows {client_raw, listeners, connected_seconds}. */
export function parseClients(json: unknown): ClientRow[] {
  if (!isObject(json) || !Array.isArray(json.all)) throw new UnexpectedShape("by-client");
  const out: ClientRow[] = [];
  for (const r of rows(json.all)) {
    const kind = CLIENT_KINDS.find((k) => k === r.client_raw);
    if (!kind) continue;
    out.push({ client: kind, listeners: num(r.listeners), seconds: num(r.connected_seconds) });
  }
  return out.sort((a, b) => b.listeners - a.listeners);
}

export interface Totals {
  /** Different listeners (devices) in the period, bots excluded. */
  listeners: number;
  seconds: number;
  /** Total time divided by listeners: how long one listener listened in the period. */
  avgSeconds: number;
}

export function totalsFromClients(clients: ClientRow[]): Totals {
  const real = clients.filter((c) => c.client !== "bot");
  const listeners = real.reduce((s, c) => s + c.listeners, 0);
  const seconds = real.reduce((s, c) => s + c.seconds, 0);
  return { listeners, seconds, avgSeconds: listeners > 0 ? seconds / listeners : 0 };
}

export interface CountryRow {
  code: string;
  listeners: number;
  seconds: number;
}

/** GET .../by-country - `all` rows {country_code, listeners, connected_seconds, country}. */
export function parseCountries(json: unknown): CountryRow[] {
  if (!isObject(json) || !Array.isArray(json.all)) throw new UnexpectedShape("by-country");
  return rows(json.all)
    .map((r) => ({
      code: typeof r.country_code === "string" ? r.country_code.toUpperCase() : "",
      listeners: num(r.listeners),
      seconds: num(r.connected_seconds),
    }))
    .filter((r) => r.code !== "" && r.listeners > 0)
    .sort((a, b) => b.listeners - a.listeners || a.code.localeCompare(b.code));
}

export interface BrowserRow {
  browser: string;
  listeners: number;
}

/** GET .../by-browser - `all` rows {browser, listeners, connected_seconds}. */
export function parseBrowsers(json: unknown): BrowserRow[] {
  if (!isObject(json) || !Array.isArray(json.all)) throw new UnexpectedShape("by-browser");
  return rows(json.all)
    .map((r) => ({
      browser: typeof r.browser === "string" && r.browser.trim() ? r.browser.trim().slice(0, 60) : "Unknown",
      listeners: num(r.listeners),
    }))
    .filter((r) => r.listeners > 0)
    .sort((a, b) => b.listeners - a.listeners || a.browser.localeCompare(b.browser));
}

export interface LengthBucket {
  label: string;
  listeners: number;
}

/** GET .../by-listening-time - `all` rows {label, value}, already in order from shortest to longest. */
export function parseListeningTime(json: unknown): LengthBucket[] {
  if (!isObject(json) || !Array.isArray(json.all)) throw new UnexpectedShape("by-listening-time");
  return rows(json.all).map((r) => ({
    label: typeof r.label === "string" ? r.label.slice(0, 80) : "",
    listeners: num(r.value),
  }));
}

export interface PlayedTrack {
  title: string;
  plays: number;
}

/** GET .../best-and-worst - `mostPlayed` rows {song: {text, artist, title}, num_plays}. */
export function parseMostPlayed(json: unknown): PlayedTrack[] {
  if (!isObject(json) || !Array.isArray(json.mostPlayed)) throw new UnexpectedShape("best-and-worst");
  const out: PlayedTrack[] = [];
  for (const r of rows(json.mostPlayed)) {
    const song = isObject(r.song) ? r.song : {};
    const artist = typeof song.artist === "string" ? song.artist.trim() : "";
    const title = typeof song.title === "string" ? song.title.trim() : "";
    const text = typeof song.text === "string" ? song.text.trim() : "";
    const name = artist && title ? `${artist} - ${title}` : title || text || "Unknown track";
    out.push({ title: name.slice(0, 120), plays: num(r.num_plays) });
  }
  return out.filter((t) => t.plays > 0).sort((a, b) => b.plays - a.plays);
}

/* --------------------------------- peak -------------------------------- */

export interface Peak {
  listeners: number;
  /** When the peak first happened (epoch seconds), or null if nobody listened. */
  at: number | null;
}

/**
 * GET /station/{id}/listeners?unique=false&start=..&end=.. - one row per
 * connection: {connected_on, connected_until, device: {is_bot}}. The row also
 * carries an IP address, which is never read here (and the raw rows are thrown
 * away as soon as the peak is worked out).
 *
 * Peak = the most connections open at the same moment, found by sweeping a line
 * through every start and end. Bots and monitoring tools are skipped.
 */
export function peakFromListeners(json: unknown): Peak {
  if (!Array.isArray(json)) throw new UnexpectedShape("listeners");
  const events: [number, number][] = []; // [time, +1 | -1]
  for (const r of json) {
    if (!isObject(r)) continue;
    const device = isObject(r.device) ? r.device : {};
    if (device.is_bot === true) continue;
    const start = num(r.connected_on);
    const end = num(r.connected_until);
    if (start <= 0 || end <= start) continue;
    events.push([start, 1], [end, -1]);
  }
  // At the same second, connections that end are counted out before new ones come in.
  events.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  let open = 0;
  let best = 0;
  let at: number | null = null;
  for (const [time, change] of events) {
    open += change;
    if (open > best) {
      best = open;
      at = time;
    }
  }
  return { listeners: best, at };
}
