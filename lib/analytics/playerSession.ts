/**
 * Counts one listening session of the shared radio player.
 *
 * A session runs from the moment the listener presses play until they pause
 * (or leave). It sends:
 *   - "start" when play is pressed,
 *   - a heartbeat ("beat") every 30 seconds while the session is open,
 *   - "end" when the listener pauses, leaves or closes the page.
 * The number sent is the TOTAL seconds of actual sound so far (time spent
 * connecting or reconnecting is not counted), plus how many times the player
 * had to reconnect and how many connection attempts failed.
 *
 * Kept free of React and the browser so it can be tested with a fake clock.
 */

export interface SessionEnv {
  /** Sends one event (the real one uses navigator.sendBeacon). */
  send: (payload: Record<string, unknown>) => void;
  now: () => number;
  newId: () => string;
  every: (fn: () => void, ms: number) => unknown;
  cancel: (handle: unknown) => void;
}

export const HEARTBEAT_MS = 30_000;

export class PlayerSessionTracker {
  private id: string | null = null;
  private secs = 0; // seconds already banked
  private playingSince: number | null = null;
  private reconnects = 0;
  private errors = 0;
  private timer: unknown = null;
  private lastSent = "";

  constructor(private env: SessionEnv) {}

  get active() {
    return this.id !== null;
  }

  /** Total seconds of sound so far. */
  seconds(): number {
    const live = this.playingSince === null ? 0 : (this.env.now() - this.playingSince) / 1000;
    return Math.floor(this.secs + live);
  }

  /** The listener pressed play: a new session. */
  begin() {
    if (this.id) this.end();
    this.id = this.env.newId();
    this.secs = 0;
    this.playingSince = null;
    this.reconnects = 0;
    this.errors = 0;
    this.lastSent = "";
    this.push("start");
    this.timer = this.env.every(() => this.beat(), HEARTBEAT_MS);
  }

  /** Sound is flowing (true) or not (connecting, reconnecting, paused). */
  setPlaying(playing: boolean) {
    if (!this.id) return;
    if (playing && this.playingSince === null) {
      this.playingSince = this.env.now();
    } else if (!playing && this.playingSince !== null) {
      this.secs += (this.env.now() - this.playingSince) / 1000;
      this.playingSince = null;
    }
  }

  /** A working connection was lost and the player started a fresh one. */
  reconnect() {
    if (this.id) this.reconnects++;
  }

  /** One connection attempt failed. */
  error() {
    if (this.id) this.errors++;
  }

  /** Send a heartbeat now - but only if something changed since the last one. */
  beat() {
    if (!this.id) return;
    const key = this.fingerprint();
    if (key === this.lastSent && this.playingSince === null) return;
    this.push("beat");
  }

  /** The page was hidden. Audio may keep playing in the background, so just report progress. */
  flush() {
    this.beat();
  }

  /** The listener paused, or the page is closing: the final update. */
  end() {
    if (!this.id) return;
    this.setPlaying(false);
    this.push("end");
    if (this.timer !== null) this.env.cancel(this.timer);
    this.timer = null;
    this.id = null;
  }

  private fingerprint() {
    return `${this.seconds()}|${this.reconnects}|${this.errors}`;
  }

  private push(phase: "start" | "beat" | "end") {
    if (!this.id) return;
    this.lastSent = this.fingerprint();
    this.env.send({
      t: "pl",
      id: this.id,
      ph: phase,
      s: this.seconds(),
      rc: this.reconnects,
      er: this.errors,
    });
  }
}
