import { listPrayerPoints, type PrayerPoint } from "@/lib/content";
import PrayerPointsEditor from "./PrayerPointsEditor";

export const dynamic = "force-dynamic";

export default async function AdminPrayerPointsPage() {
  let entries: PrayerPoint[] = [];
  let loadError: string | null = null;

  try {
    entries = await listPrayerPoints();
  } catch (err) {
    loadError = err instanceof Error ? err.message : "Unknown error";
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl">Edit Prayer Points</h1>
        <p className="mt-2 text-ink-soft">
          Add, change, or remove prayer points. Each one links out to a news
          story. The{" "}
          <a href="/prayer-points" target="_blank" rel="noreferrer">
            Prayer Points page
          </a>{" "}
          updates straight away, newest first.
        </p>
      </header>

      {loadError ? (
        <div className="rounded-xl border border-ember bg-surface p-5 text-ink">
          <p className="m-0 font-semibold">Could not load prayer points.</p>
          <p className="m-0 mt-1 text-sm text-ink-soft">{loadError}</p>
        </div>
      ) : (
        <PrayerPointsEditor entries={entries} />
      )}
    </div>
  );
}
