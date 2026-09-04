import type { Metadata } from "next";
import { getDevotion } from "@/lib/content";

export const metadata: Metadata = {
  title: "Daily Devotion",
};

// Always show the most recently saved devotion.
export const dynamic = "force-dynamic";

function paragraphs(text: string): string[] {
  return text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
}

function lines(text: string): string[] {
  return text.split(/\n+/).map((l) => l.trim()).filter(Boolean);
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="m-0 text-sm font-semibold uppercase tracking-widest text-gold">
      {children}
      <span className="mt-2 block h-0.5 w-10 bg-ember" />
    </h2>
  );
}

export default async function DailyDevotionPage() {
  const devotion = await getDevotion();
  const bodyParas = paragraphs(devotion.body);
  const studyLines = lines(devotion.furtherStudy);
  const prayerParas = paragraphs(devotion.prayer);
  const hasScripture = Boolean(devotion.scriptureText || devotion.scriptureReference);

  return (
    <article className="mx-auto max-w-2xl">
      {/* 1. Date  +  2. Source line  +  3. Title */}
      <header>
        {devotion.dateLabel ? (
          <p className="m-0 text-sm uppercase tracking-widest text-gold">
            {devotion.dateLabel}
          </p>
        ) : null}
        {devotion.sourceLine ? (
          <p className="m-0 mt-1 text-sm italic text-ink-soft">
            {devotion.sourceLine}
          </p>
        ) : null}
        <h1 className="mt-3 text-3xl">{devotion.title}</h1>
      </header>

      {/* 4. Scripture */}
      {hasScripture ? (
        <section className="mt-8">
          <SectionHeading>Scripture</SectionHeading>
          <blockquote className="mt-3 border-l-4 border-gold bg-surface px-5 py-4 text-ink">
            {devotion.scriptureText ? (
              <p className="m-0 text-lg italic leading-relaxed">
                &ldquo;{devotion.scriptureText}&rdquo;
              </p>
            ) : null}
            {devotion.scriptureReference ? (
              <p className="m-0 mt-2 text-sm font-semibold not-italic text-gold">
                {devotion.scriptureReference}
              </p>
            ) : null}
          </blockquote>
        </section>
      ) : null}

      {/* 5. Body */}
      {bodyParas.length > 0 ? (
        <section className="mt-10">
          <SectionHeading>Devotion</SectionHeading>
          <div className="mt-4 space-y-5 text-lg leading-relaxed text-ink">
            {bodyParas.map((para, i) => (
              <p key={i} className="m-0">
                {para}
              </p>
            ))}
          </div>
        </section>
      ) : null}

      {/* 6. Further Study */}
      {studyLines.length > 0 ? (
        <section className="mt-10 border-t border-sand pt-8">
          <SectionHeading>Further Study</SectionHeading>
          <ul className="mt-4 space-y-2 text-ink-soft">
            {studyLines.map((line, i) => (
              <li key={i} className="border-l-2 border-ember/60 pl-3">
                {line}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* 7. Golden Nugget */}
      {devotion.goldenNugget ? (
        <section className="mt-10">
          <div className="rounded-xl border border-gold bg-gold/10 px-6 py-5">
            <p className="m-0 text-xs font-semibold uppercase tracking-widest text-gold">
              Golden Nugget
            </p>
            <p className="m-0 mt-3 font-serif text-xl italic leading-relaxed text-ink">
              &ldquo;{devotion.goldenNugget}&rdquo;
            </p>
          </div>
        </section>
      ) : null}

      {/* 8. Prayer */}
      {prayerParas.length > 0 ? (
        <section className="mt-10 border-t border-sand pt-8">
          <SectionHeading>Prayer</SectionHeading>
          <div className="mt-4 space-y-3 text-ink">
            {prayerParas.map((para, i) => (
              <p key={i} className="m-0">
                {para}
              </p>
            ))}
          </div>
        </section>
      ) : null}
    </article>
  );
}
