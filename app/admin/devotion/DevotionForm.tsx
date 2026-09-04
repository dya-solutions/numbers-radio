"use client";

import { useActionState } from "react";
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
        className="w-full rounded-lg border border-sand bg-white px-3 py-2 outline-none focus:border-ember"
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
        className="w-full rounded-lg border border-sand bg-white px-3 py-2 outline-none focus:border-ember"
      />
    </label>
  );
}

export default function DevotionForm({ devotion }: { devotion: Devotion }) {
  const [state, formAction] = useActionState<SaveResult | null, FormData>(
    saveDevotion,
    null,
  );

  return (
    <form action={formAction} className="space-y-5">
      <TextField
        label="Today's date"
        name="date_label"
        hint="Shown at the top of the page, in plain words. Example: September 4, 2026"
        defaultValue={devotion.dateLabel}
      />
      <TextField
        label="Title"
        name="title"
        defaultValue={devotion.title}
      />
      <TextField
        label="Bible verse - where it is from"
        name="scripture_reference"
        hint="Example: Isaiah 43:1"
        defaultValue={devotion.scriptureReference}
      />
      <TextArea
        label="Bible verse - the words"
        name="scripture_text"
        rows={3}
        defaultValue={devotion.scriptureText}
      />
      <TextArea
        label="Reflection"
        name="reflection"
        hint="The main devotion. Leave one blank line between paragraphs."
        rows={10}
        defaultValue={devotion.reflection}
      />
      <TextArea
        label="Prayer"
        name="prayer"
        hint="A short closing prayer."
        rows={4}
        defaultValue={devotion.prayer}
      />

      <div className="flex items-center gap-4">
        <SaveButton />
        {state ? (
          <span
            className={`text-sm ${state.ok ? "text-ink-soft" : "text-ember-dark"}`}
          >
            {state.message}
          </span>
        ) : null}
      </div>
    </form>
  );
}
