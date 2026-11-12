/**
 * Plain-language labels and number formatting for the Statistics page.
 * Pure functions with no imports, so they are easy to test.
 */

const SECTION_LABELS: Record<string, string> = {
  "/": "Listen (Home)",
  "/program-guide": "Program Guide",
  "/daily-devotion": "Daily Devotion",
  "/prayer-points": "Prayer Points",
  "/sermons": "Sermons",
  "/feedback": "Feedback & Prayer Requests",
  "/privacy": "Privacy note",
};

/** Page paths -> friendly names. Pages we don't have a name for are added up as "Other pages". */
export function groupSections(rows: { path: string; n: number }[]): { label: string; n: number }[] {
  const out = new Map<string, number>();
  for (const row of rows) {
    const label = SECTION_LABELS[row.path] ?? "Other pages";
    out.set(label, (out.get(label) ?? 0) + row.n);
  }
  return [...out.entries()]
    .map(([label, n]) => ({ label, n }))
    .sort((a, b) => b.n - a.n || a.label.localeCompare(b.label));
}

let regionNames: Intl.DisplayNames | null = null;

/** "UG" -> "Uganda". */
export function countryName(code: string): string {
  if (!code) return "Unknown";
  try {
    regionNames ??= new Intl.DisplayNames(["en"], { type: "region" });
    return regionNames.of(code) ?? code;
  } catch {
    return code;
  }
}

export function deviceLabel(name: string): string {
  switch (name) {
    case "mobile":
      return "Phone";
    case "tablet":
      return "Tablet";
    case "desktop":
      return "Computer";
    default:
      return "Unknown";
  }
}

export function plainName(name: string): string {
  return name || "Unknown";
}

export function referrerLabel(host: string): string {
  return host || "Direct (typed address, bookmark or the app)";
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat("en-US").format(Math.round(n));
}

/** 45 -> "45 sec", 750 -> "12 min 30 sec", 8100 -> "2 h 15 min". */
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  if (s < 60) return `${s} sec`;
  if (s < 3600) {
    const m = Math.floor(s / 60);
    const rest = s % 60;
    return rest === 0 ? `${m} min` : `${m} min ${rest} sec`;
  }
  const h = Math.floor(s / 3600);
  const m = Math.round((s % 3600) / 60);
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

/** Big-number version for the summary card: [value, unit]. */
export function formatListeningTotal(totalSeconds: number): { value: string; unit: string } {
  if (totalSeconds >= 3600) {
    const hours = totalSeconds / 3600;
    return { value: hours >= 100 ? formatNumber(hours) : hours.toFixed(1), unit: "hours" };
  }
  return { value: formatNumber(totalSeconds / 60), unit: "minutes" };
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export const WEEKDAYS_LONG = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

/** "2026-11-12" -> "Nov 12";  "2026-11-12T14:00" -> "14:00". */
export function formatBucket(t: string): string {
  if (t.includes("T")) return t.split("T")[1];
  const [, m, d] = t.split("-").map(Number);
  return `${MONTHS[m - 1]} ${d}`;
}

/** "2026-11-12" -> "Nov 12, 2026". */
export function formatDate(t: string): string {
  const [y, m, d] = t.split("-").map(Number);
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}

/** Small tops are made even, so the middle line of the chart is a whole number too. */
function evenTop(n: number): number {
  return n < 20 && n % 2 !== 0 ? n + 1 : n;
}

/** A tidy top for a chart's scale: 7 -> 8, 130 -> 150, 2300 -> 2500. Never below 4. */
export function niceMax(value: number): number {
  if (value <= 4) return 4;
  const magnitude = Math.pow(10, Math.floor(Math.log10(value)));
  for (const step of [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) {
    if (value <= step * magnitude) return evenTop(step * magnitude);
  }
  return 10 * magnitude;
}

/** Time of the last cleanup (an ISO text in UTC) as GST wall-clock text, or "" if unknown. */
export function formatGstTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "";
  const d = new Date(t + 4 * 3600 * 1000);
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()} at ${hh}:${mm} GST`;
}

export function percent(part: number, whole: number): number {
  return whole > 0 ? Math.round((part / whole) * 100) : 0;
}
