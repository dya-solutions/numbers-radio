import { timeToMinutes } from "./time";

/**
 * Days-of-the-week helpers for the Program Guide. Pure functions (no database,
 * no React), shared by the public page, the admin editor and the server actions.
 *
 * Days are numbered like ISO weeks and like the database: 1 = Monday ... 7 = Sunday.
 */

export interface WeekDay {
  /** 1 = Monday ... 7 = Sunday */
  n: number;
  short: string;
  long: string;
}

export const WEEK: readonly WeekDay[] = [
  { n: 1, short: "Mon", long: "Monday" },
  { n: 2, short: "Tue", long: "Tuesday" },
  { n: 3, short: "Wed", long: "Wednesday" },
  { n: 4, short: "Thu", long: "Thursday" },
  { n: 5, short: "Fri", long: "Friday" },
  { n: 6, short: "Sat", long: "Saturday" },
  { n: 7, short: "Sun", long: "Sunday" },
];

export const EVERY_DAY: readonly number[] = [1, 2, 3, 4, 5, 6, 7];
export const WEEKDAYS: readonly number[] = [1, 2, 3, 4, 5];
export const WEEKENDS: readonly number[] = [6, 7];

/** Any input -> a sorted list of unique day numbers 1-7 (anything else is dropped). */
export function cleanDays(input: unknown): number[] {
  const list = Array.isArray(input) ? input : [];
  const set = new Set<number>();
  for (const item of list) {
    const n = typeof item === "number" ? item : typeof item === "string" && item.trim() !== "" ? Number(item) : NaN;
    if (Number.isInteger(n) && n >= 1 && n <= 7) set.add(n);
  }
  return [...set].sort((a, b) => a - b);
}

function sameDays(a: number[], b: readonly number[]): boolean {
  return a.length === b.length && a.every((n, i) => n === b[i]);
}

/** "Mon, Wed, Fri" - with friendly names for the common sets. Empty list -> "". */
export function daysLabel(days: number[]): string {
  const d = cleanDays(days);
  if (d.length === 0) return "";
  if (sameDays(d, EVERY_DAY)) return "Every day";
  if (sameDays(d, WEEKDAYS)) return "Weekdays (Mon-Fri)";
  if (sameDays(d, WEEKENDS)) return "Weekends (Sat, Sun)";
  return d.map((n) => WEEK[n - 1].short).join(", ");
}

/**
 * Today's weekday (1 = Monday ... 7 = Sunday) in Gulf Standard Time
 * (Asia/Dubai), whatever time zone the visitor's device is in.
 */
export function gstWeekday(now: Date = new Date()): number {
  const name = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Dubai", weekday: "short" }).format(now);
  const index = WEEK.findIndex((d) => d.short.toLowerCase() === name.slice(0, 3).toLowerCase());
  return index >= 0 ? index + 1 : 1;
}

/** Earliest first; programs at the same time keep the order they were added. Unreadable times go last. */
export function sortByTime<T extends { timeLabel: string }>(list: T[]): T[] {
  return list
    .map((item, index) => ({ item, index }))
    .sort((a, b) => timeToMinutes(a.item.timeLabel) - timeToMinutes(b.item.timeLabel) || a.index - b.index)
    .map(({ item }) => item);
}

export interface WeekColumn<T> {
  day: WeekDay;
  entries: T[];
}

/**
 * Seven columns (Monday to Sunday), each holding the programs that air that day
 * in time order. A program on several days appears in each of them. Programs
 * with no days chosen yet are returned separately in `other` so they are never lost.
 */
export function buildWeek<T extends { days: number[]; timeLabel: string }>(
  entries: T[],
): { columns: WeekColumn<T>[]; other: T[] } {
  const sorted = sortByTime(entries);
  const columns = WEEK.map((day) => ({
    day,
    entries: sorted.filter((e) => e.days.includes(day.n)),
  }));
  const other = sorted.filter((e) => cleanDays(e.days).length === 0);
  return { columns, other };
}
