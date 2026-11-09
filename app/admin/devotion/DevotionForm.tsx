"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import type { Devotion } from "@/lib/content";
import type { AudioInfo } from "@/lib/devotionSpeech";
import { saveDevotion, type SaveResult } from "./actions";

function SaveButton({ blocked }: { blocked: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || blocked}
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

type AudioPhase =
  | { kind: "idle" }
  | { kind: "generating" }
  | { kind: "error"; message: string };

const smallButton =
  "rounded-lg border border-gold px-3 py-1.5 text-sm font-semibold text-gold no-underline transition-colors hover:bg-gold hover:text-black disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-gold";

function allFieldsEmpty(form: HTMLFormElement | null) {
  if (!form) return false;
  return [...form.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("input, textarea")].every(
    (field) => field.value.trim() === "",
  );
}

export default function DevotionForm({
  devotion,
  initialAudio,
}: {
  devotion: Devotion;
  initialAudio: AudioInfo;
}) {
  const [state, formAction] = useActionState<SaveResult | null, FormData>(
    saveDevotion,
    null,
  );
  const formRef = useRef<HTMLFormElement>(null);

  // ----- the listen-aloud audio (made in a separate step after saving) -----
  const [audio, setAudio] = useState<AudioInfo>(initialAudio);
  const [phase, setPhase] = useState<AudioPhase>({ kind: "idle" });
  const [unsaved, setUnsaved] = useState(false);
  const [formEmpty, setFormEmpty] = useState(false);
  const lastForce = useRef(false);
  const handledState = useRef<SaveResult | null>(null);
  const generating = phase.kind === "generating";

  async function generateAudio(force: boolean) {
    lastForce.current = force;
    setPhase({ kind: "generating" });
    try {
      const res = await fetch("/admin/api/devotion-audio", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Requested-With": "numbers-admin",
        },
        body: JSON.stringify({ force }),
      });
      const data = (await res.json().catch(() => null)) as
        | { ok?: boolean; audio?: AudioInfo; message?: string }
        | null;

      if (res.ok && data?.ok && data.audio) {
        setAudio(data.audio);
        setPhase({ kind: "idle" });
        return;
      }
      setPhase({
        kind: "error",
        message:
          data?.message ??
          (res.status === 401
            ? "You have been signed out. Reload this page and sign in again."
            : "The audio could not be made right now (the request timed out or failed)."),
      });
    } catch {
      setPhase({
        kind: "error",
        message:
          "Could not reach the website to make the audio. Check your internet connection and try again.",
      });
    }
  }

  // After a successful Save: show the new audio status, then start the audio.
  useEffect(() => {
    if (!state || handledState.current === state) return;
    handledState.current = state;
    if (!state.ok) return;
    setUnsaved(false);
    setFormEmpty(false);
    if (state.audio) setAudio(state.audio);
    if (state.needsAudio) void generateAudio(false);
    else setPhase({ kind: "idle" });
    // generateAudio only uses setters and refs, so it is safe to leave out.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

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
    setUnsaved(true);
    setFormEmpty(true);
  }

  return (
    <form
      ref={formRef}
      action={formAction}
      className="space-y-6"
      onInput={() => {
        setUnsaved(true);
        setFormEmpty(allFieldsEmpty(formRef.current));
      }}
      onSubmit={(event) => {
        if (
          allFieldsEmpty(formRef.current) &&
          !confirm(
            "Every box is empty.\n\nSaving will remove today's devotion (and its audio) from the website. Continue?",
          )
        ) {
          event.preventDefault();
        }
      }}
    >
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
        <SaveButton blocked={generating} />
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

      <AudioPanel
        audio={audio}
        phase={phase}
        unsaved={unsaved}
        willBeCleared={formEmpty && audio.status !== "none"}
        onGenerate={() => generateAudio(false)}
        onRegenerate={() => generateAudio(true)}
        onRetry={() => generateAudio(lastForce.current)}
      />
    </form>
  );
}

function Spinner() {
  return (
    <span
      aria-hidden="true"
      className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-gold border-t-transparent"
    />
  );
}

function AudioPanel({
  audio,
  phase,
  unsaved,
  willBeCleared,
  onGenerate,
  onRegenerate,
  onRetry,
}: {
  audio: AudioInfo;
  phase: AudioPhase;
  unsaved: boolean;
  willBeCleared: boolean;
  onGenerate: () => void;
  onRegenerate: () => void;
  onRetry: () => void;
}) {
  const busy = phase.kind === "generating";

  return (
    <section
      aria-live="polite"
      className="rounded-xl border border-sand bg-surface-2 p-4"
    >
      <h3 className="m-0 text-base text-gold">Listen-aloud audio</h3>
      <p className="m-0 mt-1 text-xs text-ink-soft">
        Made automatically from the saved text with an AI voice. The date is not read.
      </p>

      <div className="mt-3 space-y-3">
        {willBeCleared ? (
          <p className="m-0 text-sm text-ink">
            The audio will be removed when you save.
          </p>
        ) : busy ? (
          <div>
            <p className="m-0 flex items-center gap-2 text-sm font-semibold text-ink">
              <Spinner /> Generating audio&hellip;
            </p>
            <p className="m-0 mt-1 text-xs text-ink-soft">
              This can take up to a minute. Your text is already saved.
            </p>
          </div>
        ) : phase.kind === "error" ? (
          <div className="space-y-2">
            <p className="m-0 text-sm text-red-300">{phase.message}</p>
            <p className="m-0 text-xs text-ink-soft">Your text is saved - nothing was lost.</p>
            <button type="button" onClick={onRetry} className={smallButton}>
              Try again
            </button>
          </div>
        ) : audio.status === "ready" && audio.url ? (
          <div className="space-y-3">
            <p className="m-0 text-sm font-semibold text-ink">
              <span className="text-gold">&#10003;</span> Audio ready
            </p>
            <audio
              controls
              preload="metadata"
              src={audio.url}
              className="w-full"
              style={{ colorScheme: "dark" }}
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={onRegenerate}
                disabled={unsaved}
                className={smallButton}
              >
                Regenerate audio
              </button>
              {audio.downloadUrl ? (
                <a href={audio.downloadUrl} download className={smallButton}>
                  Download MP3
                </a>
              ) : null}
            </div>
          </div>
        ) : audio.status === "outdated" ? (
          <div className="space-y-2">
            <p className="m-0 text-sm font-semibold text-ink">
              <span className="text-gold">!</span> Audio is out of date
            </p>
            <p className="m-0 text-xs text-ink-soft">
              The text was changed after this audio was made. Visitors hear the
              device&rsquo;s own voice until you regenerate it.
            </p>
            <button
              type="button"
              onClick={onRegenerate}
              disabled={unsaved}
              className={smallButton}
            >
              Regenerate audio
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="m-0 text-sm text-ink-soft">No audio has been made yet.</p>
            <button
              type="button"
              onClick={onGenerate}
              disabled={unsaved}
              className={smallButton}
            >
              Generate audio
            </button>
          </div>
        )}

        {unsaved && !busy ? (
          <p className="m-0 text-xs text-ink-soft">
            You have changes that are not saved yet. Press Save first - the audio is
            always made from the saved text.
          </p>
        ) : null}
      </div>
    </section>
  );
}
