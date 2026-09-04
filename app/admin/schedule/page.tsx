import { listScheduleEntries, type ScheduleEntry } from "@/lib/content";
import ScheduleEditor from "./ScheduleEditor";

export const dynamic = "force-dynamic";

export default async function AdminSchedulePage() {
  let entries: ScheduleEntry[] = [];
  let loadError: string | null = null;

  try {
    entries = await listScheduleEntries();
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
          updates straight away. Shows are grouped by whatever you type in the{" "}
          <strong>Day</strong> box, in the order you add them.
        </p>
      </header>

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
