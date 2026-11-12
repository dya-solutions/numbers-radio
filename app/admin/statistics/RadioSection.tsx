import { getRadioStats, type Part, type RadioStats } from "@/lib/radio/azuracast";
import { totalsFromClients } from "@/lib/radio/parse";
import {
  clientLabel,
  countryName,
  formatDuration,
  formatGstTime,
  formatListeningTotal,
  formatNumber,
} from "@/lib/analytics/labels";
import {
  BarList,
  DailyListenersChart,
  Empty,
  HourOfDayChart,
  Notice,
  Panel,
  StatCard,
} from "./charts";

/**
 * "Radio listeners (all platforms)": the station's own numbers from AzuraCast.
 * Rendered inside <Suspense> by the page, so the website numbers show at once
 * even if AzuraCast is slow. If AzuraCast is unreachable or the key is missing,
 * only this section shows a message; the rest of the page is untouched.
 */
export default async function RadioSection({ days }: { days: number }) {
  const result = await getRadioStats(days);

  return (
    <section id="radio" className="scroll-mt-20 space-y-6 border-t border-sand pt-8">
      <header>
        <h2 className="text-2xl sm:text-3xl">Radio listeners (all platforms)</h2>
        <p className="mt-2 text-ink-soft">
          Numbers from the radio station itself (AzuraCast). They cover{" "}
          <strong className="text-ink">everyone listening to the stream</strong>, including people who listen through
          other apps and radio directories, not only through this website. Same period as above, refreshed about once a
          minute.
        </p>
      </header>

      <WhyDifferent />

      {!result.ok ? (
        <div className="rounded-xl border border-ember bg-surface p-5 text-ink">
          <p className="m-0 font-semibold">
            {result.code === "missing_key" || result.code === "not_configured"
              ? "Radio listener numbers are not set up yet."
              : "Could not load the radio listener numbers."}
          </p>
          <p className="m-0 mt-1 text-sm text-ink-soft">{result.message}</p>
          <p className="m-0 mt-2 text-sm text-ink-soft">The website numbers above are not affected.</p>
        </div>
      ) : (
        <Radio data={result.data} />
      )}
    </section>
  );
}

function WhyDifferent() {
  return (
    <div className="rounded-xl border border-sand bg-surface p-4 text-sm text-ink-soft sm:p-5">
      <h3 className="m-0 text-base text-ink">Why don&rsquo;t these match the website numbers above?</h3>
      <ul className="mb-0 mt-2 list-disc space-y-1.5 pl-5">
        <li>
          <strong className="text-ink">Different places are counted.</strong> The website numbers cover people who open
          this site. The radio numbers cover every connection to the stream, including other apps, directories and smart
          speakers.
        </li>
        <li>
          <strong className="text-ink">Different ways of counting.</strong> The website counts an anonymous visitor once
          a day. The station counts one device (its connection plus the app or browser), so one person on a phone and a
          laptop counts twice.
        </li>
        <li>
          <strong className="text-ink">Blockers and timing.</strong> Some visitors block website statistics, but the
          station still sees them. The station&rsquo;s daily and hourly totals can also lag a little.
        </li>
      </ul>
      <p className="mb-0 mt-2">
        Neither is wrong: use the radio numbers for the size of the audience and the website numbers for what people do on
        the site.
      </p>
    </div>
  );
}

/** One line per distinct problem, so a single cause isn't repeated in every panel. */
function problems(parts: Part<unknown>[]): string[] {
  const seen = new Set<string>();
  for (const p of parts) if (!p.ok) seen.add(p.message);
  return [...seen];
}

function Radio({ data }: { data: RadioStats }) {
  const { live, peak, dailyUnique, dailyAverage, hourly, clients, countries, browsers, listeningTime, tracks } = data;

  const totals = clients.ok ? totalsFromClients(clients.data) : null;
  const listening = totals ? formatListeningTotal(totals.seconds) : null;

  // Average unique listeners per day. Today is only part-way through, so when
  // there are several days it is left out of the average.
  let perDay: { average: number; basis: number; best: number } | null = null;
  if (dailyUnique.ok && dailyUnique.data.length > 0) {
    const all = dailyUnique.data;
    const used = all.length > 1 ? all.slice(0, -1) : all;
    perDay = {
      average: used.reduce((s, p) => s + p.value, 0) / used.length,
      basis: used.length,
      best: Math.max(...all.map((p) => p.value)),
    };
  }

  const issues = problems([live, peak, dailyUnique, dailyAverage, hourly, clients, countries, browsers, listeningTime, tracks]);

  return (
    <>
      {data.timezoneNote ? <Notice>{data.timezoneNote}</Notice> : null}

      {issues.length > 0 ? (
        <Notice>
          <strong className="text-ink">Some radio numbers could not be loaded:</strong>
          <span className="mt-1 block">
            {issues.map((m) => (
              <span key={m} className="block">
                {m}
              </span>
            ))}
          </span>
        </Notice>
      ) : null}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <StatCard
          label="Listening right now"
          value={live.ok ? formatNumber(live.data.listeners) : "-"}
          note={live.ok ? `${formatNumber(live.data.unique)} different listeners, all platforms` : "Not available"}
        />
        <StatCard
          label="Peak listeners"
          value={peak.ok ? formatNumber(peak.data.listeners) : "-"}
          note={
            peak.ok
              ? peak.data.at
                ? `Most at the same time, ${formatGstTime(new Date(peak.data.at * 1000).toISOString())}`
                : "No one has listened in this period"
              : "Not available"
          }
        />
        <StatCard
          label="Unique listeners per day"
          value={perDay ? formatNumber(perDay.average) : "-"}
          unit={perDay ? "a day" : undefined}
          note={
            perDay
              ? perDay.basis > 1 || data.range.days > 1
                ? `Average over ${perDay.basis} full days. Best day: ${formatNumber(perDay.best)}`
                : "So far today"
              : "Not available"
          }
        />
        <StatCard
          label="Different listeners"
          value={totals ? formatNumber(totals.listeners) : "-"}
          note={totals ? "In the whole period (devices, not people)" : "Not available"}
        />
        <StatCard
          label="Total time listened"
          value={listening ? listening.value : "-"}
          unit={listening ? listening.unit : undefined}
          note={totals ? "All listeners added up" : "Not available"}
        />
        <StatCard
          label="Average listening time"
          value={totals && totals.listeners > 0 ? formatDuration(totals.avgSeconds) : "-"}
          note={totals ? "Per listener over the whole period" : "Not available"}
        />
      </div>

      <Panel
        title="Unique listeners per day"
        blurb="How many different listeners tuned in each day, across every app and website. The white bar is how many were listening at the same time, on average."
      >
        {!dailyUnique.ok ? (
          <Empty>Not available.</Empty>
        ) : dailyUnique.data.length < 2 ? (
          <Empty>
            Today so far: {formatNumber(dailyUnique.data[0]?.value ?? 0)} different listeners. Choose 7 days or longer for
            a day-by-day chart.
          </Empty>
        ) : (
          <DailyListenersChart unique={dailyUnique.data} average={dailyAverage.ok ? dailyAverage.data : null} />
        )}
      </Panel>

      <Panel
        title="Listeners by hour of the day"
        blurb="The average number of people listening at each hour of the day. The station only keeps hour-by-hour detail for the last 14 days, so a longer period still shows just the latest 14 days."
      >
        {hourly.ok ? <HourOfDayChart values={hourly.data} /> : <Empty>Not available.</Empty>}
      </Panel>

      <div className="grid gap-6 md:grid-cols-2">
        <Panel
          title="Listeners by country"
          blurb="Where listeners are, worked out from their connection. Listeners whose country can't be told are left out."
        >
          {countries.ok ? (
            <BarList
              items={countries.data.slice(0, 10).map((c) => ({ label: countryName(c.code), value: c.listeners }))}
              unit="listeners"
              empty="No listeners with a known country in this period."
            />
          ) : (
            <Empty>Not available.</Empty>
          )}
        </Panel>
        <Panel
          title="Devices"
          blurb="What people listen with. “Apps, players and directories” is everyone not using a web browser. Bots are not counted in the totals above."
        >
          {clients.ok ? (
            <BarList
              items={clients.data.map((c) => ({ label: clientLabel(c.client), value: c.listeners }))}
              unit="listeners"
              empty="No listeners in this period."
            />
          ) : (
            <Empty>Not available.</Empty>
          )}
        </Panel>
        <Panel title="Browsers" blurb="For the listeners who use a web browser: which one.">
          {browsers.ok ? (
            <BarList
              items={browsers.data.slice(0, 10).map((b) => ({ label: b.browser, value: b.listeners }))}
              unit="listeners"
              empty="No browser listeners in this period."
            />
          ) : (
            <Empty>Not available.</Empty>
          )}
        </Panel>
        <Panel title="How long people listen" blurb="How long each listener stayed connected over the period, from shortest to longest.">
          {listeningTime.ok ? (
            <BarList
              items={listeningTime.data.map((b) => ({ label: b.label, value: b.listeners }))}
              unit="listeners"
              empty="No listeners in this period."
            />
          ) : (
            <Empty>Not available.</Empty>
          )}
        </Panel>
      </div>

      <Panel title="Most played tracks" blurb="The tracks the station played the most in this period.">
        {tracks.ok ? (
          <BarList
            items={tracks.data.slice(0, 10).map((t) => ({ label: t.title, value: t.plays }))}
            unit="plays"
            color="var(--color-ember)"
            empty="No tracks have been played in this period."
          />
        ) : (
          <Empty>Not available.</Empty>
        )}
      </Panel>
    </>
  );
}
