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

function Fields({ entry }: { entry?: PrayerPoint }) {
  return (
    <div className="space-y-3">
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-ink">
          Title or short description
        </span>
        <input
          name="title"
          defaultValue={entry?.title ?? ""}
          placeholder="e.g. Pray for families affected by the flooding in ..."
          className={inputClass}
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-ink">Link</span>
        <input
          name="url"
          defaultValue={entry?.url ?? ""}
          placeholder="Paste the news story link here"
          className={inputClass}
        />
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
  const addFormRef = useRef<HTMLFormElement>(null);

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
        <form
          ref={addFormRef}
          className="mt-4 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            run(addPrayerPoint, fd, () => addFormRef.current?.reset());
          }}
        >
          <Fields />
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
