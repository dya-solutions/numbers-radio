import type { ReactNode } from "react";
import {
  WEEKDAYS,
  WEEKDAYS_LONG,
  formatBucket,
  formatDuration,
  formatNumber,
  niceMax,
  percent,
} from "@/lib/analytics/labels";

/**
 * Simple, dependency-free charts for the Statistics page. Everything here is
 * plain HTML + CSS (no chart library, no client-side code), so it is crisp at
 * any size and works on a phone. Colours come from the site theme.
 */

/* ------------------------------ layout bits ------------------------------ */

export function Panel({
  title,
  blurb,
  children,
}: {
  title: string;
  blurb: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-sand bg-surface p-4 sm:p-5">
      <h2 className="m-0 text-lg text-gold sm:text-xl">{title}</h2>
      <p className="mb-4 mt-1 text-sm text-ink-soft">{blurb}</p>
      {children}
    </section>
  );
}

export function StatCard({
  label,
  value,
  unit,
  note,
}: {
  label: string;
  value: string;
  unit?: string;
  note?: string;
}) {
  return (
    <div className="rounded-xl border border-sand bg-surface p-4">
      <p className="m-0 text-xs font-medium uppercase tracking-wide text-ink-soft">{label}</p>
      <p className="m-0 mt-1 text-2xl font-semibold leading-tight text-ink sm:text-3xl">
        {value}
        {unit ? <span className="ml-1 text-sm font-normal text-ink-soft">{unit}</span> : null}
      </p>
      {note ? <p className="m-0 mt-1 text-xs text-ink-soft">{note}</p> : null}
    </div>
  );
}

export function Empty({ children = "Nothing yet for this period." }: { children?: ReactNode }) {
  return <p className="m-0 text-sm text-ink-soft">{children}</p>;
}

function Legend({ items }: { items: { color: string; label: string }[] }) {
  return (
    <p className="m-0 mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-soft">
      {items.map((item) => (
        <span key={item.label} className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: item.color }} />
          {item.label}
        </span>
      ))}
    </p>
  );
}

/* ------------------------------ bar charts ------------------------------- */

interface Point {
  t: string;
  /** The big bar. */
  a: number;
  /** A smaller bar drawn inside it (optional). */
  b?: number;
  /** Hover text. */
  tip: string;
}

function xLabels(points: Point[]): string[] {
  if (points.length === 0) return [];
  const wanted = points.length <= 8 ? points.length : 5;
  const picks = new Set<number>();
  for (let i = 0; i < wanted; i++) picks.add(Math.round((i * (points.length - 1)) / Math.max(1, wanted - 1)));
  return [...picks].sort((x, y) => x - y).map((i) => formatBucket(points[i].t));
}

/**
 * Columns, one per day (or per hour for "Today"). `a` is the tall column; `b`
 * is an optional narrower column drawn inside it.
 */
function Columns({
  points,
  colorA,
  colorB,
  format,
  label,
}: {
  points: Point[];
  colorA: string;
  colorB?: string;
  format: (n: number) => string;
  label: string;
}) {
  const top = niceMax(Math.max(0, ...points.map((p) => p.a)));
  const labels = xLabels(points);
  const many = points.length > 45;

  return (
    <div role="img" aria-label={label}>
      <div className="flex">
        {/* y axis numbers */}
        <div className="relative mr-2 h-44 w-10 shrink-0 text-right text-[11px] tabular-nums text-ink-soft sm:h-56 sm:w-12">
          <span className="absolute right-0 top-0 -translate-y-1/2">{format(top)}</span>
          <span className="absolute right-0 top-1/2 -translate-y-1/2">{format(top / 2)}</span>
          <span className="absolute bottom-0 right-0 translate-y-1/2">0</span>
        </div>

        <div className="relative h-44 flex-1 border-b border-l border-sand sm:h-56">
          <div aria-hidden="true" className="absolute inset-x-0 top-0 border-t border-dashed border-sand/70" />
          <div aria-hidden="true" className="absolute inset-x-0 top-1/2 border-t border-dashed border-sand/70" />
          <div className={`absolute inset-0 flex items-end ${many ? "gap-px" : "gap-0.5 sm:gap-1"}`}>
            {points.map((p) => (
              <div
                key={p.t}
                title={p.tip}
                className="group relative h-full min-w-0 flex-1 hover:bg-white/10"
              >
                <div
                  className="absolute bottom-0 w-full rounded-t-[2px]"
                  style={{ height: `${(p.a / top) * 100}%`, minHeight: p.a > 0 ? 2 : 0, background: colorA }}
                />
                {colorB && p.b !== undefined ? (
                  <div
                    className="absolute bottom-0 left-1/4 w-1/2 rounded-t-[2px]"
                    style={{ height: `${(p.b / top) * 100}%`, minHeight: p.b > 0 ? 2 : 0, background: colorB }}
                  />
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="ml-12 mt-1.5 flex justify-between text-[11px] tabular-nums text-ink-soft sm:ml-14">
        {labels.map((l, i) => (
          <span key={i}>{l}</span>
        ))}
      </div>
    </div>
  );
}

export function VisitorsChart({
  series,
  bucket,
}: {
  series: { t: string; visitors: number; pageviews: number }[];
  bucket: "hour" | "day";
}) {
  const unit = bucket === "hour" ? "this hour" : "that day";
  const points: Point[] = series.map((s) => ({
    t: s.t,
    a: s.pageviews,
    b: s.visitors,
    tip: `${formatBucket(s.t)}: ${formatNumber(s.pageviews)} page views, ${formatNumber(s.visitors)} visitors ${unit}`,
  }));
  const peak = series.reduce((best, s) => (s.pageviews > best.pageviews ? s : best), series[0]);
  const total = series.reduce((sum, s) => sum + s.pageviews, 0);

  return (
    <>
      <Legend
        items={[
          { color: "var(--color-gold)", label: "Page views" },
          { color: "#ffffff", label: "Visitors" },
        ]}
      />
      <Columns
        points={points}
        colorA="var(--color-gold)"
        colorB="#ffffff"
        format={(n) => formatNumber(n)}
        label="Chart of page views and visitors over time"
      />
      {total > 0 && peak ? (
        <p className="m-0 mt-3 text-sm text-ink-soft">
          Busiest {bucket === "hour" ? "hour" : "day"}:{" "}
          <strong className="text-ink">{formatBucket(peak.t)}</strong> with{" "}
          {formatNumber(peak.pageviews)} page views from {formatNumber(peak.visitors)} visitors.
        </p>
      ) : (
        <p className="m-0 mt-3 text-sm text-ink-soft">No visits in this period yet.</p>
      )}
    </>
  );
}

export function ListeningChart({
  series,
  bucket,
}: {
  series: { t: string; listen_seconds: number }[];
  bucket: "hour" | "day";
}) {
  const points: Point[] = series.map((s) => ({
    t: s.t,
    a: s.listen_seconds / 60,
    tip: `${formatBucket(s.t)}: ${formatDuration(s.listen_seconds)} of listening`,
  }));
  const total = series.reduce((sum, s) => sum + s.listen_seconds, 0);
  const peak = series.reduce((best, s) => (s.listen_seconds > best.listen_seconds ? s : best), series[0]);

  return (
    <>
      <Legend items={[{ color: "var(--color-ember)", label: "Minutes of listening (all listeners added together)" }]} />
      <Columns
        points={points}
        colorA="var(--color-ember)"
        format={(n) => formatNumber(n)}
        label="Chart of listening minutes over time"
      />
      {total > 0 && peak ? (
        <p className="m-0 mt-3 text-sm text-ink-soft">
          Most listening: <strong className="text-ink">{formatBucket(peak.t)}</strong> with{" "}
          {formatDuration(peak.listen_seconds)}.
        </p>
      ) : (
        <p className="m-0 mt-3 text-sm text-ink-soft">No one has listened in this period yet.</p>
      )}
      {bucket === "hour" ? null : null}
    </>
  );
}

/* -------------------------------- heatmap -------------------------------- */

export function Heatmap({ cells }: { cells: [number, number, number][] }) {
  const grid: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
  for (const [dow, hour, seconds] of cells) {
    if (dow >= 1 && dow <= 7 && hour >= 0 && hour < 24) grid[dow - 1][hour] += seconds;
  }
  const max = Math.max(0, ...grid.flat());
  if (max <= 0) return <Empty>No listening yet for this period.</Empty>;

  const busiest = grid
    .flatMap((row, d) => row.map((seconds, h) => ({ d, h, seconds })))
    .filter((c) => c.seconds > 0)
    .sort((a, b) => b.seconds - a.seconds)
    .slice(0, 3);

  const hh = (h: number) => String(h).padStart(2, "0");

  return (
    <div>
      <div
        role="img"
        aria-label="Heat map of listening by day of the week and hour of the day, in Gulf Standard Time"
        className="grid gap-[3px]"
        style={{ gridTemplateColumns: "2.25rem repeat(24, minmax(0, 1fr))" }}
      >
        {/* hour labels */}
        <span />
        {Array.from({ length: 24 }, (_, h) => (
          <span key={h} className="text-center text-[9px] leading-none text-ink-soft sm:text-[10px]">
            {h % 3 === 0 ? hh(h) : ""}
          </span>
        ))}

        {grid.map((row, d) => (
          <Row key={d} day={WEEKDAYS[d]}>
            {row.map((seconds, h) => (
              <span
                key={h}
                title={`${WEEKDAYS_LONG[d]} ${hh(h)}:00-${hh((h + 1) % 24)}:00 GST: ${
                  seconds > 0 ? formatDuration(seconds) : "no listening"
                }`}
                className="block h-5 rounded-[3px] sm:h-6"
                style={{
                  background:
                    seconds > 0
                      ? `rgba(242, 169, 0, ${0.18 + 0.82 * Math.sqrt(seconds / max)})`
                      : "rgba(255, 255, 255, 0.05)",
                }}
              />
            ))}
          </Row>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-soft">
        <span className="inline-flex items-center gap-1.5">
          Less
          <span
            aria-hidden="true"
            className="inline-block h-2.5 w-20 rounded-sm"
            style={{ background: "linear-gradient(to right, rgba(242,169,0,0.18), rgba(242,169,0,1))" }}
          />
          More
        </span>
        <span>Hours are Gulf Standard Time (GST), 00 = midnight.</span>
      </div>
      <p className="m-0 mt-2 text-sm text-ink-soft">
        Busiest hours of the week:{" "}
        {busiest.map((c, i) => (
          <span key={`${c.d}-${c.h}`}>
            {i > 0 ? ", " : ""}
            <strong className="text-ink">
              {WEEKDAYS_LONG[c.d]} {hh(c.h)}:00
            </strong>{" "}
            ({formatDuration(c.seconds)} listened)
          </span>
        ))}
        .
      </p>
    </div>
  );
}

function Row({ day, children }: { day: string; children: ReactNode }) {
  return (
    <>
      <span className="flex items-center text-[11px] text-ink-soft">{day}</span>
      {children}
    </>
  );
}

/* --------------------------- lists and split bars -------------------------- */

export interface BarItem {
  label: string;
  value: number;
  /** Small grey text after the label. */
  sub?: string;
}

/** A ranked list with a bar behind each row. Shares are of the list's total unless `of` is given. */
export function BarList({
  items,
  of,
  color = "var(--color-gold)",
  unit = "",
  empty,
}: {
  items: BarItem[];
  of?: number;
  color?: string;
  unit?: string;
  empty?: string;
}) {
  if (items.length === 0) return <Empty>{empty}</Empty>;
  const total = of ?? items.reduce((sum, i) => sum + i.value, 0);
  const top = Math.max(1, ...items.map((i) => i.value));

  return (
    <ul className="m-0 list-none space-y-2.5 p-0">
      {items.map((item) => (
        <li key={item.label + (item.sub ?? "")}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate text-ink" title={item.label}>
              {item.label}
              {item.sub ? <span className="ml-1.5 text-xs text-ink-soft">{item.sub}</span> : null}
            </span>
            <span className="shrink-0 tabular-nums text-ink-soft">
              <strong className="font-semibold text-ink">{formatNumber(item.value)}</strong>
              {unit ? ` ${unit}` : ""}
              {total > 0 ? <span className="ml-1.5 text-xs">{percent(item.value, total)}%</span> : null}
            </span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-surface-2">
            <div className="h-full rounded-full" style={{ width: `${(item.value / top) * 100}%`, background: color }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Two groups side by side, as one bar split in two. */
export function SplitBar({
  a,
  b,
}: {
  a: { label: string; value: number; color: string };
  b: { label: string; value: number; color: string };
}) {
  const total = a.value + b.value;
  if (total === 0) return <Empty />;
  const pa = percent(a.value, total);
  return (
    <div>
      <div className="flex h-4 overflow-hidden rounded-full bg-surface-2" role="img" aria-label={`${a.label} ${pa}%, ${b.label} ${100 - pa}%`}>
        <div style={{ width: `${(a.value / total) * 100}%`, background: a.color }} />
        <div style={{ width: `${(b.value / total) * 100}%`, background: b.color }} />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
        {[a, b].map((x) => (
          <div key={x.label}>
            <p className="m-0 inline-flex items-center gap-1.5 text-ink-soft">
              <span aria-hidden="true" className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: x.color }} />
              {x.label}
            </p>
            <p className="m-0 text-xl font-semibold tabular-nums text-ink">
              {formatNumber(x.value)}
              <span className="ml-1.5 text-sm font-normal text-ink-soft">{percent(x.value, total)}%</span>
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function MiniStat({ label, value, tone }: { label: string; value: string; tone?: "good" | "warn" }) {
  return (
    <div className="rounded-lg border border-sand bg-surface-2 p-3">
      <p className="m-0 text-xs text-ink-soft">{label}</p>
      <p
        className={`m-0 mt-0.5 text-xl font-semibold tabular-nums ${
          tone === "warn" ? "text-gold" : "text-ink"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
