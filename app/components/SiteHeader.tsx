"use client";

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

  return (
    <header className="sticky top-0 z-10 border-b border-sand bg-cream/90 backdrop-blur">
      <div className="mx-auto flex max-w-4xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <Link href="/" className="no-underline" aria-label={`${STATION_NAME} - ${STATION_TAGLINE}`}>
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
                    ? "text-gold font-semibold"
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
