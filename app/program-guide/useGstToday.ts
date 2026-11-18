"use client";

import { useEffect, useState } from "react";
import { gstWeekday } from "@/lib/schedule";

/**
 * Today's weekday in Gulf Standard Time (1 = Monday ... 7 = Sunday).
 *
 * Starts from the value the server worked out, then checks again once the page
 * is on screen, when the tab becomes visible again, and every minute - so even
 * a cached page, or a tab left open past midnight in Dubai, shows the right day.
 */
export function useGstToday(initial: number): number {
  const [today, setToday] = useState(initial);
  useEffect(() => {
    const sync = () => setToday(gstWeekday());
    sync();
    document.addEventListener("visibilitychange", sync);
    const timer = setInterval(sync, 60000);
    return () => {
      document.removeEventListener("visibilitychange", sync);
      clearInterval(timer);
    };
  }, []);
  return today;
}
