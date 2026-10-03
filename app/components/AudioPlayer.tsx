"use client";

import { STATION_NAME } from "@/lib/config";
import { usePlayer } from "./PlayerProvider";
import { PauseIcon, PlayIcon } from "./PlayerIcons";

/**
 * The large, featured player on the homepage. It has no audio of its own -
 * it controls the shared player in PlayerProvider, so leaving the homepage
 * never interrupts the stream.
 */
export default function AudioPlayer() {
  const { status, volume, setVolume, toggle, retry } = usePlayer();

  const label =
    status === "playing"
      ? "Pause"
      : status === "loading"
        ? "Connecting..."
        : status === "reconnecting"
          ? "Reconnecting..."
          : "Listen Live";

  const detail =
    status === "playing"
      ? `You are listening to ${STATION_NAME}`
      : status === "reconnecting"
        ? "The connection dropped - reconnecting automatically. You don't need to do anything."
        : status === "error"
          ? "The stream could not be started. Please tap Try Again."
          : "Tap to start the live broadcast";

  const busy =
    status === "playing" || status === "loading" || status === "reconnecting";

  return (
    <div className="rounded-2xl border border-sand bg-surface p-6 shadow-sm">
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={toggle}
          className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-ember text-white shadow transition-transform hover:scale-105 hover:bg-ember-dark"
          aria-label={label}
        >
          {busy ? <PauseIcon /> : <PlayIcon />}
        </button>

        <div className="min-w-0" aria-live="polite">
          <p className="m-0 flex items-center gap-2 text-lg font-semibold text-ink">
            {label}
            {status === "reconnecting" ? (
              <span
                aria-hidden="true"
                className="inline-block h-2 w-2 animate-pulse rounded-full bg-gold"
              />
            ) : null}
          </p>
          <p
            className={`m-0 text-sm ${
              status === "error" ? "text-red-300" : "text-ink-soft"
            }`}
          >
            {detail}
          </p>
          {status === "error" || status === "reconnecting" ? (
            <button
              type="button"
              onClick={retry}
              className="mt-3 rounded-lg border border-gold px-3 py-1.5 text-sm font-semibold text-gold transition-colors hover:bg-gold hover:text-black"
            >
              Try Again
            </button>
          ) : null}
        </div>
      </div>

      <div className="mt-5 flex items-center gap-3">
        <span className="text-xs text-ink-soft">Volume</span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={volume}
          onChange={(e) => setVolume(Number(e.target.value))}
          className="h-1 w-full max-w-xs accent-ember"
          aria-label="Volume"
        />
      </div>
    </div>
  );
}
