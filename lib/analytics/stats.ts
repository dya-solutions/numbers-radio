import { getSupabaseAdmin } from "@/lib/supabaseServer";

/**
 * Reads the Statistics page's numbers. SERVER ONLY. The numbers are worked out
 * inside the database (analytics_dashboard in supabase/add-statistics.sql), so
 * the page receives a small summary - never the raw events.
 */

export const RANGES = [
  { days: 1, label: "Today" },
  { days: 7, label: "7 days" },
  { days: 30, label: "30 days" },
  { days: 90, label: "90 days" },
] as const;

export function parseRange(value: string | string[] | undefined): number {
  const n = Number(Array.isArray(value) ? value[0] : value);
  return RANGES.some((r) => r.days === n) ? n : 7;
}

export interface Named {
  name: string;
  n: number;
}

export interface Dashboard {
  range: { days: number; from: string; to: string; bucket: "hour" | "day" };
  totals: {
    visitors: number;
    pageviews: number;
    listening_sessions: number;
    avg_session_seconds: number;
    listening_seconds: number;
    devotion_plays: number;
    devotion_finished: number;
    devotion_ai: number;
    devotion_device: number;
    feedback: number;
    prayer: number;
    installs: number;
  };
  series: { t: string; visitors: number; pageviews: number; listen_seconds: number }[];
  /** [weekday 1=Mon..7=Sun, hour 0-23, seconds] in Gulf Standard Time */
  heatmap: [number, number, number][];
  sections: { path: string; n: number }[];
  who: {
    countries: { code: string; n: number }[];
    cities: { city: string; code: string; n: number }[];
    devices: Named[];
    browsers: Named[];
    systems: Named[];
    returning: { new: number; returning: number };
    app: { installed: number; browser: number };
  };
  referrers: { host: string; n: number }[];
  sermons: { label: string; n: number }[];
  prayer_points: { label: string; n: number }[];
  health: {
    sessions: number;
    never_started: number;
    listened: number;
    smooth: number;
    with_reconnects: number;
    with_errors: number;
    reconnects: number;
    errors: number;
  };
  housekeeping: {
    last_cleanup: string | null;
    events: number;
    sessions: number;
    oldest: string | null;
    daily_rows: number;
  };
}

export type DashboardResult =
  | { ok: true; data: Dashboard }
  | { ok: false; code: "not_ready" | "error"; message: string };

export async function getDashboard(days: number): Promise<DashboardResult> {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.rpc("analytics_dashboard", { p_days: days });
    if (error) {
      const text = `${error.code ?? ""} ${error.message ?? ""}`;
      if (/PGRST202|42883|could not find the function/i.test(text)) {
        return {
          ok: false,
          code: "not_ready",
          message:
            "Statistics haven't been set up in the database yet. Run the SQL in supabase/add-statistics.sql in Supabase (SQL Editor -> New query -> paste -> Run), then reload this page.",
        };
      }
      return { ok: false, code: "error", message: error.message };
    }
    return { ok: true, data: data as Dashboard };
  } catch (err) {
    return {
      ok: false,
      code: "error",
      message: err instanceof Error ? err.message : "Unknown error",
    };
  }
}
