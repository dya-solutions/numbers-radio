"use client";

import { useRef, useState, useTransition } from "react";
import type { PrayerPoint } from "@/lib/content";
import {
  addPrayerPoint,
  updatePrayerPoint,
  deletePrayerPoint,
  type ActionResult,
} from "./actions";

const inputClass =
  "w-full rounded-lg border border-sand bg-surface-2 px-3 py-2 outline-none focus:border-ember";

type FetchStatus = "idle" | "loading" | "done" | "error";

function Fields({ entry }: { entry?: PrayerPoint }) {
  const [url, setUrl] = useState(entry?.url ?? "");
  const [title, setTitle] = useState(entry?.title ?? "");
  // True once the user types in the title box - we never overwrite after that.
  const [titleTouched, setTitleTouched] = useState(Boolean(entry?.title));
  const [status, setStatus] = useState<FetchStatus>("idle");
  const [hint, setHint] = useState("");
  const lastFetched = useRef("");

  async function fetchTitleFor(rawUrl: string, force = false) {
    let link = rawUrl.trim();
    if (!link) return;
    // Match the server: a pasted bare domain still gets looked up.
    if (!/^https?:\/\//i.test(link)) link = `https://${link}`;
    // Respect a title the user has edited, unless they explicitly ask again.
    if (titleTouched && !force) return;
    if (lastFetched.current === link && !force) return; // already tried this link

    lastFetched.current = link;
    setStatus("loading");
    setHint("");

    try {
      const res = await fetch(
        `/admin/api/fetch-title?url=${encodeURIComponent(link)}`,
      );
      const data: { title?: string; error?: string } = await res
        .json()
        .catch(() => ({}));

      if (res.ok && data.title) {
        setTitle(data.title);
        setTitleTouched(false);
        setStatus("done");
        setHint("Title filled in from the link - edit it below if needed.");
      } else {
        setStatus("error");
        setHint(
          `${data.error ?? "Could not read the page title."} You can type one below.`,
        );
      }
    } catch {
      setStatus("error");
      setHint("Could not read the page title. You can type one below.");
    }
  }

  return (
    <div className="space-y-3">
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-ink">Link</span>
        <div className="flex gap-2">
          <input
            name="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onBlur={(e) => fetchTitleFor(e.target.value)}
            onPaste={(e) => {
              const pasted = e.clipboardData.getData("text");
              if (pasted) setTimeout(() => fetchTitleFor(pasted), 0);
            }}
            placeholder="Paste the news story link here"
            className={inputClass}
          />
          <button
            type="button"
            onClick={() => fetchTitleFor(url, true)}
            disabled={!url.trim() || status === "loading"}
            className="shrink-0 rounded-lg border border-sand px-3 py-2 text-sm text-ink-soft transition-colors hover:border-gold hover:text-gold disabled:opacity-50"
          >
            Get title
          </button>
        </div>
      </label>

      <label className="block">
        <span className="mb-1 block text-sm font-medium text-ink">
          Title or short description
        </span>
        <input
          name="title"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            setTitleTouched(true);
          }}
          placeholder="Filled in from the link - or type your own"
          className={inputClass}
        />
        {status === "loading" ? (
          <span className="mt-1 block text-sm text-ink-soft">
            Fetching the page title...
          </span>
        ) : hint ? (
          <span
            className={`mt-1 block text-sm ${
              status === "error" ? "text-red-300" : "text-ink-soft"
            }`}
          >
            {hint}
          </span>
        ) : null}
      </label>
    </div>
  );
}

export default function PrayerPointsEditor({
  entries,
}: {
  entries: PrayerPoint[];
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState<ActionResult | null>(null);
  const [isPending, startTransition] = useTransition();
  // Bumping this remounts the "add" form so its fields reset after a save.
  const [addFormKey, setAddFormKey] = useState(0);

  function run(
    action: (fd: FormData) => Promise<ActionResult>,
    formData: FormData,
    onSuccess?: () => void,
  ) {
    setMessage(null);
    startTransition(async () => {
      const result = await action(formData);
      setMessage(result);
      if (result.ok && onSuccess) onSuccess();
    });
  }

  return (
    <div className="space-y-8">
      {message ? (
        <p
          className={`rounded-lg px-4 py-2 text-sm ${
            message.ok
              ? "bg-sand/70 text-ink"
              : "bg-surface-2 text-red-300 border border-ember"
          }`}
        >
          {message.message}
        </p>
      ) : null}

      {/* Add a new prayer point */}
      <section className="rounded-xl border border-sand bg-surface p-6">
        <h2 className="m-0 text-xl text-gold">Add a prayer point</h2>
        <p className="mt-1 text-sm text-ink-soft">
          Paste the link first - the title is pulled from the page
          automatically, and you can edit it before saving.
        </p>
        <form
          className="mt-4 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            run(addPrayerPoint, fd, () => setAddFormKey((k) => k + 1));
          }}
        >
          <Fields key={addFormKey} />
          <button
            type="submit"
            disabled={isPending}
            className="rounded-lg bg-ember px-5 py-2.5 font-semibold text-white transition-colors hover:bg-ember-dark disabled:opacity-60"
          >
            {isPending ? "Working..." : "Add prayer point"}
          </button>
        </form>
      </section>

      {/* Existing prayer points */}
      <section className="space-y-3">
        <h2 className="m-0 text-xl text-gold">
          Current prayer points ({entries.length})
        </h2>

        {entries.length === 0 ? (
          <p className="text-ink-soft">
            No prayer points yet. Add your first one above.
          </p>
        ) : (
          <ul className="space-y-3">
            {entries.map((entry) => (
              <li
                key={entry.id}
                className="rounded-xl border border-sand bg-surface p-5"
              >
                {editingId === entry.id ? (
                  <form
                    className="space-y-4"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const fd = new FormData(e.currentTarget);
                      fd.set("id", entry.id);
                      run(updatePrayerPoint, fd, () => setEditingId(null));
                    }}
                  >
                    <Fields entry={entry} />
                    <div className="flex gap-3">
                      <button
                        type="submit"
                        disabled={isPending}
                        className="rounded-lg bg-ember px-4 py-2 font-semibold text-white hover:bg-ember-dark disabled:opacity-60"
                      >
                        {isPending ? "Working..." : "Save changes"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(null);
                          setMessage(null);
                        }}
                        className="rounded-lg border border-sand px-4 py-2 text-ink-soft hover:text-ink"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="m-0 font-semibold text-ink">
                        {entry.title}
                      </p>
                      <p className="m-0 mt-1 truncate text-sm text-ink-soft">
                        {entry.url}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(entry.id);
                          setMessage(null);
                        }}
                        className="rounded-lg border border-sand px-3 py-1.5 text-sm text-ink-soft hover:text-ink"
                      >
                        Edit
                      </button>
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          if (!confirm(`Remove "${entry.title}"?`)) return;
                          const fd = new FormData();
                          fd.set("id", entry.id);
                          run(deletePrayerPoint, fd);
                        }}
                      >
                        <button
                          type="submit"
                          disabled={isPending}
                          className="rounded-lg border border-ember px-3 py-1.5 text-sm text-red-300 hover:bg-ember hover:text-white disabled:opacity-60"
                        >
                          Remove
                        </button>
                      </form>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
