/**
 * Helpers for Program Guide times.
 *
 * Times are stored and shown in 24-hour "HH:MM" format (e.g. "09:00", "18:30").
 * These helpers also understand older 12-hour entries like "6:00 AM", so
 * nothing looks wrong or sorts oddly if old data is still in the database.
 */

const NO_TIME = 99999; // sorts anything unreadable to the end of its day

/** Returns "HH:MM" (24-hour), or null if the text is not a recognisable time. */
export function normalizeTime24(input: string): string | null {
  const text = input.trim();

  // 24-hour: "9:00", "09:00", "18.30"
  const h24 = text.match(/^(\d{1,2})[:.](\d{2})$/);
  if (h24) {
    const hours = Number(h24[1]);
    const minutes = Number(h24[2]);
    if (hours > 23 || minutes > 59) return null;
    return `${pad(hours)}:${pad(minutes)}`;
  }

  // 12-hour with am/pm: "6 PM", "6:00 AM", "6:30pm", "6:00 p.m."
  const h12 = text.match(/^(\d{1,2})(?:[:.](\d{2}))?\s*([ap])\.?\s*m\.?$/i);
  if (h12) {
    const hours = Number(h12[1]);
    const minutes = Number(h12[2] ?? "0");
    if (hours < 1 || hours > 12 || minutes > 59) return null;
    const pm = h12[3].toLowerCase() === "p";
    return `${pad((hours % 12) + (pm ? 12 : 0))}:${pad(minutes)}`;
  }

  return null;
}

/** Minutes since midnight, used for sorting. Unreadable times sort last. */
export function timeToMinutes(label: string): number {
  const normalized = normalizeTime24(label);
  if (!normalized) return NO_TIME;
  const [h, m] = normalized.split(":").map(Number);
  return h * 60 + m;
}

/**
 * Orders schedule entries for display: days stay in the order they first
 * appear in the list (the order they were created), and within each day the
 * entries run earliest to latest. Entries with the same time keep their
 * original order.
 */
export function sortScheduleEntries<T extends { day: string; timeLabel: string }>(
  entries: T[],
): T[] {
  const dayOrder = new Map<string, number>();
  for (const entry of entries) {
    if (!dayOrder.has(entry.day)) dayOrder.set(entry.day, dayOrder.size);
  }

  return entries
    .map((entry, index) => ({ entry, index }))
    .sort(
      (a, b) =>
        dayOrder.get(a.entry.day)! - dayOrder.get(b.entry.day)! ||
        timeToMinutes(a.entry.timeLabel) - timeToMinutes(b.entry.timeLabel) ||
        a.index - b.index,
    )
    .map(({ entry }) => entry);
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}
