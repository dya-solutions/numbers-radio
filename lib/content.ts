import { getSupabaseAdmin } from "./supabaseServer";
import { normalizeTime24, sortScheduleEntries } from "./time";
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
};

export async function getDevotion(): Promise<Devotion> {
  try {
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
    };
  } catch (err) {
    console.error("getDevotion: using file fallback -", err);
    return devotionFileFallback;
  }
}

/* ===========================================================================
   PROGRAM GUIDE
   Shows are stored one-per-row in the Supabase "schedule_entries" table.
   =========================================================================== */

export interface ScheduleEntry {
  id: string;
  day: string;
  timeLabel: string;
  showName: string;
  description: string;
}

export interface ScheduleDayGroup {
  day: string;
  entries: ScheduleEntry[];
}

/**
 * All shows, grouped by day (days in the order they were first added) and
 * sorted by time within each day, in 24-hour format. Used by both the public
 * page and the admin editor, so what you edit matches what is live.
 * Throws if the database is not configured.
 */
export async function listScheduleEntries(): Promise<ScheduleEntry[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("schedule_entries")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);

  const entries = (data ?? []).map((row) => {
    const timeLabel: string = row.time_label ?? "";
    return {
      id: String(row.id),
      day: row.day ?? "",
      // Older entries saved as "6:00 AM" are shown as "06:00".
      timeLabel: normalizeTime24(timeLabel) ?? timeLabel,
      showName: row.show_name ?? "",
      description: row.description ?? "",
    };
  });

  return sortScheduleEntries(entries);
}

const scheduleFileFallback: ScheduleDayGroup[] = weeklySchedule.map((d) => ({
  day: d.day,
  entries: sortScheduleEntries(
    d.entries.map((e, i) => ({
      id: `fallback-${i}`,
      day: d.day,
      timeLabel: normalizeTime24(e.time) ?? e.time,
      showName: e.title,
      description: e.host ? `${e.description} ${e.host}` : e.description,
    })),
  ),
}));

/** Entries grouped by day, in the order days first appear. Used by the public page. */
export async function getGroupedSchedule(): Promise<ScheduleDayGroup[]> {
  let entries: ScheduleEntry[];
  try {
    entries = await listScheduleEntries();
  } catch (err) {
    console.error("getGroupedSchedule: using file fallback -", err);
    return scheduleFileFallback;
  }

  if (entries.length === 0) return scheduleFileFallback;

  const groups: ScheduleDayGroup[] = [];
  for (const entry of entries) {
    let group = groups.find((g) => g.day === entry.day);
    if (!group) {
      group = { day: entry.day, entries: [] };
      groups.push(group);
    }
    group.entries.push(entry);
  }
  return groups;
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
