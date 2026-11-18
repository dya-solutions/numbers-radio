import type { Metadata } from "next";
import { getPublicSchedule } from "@/lib/content";
import { buildWeek, gstWeekday } from "@/lib/schedule";
import {
  SCHEDULE_TIMEZONE_ABBR,
  SCHEDULE_TIMEZONE_NAME,
  SCHEDULE_TIMEZONE_OFFSET,
} from "@/lib/config";
import MobileDays from "./MobileDays";
import TodayMarker from "./TodayMarker";
import Program from "./Program";

export const metadata: Metadata = {
  title: "Program Guide",
};

// Served from cache. The schedule is rebuilt right away whenever it is saved in
// /admin (revalidatePath in app/admin/schedule/actions.ts), and as a safety net
// at most every 5 minutes. "Today" is not baked in: TodayMarker fixes it on screen.
export const revalidate = 300;

export default async function ProgramGuidePage() {
  const { entries } = await getPublicSchedule();
  const { columns, other } = buildWeek(entries);
  // Today in Gulf Standard Time, whatever time zone the visitor is in.
  const today = gstWeekday();

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

      {/* Wide screens: all seven days side by side. (A little wider than the page text so the columns have room.) */}
      <div className="hidden lg:relative lg:left-1/2 lg:block lg:w-[min(72rem,calc(100vw-2rem))] lg:-translate-x-1/2">
        <table className="week-table w-full table-fixed border-separate border-spacing-x-2 border-spacing-y-2">
          <caption className="sr-only">
            Weekly program schedule, Monday to Sunday. Times are in Gulf Standard Time.
          </caption>
          <thead>
            <tr>
              {columns.map(({ day }) => {
                const isToday = day.n === today;
                return (
                  <th
                    key={day.n}
                    scope="col"
                    data-day={day.n}
                    data-today={isToday ? "true" : undefined}
                    aria-current={isToday ? "date" : undefined}
                    className="rounded-lg border border-sand bg-surface px-2 py-2.5 text-center text-sm font-semibold text-ink"
                  >
                    {day.long}
                    <span className="today-label text-[11px] font-semibold uppercase tracking-wide">Today</span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            <tr>
              {columns.map(({ day, entries: list }) => {
                const isToday = day.n === today;
                return (
                  <td
                    key={day.n}
                    data-day={day.n}
                    data-today={isToday ? "true" : undefined}
                    className="rounded-lg border border-sand bg-surface p-3 align-top"
                  >
                    {list.length === 0 ? (
                      <p className="m-0 text-xs italic text-ink-soft">No programs scheduled</p>
                    ) : (
                      <ul className="m-0 list-none space-y-4 p-0">
                        {list.map((entry) => (
                          <li key={entry.id}>
                            <Program
                              timeLabel={entry.timeLabel}
                              showName={entry.showName}
                              description={entry.description}
                            />
                          </li>
                        ))}
                      </ul>
                    )}
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>

      <TodayMarker initialToday={today} />

      {/* Phones and tablets: a button for each day, one day at a time. */}
      <div className="lg:hidden">
        <MobileDays
          initialToday={today}
          days={columns.map(({ entries: list }) =>
            list.map((e) => ({
              id: e.id,
              timeLabel: e.timeLabel,
              showName: e.showName,
              description: e.description,
            })),
          )}
        />
      </div>

      {/* Programs whose days have not been chosen yet in the admin: never hidden. */}
      {other.length > 0 ? (
        <section aria-labelledby="other-times" className="rounded-xl border border-sand bg-surface p-4">
          <h2 id="other-times" className="m-0 text-base text-gold">
            Other times
          </h2>
          <ul className="mb-0 mt-2 list-none space-y-2 p-0 text-sm">
            {other.map((entry) => (
              <li key={entry.id} className="text-ink-soft">
                <span className="font-semibold text-ink">{entry.showName}</span>
                {" - "}
                {entry.originalDay ? `${entry.originalDay}, ` : ""}
                {entry.timeLabel}
                {entry.description ? <span className="block text-xs">{entry.description}</span> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
