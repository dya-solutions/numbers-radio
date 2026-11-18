"use client";

import { useEffect } from "react";
import { useGstToday } from "./useGstToday";

/**
 * Keeps today's column in the weekly table highlighted correctly. The table is
 * built on the server (and may be a cached copy from a few minutes ago), so
 * this small helper moves the highlight to today in Gulf Standard Time once the
 * page is on screen. It renders nothing.
 */
export default function TodayMarker({ initialToday }: { initialToday: number }) {
  const today = useGstToday(initialToday);

  useEffect(() => {
    const table = document.querySelector(".week-table");
    if (!table) return;
    table.querySelectorAll<HTMLElement>("[data-day]").forEach((cell) => {
      const isToday = cell.dataset.day === String(today);
      if (isToday) cell.setAttribute("data-today", "true");
      else cell.removeAttribute("data-today");
      if (cell.tagName === "TH") {
        if (isToday) cell.setAttribute("aria-current", "date");
        else cell.removeAttribute("aria-current");
      }
    });
  }, [today]);

  return null;
}
