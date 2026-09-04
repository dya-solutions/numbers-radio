import type { Metadata } from "next";
import { getGroupedSchedule } from "@/lib/content";

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
          Here is what you can expect to hear on Numbers Radio. All times are
          shown in the station&rsquo;s local time.
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
                  <span className="w-24 shrink-0 font-semibold text-ink">
                    {entry.timeLabel}
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
