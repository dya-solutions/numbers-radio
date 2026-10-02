import type { Metadata } from "next";
import { listSermons, type Sermon } from "@/lib/content";

export const metadata: Metadata = {
  title: "Sermons",
};

// Always show the most recently added sermons.
export const dynamic = "force-dynamic";

export default async function SermonsPage() {
  let entries: Sermon[] = [];
  let loadError: string | null = null;

  try {
    entries = await listSermons();
  } catch (err) {
    loadError = err instanceof Error ? err.message : "Unknown error";
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl">Sermons</h1>
        <p className="mt-2 text-ink-soft">
          Watch recent messages on{" "}
          <a
            href="https://www.youtube.com/@phaneroo"
            target="_blank"
            rel="noopener noreferrer"
          >
            YouTube
          </a>
          .
        </p>
      </header>

      {loadError ? (
        <p className="text-ink-soft">
          Sermons could not be loaded right now. Please check back soon.
        </p>
      ) : entries.length === 0 ? (
        <p className="text-ink-soft">No sermons have been posted yet.</p>
      ) : (
        <ul className="space-y-4">
          {entries.map((entry) => (
            <li
              key={entry.id}
              className="flex flex-col gap-3 rounded-xl border border-sand bg-surface p-5 sm:flex-row sm:items-center sm:justify-between"
            >
              <p className="m-0 text-lg">
                <a
                  href={entry.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-ink no-underline transition-colors hover:text-gold"
                >
                  {entry.title}
                </a>
              </p>
              <a
                href={entry.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex shrink-0 items-center gap-1 self-start rounded-lg border border-gold px-3 py-1.5 text-sm font-semibold text-gold no-underline transition-colors hover:bg-gold hover:text-black sm:self-auto"
              >
                Watch on YouTube
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
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
