import { getSupabaseAdmin } from "./supabaseServer";
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

/** Raw list, oldest first. Throws if the database is not configured. */
export async function listScheduleEntries(): Promise<ScheduleEntry[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("schedule_entries")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => ({
    id: String(row.id),
    day: row.day ?? "",
    timeLabel: row.time_label ?? "",
    showName: row.show_name ?? "",
    description: row.description ?? "",
  }));
}

const scheduleFileFallback: ScheduleDayGroup[] = weeklySchedule.map((d) => ({
  day: d.day,
  entries: d.entries.map((e, i) => ({
    id: `fallback-${i}`,
    day: d.day,
    timeLabel: e.time,
    showName: e.title,
    description: e.host ? `${e.description} ${e.host}` : e.description,
  })),
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
