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
 */

export type PlayerStatus = "stopped" | "loading" | "playing" | "error";

interface PlayerContextValue {
  status: PlayerStatus;
  volume: number;
  setVolume: (volume: number) => void;
  toggle: () => void;
}

const PlayerContext = createContext<PlayerContextValue | null>(null);

const VOLUME_KEY = "numbers-radio-volume";

export function usePlayer() {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error("usePlayer must be used inside <PlayerProvider>");
  return ctx;
}

export default function PlayerProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [status, setStatus] = useState<PlayerStatus>("stopped");
  const [volume, setVolumeState] = useState(0.8);

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

  const stop = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
    // Drop the source so the next play always joins the live edge
    // instead of resuming stale buffered audio.
    audio.removeAttribute("src");
    audio.load();
    setStatus("stopped");
  }, []);

  const play = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;
    try {
      setStatus("loading");
      audio.src = STREAM_URL;
      audio.load();
      await audio.play();
      setStatus("playing");
    } catch {
      setStatus("error");
    }
  }, []);

  const toggle = useCallback(() => {
    if (status === "playing" || status === "loading") stop();
    else void play();
  }, [status, play, stop]);

  // Lock-screen / headphone controls where the browser supports them.
  useEffect(() => {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: `${STATION_NAME} - Live`,
      artist: STATION_TAGLINE,
    });
    navigator.mediaSession.setActionHandler("play", () => void play());
    navigator.mediaSession.setActionHandler("pause", () => stop());
    navigator.mediaSession.setActionHandler("stop", () => stop());
    return () => {
      navigator.mediaSession.setActionHandler("play", null);
      navigator.mediaSession.setActionHandler("pause", null);
      navigator.mediaSession.setActionHandler("stop", null);
    };
  }, [play, stop]);

  return (
    <PlayerContext.Provider value={{ status, volume, setVolume, toggle }}>
      {children}
      <audio
        ref={audioRef}
        preload="none"
        onPlaying={() => setStatus("playing")}
        onWaiting={() => setStatus("loading")}
        onError={() => setStatus((s) => (s === "stopped" ? s : "error"))}
      />
    </PlayerContext.Provider>
  );
}
