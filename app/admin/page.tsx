import type { Metadata } from "next";
import { getSupabaseAdmin, type Submission } from "@/lib/supabaseServer";

export const metadata: Metadata = {
  title: "Submissions",
  robots: { index: false, follow: false },
};

// Always fetch fresh data - never cache the admin list.
export const dynamic = "force-dynamic";

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default async function AdminPage() {
  let submissions: Submission[] = [];
  let loadError: string | null = null;

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("submissions")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);
    submissions = (data as Submission[]) ?? [];
  } catch (err) {
    loadError = err instanceof Error ? err.message : "Unknown error";
  }

  const feedback = submissions.filter((s) => s.type === "feedback");
  const prayers = submissions.filter((s) => s.type === "prayer");

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl">Submissions</h1>
        <p className="mt-2 text-ink-soft">
          All feedback and prayer requests, newest first.
        </p>
      </header>

      {loadError ? (
        <div className="rounded-xl border border-ember bg-surface p-5 text-ink">
          <p className="m-0 font-semibold">Could not load submissions.</p>
          <p className="m-0 mt-1 text-sm text-ink-soft">{loadError}</p>
        </div>
      ) : (
        <>
          <div className="flex gap-6 text-sm text-ink-soft">
            <span>
              <strong className="text-ink">{prayers.length}</strong> prayer requests
            </span>
            <span>
              <strong className="text-ink">{feedback.length}</strong> feedback messages
            </span>
          </div>

          {submissions.length === 0 ? (
            <p className="text-ink-soft">No submissions yet.</p>
          ) : (
            <ul className="space-y-3">
              {submissions.map((s) => (
                <li
                  key={s.id}
                  className="rounded-xl border border-sand bg-surface p-5"
                >
                  <div className="flex flex-wrap items-center gap-3">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        s.type === "prayer"
                          ? "bg-gold text-black"
                          : "bg-ember text-white"
                      }`}
                    >
                      {s.type === "prayer" ? "Prayer Request" : "Feedback"}
                    </span>
                    <span className="text-xs text-ink-soft">
                      {formatDate(s.created_at)}
                    </span>
                  </div>

                  <p className="m-0 mt-3 whitespace-pre-wrap text-ink">{s.message}</p>

                  <p className="m-0 mt-3 text-sm text-ink-soft">
                    {s.name ? s.name : "Anonymous"}
                    {s.email ? (
                      <>
                        {" - "}
                        <a href={`mailto:${s.email}`}>{s.email}</a>
                      </>
                    ) : null}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
