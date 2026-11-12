import type { Metadata } from "next";
import { STATION_NAME } from "@/lib/config";

export const metadata: Metadata = {
  title: "Privacy",
  description: `How ${STATION_NAME} counts visitors without cookies, tracking or personal details.`,
};

export default function PrivacyPage() {
  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl">Privacy</h1>
        <p className="mt-2 text-ink-soft">
          We like to know how many people listen and read, so we can serve you
          better. We do it without knowing who you are.
        </p>
      </header>

      <section className="space-y-3 rounded-xl border border-sand bg-surface p-5">
        <h2 className="m-0 text-xl text-gold">What we count</h2>
        <ul className="m-0 list-disc space-y-1.5 pl-5 text-ink">
          <li>Which pages of this site are opened, and which website sent you here.</li>
          <li>
            When you listen to the radio: when you press play, how long you
            listen, and whether the connection had to be re-made.
          </li>
          <li>
            Whether you play the Daily Devotion and whether you reach the end,
            and which sermon or prayer-point links you open.
          </li>
          <li>
            That a Feedback or Prayer Request form was sent. We count only
            <em> that </em> it was sent, never what it says.
          </li>
          <li>Whether the site was installed as an app, and whether you use it as an app or in a browser.</li>
          <li>
            Roughly where you are (country, region and city, worked out from your
            connection when you visit) and the type of device, browser and
            operating system you use.
          </li>
        </ul>
      </section>

      <section className="space-y-3 rounded-xl border border-sand bg-surface p-5">
        <h2 className="m-0 text-xl text-gold">What we never do</h2>
        <ul className="m-0 list-disc space-y-1.5 pl-5 text-ink">
          <li>
            <strong>No cookies</strong>, and no advertising or analytics
            companies. The counting is done by this website itself.
          </li>
          <li>
            <strong>Your IP address is never stored.</strong> It is used for a
            moment to make an anonymous code and then forgotten.
          </li>
          <li>
            We don&rsquo;t record your name, email, or anything you type into a
            form as part of the counting.
          </li>
          <li>We don&rsquo;t follow you from one day to the next, or from one website to another.</li>
          <li>We don&rsquo;t sell or share these numbers with anyone.</li>
        </ul>
      </section>

      <section className="space-y-3 rounded-xl border border-sand bg-surface p-5">
        <h2 className="m-0 text-xl text-gold">How the anonymous code works</h2>
        <p className="m-0 text-ink">
          To count visitors, your connection and browser details are scrambled
          into a code that can&rsquo;t be turned back into an IP address. The
          scrambling uses a secret that changes every day, so the code changes
          every day too. That lets us count people for one day, but not
          recognise anyone the next day.
        </p>
        <p className="m-0 text-ink">
          One small thing is remembered on your own device (not a cookie):
          the <em>date</em> of your first visit. It lets us tell &ldquo;new&rdquo;
          from &ldquo;returning&rdquo; visitors. It contains no code and no
          personal information, and it is never sent to us on its own.
        </p>
      </section>

      <section className="space-y-3 rounded-xl border border-sand bg-surface p-5">
        <h2 className="m-0 text-xl text-gold">How long we keep it</h2>
        <p className="m-0 text-ink">
          Detailed counts are deleted automatically after 120 days. Only
          anonymous daily totals (for example &ldquo;120 visitors on this
          day&rdquo;) are kept longer.
        </p>
      </section>

      <section className="space-y-3 rounded-xl border border-sand bg-surface p-5">
        <h2 className="m-0 text-xl text-gold">The live radio stream</h2>
        <p className="m-0 text-ink">
          Everything above is about this website. The live audio itself comes
          from our radio server, a separate system. To play you the audio it
          has to receive your connection, and it keeps its own listener
          statistics (for example the country, the kind of device or app, and
          how long a listener stayed) so we know how many people we serve. That
          happens for everyone who listens to the station, whether through this
          website or another app.
        </p>
      </section>

      <section className="space-y-3 rounded-xl border border-sand bg-surface p-5">
        <h2 className="m-0 text-xl text-gold">Messages you send us</h2>
        <p className="m-0 text-ink">
          Feedback and prayer requests you choose to send are stored separately
          so our team can read and pray over them. They are never part of the
          visitor counts above.
        </p>
      </section>
    </div>
  );
}
