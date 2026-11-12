import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { isAdminAuthorized } from "@/lib/adminAuth";
import { RANGES, getDashboard, parseRange } from "@/lib/analytics/stats";
import {
  countryName,
  deviceLabel,
  formatDate,
  formatDuration,
  formatGstTime,
  formatListeningTotal,
  formatNumber,
  groupSections,
  percent,
  plainName,
  referrerLabel,
} from "@/lib/analytics/labels";
import CleanupButton from "./CleanupButton";
import RadioSection from "./RadioSection";
import {
  BarList,
  Empty,
  Heatmap,
  ListeningChart,
  MiniStat,
  Panel,
  SplitBar,
  StatCard,
  VisitorsChart,
} from "./charts";

export const metadata: Metadata = {
  title: "Statistics",
  robots: { index: false, follow: false },
};

// Always fresh numbers - never cached.
export const dynamic = "force-dynamic";

export default async function StatisticsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // The /admin password is checked by middleware.ts; checked again here so the
  // numbers stay private even if the middleware settings were ever changed by mistake.
  if (!isAdminAuthorized((await headers()).get("authorization"))) notFound();

  const days = parseRange((await searchParams).days);
  const result = await getDashboard(days);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl">Statistics</h1>
        <p className="mt-2 text-ink-soft">
          How people use the site and the player. Everything is anonymous: no
          names, no cookies and no IP addresses are stored.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Choose a period">
        {RANGES.map((r) => (
          <Link
            key={r.days}
            href={`/admin/statistics?days=${r.days}`}
            aria-current={r.days === days ? "true" : undefined}
            className={`rounded-lg px-4 py-2 text-sm no-underline transition-colors ${
              r.days === days
                ? "bg-gold font-semibold text-black"
                : "border border-sand bg-surface text-ink-soft hover:text-ink"
            }`}
          >
            {r.label}
          </Link>
        ))}
        <a
          href="#radio"
          className="ml-auto text-sm text-ink-soft no-underline hover:text-ink"
        >
          Radio listeners (all platforms) &darr;
        </a>
      </div>

      {!result.ok ? (
        <div className="rounded-xl border border-ember bg-surface p-5 text-ink">
          <p className="m-0 font-semibold">
            {result.code === "not_ready" ? "Statistics are not set up yet." : "Could not load the statistics."}
          </p>
          <p className="m-0 mt-1 text-sm text-ink-soft">{result.message}</p>
        </div>
      ) : (
        <Dashboard data={result.data} />
      )}

      {/* The station's own numbers from AzuraCast. Loads on its own, so a slow or
          unreachable radio server never holds up (or breaks) the numbers above. */}
      <Suspense
        fallback={
          <section id="radio" className="scroll-mt-20 border-t border-sand pt-8">
            <h2 className="text-2xl sm:text-3xl">Radio listeners (all platforms)</h2>
            <p className="mt-2 text-ink-soft">Loading the radio station&rsquo;s numbers&hellip;</p>
          </section>
        }
      >
        <RadioSection days={days} />
      </Suspense>
    </div>
  );
}

function Dashboard({ data }: { data: import("@/lib/analytics/stats").Dashboard }) {
  const { totals: t, range } = data;
  const listening = formatListeningTotal(t.listening_seconds);
  const forms = t.feedback + t.prayer;
  const sections = groupSections(data.sections);
  const health = data.health;
  const cleanupAge = data.housekeeping.last_cleanup
    ? (Date.now() - Date.parse(data.housekeeping.last_cleanup)) / 3600000
    : Infinity;

  return (
    <>
      <p className="text-sm text-ink-soft">
        {range.days === 1 ? (
          <>Showing <strong className="text-ink">today</strong>, {formatDate(range.to)}</>
        ) : (
          <>
            Showing <strong className="text-ink">{formatDate(range.from)}</strong> to{" "}
            <strong className="text-ink">{formatDate(range.to)}</strong>
          </>
        )}
        . All days and times are Gulf Standard Time (GST, UTC+4).
      </p>

      {/* ---------------------------- summary cards ---------------------------- */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Visitors" value={formatNumber(t.visitors)} note="Counted once per day each" />
        <StatCard label="Page views" value={formatNumber(t.pageviews)} note="Pages opened" />
        <StatCard
          label="Listening sessions"
          value={formatNumber(t.listening_sessions)}
          note="Times someone listened 5+ seconds"
        />
        <StatCard label="Listening time" value={listening.value} unit={listening.unit} note="All listeners added up" />
        <StatCard
          label="Average session"
          value={t.listening_sessions > 0 ? formatDuration(t.avg_session_seconds) : "-"}
          note="How long one listen lasts"
        />
        <StatCard
          label="Devotion plays"
          value={formatNumber(t.devotion_plays)}
          note={
            t.devotion_plays > 0
              ? `${formatNumber(t.devotion_finished)} listened to the end`
              : "Listen to today's devotion"
          }
        />
        <StatCard
          label="Forms sent"
          value={formatNumber(forms)}
          note={`${formatNumber(t.feedback)} feedback, ${formatNumber(t.prayer)} prayer`}
        />
        <StatCard label="App installs" value={formatNumber(t.installs)} note="Added to a home screen / desktop" />
      </div>

      {/* ------------------------------- trends -------------------------------- */}
      <Panel
        title="Visitors and page views"
        blurb={`How busy the site was ${range.bucket === "hour" ? "hour by hour today" : "day by day"}. A visitor is one person on one day; page views count every page they opened.`}
      >
        <VisitorsChart series={data.series} bucket={range.bucket} />
      </Panel>

      <Panel
        title="Listening time"
        blurb={`Minutes of radio listened to ${range.bucket === "hour" ? "each hour today" : "each day"}, added up across everyone.`}
      >
        <ListeningChart series={data.series} bucket={range.bucket} />
      </Panel>

      <Panel
        title="When do people listen?"
        blurb="The brighter the gold, the more people were listening at that time of the week. Use it to see the best hours to share something."
      >
        <Heatmap cells={data.heatmap} />
      </Panel>

      {/* -------------------------------- content ------------------------------- */}
      <Panel title="Most visited sections" blurb="Which parts of the site get opened the most (page views).">
        <BarList items={sections.map((s) => ({ label: s.label, value: s.n }))} unit="views" />
      </Panel>

      <div className="grid gap-6 md:grid-cols-2">
        <Panel title="Most clicked sermons" blurb="Sermon links people opened.">
          <BarList
            items={data.sermons.map((s) => ({ label: s.label || "(removed sermon)", value: s.n }))}
            unit="clicks"
            color="var(--color-ember)"
            empty="No sermon links have been clicked in this period."
          />
        </Panel>
        <Panel title="Most clicked prayer points" blurb="Prayer point links people opened.">
          <BarList
            items={data.prayer_points.map((s) => ({ label: s.label || "(removed prayer point)", value: s.n }))}
            unit="clicks"
            color="var(--color-ember)"
            empty="No prayer point links have been clicked in this period."
          />
        </Panel>
      </div>

      {/* --------------------------------- people -------------------------------- */}
      <div className="grid gap-6 md:grid-cols-2">
        <Panel title="Top countries" blurb="Where visitors are, worked out from their connection (never stored as an address).">
          <BarList
            items={data.who.countries.map((c) => ({ label: countryName(c.code), value: c.n }))}
            unit="visitors"
          />
        </Panel>
        <Panel title="Top cities" blurb="The same, by city. Some connections don't reveal a city.">
          <BarList
            items={data.who.cities.map((c) => ({ label: c.city, sub: countryName(c.code), value: c.n }))}
            unit="visitors"
            empty="No city information yet."
          />
        </Panel>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Panel title="Devices" blurb="Phone, tablet or computer.">
          <BarList items={data.who.devices.map((d) => ({ label: deviceLabel(d.name), value: d.n }))} />
        </Panel>
        <Panel title="Browsers" blurb="The app people use to open the site.">
          <BarList items={data.who.browsers.map((d) => ({ label: plainName(d.name), value: d.n }))} />
        </Panel>
        <Panel title="Operating systems" blurb="Windows, Android, iPhone and so on.">
          <BarList items={data.who.systems.map((d) => ({ label: plainName(d.name), value: d.n }))} />
        </Panel>
      </div>

      <Panel
        title="How people found us"
        blurb="The website that sent each visit to us. “Direct” means they typed the address, used a bookmark or opened the app."
      >
        <BarList
          items={data.referrers.map((r) => ({ label: referrerLabel(r.host), value: r.n }))}
          unit="visits"
          empty="No visits yet."
        />
      </Panel>

      <div className="grid gap-6 md:grid-cols-2">
        <Panel
          title="New or returning"
          blurb="“Returning” means this browser was here on an earlier day."
        >
          <SplitBar
            a={{ label: "New visitors", value: data.who.returning.new, color: "var(--color-gold)" }}
            b={{ label: "Returning", value: data.who.returning.returning, color: "var(--color-ember)" }}
          />
        </Panel>
        <Panel
          title="Installed app or browser"
          blurb="Whether people opened the site as an installed app or in a normal browser."
        >
          <SplitBar
            a={{ label: "Installed app", value: data.who.app.installed, color: "var(--color-gold)" }}
            b={{ label: "In a browser", value: data.who.app.browser, color: "#8a8a8a" }}
          />
        </Panel>
      </div>

      {/* ------------------------------ player health ------------------------------ */}
      <Panel
        title="Is the player working well?"
        blurb="A “reconnect” is when the live stream dropped and the player put it back by itself. An “error” is a connection attempt that failed. Fewer is better."
      >
        {health.sessions === 0 ? (
          <Empty>No one has pressed play in this period yet.</Empty>
        ) : (
          <div className="space-y-4">
            <p className="m-0 text-ink">
              {health.listened > 0 ? (
                <>
                  <strong className="text-2xl text-gold">{percent(health.smooth, health.listened)}%</strong>{" "}
                  of listening sessions were smooth, with no reconnects or errors.
                </>
              ) : (
                <>No listening session lasted long enough to judge yet.</>
              )}
            </p>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              <MiniStat label="Times play was pressed" value={formatNumber(health.sessions)} />
              <MiniStat
                label="Never got any sound"
                value={formatNumber(health.never_started)}
                tone={health.never_started > 0 ? "warn" : undefined}
              />
              <MiniStat label="Sessions with a reconnect" value={formatNumber(health.with_reconnects)} />
              <MiniStat label="Sessions with an error" value={formatNumber(health.with_errors)} />
              <MiniStat label="Reconnects in total" value={formatNumber(health.reconnects)} />
              <MiniStat label="Errors in total" value={formatNumber(health.errors)} />
            </div>
          </div>
        )}
      </Panel>

      {/* ------------------------------- housekeeping ------------------------------ */}
      <section className="rounded-xl border border-sand bg-surface p-4 text-sm text-ink-soft sm:p-5">
        <h2 className="m-0 text-base text-ink">Data kept</h2>
        <p className="mb-3 mt-1">
          Detailed records are kept for 120 days and then deleted automatically
          each night. A short daily total is kept forever. Right now:{" "}
          {formatNumber(data.housekeeping.events)} detailed events
          {data.housekeeping.oldest ? ` (oldest ${formatDate(data.housekeeping.oldest)})` : ""} and{" "}
          {formatNumber(data.housekeeping.daily_rows)} daily totals.
        </p>
        <p className={`m-0 mb-3 ${cleanupAge > 36 ? "text-gold" : ""}`}>
          {data.housekeeping.last_cleanup
            ? `Last cleanup: ${formatGstTime(data.housekeeping.last_cleanup)}.`
            : "The cleanup hasn't run yet."}
          {cleanupAge > 36
            ? " It should run by itself every night at 03:10 GST. If it isn't, switch on pg_cron in Supabase (Database -> Extensions), run supabase/add-statistics.sql again, or press the button."
            : ""}
        </p>
        <CleanupButton />
      </section>
    </>
  );
}
