"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { STATION_NAME, STATION_TAGLINE } from "@/lib/config";

const links = [
  { href: "/", label: "Listen" },
  { href: "/program-guide", label: "Program Guide" },
  { href: "/daily-devotion", label: "Daily Devotion" },
  { href: "/feedback", label: "Feedback & Prayer" },
];

export default function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="border-b border-sand bg-cream/90 backdrop-blur sticky top-0 z-10">
      <div className="mx-auto flex max-w-4xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <Link href="/" className="no-underline">
          <span className="block text-xl font-semibold text-ink" style={{ fontFamily: "Georgia, serif" }}>
            {STATION_NAME}
          </span>
          <span className="block text-sm text-ink-soft">{STATION_TAGLINE}</span>
        </Link>

        <nav className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
          {links.map((link) => {
            const active =
              link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`no-underline transition-colors ${
                  active
                    ? "text-ember-dark font-semibold"
                    : "text-ink-soft hover:text-ink"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
