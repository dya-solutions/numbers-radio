import type { Metadata } from "next";
import { getDevotion } from "@/lib/content";

export const metadata: Metadata = {
  title: "Daily Devotion",
};

// Always show the most recently saved devotion.
export const dynamic = "force-dynamic";

export default async function DailyDevotionPage() {
  const devotion = await getDevotion();
  const paragraphs = devotion.reflection.split(/\n\s*\n/).filter(Boolean);

  return (
    <article className="mx-auto max-w-2xl">
      {devotion.dateLabel ? (
        <p className="m-0 text-sm uppercase tracking-widest text-ember-dark">
          {devotion.dateLabel}
        </p>
      ) : null}
      <h1 className="mt-2 text-3xl">{devotion.title}</h1>

      {devotion.scriptureText ? (
        <blockquote className="my-6 border-l-4 border-gold bg-white/60 px-5 py-4 italic text-ink">
          &ldquo;{devotion.scriptureText}&rdquo;
          {devotion.scriptureReference ? (
            <footer className="mt-2 text-sm not-italic text-ink-soft">
              {devotion.scriptureReference}
            </footer>
          ) : null}
        </blockquote>
      ) : null}

      <div className="space-y-4 text-lg leading-relaxed">
        {paragraphs.map((para, i) => (
          <p key={i} className="m-0">
            {para}
          </p>
        ))}
      </div>

      {devotion.prayer ? (
        <p className="mt-8 rounded-xl bg-sand/60 p-5 text-ink">
          <span className="block text-sm font-semibold uppercase tracking-wide text-ember-dark">
            A prayer
          </span>
          <span className="mt-1 block">{devotion.prayer}</span>
        </p>
      ) : null}
    </article>
  );
}
