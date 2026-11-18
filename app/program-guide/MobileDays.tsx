"use client";

import { useEffect, useState } from "react";
import { WEEK } from "@/lib/schedule";
import Program from "./Program";
import { useGstToday } from "./useGstToday";

interface Item {
  id: string;
  timeLabel: string;
  showName: string;
  description: string;
}

/**
 * The phone version of the weekly guide: seven day buttons across the top
 * (today in Gulf Standard Time is selected to begin with) and that day's
 * programs listed underneath.
 */
export default function MobileDays({
  days,
  initialToday,
}: {
  /** The programs for each day, Monday first (7 lists). */
  days: Item[][];
  /** Today's weekday in GST (1 = Monday ... 7 = Sunday), worked out on the server. */
  initialToday: number;
}) {
  const today = useGstToday(initialToday);
  const [selected, setSelected] = useState(initialToday);
  const [picked, setPicked] = useState(false); // has the visitor chosen a day themselves?

  // Until the visitor picks a day, the selected day follows today (it can change at midnight in Dubai).
  useEffect(() => {
    if (!picked) setSelected(today);
  }, [today, picked]);

  const day = WEEK[selected - 1];
  const items = days[selected - 1] ?? [];

  return (
    <div>
      <div className="grid grid-cols-7 gap-1" role="group" aria-label="Choose a day">
        {WEEK.map((d) => {
          const isSelected = d.n === selected;
          const isToday = d.n === today;
          return (
            <button
              key={d.n}
              type="button"
              aria-pressed={isSelected}
              aria-label={`${d.long}${isToday ? " (today)" : ""}`}
              onClick={() => {
                setSelected(d.n);
                setPicked(true);
              }}
              className={`relative rounded-lg border px-0 py-2.5 text-sm font-semibold transition-colors ${
                isSelected
                  ? "border-gold bg-gold text-black"
                  : "border-sand bg-surface text-ink hover:border-gold/60"
              }`}
            >
              {d.short}
              {isToday ? (
                <span
                  aria-hidden="true"
                  className={`absolute inset-x-0 bottom-1 mx-auto block h-1 w-1 rounded-full ${
                    isSelected ? "bg-black" : "bg-gold"
                  }`}
                />
              ) : null}
            </button>
          );
        })}
      </div>

      <section className="mt-4 rounded-xl border border-sand bg-surface p-4" aria-live="polite">
        <h2 className="m-0 flex items-center gap-2 text-xl text-gold">
          {day.long}
          {selected === today ? (
            <span className="rounded-full bg-gold px-2 py-0.5 font-sans text-xs font-semibold text-black">Today</span>
          ) : null}
        </h2>
        {items.length === 0 ? (
          <p className="mb-0 mt-3 text-sm italic text-ink-soft">No programs scheduled</p>
        ) : (
          <ul className="mb-0 mt-3 list-none divide-y divide-sand p-0">
            {items.map((item) => (
              <li key={item.id} className="py-3 first:pt-0 last:pb-0">
                <Program
                  timeLabel={item.timeLabel}
                  showName={item.showName}
                  description={item.description}
                  large
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
