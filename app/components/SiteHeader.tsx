"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { STATION_NAME, STATION_TAGLINE } from "@/lib/config";
import { isPendingPath, usePendingHref } from "./NavigationProgress";
import { preloadSkeletons } from "./SkeletonOverlay";
// The wordmark, pre-cropped to the exact banner shape shown in the header (the
// original logo.jpeg is a big square with the wordmark in a thin band).
import logo from "@/public/logo-wordmark.jpg";

const links = [
  { href: "/", label: "Listen" },
  { href: "/program-guide", label: "Program Guide" },
  { href: "/daily-devotion", label: "Daily Devotion" },
  { href: "/prayer-points", label: "Prayer Points" },
  { href: "/sermons", label: "Sermons" },
  { href: "/feedback", label: "Feedback" },
];

export default function SiteHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const pending = usePendingHref();
  const [menuOpen, setMenuOpen] = useState(false);

  // Quietly fetch the other pages (and the loading screens) once this page has
  // finished loading and the browser is idle, so taps feel instant without
  // competing with the page's own first load. (The header stays on screen across
  // pages, so this runs once per visit.)
  useEffect(() => {
    let cancelled = false;
    const timers: number[] = [];
    const run = () => {
      if (cancelled) return;
      for (const link of links) router.prefetch(link.href);
      router.prefetch("/privacy");
      void preloadSkeletons();
    };
    const warm = () => {
      if (cancelled) return;
      const idle = (window as Window & { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number }).requestIdleCallback;
      if (typeof idle === "function") idle.call(window, run, { timeout: 5000 });
      else timers.push(window.setTimeout(run, 1500));
    };
    const onLoad = () => timers.push(window.setTimeout(warm, 1200));
    if (document.readyState === "complete") onLoad();
    else window.addEventListener("load", onLoad, { once: true });
    return () => {
      cancelled = true;
      window.removeEventListener("load", onLoad);
      timers.forEach((t) => window.clearTimeout(t));
    };
  }, [router]);

  // Close the mobile menu whenever the page changes.
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  // While a page is loading, the tapped item is the highlighted one, so the tap
  // is acknowledged at once; otherwise it is the page we are on.
  function isActive(href: string) {
    if (pending) return isPendingPath(pending, href);
    return href === "/" ? pathname === "/" : pathname.startsWith(href);
  }

  return (
    <header className="sticky top-0 z-10 border-b border-sand bg-cream/90 backdrop-blur">
      <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
        <Link
          href="/"
          className="no-underline"
          aria-label={`${STATION_NAME} - ${STATION_TAGLINE}`}
        >
          <Image
            src={logo}
            alt={STATION_NAME}
            priority
            sizes="(min-width: 640px) 240px, 200px"
            className="block h-10 w-[200px] sm:h-12 sm:w-[240px]"
          />
        </Link>

        {/* Desktop navigation - unchanged from before */}
        <nav className="hidden text-sm sm:flex sm:flex-wrap sm:gap-x-5 sm:gap-y-1">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              prefetch={false}
              aria-current={isActive(link.href) ? "page" : undefined}
              className={`-mx-1 rounded px-1 py-1 no-underline transition active:scale-95 active:text-gold ${
                isActive(link.href)
                  ? "text-gold font-semibold"
                  : "text-ink-soft hover:text-ink"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Mobile menu button */}
        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          className="flex h-10 w-10 items-center justify-center rounded-lg border border-sand text-ink transition active:scale-95 active:border-gold active:text-gold hover:border-gold hover:text-gold sm:hidden"
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
          aria-controls="mobile-nav"
        >
          {menuOpen ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          )}
        </button>
      </div>

      {/* Mobile dropdown menu */}
      {menuOpen ? (
        <nav id="mobile-nav" className="border-t border-sand bg-cream px-4 py-3 sm:hidden">
          <ul className="flex flex-col gap-1">
            {links.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  prefetch={false}
                  aria-current={isActive(link.href) ? "page" : undefined}
                  className={`block rounded-lg px-3 py-2.5 no-underline transition active:scale-[0.98] active:bg-gold active:text-black ${
                    isActive(link.href)
                      ? "bg-gold font-semibold text-black"
                      : "text-ink-soft hover:bg-surface hover:text-ink"
                  }`}
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}
    </header>
  );
}
