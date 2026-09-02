import type { Metadata } from "next";
import { weeklySchedule } from "@/content/schedule";

export const metadata: Metadata = {
  title: "Program Guide",
};

export default function ProgramGuidePage() {
  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl">Program Guide</h1>
        <p className="mt-2 text-ink-soft">
          Here is what you can expect to hear on Numbers Radio. All times are
          shown in the station&rsquo;s local time.
        </p>
        <p className="mt-1 text-sm text-ink-soft">
          <em>
            This schedule is entered by hand for now. Soon it will update
            automatically from our broadcast system.
          </em>
        </p>
      </header>

      <div className="space-y-6">
        {weeklySchedule.map((day) => (
          <section
            key={day.day}
            className="rounded-xl border border-sand bg-white/60 p-5"
          >
            <h2 className="m-0 text-xl text-ember-dark">{day.day}</h2>
            <ul className="mt-4 divide-y divide-sand">
              {day.entries.map((entry) => (
                <li
                  key={`${day.day}-${entry.time}-${entry.title}`}
                  className="flex flex-col gap-1 py-3 sm:flex-row sm:gap-4"
                >
                  <span className="w-24 shrink-0 font-semibold text-ink">
                    {entry.time}
                  </span>
                  <span>
                    <span className="font-semibold text-ink">{entry.title}</span>
                    {entry.host ? (
                      <span className="text-ink-soft"> {entry.host}</span>
                    ) : null}
                    <span className="block text-sm text-ink-soft">
                      {entry.description}
                    </span>
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
