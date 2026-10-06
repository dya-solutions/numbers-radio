import type { Metadata } from "next";
import { getGroupedSchedule } from "@/lib/content";
import {
  SCHEDULE_TIMEZONE_ABBR,
  SCHEDULE_TIMEZONE_NAME,
  SCHEDULE_TIMEZONE_OFFSET,
} from "@/lib/config";

export const metadata: Metadata = {
  title: "Program Guide",
};

// Always show the most recently saved schedule.
export const dynamic = "force-dynamic";

export default async function ProgramGuidePage() {
  const schedule = await getGroupedSchedule();

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl">Program Guide</h1>
        <p className="mt-2 text-ink-soft">
          Here is what you can expect to hear on Numbers Radio.
        </p>
        <p className="mt-3 inline-block rounded-lg border border-sand border-l-gold border-l-4 bg-surface px-4 py-2 text-sm text-ink">
          All times are in {SCHEDULE_TIMEZONE_NAME} ({SCHEDULE_TIMEZONE_ABBR},{" "}
          {SCHEDULE_TIMEZONE_OFFSET})
        </p>
      </header>

      <div className="space-y-6">
        {schedule.map((day) => (
          <section
            key={day.day}
            className="rounded-xl border border-sand bg-surface p-5"
          >
            <h2 className="m-0 text-xl text-gold">{day.day}</h2>
            <ul className="mt-4 divide-y divide-sand">
              {day.entries.map((entry) => (
                <li
                  key={entry.id}
                  className="flex flex-col gap-1 py-3 sm:flex-row sm:gap-4"
                >
                  <span className="w-28 shrink-0 font-semibold text-ink">
                    {entry.timeLabel}{" "}
                    <span className="text-xs font-medium text-gold">
                      {SCHEDULE_TIMEZONE_ABBR}
                    </span>
                  </span>
                  <span>
                    <span className="font-semibold text-ink">
                      {entry.showName}
                    </span>
                    {entry.description ? (
                      <span className="block text-sm text-ink-soft">
                        {entry.description}
                      </span>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
