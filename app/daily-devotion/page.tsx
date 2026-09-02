import type { Metadata } from "next";
import { devotion } from "@/content/devotion";

export const metadata: Metadata = {
  title: "Daily Devotion",
};

export default function DailyDevotionPage() {
  const paragraphs = devotion.body.split(/\n\s*\n/);

  return (
    <article className="mx-auto max-w-2xl">
      <p className="m-0 text-sm uppercase tracking-widest text-ember-dark">
        {devotion.date}
      </p>
      <h1 className="mt-2 text-3xl">{devotion.title}</h1>

      <blockquote className="my-6 border-l-4 border-gold bg-white/60 px-5 py-4 italic text-ink">
        &ldquo;{devotion.scriptureText}&rdquo;
        <footer className="mt-2 text-sm not-italic text-ink-soft">
          {devotion.scriptureReference}
        </footer>
      </blockquote>

      <div className="space-y-4 text-lg leading-relaxed">
        {paragraphs.map((para, i) => (
          <p key={i} className="m-0">
            {para}
          </p>
        ))}
      </div>

      <p className="mt-8 rounded-xl bg-sand/60 p-5 text-ink">
        <span className="block text-sm font-semibold uppercase tracking-wide text-ember-dark">
          A prayer
        </span>
        <span className="mt-1 block">{devotion.prayer}</span>
      </p>
    </article>
  );
}
