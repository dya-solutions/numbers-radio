"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import {
  hasTouch,
  isInstalledApp,
  isReturningVisitor,
  referrerHost,
  sendEvent,
  trackInstall,
} from "@/lib/analytics/client";

/**
 * Anonymous page-view counting. Renders nothing.
 *
 * Sends one small note to our own /api/track each time a public page is shown
 * (including when the visitor moves between pages without a full reload), and
 * one when the app is installed. Nothing is recorded on /admin pages. No
 * cookies and no outside services - see /privacy.
 */
export default function Analytics() {
  const pathname = usePathname();
  const lastPath = useRef<string | null>(null);
  const sentFirst = useRef(false);

  useEffect(() => {
    if (!pathname || pathname === lastPath.current) return;
    lastPath.current = pathname;

    if (pathname === "/admin" || pathname.startsWith("/admin/")) return; // never track the admin area

    const landing = !sentFirst.current;
    sentFirst.current = true;

    sendEvent({
      t: "pv",
      path: pathname,
      // Only the first page of a visit says where the visitor came from.
      ...(landing ? { ref: referrerHost() ?? undefined } : {}),
      ret: isReturningVisitor() ? 1 : 0,
      app: isInstalledApp() ? 1 : 0,
      land: landing ? 1 : 0,
      touch: hasTouch() ? 1 : 0,
    });
  }, [pathname]);

  // The browser says so when the site is installed as an app.
  useEffect(() => {
    const onInstalled = () => trackInstall();
    window.addEventListener("appinstalled", onInstalled);
    return () => window.removeEventListener("appinstalled", onInstalled);
  }, []);

  return null;
}
