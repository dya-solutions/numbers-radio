"use client";

import { usePathname } from "next/navigation";
import { STATION_NAME } from "@/lib/config";
import { usePlayer } from "./PlayerProvider";
import { PauseIcon, PlayIcon } from "./PlayerIcons";

/**
 * Slim player fixed to the bottom of every page except the homepage (which
 * has the large featured player). Controls the same shared audio element, so
 * whatever was playing keeps playing as visitors browse.
 */
export default function MiniPlayer() {
  const pathname = usePathname();
  const { status, volume, setVolume, toggle, retry } = usePlayer();

  if (pathname === "/") return null;

  const active =
    status === "playing" || status === "loading" || status === "reconnecting";
  const label =
    status === "playing"
      ? "Pause"
      : status === "loading"
        ? "Connecting..."
        : status === "reconnecting"
          ? "Reconnecting..."
          : "Listen Live";

  const statusText =
    status === "playing"
      ? "Live now"
      : status === "loading"
        ? "Connecting..."
        : status === "reconnecting"
          ? "Reconnecting..."
          : status === "error"
            ? "Could not start the stream"
            : "Tap to listen live";

  return (
    <>
      {/* Keeps the footer from sitting underneath the fixed bar. */}
      <div aria-hidden="true" className="h-[68px]" />

      <div
        role="region"
        aria-label="Live radio player"
        className="fixed inset-x-0 bottom-0 z-20 border-t border-sand bg-cream/95 backdrop-blur"
      >
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-2.5">
          <button
            type="button"
            onClick={toggle}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-ember text-white shadow transition-transform hover:scale-105 hover:bg-ember-dark"
            aria-label={label}
          >
            {active ? <PauseIcon size={18} /> : <PlayIcon size={20} />}
          </button>

          <div className="min-w-0 flex-1">
            <p className="m-0 truncate text-sm font-semibold text-ink">
              {STATION_NAME}
            </p>
            <p
              aria-live="polite"
              className={`m-0 flex items-center gap-1.5 truncate text-xs ${
                status === "error" ? "text-red-300" : "text-ink-soft"
              }`}
            >
              {status === "playing" || status === "reconnecting" ? (
                <span
                  aria-hidden="true"
                  className={`inline-block h-2 w-2 shrink-0 animate-pulse rounded-full ${
                    status === "playing" ? "bg-ember" : "bg-gold"
                  }`}
                />
              ) : null}
              <span
                className={
                  status === "playing" || status === "reconnecting" ? "text-gold" : undefined
                }
              >
                {statusText}
              </span>
            </p>
          </div>

          {status === "error" || status === "reconnecting" ? (
            <button
              type="button"
              onClick={retry}
              className="shrink-0 rounded-lg border border-gold px-3 py-1.5 text-sm font-semibold text-gold transition-colors hover:bg-gold hover:text-black"
            >
              Try Again
            </button>
          ) : (
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={volume}
              onChange={(e) => setVolume(Number(e.target.value))}
              className="h-1 w-20 shrink-0 accent-ember sm:w-32"
              aria-label="Volume"
            />
          )}
        </div>
      </div>
    </>
  );
}
