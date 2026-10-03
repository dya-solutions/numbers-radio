"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { STATION_NAME, STATION_TAGLINE, STREAM_URL } from "@/lib/config";

/**
 * One shared audio player for the whole site.
 *
 * The <audio> element lives here, in the root layout, so it is never
 * unmounted when visitors move between pages. Every player control (the big
 * one on the homepage and the bar at the bottom of other pages) talks to this
 * single element, so playback continues without restarting.
 *
 * Reconnecting
 * ------------
 * A live stream can die silently (Wi-Fi <-> mobile data, a locked phone, a
 * dropped connection that never reports an error). So instead of waiting for
 * the browser to notice, the player:
 *   - reconnects exactly like a manual pause + play: the old connection is
 *     dropped completely and the stream is requested again from scratch with a
 *     changing "?t=" value, so the browser makes a brand-new request;
 *   - runs a watchdog that treats "audio time stopped moving" or "stuck
 *     connecting" for ~4 seconds as a dead connection;
 *   - reconnects immediately when the browser says we are back online, the
 *     network type changes, or the page becomes visible again;
 *   - keeps retrying quickly (0.5s, 1s, 2s, then every 3s) and never gives up
 *     while the listener has not paused.
 * If the listener paused on purpose, nothing here ever restarts playback.
 */

export type PlayerStatus =
  | "stopped"
  | "loading"
  | "playing"
  | "reconnecting"
  | "error";

interface PlayerContextValue {
  status: PlayerStatus;
  volume: number;
  setVolume: (volume: number) => void;
  /** Play / pause. Pausing is always treated as "the listener wants it off". */
  toggle: () => void;
  /** Start again from scratch right now (the "Try Again" button). */
  retry: () => void;
}

const PlayerContext = createContext<PlayerContextValue | null>(null);

const VOLUME_KEY = "numbers-radio-volume";

/** Wait before the next try after a failed attempt: 0.5s, 1s, 2s, then 3s forever. */
const RETRY_DELAYS_MS = [500, 1000, 2000, 3000];
/** Audio time not moving for this long = the connection is dead. */
const STALL_MS = 4000;
/** How often the watchdog looks. */
const WATCHDOG_INTERVAL_MS = 500;
/** Ignore a second "reconnect now" signal this soon after the last one. */
const EVENT_DEBOUNCE_MS = 1500;

/** How long one connection attempt may take before it is abandoned. */
function attemptTimeoutMs(failures: number) {
  // 4s at first; a little more patience on repeatedly slow networks.
  return Math.min(STALL_MS + failures * 1000, 10000);
}

function freshStreamUrl() {
  return `${STREAM_URL}${STREAM_URL.includes("?") ? "&" : "?"}t=${Date.now()}`;
}

export function usePlayer() {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error("usePlayer must be used inside <PlayerProvider>");
  return ctx;
}

type Phase =
  | "idle" // listener has not asked for playback
  | "attempt" // a connection attempt is in flight
  | "live" // sound has started for the current connection
  | "waiting"; // an attempt failed; the next try is scheduled

export default function PlayerProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [status, setStatusState] = useState<PlayerStatus>("stopped");
  const [volume, setVolumeState] = useState(0.8);

  // Mirrors of state that event handlers and timers need to read "live".
  const statusRef = useRef<PlayerStatus>("stopped");
  const phaseRef = useRef<Phase>("idle");
  /** True from the moment the listener presses play until they pause. */
  const wantsPlayRef = useRef(false);
  /** True once this listening session has produced sound at least once. */
  const everConnectedRef = useRef(false);
  /** Consecutive failed attempts (reset whenever sound starts). */
  const failuresRef = useRef(0);
  const attemptStartedAtRef = useRef(0);
  const currentUrlRef = useRef("");
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastForcedAtRef = useRef(0);
  // Watchdog bookkeeping: last audio time seen, and when it last moved.
  const lastTimeRef = useRef(0);
  const lastAdvanceAtRef = useRef(0);
  const connTypeRef = useRef<string | undefined>(undefined);
  // Handlers call each other; refs keep them free of stale closures.
  const startAttemptRef = useRef<(failuresSoFar: number) => void>(() => {});
  const failAttemptRef = useRef<() => void>(() => {});

  const setStatus = useCallback((next: PlayerStatus) => {
    statusRef.current = next;
    setStatusState(next);
  }, []);

  const clearRetryTimer = useCallback(() => {
    if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    retryTimerRef.current = null;
  }, []);

  // Remember the listener's volume between visits.
  useEffect(() => {
    try {
      const saved = Number(localStorage.getItem(VOLUME_KEY));
      if (saved > 0 && saved <= 1) setVolumeState(saved);
    } catch {
      /* storage unavailable - keep the default */
    }
  }, []);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  const setVolume = useCallback((next: number) => {
    setVolumeState(next);
    try {
      localStorage.setItem(VOLUME_KEY, String(next));
    } catch {
      /* ignore */
    }
  }, []);

  /** Drop the current connection completely (same as a manual pause). */
  const release = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
    audio.removeAttribute("src");
    audio.load();
    currentUrlRef.current = "";
  }, []);

  /**
   * One brand-new connection: tear the old one down, request the stream again
   * with a fresh "?t=" value, and call play(). No waiting on the old connection.
   *
   * Everything up to audio.play() is synchronous on purpose, so a click on the
   * play button still counts as a user gesture for the browser.
   */
  const startAttempt = useCallback(
    (failuresSoFar: number) => {
      const audio = audioRef.current;
      if (!audio || !wantsPlayRef.current) return;

      clearRetryTimer();
      failuresRef.current = failuresSoFar;
      phaseRef.current = "attempt";
      attemptStartedAtRef.current = Date.now();
      setStatus(
        everConnectedRef.current || failuresSoFar > 0 ? "reconnecting" : "loading",
      );

      release();
      const url = freshStreamUrl();
      currentUrlRef.current = url;
      audio.src = url;
      audio.load();

      audio.play().catch((err: unknown) => {
        // A newer attempt replaced this one - ignore the old result.
        if (currentUrlRef.current !== url || !wantsPlayRef.current) return;
        if (err instanceof DOMException && err.name === "NotAllowedError") {
          // The browser wants a tap before it will play. Don't loop.
          clearRetryTimer();
          release();
          phaseRef.current = "idle";
          wantsPlayRef.current = false;
          setStatus("error");
          return;
        }
        failAttemptRef.current();
      });
    },
    [clearRetryTimer, release, setStatus],
  );

  /** This attempt failed or timed out: try again soon (0.5s, 1s, 2s, then 3s). */
  const failAttempt = useCallback(() => {
    if (!wantsPlayRef.current) return;
    clearRetryTimer();
    const failures = failuresRef.current + 1;
    failuresRef.current = failures;
    phaseRef.current = "waiting";
    setStatus("reconnecting");

    const delay = RETRY_DELAYS_MS[Math.min(failures - 1, RETRY_DELAYS_MS.length - 1)];
    retryTimerRef.current = setTimeout(() => {
      retryTimerRef.current = null;
      startAttemptRef.current(failures);
    }, delay);
  }, [clearRetryTimer, setStatus]);

  useEffect(() => {
    startAttemptRef.current = startAttempt;
    failAttemptRef.current = failAttempt;
  }, [startAttempt, failAttempt]);

  const stop = useCallback(() => {
    wantsPlayRef.current = false;
    everConnectedRef.current = false;
    failuresRef.current = 0;
    phaseRef.current = "idle";
    clearRetryTimer();
    release();
    setStatus("stopped");
  }, [clearRetryTimer, release, setStatus]);

  /** Listener pressed play (or "Try Again"): fresh start, right now. */
  const play = useCallback(() => {
    wantsPlayRef.current = true;
    everConnectedRef.current = false;
    startAttempt(0);
  }, [startAttempt]);

  const toggle = useCallback(() => {
    const s = statusRef.current;
    if (s === "playing" || s === "loading" || s === "reconnecting") stop();
    else play();
  }, [play, stop]);

  /** Is sound actually coming out right now? */
  const isHealthy = useCallback(() => {
    const audio = audioRef.current;
    return (
      !!audio &&
      phaseRef.current === "live" &&
      !audio.paused &&
      audio.currentTime > lastTimeRef.current + 0.05
    );
  }, []);

  /** Reconnect right now because the network changed / came back / page woke. */
  const reconnectNow = useCallback(() => {
    if (!wantsPlayRef.current) return; // listener paused - respect that
    const now = Date.now();
    if (now - lastForcedAtRef.current < EVENT_DEBOUNCE_MS) return;
    lastForcedAtRef.current = now;
    startAttempt(0);
  }, [startAttempt]);

  // ----- Watchdog: don't wait for the browser to report an error ----------
  useEffect(() => {
    const id = setInterval(() => {
      const audio = audioRef.current;
      if (!audio || !wantsPlayRef.current) return;
      const now = Date.now();

      if (phaseRef.current === "live") {
        if (audio.currentTime > lastTimeRef.current + 0.05) {
          lastTimeRef.current = audio.currentTime;
          lastAdvanceAtRef.current = now;
        } else if (now - lastAdvanceAtRef.current >= STALL_MS) {
          // Playing / buffering but the time hasn't moved: connection is dead.
          lastAdvanceAtRef.current = now;
          startAttemptRef.current(0);
        }
      } else if (phaseRef.current === "attempt") {
        if (now - attemptStartedAtRef.current >= attemptTimeoutMs(failuresRef.current)) {
          // Stuck "Connecting": give up on this connection and go again.
          failAttemptRef.current();
        }
      }
    }, WATCHDOG_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  // ----- Network / page signals that trigger an immediate reconnect --------
  useEffect(() => {
    const connection = (
      navigator as Navigator & {
        connection?: EventTarget & { type?: string };
      }
    ).connection;
    connTypeRef.current = connection?.type;

    function handleOnline() {
      reconnectNow();
    }

    function handleConnectionChange() {
      const type = connection?.type;
      const typeChanged = type !== connTypeRef.current;
      connTypeRef.current = type;
      // Wi-Fi <-> mobile data always changes the type. Other changes (speed
      // estimates flickering) only matter if the stream is not playing well.
      if (!typeChanged && isHealthy()) return;
      reconnectNow();
    }

    function handleVisibility() {
      if (document.visibilityState !== "visible") return;
      if (!wantsPlayRef.current) return;
      // Woke up after a locked phone / background tab: if sound is still
      // flowing leave it alone, otherwise reconnect straight away.
      if (isHealthy()) return;
      reconnectNow();
    }

    window.addEventListener("online", handleOnline);
    connection?.addEventListener("change", handleConnectionChange);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.removeEventListener("online", handleOnline);
      connection?.removeEventListener("change", handleConnectionChange);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [reconnectNow, isHealthy]);

  // Stop timers if the whole app is torn down.
  useEffect(() => clearRetryTimer, [clearRetryTimer]);

  // Lock-screen / headphone controls where the browser supports them.
  useEffect(() => {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: `${STATION_NAME} - Live`,
      artist: STATION_TAGLINE,
    });
    navigator.mediaSession.setActionHandler("play", () => play());
    navigator.mediaSession.setActionHandler("pause", () => stop());
    navigator.mediaSession.setActionHandler("stop", () => stop());
    return () => {
      navigator.mediaSession.setActionHandler("play", null);
      navigator.mediaSession.setActionHandler("pause", null);
      navigator.mediaSession.setActionHandler("stop", null);
    };
  }, [play, stop]);

  // ----- <audio> events ---------------------------------------------------

  function handlePlaying() {
    const audio = audioRef.current;
    if (!audio || !wantsPlayRef.current) return;
    // Sound is flowing (first connect, or recovered after a drop).
    clearRetryTimer();
    phaseRef.current = "live";
    everConnectedRef.current = true;
    failuresRef.current = 0;
    lastTimeRef.current = audio.currentTime;
    lastAdvanceAtRef.current = Date.now();
    setStatus("playing");
  }

  function handleTimeUpdate() {
    // Precise "sound is still moving" signal for the watchdog.
    const audio = audioRef.current;
    if (!audio || phaseRef.current !== "live") return;
    if (audio.currentTime > lastTimeRef.current + 0.05) {
      lastTimeRef.current = audio.currentTime;
      lastAdvanceAtRef.current = Date.now();
    }
  }

  function handleWaiting() {
    // Buffer ran dry mid-stream: say so right away. If sound doesn't come back
    // within ~4s the watchdog drops this connection and reconnects.
    if (wantsPlayRef.current && phaseRef.current === "live" && statusRef.current === "playing") {
      setStatus("reconnecting");
    }
  }

  function handleError() {
    const audio = audioRef.current;
    if (!audio || !wantsPlayRef.current) return; // listener paused on purpose
    // Ignore errors from a connection we already dropped on purpose.
    if (!currentUrlRef.current || audio.getAttribute("src") !== currentUrlRef.current) return;

    if (phaseRef.current === "live") {
      startAttempt(0); // lost a working connection: go again immediately
    } else if (phaseRef.current === "attempt") {
      failAttempt(); // this attempt failed: short wait, then try again
    }
  }

  function handleEnded() {
    // A live stream should never end - if it does, the server dropped us.
    if (wantsPlayRef.current && phaseRef.current === "live") startAttempt(0);
  }

  return (
    <PlayerContext.Provider
      value={{ status, volume, setVolume, toggle, retry: play }}
    >
      {children}
      <audio
        ref={audioRef}
        preload="none"
        onPlaying={handlePlaying}
        onWaiting={handleWaiting}
        onTimeUpdate={handleTimeUpdate}
        onError={handleError}
        onEnded={handleEnded}
      />
    </PlayerContext.Provider>
  );
}
