import { listSermons, type Sermon } from "@/lib/content";
import SermonsEditor from "./SermonsEditor";

export const dynamic = "force-dynamic";

export default async function AdminSermonsPage() {
  let entries: Sermon[] = [];
  let loadError: string | null = null;

  try {
    entries = await listSermons();
  } catch (err) {
    loadError = err instanceof Error ? err.message : "Unknown error";
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl">Edit Sermons</h1>
        <p className="mt-2 text-ink-soft">
          Add, change, or remove sermons. Each one links to a YouTube video. The{" "}
          <a href="/sermons" target="_blank" rel="noreferrer">
            Sermons page
          </a>{" "}
          updates straight away, newest first.
        </p>
      </header>

      {loadError ? (
        <div className="rounded-xl border border-ember bg-surface p-5 text-ink">
          <p className="m-0 font-semibold">Could not load sermons.</p>
          <p className="m-0 mt-1 text-sm text-ink-soft">{loadError}</p>
        </div>
      ) : (
        <SermonsEditor entries={entries} />
      )}
    </div>
  );
}
