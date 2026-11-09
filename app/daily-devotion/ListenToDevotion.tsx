"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePlayer } from "../components/PlayerProvider";
import { PauseIcon, PlayIcon } from "../components/PlayerIcons";
import { chunkText } from "@/lib/devotionSpeech";

/**
 * "Listen to today's devotion".
 *
 * - With matching AI audio: plays that MP3 (play/pause + a progress bar).
 * - Without it (none yet, or out of date): reads the same text aloud with the
 *   device's built-in voice, in sentence-sized pieces (browsers cut off long
 *   speech), with play / pause / stop.
 *
 * Either way the live radio is paused while this plays and comes back after
 * (only if it was playing) - see holdForSpeech / releaseSpeech in PlayerProvider.
 */

type Playback = "idle" | "playing" | "paused";
type Mode = "ai" | "device";

/** Sentence-sized pieces for the browser voice. */
const DEVICE_CHUNK_CHARS = 180;

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const whole = Math.floor(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

export default function ListenToDevotion({
  audioUrl,
  spokenText,
}: {
  audioUrl: string | null;
  spokenText: string;
}) {
  const { holdForSpeech, releaseSpeech } = usePlayer();

  const [mode, setMode] = useState<Mode>(audioUrl ? "ai" : "device");
  const [playback, setPlayback] = useState<Playback>("idle");
  const [notice, setNotice] = useState("");
  const [deviceSupported, setDeviceSupported] = useState(true);

  // AI audio
  const audioRef = useRef<HTMLAudioElement | null>(null);
  // Set when WE pause the audio to stop it, so the late "pause" event doesn't show "Resume".
  const ignoreNextPauseRef = useRef(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // Device voice
  const chunks = useMemo(() => chunkText(spokenText, DEVICE_CHUNK_CHARS), [spokenText]);
  const [chunkIndex, setChunkIndex] = useState(0);
  const chunkIndexRef = useRef(0);
  const runRef = useRef(0); // bumped on every pause/stop so old speech events are ignored
  const startTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Radio hand-off
  const holdingRef = useRef(false);
  const stopEverythingRef = useRef<() => void>(() => {});

  useEffect(() => {
    setDeviceSupported(
      typeof window !== "undefined" &&
        "speechSynthesis" in window &&
        typeof SpeechSynthesisUtterance !== "undefined",
    );
  }, []);

  function hold() {
    holdingRef.current = true;
    holdForSpeech(() => stopEverythingRef.current());
  }

  function release() {
    if (!holdingRef.current) return;
    holdingRef.current = false;
    releaseSpeech();
  }

  /* ----------------------------- device voice ----------------------------- */

  function cancelSpeech() {
    runRef.current++;
    if (startTimerRef.current) clearTimeout(startTimerRef.current);
    startTimerRef.current = null;
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  }

  function stopDevice() {
    cancelSpeech();
    chunkIndexRef.current = 0;
    setChunkIndex(0);
    setPlayback("idle");
    release();
  }

  function failDevice() {
    stopDevice();
    setNotice("Sorry, your device couldn't read the devotion aloud.");
  }

  function speakFrom(start: number) {
    const synth = window.speechSynthesis;
    const run = ++runRef.current;
    if (startTimerRef.current) clearTimeout(startTimerRef.current);

    hold();
    setNotice("");
    setPlayback("playing");
    synth.cancel(); // clear anything left over from before

    // Browsers sometimes drop the first piece spoken right after cancel(), so wait a beat.
    startTimerRef.current = setTimeout(() => {
      startTimerRef.current = null;
      if (run !== runRef.current) return;

      chunks.slice(start).forEach((piece, offset) => {
        const index = start + offset;
        const utterance = new SpeechSynthesisUtterance(piece);
        utterance.lang = "en-US";
        utterance.rate = 0.95;
        utterance.onstart = () => {
          if (run !== runRef.current) return;
          chunkIndexRef.current = index;
          setChunkIndex(index);
        };
        utterance.onend = () => {
          if (run !== runRef.current) return;
          if (index === chunks.length - 1) stopDevice(); // finished
        };
        utterance.onerror = (event) => {
          if (run !== runRef.current) return;
          // Pausing / stopping cancels speech on purpose - that's not a failure.
          if (event.error === "canceled" || event.error === "interrupted") return;
          failDevice();
        };
        synth.speak(utterance);
      });
    }, 60);
  }

  function pauseDevice() {
    cancelSpeech(); // keeps chunkIndexRef, so resume continues from this piece
    setPlayback("paused");
    // The radio stays paused: the listener is probably coming back to the devotion.
  }

  /* -------------------------------- AI audio ------------------------------ */

  function stopAi() {
    const audio = audioRef.current;
    if (audio) {
      if (!audio.paused) ignoreNextPauseRef.current = true;
      audio.pause();
      audio.currentTime = 0;
    }
    setCurrentTime(0);
    setPlayback("idle");
    release();
  }

  function useDeviceVoiceInstead() {
    const audio = audioRef.current;
    if (audio) audio.pause();
    setMode("device");
    setNotice("The recorded voice couldn't be played, so your device's voice is reading it instead.");
    if (deviceSupported && chunks.length > 0) speakFrom(0);
    else {
      setPlayback("idle");
      release();
    }
  }

  /* ----------------------------- shared controls -------------------------- */

  function stopEverything() {
    if (mode === "ai") stopAi();
    else stopDevice();
  }
  stopEverythingRef.current = stopEverything;

  function handleMainClick() {
    setNotice("");
    if (mode === "ai") {
      const audio = audioRef.current;
      if (!audio) return;
      if (audio.paused) {
        hold();
        audio.play().catch(useDeviceVoiceInstead);
      } else {
        audio.pause();
      }
      return;
    }

    if (playback === "playing") pauseDevice();
    else speakFrom(playback === "paused" ? chunkIndexRef.current : 0);
  }

  // Stop speaking (and give the radio back) when the listener leaves the page.
  useEffect(() => {
    const leave = () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
      audioRef.current?.pause();
    };
    window.addEventListener("pagehide", leave);
    window.addEventListener("beforeunload", leave);
    return () => {
      window.removeEventListener("pagehide", leave);
      window.removeEventListener("beforeunload", leave);
      // Also runs when navigating to another page inside the site.
      stopEverythingRef.current();
      cancelSpeech();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* --------------------------------- view -------------------------------- */

  const canListen = mode === "ai" || (deviceSupported && chunks.length > 0);
  const label =
    playback === "playing" ? "Pause" : playback === "paused" ? "Resume" : "Listen to today’s devotion";
  const deviceProgress =
    chunks.length > 0 && playback !== "idle" ? ((chunkIndex + 1) / chunks.length) * 100 : 0;

  if (!canListen) {
    return (
      <p className="mt-5 text-sm text-ink-soft">
        Listening isn&rsquo;t available in this browser.
      </p>
    );
  }

  return (
    <section
      aria-label="Listen to today's devotion"
      className="mt-5 rounded-xl border border-sand bg-surface p-4"
    >
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleMainClick}
          className="flex min-h-14 flex-1 items-center justify-center gap-3 rounded-xl bg-ember px-5 py-3 text-lg font-semibold text-white shadow transition-colors hover:bg-ember-dark"
        >
          {playback === "playing" ? <PauseIcon size={22} /> : <PlayIcon size={24} />}
          <span>{label}</span>
        </button>

        {mode === "device" && playback !== "idle" ? (
          <button
            type="button"
            onClick={stopDevice}
            className="min-h-14 rounded-xl border border-gold px-5 py-3 text-base font-semibold text-gold transition-colors hover:bg-gold hover:text-black"
          >
            Stop
          </button>
        ) : null}
      </div>

      {mode === "ai" ? (
        <>
          <div className="mt-4 flex items-center gap-3">
            <span className="w-10 shrink-0 text-right text-xs tabular-nums text-ink-soft">
              {formatTime(currentTime)}
            </span>
            <input
              type="range"
              aria-label="Progress"
              min={0}
              max={duration > 0 ? duration : 1}
              step={0.1}
              value={Math.min(currentTime, duration > 0 ? duration : 1)}
              disabled={duration <= 0}
              onChange={(event) => {
                const audio = audioRef.current;
                const next = Number(event.target.value);
                if (audio) audio.currentTime = next;
                setCurrentTime(next);
              }}
              className="h-8 w-full accent-ember disabled:opacity-50"
            />
            <span className="w-10 shrink-0 text-xs tabular-nums text-ink-soft">
              {formatTime(duration)}
            </span>
          </div>
          <p className="m-0 mt-2 text-xs text-ink-soft">Voice generated by AI</p>
          <audio
            ref={audioRef}
            src={audioUrl ?? undefined}
            preload="metadata"
            onPlay={() => setPlayback("playing")}
            onPause={() => {
              if (ignoreNextPauseRef.current) {
                ignoreNextPauseRef.current = false;
                return;
              }
              if (audioRef.current && !audioRef.current.ended) setPlayback("paused");
            }}
            onEnded={stopAi}
            onError={() => {
              if (holdingRef.current || playback !== "idle") useDeviceVoiceInstead();
            }}
            onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
            onLoadedMetadata={(event) => setDuration(event.currentTarget.duration || 0)}
            onDurationChange={(event) => {
              const d = event.currentTarget.duration;
              setDuration(Number.isFinite(d) ? d : 0);
            }}
          />
        </>
      ) : (
        <>
          {playback !== "idle" ? (
            <div
              role="progressbar"
              aria-label="Reading progress"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(deviceProgress)}
              className="mt-4 h-2 w-full overflow-hidden rounded-full bg-surface-2"
            >
              <div
                className="h-full rounded-full bg-ember transition-[width] duration-300"
                style={{ width: `${deviceProgress}%` }}
              />
            </div>
          ) : null}
          <p className="m-0 mt-2 text-xs text-ink-soft">
            Read aloud by your device&rsquo;s built-in voice
          </p>
        </>
      )}

      <p aria-live="polite" className={`m-0 text-xs text-gold ${notice ? "mt-2" : ""}`}>
        {notice}
      </p>
    </section>
  );
}
