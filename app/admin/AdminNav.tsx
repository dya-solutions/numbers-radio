"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { usePendingHref } from "../components/NavigationProgress";

const tabs = [
  { href: "/admin", label: "Submissions" },
  { href: "/admin/devotion", label: "Edit Daily Devotion" },
  { href: "/admin/schedule", label: "Edit Program Guide" },
  { href: "/admin/prayer-points", label: "Edit Prayer Points" },
  { href: "/admin/sermons", label: "Edit Sermons" },
  { href: "/admin/statistics", label: "Statistics" },
];

export default function AdminNav() {
  const pathname = usePathname();
  const pending = usePendingHref();

  return (
    <nav className="flex flex-wrap gap-2 border-b border-sand pb-4">
      {tabs.map((tab) => {
        // The tapped tab lights up at once while its page loads.
        const active = pending ? pending.split("?")[0] === tab.href : pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`rounded-lg px-3 py-1.5 text-sm no-underline transition active:scale-95 ${
              active
                ? "bg-gold font-medium text-black"
                : "border border-sand bg-surface text-ink-soft hover:text-ink"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
