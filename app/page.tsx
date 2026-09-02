import Link from "next/link";
import AudioPlayer from "./components/AudioPlayer";
import { STATION_NAME, STATION_TAGLINE } from "@/lib/config";

export default function HomePage() {
  return (
    <div className="space-y-12">
      <section className="text-center">
        <p className="m-0 text-sm uppercase tracking-widest text-ember-dark">
          Christian Radio
        </p>
        <h1 className="mt-2 text-4xl sm:text-5xl">{STATION_NAME}</h1>
        <p className="mx-auto mt-3 max-w-xl text-lg text-ink-soft">
          {STATION_TAGLINE}. Worship, teaching, and prayer - streaming day and
          night.
        </p>
      </section>

      <section>
        <AudioPlayer />
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <HomeCard
          href="/program-guide"
          title="Program Guide"
          text="See what is on air through the day and week."
        />
        <HomeCard
          href="/daily-devotion"
          title="Daily Devotion"
          text="A short Scripture and reflection for today."
        />
        <HomeCard
          href="/feedback"
          title="Feedback & Prayer"
          text="Share a thought or send a prayer request."
        />
      </section>
    </div>
  );
}

function HomeCard({
  href,
  title,
  text,
}: {
  href: string;
  title: string;
  text: string;
}) {
  return (
    <Link
      href={href}
      className="block rounded-xl border border-sand bg-white/60 p-5 no-underline transition-colors hover:border-ember"
    >
      <h3 className="m-0 text-lg text-ink">{title}</h3>
      <p className="m-0 mt-1 text-sm text-ink-soft">{text}</p>
    </Link>
  );
}
