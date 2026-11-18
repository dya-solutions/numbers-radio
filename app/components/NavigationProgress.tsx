"use client";

import { Suspense, useEffect, useSyncExternalStore } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * Instant feedback when someone taps a link.
 *
 * The moment a link to another page of this site is tapped, before the new page
 * has arrived:
 *   - a thin gold progress bar appears at the very top of the screen and keeps
 *     creeping forward until the new page is shown;
 *   - the menu reads "where we are going" (see usePendingHref) so the tapped
 *     item lights up straight away;
 *   - if the page takes longer than a moment, a loading screen (SkeletonOverlay)
 *     fills the content area while the menu, player and footer stay in place;
 *   - tapping the same link again while it is still loading is ignored, so
 *     impatient double-taps can't start the navigation twice.
 *
 * It listens for clicks on ordinary <a> links (which is what <Link> renders), so
 * it needs no changes to individual links. It renders only the bar and never
 * blocks or delays the navigation itself.
 */

interface NavState {
  /** The page being loaded, as "/path?query", or null when nothing is loading. */
  pending: string | null;
  /** Bar width, 0-100. */
  pct: number;
  visible: boolean;
  /** The page is taking a while: time to show the loading screen. */
  slow: boolean;
}

let state: NavState = { pending: null, pct: 0, visible: false, slow: false };
const listeners = new Set<() => void>();
let trickle: ReturnType<typeof setInterval> | null = null;
let giveUp: ReturnType<typeof setTimeout> | null = null;
let slowTimer: ReturnType<typeof setTimeout> | null = null;
let hide: ReturnType<typeof setTimeout> | null = null;

/** Pages that arrive faster than this never show a loading screen (no flicker). */
const SLOW_AFTER_MS = 150;

/** If a page never arrives (offline, error) the bar is put away after this long. */
const GIVE_UP_MS = 15000;

function set(next: Partial<NavState>) {
  state = { ...state, ...next };
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function clearTimers() {
  if (trickle) clearInterval(trickle);
  if (giveUp) clearTimeout(giveUp);
  if (slowTimer) clearTimeout(slowTimer);
  trickle = giveUp = slowTimer = null;
}

function begin(target: string) {
  if (hide) {
    clearTimeout(hide);
    hide = null;
  }
  clearTimers();
  // Starting again (a different link tapped meanwhile) keeps the bar where it is,
  // unless it was just finishing, in which case it starts over.
  set({ pending: target, visible: true, slow: false, pct: state.visible && state.pct < 100 ? state.pct : 12 });
  slowTimer = setTimeout(() => {
    if (state.pending === target) set({ slow: true });
  }, SLOW_AFTER_MS);
  trickle = setInterval(() => {
    // Creeps toward 90% and never reaches it, so it always looks alive.
    set({ pct: state.pct + (90 - state.pct) * 0.09 });
  }, 180);
  giveUp = setTimeout(finish, GIVE_UP_MS);
}

function finish() {
  if (state.pending === null && !state.visible) return;
  clearTimers();
  set({ pending: null, slow: false, pct: 100 });
  hide = setTimeout(() => {
    set({ visible: false });
    hide = setTimeout(() => {
      set({ pct: 0 });
      hide = null;
    }, 250);
  }, 180);
}

/** The page currently being loaded ("/path?query"), or null. For highlighting the tapped menu item. */
export function usePendingHref(): string | null {
  return useSyncExternalStore(
    subscribe,
    () => state.pending,
    () => null,
  );
}

/** The page being loaded, but only once it is taking long enough to warrant a loading screen. */
export function useSlowPath(): string | null {
  return useSyncExternalStore(
    subscribe,
    () => (state.slow ? state.pending : null),
    () => null,
  );
}

/** Does this link point at the page being loaded? Compares the path only (ignores ?query). */
export function isPendingPath(pending: string | null, href: string): boolean {
  if (!pending) return false;
  const path = pending.split("?")[0];
  return href === "/" ? path === "/" : path === href || path.startsWith(`${href}/`);
}

/** Watches for the new page appearing, which ends the progress bar. */
function RouteWatcher() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  useEffect(() => {
    finish();
  }, [pathname, search]);
  return null;
}

function Bar() {
  const s = useSyncExternalStore(
    subscribe,
    () => state,
    () => state,
  );
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-[3px] motion-reduce:transition-none"
      style={{ opacity: s.visible ? 1 : 0, transition: "opacity 220ms ease-out" }}
    >
      <div
        className="h-full bg-gold motion-reduce:transition-none"
        style={{
          width: `${s.pct}%`,
          boxShadow: "0 0 10px var(--color-gold), 0 0 4px var(--color-gold)",
          transition: s.pct >= 100 ? "width 160ms ease-out" : "width 240ms ease-out",
        }}
      />
    </div>
  );
}

export default function NavigationProgress() {
  useEffect(() => {
    function onClick(event: MouseEvent) {
      // Ignore anything that isn't a plain left-click on a link.
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      const link = target.closest("a[href]");
      if (!(link instanceof HTMLAnchorElement)) return;
      if ((link.target && link.target !== "_self") || link.hasAttribute("download")) return;

      let url: URL;
      try {
        url = new URL(link.href, window.location.href);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) return; // other websites: leave alone
      // The page we are already on (or just a #section): nothing to load.
      if (url.pathname === window.location.pathname && url.search === window.location.search) {
        // Tapping the current page's own link while another page is loading cancels that trip.
        if (state.pending && !url.hash) finish();
        return;
      }

      const next = url.pathname + url.search;
      if (state.pending === next) {
        // Already on its way: swallow the extra tap instead of starting it again.
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      begin(next);
    }

    // Capture phase: runs before the link's own handler, so the bar and the
    // highlight appear on the very same tap.
    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      clearTimers();
    };
  }, []);

  return (
    <>
      <Bar />
      <Suspense fallback={null}>
        <RouteWatcher />
      </Suspense>
    </>
  );
}
