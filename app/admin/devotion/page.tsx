import { getDevotion } from "@/lib/content";
import DevotionForm from "./DevotionForm";

export const dynamic = "force-dynamic";

export default async function AdminDevotionPage() {
  const devotion = await getDevotion();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl">Edit Daily Devotion</h1>
        <p className="mt-2 text-ink-soft">
          The boxes below show what is on the website right now. Change any of
          them and press <strong>Save</strong>. The{" "}
          <a href="/daily-devotion" target="_blank" rel="noreferrer">
            Daily Devotion page
          </a>{" "}
          updates straight away.
        </p>
      </header>

      <div className="rounded-xl border border-sand bg-white/60 p-6">
        <DevotionForm devotion={devotion} />
      </div>
    </div>
  );
}
