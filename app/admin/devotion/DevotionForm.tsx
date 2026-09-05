"use client";

import { useActionState, useRef } from "react";
import { useFormStatus } from "react-dom";
import type { Devotion } from "@/lib/content";
import { saveDevotion, type SaveResult } from "./actions";

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-ember px-6 py-2.5 font-semibold text-white transition-colors hover:bg-ember-dark disabled:opacity-60"
    >
      {pending ? "Saving..." : "Save"}
    </button>
  );
}

function TextField({
  label,
  name,
  hint,
  defaultValue,
}: {
  label: string;
  name: string;
  hint?: string;
  defaultValue: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block font-medium text-ink">{label}</span>
      {hint ? <span className="mb-1 block text-sm text-ink-soft">{hint}</span> : null}
      <input
        type="text"
        name={name}
        defaultValue={defaultValue}
        className="w-full rounded-lg border border-sand bg-surface-2 px-3 py-2 outline-none focus:border-ember"
      />
    </label>
  );
}

function TextArea({
  label,
  name,
  hint,
  defaultValue,
  rows,
}: {
  label: string;
  name: string;
  hint?: string;
  defaultValue: string;
  rows: number;
}) {
  return (
    <label className="block">
      <span className="mb-1 block font-medium text-ink">{label}</span>
      {hint ? <span className="mb-1 block text-sm text-ink-soft">{hint}</span> : null}
      <textarea
        name={name}
        rows={rows}
        defaultValue={defaultValue}
        className="w-full rounded-lg border border-sand bg-surface-2 px-3 py-2 outline-none focus:border-ember"
      />
    </label>
  );
}

export default function DevotionForm({ devotion }: { devotion: Devotion }) {
  const [state, formAction] = useActionState<SaveResult | null, FormData>(
    saveDevotion,
    null,
  );
  const formRef = useRef<HTMLFormElement>(null);

  function handleClearAll() {
    const confirmed = confirm(
      "Clear every box in this form?\n\nThis only empties the form on screen - nothing on the website changes until you press Save.",
    );
    if (!confirmed) return;

    formRef.current
      ?.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("input, textarea")
      .forEach((field) => {
        field.value = "";
      });
  }

  return (
    <form ref={formRef} action={formAction} className="space-y-6">
      {/* 1. Date */}
      <TextField
        label="1. Date"
        name="date_label"
        hint="Shown at the top of the page, in plain words. Example: September 4, 2026"
        defaultValue={devotion.dateLabel}
      />

      {/* 2. Source line */}
      <TextField
        label="2. Source line"
        name="source_line"
        hint="Where the devotion is from and who it is by. Example: From Our Daily Bread, by Tim Gustafson"
        defaultValue={devotion.sourceLine}
      />

      {/* 3. Devotion title */}
      <TextField
        label="3. Devotion title (the message of the day)"
        name="title"
        defaultValue={devotion.title}
      />

      {/* 4. Scripture */}
      <TextField
        label="4. Scripture - reference"
        name="scripture_reference"
        hint="Example: Isaiah 43:1"
        defaultValue={devotion.scriptureReference}
      />
      <TextArea
        label="4. Scripture - the verse text"
        name="scripture_text"
        rows={3}
        defaultValue={devotion.scriptureText}
      />

      {/* 5. Body */}
      <TextArea
        label="5. Body (the main devotion)"
        name="body"
        hint="Leave one blank line between paragraphs."
        rows={12}
        defaultValue={devotion.body}
      />

      {/* 6. Further study */}
      <TextArea
        label="6. Further study"
        name="further_study"
        hint="Related reading or extra verses. Put each suggestion on its own line."
        rows={5}
        defaultValue={devotion.furtherStudy}
      />

      {/* 7. Golden nugget */}
      <TextArea
        label="7. Golden nugget"
        name="golden_nugget"
        hint="One short standout takeaway line or quote."
        rows={2}
        defaultValue={devotion.goldenNugget}
      />

      {/* 8. Prayer */}
      <TextArea
        label="8. Prayer"
        name="prayer"
        hint="A short closing prayer."
        rows={4}
        defaultValue={devotion.prayer}
      />

      <div className="flex flex-wrap items-center gap-4">
        <SaveButton />
        <button
          type="button"
          onClick={handleClearAll}
          className="rounded-lg border border-sand px-4 py-2.5 text-sm font-semibold text-ink-soft transition-colors hover:border-ember hover:text-red-300"
        >
          Clear All
        </button>
        {state ? (
          <span
            className={`text-sm ${state.ok ? "text-ink-soft" : "text-red-300"}`}
          >
            {state.message}
          </span>
        ) : null}
      </div>
    </form>
  );
}
