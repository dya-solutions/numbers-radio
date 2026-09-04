"use client";

import { useEffect, useRef, useState } from "react";
import { STATION_NAME, STREAM_URL } from "@/lib/config";

type Status = "stopped" | "loading" | "playing" | "error";

export default function AudioPlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [status, setStatus] = useState<Status>("stopped");
  const [volume, setVolume] = useState(0.8);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  async function togglePlay() {
    const audio = audioRef.current;
    if (!audio) return;

    if (status === "playing" || status === "loading") {
      audio.pause();
      // Reload so we always pull the live edge next time, not buffered audio.
      audio.removeAttribute("src");
      audio.load();
      setStatus("stopped");
      return;
    }

    try {
      setStatus("loading");
      audio.src = STREAM_URL;
      audio.load();
      await audio.play();
      setStatus("playing");
    } catch {
      setStatus("error");
    }
  }

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
          onClick={togglePlay}
          disabled={status === "loading"}
          className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-ember text-white shadow transition-transform hover:scale-105 hover:bg-ember-dark disabled:opacity-60"
          aria-label={label}
        >
          {status === "playing" ? (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="5" width="4" height="14" rx="1" />
              <rect x="14" y="5" width="4" height="14" rx="1" />
            </svg>
          ) : (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5.14v13.72c0 .8.87 1.28 1.54.86l10.79-6.86a1 1 0 0 0 0-1.72L9.54 4.28A1 1 0 0 0 8 5.14z" />
            </svg>
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

      {/* The actual audio element is hidden; the controls above drive it. */}
      <audio
        ref={audioRef}
        preload="none"
        onPlaying={() => setStatus("playing")}
        onWaiting={() => setStatus("loading")}
        onError={() => setStatus((s) => (s === "stopped" ? s : "error"))}
      />
    </div>
  );
}
