import { getSupabaseAdmin } from "./supabaseServer";
import { normalizeTime24 } from "./time";
import { cleanDays, sortByTime } from "./schedule";
import { devotion as devotionFallback } from "@/content/devotion";
import { weeklySchedule } from "@/content/schedule";

/* ===========================================================================
   DAILY DEVOTION
   The live devotion is stored in the Supabase "devotion" table (one row).
   If the database is not reachable yet, we fall back to content/devotion.ts
   so the page never looks broken.
   =========================================================================== */

export interface Devotion {
  dateLabel: string;
  sourceLine: string;
  title: string;
  scriptureReference: string;
  scriptureText: string;
  body: string;
  furtherStudy: string;
  goldenNugget: string;
  prayer: string;
  /** AI audio of the devotion (empty when none has been made). */
  audioUrl: string;
  /** Fingerprint of the text that audio was made from. */
  audioHash: string;
}

const devotionFileFallback: Devotion = {
  dateLabel: devotionFallback.date,
  sourceLine: devotionFallback.sourceLine,
  title: devotionFallback.title,
  scriptureReference: devotionFallback.scriptureReference,
  scriptureText: devotionFallback.scriptureText,
  body: devotionFallback.body,
  furtherStudy: devotionFallback.furtherStudy,
  goldenNugget: devotionFallback.goldenNugget,
  prayer: devotionFallback.prayer,
  audioUrl: "",
  audioHash: "",
};

/**
 * The public pages (Program Guide, Daily Devotion, Prayer Points, Sermons) are
 * served from a cached copy that is rebuilt in the background. If the database
 * cannot be read during a rebuild, the rebuild must FAIL, so Next.js keeps
 * showing the last good copy. Quietly building a "starter content" or "could
 * not load" page instead would get cached and replace the good one. The
 * friendly fallbacks below are only used while building and in local development.
 */
export function mayUseFallback(): boolean {
  return process.env.NODE_ENV !== "production" || process.env.NEXT_PHASE === "phase-production-build";
}

/** Reads the devotion row. Throws if the database cannot be read. */
async function readDevotion(): Promise<Devotion> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("devotion")
    .select("*")
    .eq("id", 1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return devotionFileFallback;

  return {
    dateLabel: data.date_label ?? "",
    sourceLine: data.source_line ?? "",
    title: data.title ?? "",
    scriptureReference: data.scripture_reference ?? "",
    scriptureText: data.scripture_text ?? "",
    body: data.body ?? "",
    furtherStudy: data.further_study ?? "",
    goldenNugget: data.golden_nugget ?? "",
    prayer: data.prayer ?? "",
    audioUrl: data.audio_url ?? "",
    audioHash: data.audio_hash ?? "",
  };
}

/** For the admin editor: falls back to the built-in devotion if the database can't be read (as before). */
export async function getDevotion(): Promise<Devotion> {
  try {
    return await readDevotion();
  } catch (err) {
    console.error("getDevotion: using file fallback -", err);
    return devotionFileFallback;
  }
}

/** For the public Daily Devotion page (cached): see mayUseFallback(). */
export async function getPublicDevotion(): Promise<Devotion> {
  try {
    return await readDevotion();
  } catch (err) {
    if (!mayUseFallback()) throw err;
    console.error("getPublicDevotion: using file fallback -", err);
    return devotionFileFallback;
  }
}

/* ===========================================================================
   PROGRAM GUIDE
   Shows are stored one-per-row in the Supabase "schedule_entries" table.
   =========================================================================== */

export interface ScheduleEntry {
  id: string;
  /** Days it airs: 1 = Monday ... 7 = Sunday. Empty = the days still need to be chosen. */
  days: number[];
  /** The text that was typed in the old free-text "Day" box (kept so nothing is lost). */
  originalDay: string;
  timeLabel: string;
  showName: string;
  description: string;
}

export interface ScheduleData {
  entries: ScheduleEntry[];
  /** True when the database has not had supabase/add-program-days.sql run yet. */
  setupNeeded: boolean;
}

/**
 * All programs, sorted by time (earliest first). Used by both the public page
 * and the admin editor, so what you edit matches what is live.
 * Throws if the database is not configured.
 *
 * If the one-time SQL (supabase/add-program-days.sql) has not been run yet the
 * "days" column does not exist: every program is then returned with no days (so
 * it shows under "Other times" and nothing is hidden) and setupNeeded is true.
 */
export async function getScheduleData(): Promise<ScheduleData> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("schedule_entries")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);

  const rows = data ?? [];
  const setupNeeded = rows.length > 0 && !("days" in rows[0]);

  const entries = rows.map((row) => {
    const timeLabel: string = row.time_label ?? "";
    return {
      id: String(row.id),
      days: cleanDays(row.days),
      originalDay: String(row.day_original ?? row.day ?? ""),
      // Older entries saved as "6:00 AM" are shown as "06:00".
      timeLabel: normalizeTime24(timeLabel) ?? timeLabel,
      showName: row.show_name ?? "",
      description: row.description ?? "",
    };
  });

  return { entries: sortByTime(entries), setupNeeded };
}

const scheduleFileFallback: ScheduleEntry[] = sortByTime(
  weeklySchedule.flatMap((group, g) =>
    group.entries.map((e, i) => ({
      id: `fallback-${g}-${i}`,
      days: cleanDays(group.days),
      originalDay: group.label,
      timeLabel: normalizeTime24(e.time) ?? e.time,
      showName: e.title,
      description: e.host ? `${e.description} ${e.host}` : e.description,
    })),
  ),
);

/** What the public Program Guide shows. Falls back to the built-in starter schedule if the database is empty or unreachable. */
export async function getPublicSchedule(): Promise<ScheduleData> {
  try {
    const result = await getScheduleData();
    if (result.entries.length === 0) return { entries: scheduleFileFallback, setupNeeded: false };
    return result;
  } catch (err) {
    if (!mayUseFallback()) throw err;
    console.error("getPublicSchedule: using file fallback -", err);
    return { entries: scheduleFileFallback, setupNeeded: false };
  }
}

/* ===========================================================================
   PRAYER POINTS
   Each entry links out to an external news story. Stored one-per-row in the
   Supabase "prayer_points" table.
   =========================================================================== */

export interface PrayerPoint {
  id: string;
  title: string;
  url: string;
  createdAt: string;
}

/** Newest first. Throws if the database is not configured. */
export async function listPrayerPoints(): Promise<PrayerPoint[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("prayer_points")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => ({
    id: String(row.id),
    title: row.title ?? "",
    url: row.url ?? "",
    createdAt: row.created_at,
  }));
}

/* ===========================================================================
   SERMONS
   Each entry links to a YouTube video. Stored one-per-row in the Supabase
   "sermons" table.
   =========================================================================== */

export interface Sermon {
  id: string;
  title: string;
  url: string;
  createdAt: string;
}

/** Newest first. Throws if the database is not configured. */
export async function listSermons(): Promise<Sermon[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("sermons")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => ({
    id: String(row.id),
    title: row.title ?? "",
    url: row.url ?? "",
    createdAt: row.created_at,
  }));
}
