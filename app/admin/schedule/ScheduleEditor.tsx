"use client";

import { useState, useTransition } from "react";
import type { ScheduleEntry } from "@/lib/content";
import { SCHEDULE_TIMEZONE_ABBR, SCHEDULE_TIMEZONE_NAME } from "@/lib/config";
import { EVERY_DAY, WEEK, WEEKDAYS, WEEKENDS, daysLabel } from "@/lib/schedule";
import {
  addScheduleEntry,
  updateScheduleEntry,
  deleteScheduleEntry,
  type ActionResult,
} from "./actions";

const inputClass =
  "w-full rounded-lg border border-sand bg-surface-2 px-3 py-2 outline-none focus:border-ember";

const quickButtonClass =
  "rounded-lg border border-sand px-3 py-1.5 text-sm text-ink-soft transition-colors hover:border-gold hover:text-ink";

/** Monday-Sunday checkboxes plus "Every day", "Weekdays" and "Weekends" shortcuts. */
function DaysPicker({ defaultDays }: { defaultDays: number[] }) {
  const [selected, setSelected] = useState<Set<number>>(() => new Set(defaultDays));

  function toggle(n: number) {
    setSelected((previous) => {
      const next = new Set(previous);
      if (next.has(n)) next.delete(n);
      else next.add(n);
      return next;
    });
  }

  function choose(days: readonly number[]) {
    setSelected(new Set(days));
  }

  return (
    <fieldset className="m-0 min-w-0 border-0 p-0 sm:col-span-2">
      <legend className="mb-1 block p-0 text-sm font-medium text-ink">
        Days <span className="font-normal text-ink-soft">(tick every day this show airs)</span>
      </legend>
      <div className="flex flex-wrap gap-2">
        {WEEK.map((d) => (
          <label key={d.n} className="cursor-pointer">
            <input
              type="checkbox"
              name="days"
              value={d.n}
              checked={selected.has(d.n)}
              onChange={() => toggle(d.n)}
              className="peer sr-only"
            />
            <span
              title={d.long}
              className="block min-w-14 rounded-lg border border-sand bg-surface-2 px-3 py-2 text-center text-sm font-semibold text-ink-soft transition-colors hover:border-gold peer-checked:border-gold peer-checked:bg-gold peer-checked:text-black peer-focus-visible:ring-2 peer-focus-visible:ring-gold peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-black"
            >
              {d.short}
            </span>
          </label>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <button type="button" onClick={() => choose(EVERY_DAY)} className={quickButtonClass}>
          Every day
        </button>
        <button type="button" onClick={() => choose(WEEKDAYS)} className={quickButtonClass}>
          Weekdays
        </button>
        <button type="button" onClick={() => choose(WEEKENDS)} className={quickButtonClass}>
          Weekends
        </button>
        <button type="button" onClick={() => choose([])} className={quickButtonClass}>
          Clear
        </button>
      </div>
    </fieldset>
  );
}

function Fields({ entry }: { entry?: ScheduleEntry }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {entry && entry.days.length === 0 ? (
        <p className="m-0 rounded-lg border border-gold bg-surface-2 px-3 py-2 text-sm text-ink sm:col-span-2">
          <strong className="text-gold">Choose days.</strong> This show was saved with the day text &ldquo;
          {entry.originalDay || "(blank)"}&rdquo;, which could not be turned into days automatically.
        </p>
      ) : null}
      <DaysPicker defaultDays={entry?.days ?? []} />
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-ink">
          Time (24-hour)
        </span>
        <input
          name="time_label"
          defaultValue={entry?.timeLabel ?? ""}
          placeholder="e.g. 08:00 or 18:30"
          pattern="([01]?[0-9]|2[0-3]):[0-5][0-9]"
          title="Use the 24-hour clock, like 09:00 or 18:30"
          maxLength={5}
          autoComplete="off"
          className={inputClass}
        />
        <span className="mt-1 block text-xs text-ink-soft">
          Times are in {SCHEDULE_TIMEZONE_NAME} ({SCHEDULE_TIMEZONE_ABBR}). Just
          type the time - &ldquo;{SCHEDULE_TIMEZONE_ABBR}&rdquo; is added for you.
        </span>
      </label>
      <label className="block">
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
  // Changing this empties the "Add a show" form after a successful add.
  const [addFormKey, setAddFormKey] = useState(0);

  const needDays = entries.filter((e) => e.days.length === 0);

  function run(
    action: (fd: FormData) => Promise<ActionResult>,
    formData: FormData,
    onSuccess?: () => void,
  ) {
    setMessage(null);
    // Quick check in the browser (the server checks again).
    if (action !== deleteScheduleEntry && formData.getAll("days").length === 0) {
      setMessage({ ok: false, message: "Please choose at least one day." });
      return;
    }
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
          role="status"
          className={`rounded-lg px-4 py-2 text-sm ${
            message.ok
              ? "bg-sand/70 text-ink"
              : "bg-surface-2 text-red-300 border border-ember"
          }`}
        >
          {message.message}
        </p>
      ) : null}

      {needDays.length > 0 ? (
        <section className="rounded-xl border border-gold bg-surface p-5">
          <h2 className="m-0 text-lg text-gold">
            Choose days for {needDays.length} {needDays.length === 1 ? "show" : "shows"}
          </h2>
          <p className="mb-2 mt-1 text-sm text-ink-soft">
            {needDays.length === 1 ? "This show has" : "These shows have"} no days yet, so the public Program Guide lists
            {needDays.length === 1 ? " it" : " them"} under &ldquo;Other times&rdquo;. Click Edit and tick the days.
          </p>
          <ul className="m-0 list-disc space-y-1 pl-5 text-sm text-ink">
            {needDays.map((e) => (
              <li key={e.id}>
                <a href={`#show-${e.id}`}>{e.showName || "(no name)"}</a>{" "}
                <span className="text-ink-soft">
                  - {e.timeLabel}, was &ldquo;{e.originalDay || "blank"}&rdquo;
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Add a new show */}
      <section className="rounded-xl border border-sand bg-surface p-6">
        <h2 className="m-0 text-xl text-gold">Add a show</h2>
        <form
          key={addFormKey}
          className="mt-4 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            run(addScheduleEntry, fd, () => setAddFormKey((k) => k + 1));
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
        <h2 className="m-0 text-xl text-gold">
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
                id={`show-${entry.id}`}
                className={`scroll-mt-20 rounded-xl border bg-surface p-5 ${
                  entry.days.length === 0 ? "border-gold" : "border-sand"
                }`}
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
                        {entry.days.length > 0 ? (
                          <>
                            {daysLabel(entry.days)} - {entry.timeLabel} {SCHEDULE_TIMEZONE_ABBR}
                          </>
                        ) : (
                          <>
                            <span className="mr-2 rounded-full bg-gold px-2 py-0.5 text-xs font-semibold text-black">
                              Choose days
                            </span>{" "}
                            was &ldquo;{entry.originalDay || "blank"}&rdquo; - {entry.timeLabel}{" "}
                            {SCHEDULE_TIMEZONE_ABBR}
                          </>
                        )}
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
