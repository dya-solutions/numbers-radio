/**
 * Browser-side helpers for the anonymous statistics. No cookies, no third-party
 * scripts: everything is sent to our own /api/track and nothing here ever
 * reads anything back.
 */

const ENDPOINT = "/api/track";

/** Never record anything on the admin pages. */
export function onAdminPage(): boolean {
  return typeof window !== "undefined" && /^\/admin(\/|$)/.test(window.location.pathname);
}

/**
 * Sends one small event. Uses sendBeacon where possible, which keeps working
 * while the page is being closed. Failures are ignored on purpose: statistics
 * must never get in the visitor's way.
 */
export function sendEvent(payload: Record<string, unknown>): void {
  if (typeof window === "undefined" || onAdminPage()) return;
  const body = JSON.stringify(payload);
  try {
    if (
      typeof navigator !== "undefined" &&
      typeof navigator.sendBeacon === "function" &&
      navigator.sendBeacon(ENDPOINT, new Blob([body], { type: "text/plain;charset=UTF-8" }))
    ) {
      return;
    }
  } catch {
    /* fall through to fetch */
  }
  try {
    void fetch(ENDPOINT, {
      method: "POST",
      body,
      headers: { "Content-Type": "text/plain;charset=UTF-8" },
      keepalive: true,
      credentials: "omit",
    }).catch(() => {});
  } catch {
    /* ignore */
  }
}

/** A random code for one listening session / one devotion play. Not linked to the person. */
export function randomId(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
  } catch {
    /* fall back below */
  }
  let id = "";
  for (let i = 0; i < 24; i++) id += Math.floor(Math.random() * 16).toString(16);
  return id;
}

/** Opened as an installed app (home-screen icon / desktop app window) rather than in a browser tab? */
export function isInstalledApp(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (
      window.matchMedia("(display-mode: standalone)").matches ||
      window.matchMedia("(display-mode: minimal-ui)").matches ||
      window.matchMedia("(display-mode: fullscreen)").matches
    ) {
      return true;
    }
    return (navigator as Navigator & { standalone?: boolean }).standalone === true;
  } catch {
    return false;
  }
}

const FIRST_VISIT_KEY = "nr-first-visit";

/** Today's date in Gulf Standard Time (UTC+4) as "2026-11-12". */
export function gstToday(now = Date.now()): string {
  return new Date(now + 4 * 3600 * 1000).toISOString().slice(0, 10);
}

/**
 * Has this browser been here on an EARLIER day? The only thing remembered on
 * the device is the DATE of its first visit (not a cookie, not an ID, nothing
 * that identifies anyone) - just enough to tell "new" from "returning".
 */
export function isReturningVisitor(now = Date.now()): boolean {
  try {
    const today = gstToday(now);
    const first = localStorage.getItem(FIRST_VISIT_KEY);
    if (!first || !/^\d{4}-\d{2}-\d{2}$/.test(first)) {
      localStorage.setItem(FIRST_VISIT_KEY, today);
      return false;
    }
    return first < today;
  } catch {
    return false; // storage blocked: count as new
  }
}

/** The website we came from (host only - never the page or search words), if it is another site. */
export function referrerHost(): string | null {
  try {
    if (!document.referrer) return null;
    const host = new URL(document.referrer).hostname;
    return host && host !== window.location.hostname ? host : null;
  } catch {
    return null;
  }
}

/** Does this device have a touch screen? (Tells an iPad from a Mac.) */
export function hasTouch(): boolean {
  try {
    return navigator.maxTouchPoints > 1;
  } catch {
    return false;
  }
}

/* ----------------------------- named events ----------------------------- */

export function trackClick(kind: "sermon" | "prayer", id: string) {
  sendEvent({ t: "ck", kind, id });
}

export function trackDevotionPlay(id: string, mode: "ai" | "device") {
  sendEvent({ t: "dp", id, mode });
}

export function trackDevotionFinish(id: string) {
  sendEvent({ t: "df", id });
}

export function trackInstall() {
  sendEvent({ t: "in", app: isInstalledApp() ? 1 : 0 });
}
