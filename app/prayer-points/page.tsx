import type { Metadata } from "next";
import { listPrayerPoints, type PrayerPoint } from "@/lib/content";

export const metadata: Metadata = {
  title: "Prayer Points",
};

// Always show the most recently added prayer points.
export const dynamic = "force-dynamic";

export default async function PrayerPointsPage() {
  let entries: PrayerPoint[] = [];
  let loadError: string | null = null;

  try {
    entries = await listPrayerPoints();
  } catch (err) {
    loadError = err instanceof Error ? err.message : "Unknown error";
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl">Prayer Points</h1>
        <p className="mt-2 text-ink-soft">
          Current stories and situations to hold in prayer.
        </p>
      </header>

      {loadError ? (
        <p className="text-ink-soft">
          Prayer points could not be loaded right now. Please check back
          soon.
        </p>
      ) : entries.length === 0 ? (
        <p className="text-ink-soft">No prayer points have been posted yet.</p>
      ) : (
        <ul className="space-y-4">
          {entries.map((entry) => (
            <li
              key={entry.id}
              className="flex flex-col gap-3 rounded-xl border border-sand bg-surface p-5 sm:flex-row sm:items-center sm:justify-between"
            >
              <p className="m-0 text-lg text-ink">{entry.title}</p>
              <a
                href={entry.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex shrink-0 items-center gap-1 self-start rounded-lg border border-gold px-3 py-1.5 text-sm font-semibold text-gold no-underline transition-colors hover:bg-gold hover:text-black sm:self-auto"
              >
                Read more
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M7 17L17 7M9 7h8v8" />
                </svg>
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
