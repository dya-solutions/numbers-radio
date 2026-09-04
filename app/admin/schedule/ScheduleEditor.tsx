"use client";

import { useRef, useState, useTransition } from "react";
import type { ScheduleEntry } from "@/lib/content";
import {
  addScheduleEntry,
  updateScheduleEntry,
  deleteScheduleEntry,
  type ActionResult,
} from "./actions";

const inputClass =
  "w-full rounded-lg border border-sand bg-white px-3 py-2 outline-none focus:border-ember";

function Fields({ entry }: { entry?: ScheduleEntry }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-ink">Day</span>
        <input
          name="day"
          defaultValue={entry?.day ?? ""}
          placeholder="e.g. Sunday, or Weekday Mornings"
          className={inputClass}
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-ink">Time</span>
        <input
          name="time_label"
          defaultValue={entry?.timeLabel ?? ""}
          placeholder="e.g. 8:00 AM"
          className={inputClass}
        />
      </label>
      <label className="block sm:col-span-2">
        <span className="mb-1 block text-sm font-medium text-ink">Show name</span>
        <input
          name="show_name"
          defaultValue={entry?.showName ?? ""}
          placeholder="e.g. The Morning Word"
          className={inputClass}
        />
      </label>
      <label className="block sm:col-span-2">
        <span className="mb-1 block text-sm font-medium text-ink">
          Short description
        </span>
        <input
          name="description"
          defaultValue={entry?.description ?? ""}
          placeholder="One sentence about the show"
          className={inputClass}
        />
      </label>
    </div>
  );
}

export default function ScheduleEditor({
  entries,
}: {
  entries: ScheduleEntry[];
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
              : "bg-white text-ember-dark border border-ember"
          }`}
        >
          {message.message}
        </p>
      ) : null}

      {/* Add a new show */}
      <section className="rounded-xl border border-sand bg-white/60 p-6">
        <h2 className="m-0 text-xl text-ember-dark">Add a show</h2>
        <form
          ref={addFormRef}
          className="mt-4 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            run(addScheduleEntry, fd, () => addFormRef.current?.reset());
          }}
        >
          <Fields />
          <button
            type="submit"
            disabled={isPending}
            className="rounded-lg bg-ember px-5 py-2.5 font-semibold text-white transition-colors hover:bg-ember-dark disabled:opacity-60"
          >
            {isPending ? "Working..." : "Add show"}
          </button>
        </form>
      </section>

      {/* Existing shows */}
      <section className="space-y-3">
        <h2 className="m-0 text-xl text-ember-dark">
          Current shows ({entries.length})
        </h2>

        {entries.length === 0 ? (
          <p className="text-ink-soft">
            No shows yet. Add your first one above.
          </p>
        ) : (
          <ul className="space-y-3">
            {entries.map((entry) => (
              <li
                key={entry.id}
                className="rounded-xl border border-sand bg-white/60 p-5"
              >
                {editingId === entry.id ? (
                  <form
                    className="space-y-4"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const fd = new FormData(e.currentTarget);
                      fd.set("id", entry.id);
                      run(updateScheduleEntry, fd, () => setEditingId(null));
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
                    <div>
                      <p className="m-0 text-sm text-ink-soft">
                        {entry.day} - {entry.timeLabel}
                      </p>
                      <p className="m-0 font-semibold text-ink">
                        {entry.showName}
                      </p>
                      {entry.description ? (
                        <p className="m-0 text-sm text-ink-soft">
                          {entry.description}
                        </p>
                      ) : null}
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
                          if (
                            !confirm(
                              `Remove "${entry.showName}" from the schedule?`,
                            )
                          )
                            return;
                          const fd = new FormData();
                          fd.set("id", entry.id);
                          run(deleteScheduleEntry, fd);
                        }}
                      >
                        <button
                          type="submit"
                          disabled={isPending}
                          className="rounded-lg border border-ember px-3 py-1.5 text-sm text-ember-dark hover:bg-ember hover:text-white disabled:opacity-60"
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
