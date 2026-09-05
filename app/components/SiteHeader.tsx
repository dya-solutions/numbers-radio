"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { STATION_NAME, STATION_TAGLINE } from "@/lib/config";
import logo from "@/public/logo.jpeg";

const links = [
  { href: "/", label: "Listen" },
  { href: "/program-guide", label: "Program Guide" },
  { href: "/daily-devotion", label: "Daily Devotion" },
  { href: "/feedback", label: "Feedback & Prayer" },
];

export default function SiteHeader() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  // Close the mobile menu whenever the page changes.
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  function isActive(href: string) {
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
          <span className="relative block h-10 w-[196px] overflow-hidden sm:h-12 sm:w-[240px]">
            <Image
              src={logo}
              alt={STATION_NAME}
              fill
              priority
              sizes="240px"
              className="scale-[1.08] object-cover object-center"
            />
          </span>
        </Link>

        {/* Desktop navigation - unchanged from before */}
        <nav className="hidden text-sm sm:flex sm:flex-wrap sm:gap-x-5 sm:gap-y-1">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`no-underline transition-colors ${
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
          className="flex h-10 w-10 items-center justify-center rounded-lg border border-sand text-ink transition-colors hover:border-gold hover:text-gold sm:hidden"
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
                  className={`block rounded-lg px-3 py-2 no-underline transition-colors ${
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
