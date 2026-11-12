import { AZURACAST_BASE_URL, AZURACAST_STATION_ID } from "@/lib/config";
import { gstDay } from "@/lib/analytics/visitor";
import {
  UnexpectedShape,
  parseBrowsers,
  parseClients,
  parseCountries,
  parseDaily,
  parseHourly,
  parseListeningTime,
  parseLive,
  parseMostPlayed,
  peakFromListeners,
  type BrowserRow,
  type ClientRow,
  type CountryRow,
  type DailyPoint,
  type LengthBucket,
  type LiveInfo,
  type Peak,
  type PlayedTrack,
} from "@/lib/radio/parse";

/**
 * The radio station's own listener statistics, read from AzuraCast.
 * SERVER ONLY: the API key (AZURACAST_API_KEY, never NEXT_PUBLIC_) must not
 * reach the browser, and this file is only imported by server components.
 *
 * Endpoints used (all GET, under <base>/api):
 *   /nowplaying/{station_id}                              public - listeners right now
 *   /station/{id}/reports/overview/charts                 unique listeners per day, average per day, average by hour of day
 *   /station/{id}/reports/overview/by-client              listeners + listening time by kind of device (totals come from here)
 *   /station/{id}/reports/overview/by-country             listeners by country
 *   /station/{id}/reports/overview/by-browser             listeners by browser
 *   /station/{id}/reports/overview/by-listening-time      how long listeners stay
 *   /station/{id}/reports/overview/best-and-worst         the "mostPlayed" tracks
 *   /station/{id}/listeners?unique=false                  every connection in the period, only used to find the peak
 * Everything except the first needs the key, which only needs the station permission
 * "View Station Reports".
 */

export type RadioErrorCode =
  | "not_configured"
  | "missing_key"
  | "unreachable"
  | "denied"
  | "analytics_level"
  | "not_found"
  | "too_large"
  | "error";

export type Part<T> = { ok: true; data: T } | { ok: false; code: RadioErrorCode; message: string };

export interface RadioStats {
  range: { days: number; from: string; to: string };
  /** Set if the station's own clock is not Gulf Standard Time (the page labels everything GST). */
  timezoneNote: string | null;
  live: Part<LiveInfo>;
  peak: Part<Peak>;
  dailyUnique: Part<DailyPoint[]>;
  dailyAverage: Part<DailyPoint[]>;
  /** Average listeners in each hour of the day (index 0..23). */
  hourly: Part<number[]>;
  clients: Part<ClientRow[]>;
  countries: Part<CountryRow[]>;
  browsers: Part<BrowserRow[]>;
  listeningTime: Part<LengthBucket[]>;
  tracks: Part<PlayedTrack[]>;
}

export type RadioResult =
  | { ok: true; data: RadioStats }
  | { ok: false; code: RadioErrorCode; message: string };

/* ------------------------------ settings ------------------------------ */

const STATION_TIMEZONE = "Asia/Dubai"; // = Gulf Standard Time, UTC+4, the zone the whole page uses
const CACHE_MS = 60_000;
const FAILED_CACHE_MS = 10_000;
const CACHE_MAX_ENTRIES = 80;
const QUICK_TIMEOUT_MS = 10_000;
const PEAK_TIMEOUT_MS = 25_000;
const QUICK_MAX_BYTES = 3 * 1024 * 1024;
const PEAK_MAX_BYTES = 25 * 1024 * 1024;

class RadioError extends Error {
  constructor(
    readonly code: RadioErrorCode,
    message: string,
  ) {
    super(message);
  }
}

function apiKey(): string {
  return (process.env.AZURACAST_API_KEY ?? "").trim();
}

/** The base address, only if it is a real https address (http only for a local test station). */
function baseUrl(): string | null {
  let url: URL;
  try {
    url = new URL(AZURACAST_BASE_URL.trim());
  } catch {
    return null;
  }
  if (url.hostname === "your-station.azuracast.com") return null; // the placeholder from .env.local.example
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (url.protocol !== "https:" && !(local && url.protocol === "http:")) return null;
  return `${url.origin}${url.pathname.replace(/\/+$/, "")}`;
}

/* ------------------------------ the cache ----------------------------- */

/**
 * AzuraCast is asked at most once a minute for the same thing (failures are
 * remembered for 10 seconds, so an unreachable station isn't hammered either).
 * It is kept in memory and shared by everyone who opens the page on this server
 * instance. Only the small, tidied results are kept, never raw listener rows.
 */
const cache = new Map<string, { until: number; value: Promise<Part<unknown>> }>();

function remember<T>(key: string, load: () => Promise<T>): Promise<Part<T>> {
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && hit.until > now) return hit.value as Promise<Part<T>>;

  if (cache.size >= CACHE_MAX_ENTRIES) {
    for (const [k, v] of cache) if (v.until <= now) cache.delete(k);
    while (cache.size >= CACHE_MAX_ENTRIES) {
      const oldest = cache.keys().next().value;
      if (oldest === undefined) break;
      cache.delete(oldest);
    }
  }

  const value = settle(load);
  const entry = { until: now + CACHE_MS, value: value as Promise<Part<unknown>> };
  cache.set(key, entry);
  void value.then((part) => {
    if (!part.ok) entry.until = Date.now() + FAILED_CACHE_MS;
  });
  return value;
}

/** Runs a loader and turns anything that goes wrong into a plain "not ok" part. Never throws. */
async function settle<T>(load: () => Promise<T>): Promise<Part<T>> {
  try {
    return { ok: true, data: await load() };
  } catch (err) {
    if (err instanceof RadioError) return { ok: false, code: err.code, message: err.message };
    if (err instanceof UnexpectedShape) {
      return {
        ok: false,
        code: "error",
        message:
          "AzuraCast answered, but not in the form we expected (it may have been updated). The rest of the page is unaffected.",
      };
    }
    return { ok: false, code: "error", message: "Something went wrong while reading this from AzuraCast." };
  }
}

/** Test hook: forget everything that was cached. */
export function clearRadioCache(): void {
  cache.clear();
}

/* ------------------------------ fetching ------------------------------ */

interface CallOptions {
  /** Send the API key (everything except the public "now playing"). */
  auth: boolean;
  timeoutMs?: number;
  maxBytes?: number;
  /** Reports that AzuraCast only builds when its analytics setting is "Full". */
  needsFullAnalytics?: boolean;
}

async function readLimited(res: Response, maxBytes: number): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) return await res.text();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel().catch(() => undefined);
      throw new RadioError(
        "too_large",
        "AzuraCast sent more data than we can safely work through for this period. Try a shorter period.",
      );
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}

async function callAzuraCast(
  base: string,
  path: string,
  query: Record<string, string>,
  opts: CallOptions,
): Promise<unknown> {
  const url = new URL(`${base}/api${path}`);
  for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);

  const headers: Record<string, string> = { Accept: "application/json" };
  if (opts.auth) headers.Authorization = `Bearer ${apiKey()}`;

  let res: Response;
  try {
    res = await fetch(url, {
      method: "GET",
      headers,
      cache: "no-store",
      // Never follow a redirect: the key must only ever go to the configured address.
      redirect: "manual",
      signal: AbortSignal.timeout(opts.timeoutMs ?? QUICK_TIMEOUT_MS),
    });
  } catch {
    throw new RadioError(
      "unreachable",
      "The radio station (AzuraCast) could not be reached just now, or it took too long to answer.",
    );
  }

  if (res.status === 401 || res.status === 403) {
    await res.body?.cancel().catch(() => undefined);
    throw new RadioError(
      "denied",
      "AzuraCast did not accept the API key. Check the key is copied correctly and that its user has the \"View Station Reports\" permission for this station.",
    );
  }
  if (res.status === 400) {
    await res.body?.cancel().catch(() => undefined);
    throw new RadioError(
      "analytics_level",
      opts.needsFullAnalytics
        ? "AzuraCast hides this report. In AzuraCast open Administration, System Settings, Security & Privacy and set \"Listener Analytics Collection\" to Full."
        : "AzuraCast hides this report because listener analytics are switched off. In AzuraCast open Administration, System Settings, Security & Privacy and set \"Listener Analytics Collection\" to Full (or at least Limited).",
    );
  }
  if (res.status === 404) {
    await res.body?.cancel().catch(() => undefined);
    throw new RadioError("not_found", "AzuraCast says it has no station with the configured station ID.");
  }
  if (!res.ok) {
    await res.body?.cancel().catch(() => undefined);
    throw new RadioError("error", `AzuraCast had a problem answering (error ${res.status}).`);
  }

  const text = await readLimited(res, opts.maxBytes ?? QUICK_MAX_BYTES);
  try {
    return JSON.parse(text);
  } catch {
    throw new UnexpectedShape("not json");
  }
}

/* ----------------------------- the dashboard ----------------------------- */

function failed(code: RadioErrorCode, message: string): { ok: false; code: RadioErrorCode; message: string } {
  return { ok: false, code, message };
}

/** Run a parser on a fetched part; a shape problem becomes a plain "not ok" part. */
function derive<A, B>(part: Part<A>, fn: (data: A) => B): Part<B> {
  if (!part.ok) return part;
  try {
    return { ok: true, data: fn(part.data) };
  } catch {
    return failed(
      "error",
      "AzuraCast answered, but not in the form we expected (it may have been updated). The rest of the page is unaffected.",
    );
  }
}

export async function getRadioStats(days: number, now: Date = new Date()): Promise<RadioResult> {
  const base = baseUrl();
  if (!base) {
    return failed(
      "not_configured",
      "The radio station address is not set. Set NEXT_PUBLIC_AZURACAST_BASE_URL (and NEXT_PUBLIC_AZURACAST_STATION_ID) in Vercel to the real AzuraCast address, then redeploy.",
    );
  }
  if (!apiKey()) {
    return failed(
      "missing_key",
      "The AzuraCast API key is not set yet. Add AZURACAST_API_KEY in Vercel (steps are in the README under \"Radio listeners\") and redeploy.",
    );
  }

  const station = encodeURIComponent(AZURACAST_STATION_ID.trim());
  const to = gstDay(now);
  const from = gstDay(new Date(now.getTime() - (days - 1) * 86400000));
  const stamp = new Date(now.getTime() + 4 * 3600 * 1000).toISOString(); // GST wall clock
  const nowText = `${stamp.slice(0, 10)} ${stamp.slice(11, 19)}`;
  const reports = `/station/${station}/reports/overview`;
  const range = { start: from, end: to };
  const key = `${base}|${station}`;
  const full = { auth: true, needsFullAnalytics: true } as const;

  const [live, chartsUnique, chartsAverage, byClient, byCountry, byBrowser, byTime, mostPlayed, peak] =
    await Promise.all([
      remember(`${key}|live`, () => callAzuraCast(base, `/nowplaying/${station}`, {}, { auth: false })),
      remember(`${key}|charts|unique|${from}|${to}`, () =>
        callAzuraCast(base, `${reports}/charts`, { ...range, type: "unique" }, { auth: true }),
      ),
      remember(`${key}|charts|average|${from}|${to}`, () =>
        callAzuraCast(base, `${reports}/charts`, { ...range, type: "average" }, { auth: true }),
      ),
      remember(`${key}|client|${from}|${to}`, () => callAzuraCast(base, `${reports}/by-client`, range, full)),
      remember(`${key}|country|${from}|${to}`, () => callAzuraCast(base, `${reports}/by-country`, range, full)),
      remember(`${key}|browser|${from}|${to}`, () => callAzuraCast(base, `${reports}/by-browser`, range, full)),
      remember(`${key}|time|${from}|${to}`, () =>
        callAzuraCast(base, `${reports}/by-listening-time`, range, { auth: true }),
      ),
      remember(`${key}|played|${from}|${to}`, () =>
        callAzuraCast(base, `${reports}/best-and-worst`, range, { auth: true }),
      ),
      // The heavy one: every connection in the period. Only the peak is kept.
      remember(`${key}|peak|${from}|${to}`, async () =>
        peakFromListeners(
          await callAzuraCast(
            base,
            `/station/${station}/listeners`,
            { start: from, end: nowText, unique: "false" },
            { auth: true, timeoutMs: PEAK_TIMEOUT_MS, maxBytes: PEAK_MAX_BYTES },
          ),
        ),
      ),
    ]);

  const stats: RadioStats = {
    range: { days, from, to },
    timezoneNote: null,
    live: derive(live, parseLive),
    peak,
    dailyUnique: derive(chartsUnique, (j) => parseDaily(j, from, to)),
    dailyAverage: derive(chartsAverage, (j) => parseDaily(j, from, to)),
    hourly: derive(chartsAverage, parseHourly),
    clients: derive(byClient, parseClients),
    countries: derive(byCountry, parseCountries),
    browsers: derive(byBrowser, parseBrowsers),
    listeningTime: derive(byTime, parseListeningTime),
    tracks: derive(mostPlayed, parseMostPlayed),
  };

  // Everything that needs the key failed the same way (wrong key, station down...):
  // say so once instead of repeating it in every panel.
  const needingKey = [
    stats.peak,
    stats.dailyUnique,
    stats.dailyAverage,
    stats.hourly,
    stats.clients,
    stats.countries,
    stats.browsers,
    stats.listeningTime,
    stats.tracks,
  ];
  const firstFailure = needingKey.find((p) => !p.ok);
  if (firstFailure && !firstFailure.ok && needingKey.every((p) => !p.ok && p.code === firstFailure.code)) {
    return failed(firstFailure.code, firstFailure.message);
  }

  if (stats.live.ok && stats.live.data.timezone && stats.live.data.timezone !== STATION_TIMEZONE) {
    stats.timezoneNote = `The station's clock is set to ${stats.live.data.timezone}, not Gulf Standard Time, so the days and hours in this section may be shifted from the rest of the page.`;
  }

  return { ok: true, data: stats };
}
