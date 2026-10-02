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
  const { status, volume, setVolume, toggle } = usePlayer();

  const label =
    status === "playing"
      ? "Pause"
      : status === "loading"
        ? "Connecting..."
        : "Listen Live";

  return (
    <div className="rounded-2xl border border-sand bg-surface p-6 shadow-sm">
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={toggle}
          className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-ember text-white shadow transition-transform hover:scale-105 hover:bg-ember-dark"
          aria-label={label}
        >
          {status === "playing" || status === "loading" ? (
            <PauseIcon />
          ) : (
            <PlayIcon />
          )}
        </button>

        <div className="min-w-0">
          <p className="m-0 text-lg font-semibold text-ink">{label}</p>
          <p className="m-0 text-sm text-ink-soft">
            {status === "playing"
              ? `You are listening to ${STATION_NAME}`
              : status === "error"
                ? "The stream could not be reached. Please try again shortly."
                : "Tap to start the live broadcast"}
          </p>
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
