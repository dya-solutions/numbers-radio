import { getScheduleData, type ScheduleEntry } from "@/lib/content";
import ScheduleEditor from "./ScheduleEditor";

export const dynamic = "force-dynamic";

export default async function AdminSchedulePage() {
  let entries: ScheduleEntry[] = [];
  let setupNeeded = false;
  let loadError: string | null = null;

  try {
    ({ entries, setupNeeded } = await getScheduleData());
  } catch (err) {
    loadError = err instanceof Error ? err.message : "Unknown error";
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl">Edit Program Guide</h1>
        <p className="mt-2 text-ink-soft">
          Add, change, or remove shows. The{" "}
          <a href="/program-guide" target="_blank" rel="noreferrer">
            Program Guide page
          </a>{" "}
          updates straight away. Tick the days a show airs on (one show can air on
          several days), and the Program Guide lists it under each of them,
          earliest first. Enter times on the 24-hour clock, like{" "}
          <strong>09:00</strong> or <strong>18:30</strong>, in Gulf Standard
          Time.
        </p>
      </header>

      {setupNeeded ? (
        <div className="rounded-xl border border-ember bg-surface p-5 text-ink">
          <p className="m-0 font-semibold">One-time database update needed.</p>
          <p className="m-0 mt-1 text-sm text-ink-soft">
            Run <code>supabase/add-program-days.sql</code> in Supabase (SQL Editor, New query, paste, Run). Until you
            do, saving will not work and every show is listed under &ldquo;Other times&rdquo; on the public page.
            Nothing is lost.
          </p>
        </div>
      ) : null}

      {loadError ? (
        <div className="rounded-xl border border-ember bg-surface p-5 text-ink">
          <p className="m-0 font-semibold">Could not load the schedule.</p>
          <p className="m-0 mt-1 text-sm text-ink-soft">{loadError}</p>
        </div>
      ) : (
        <ScheduleEditor entries={entries} />
      )}
    </div>
  );
}
