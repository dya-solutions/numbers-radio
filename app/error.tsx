"use client";

import Link from "next/link";

/**
 * Shown if a page cannot be put together (for example the database is briefly
 * unreachable and there is no earlier copy to show). The header, the footer and
 * the live radio player stay in place and keep playing.
 */
export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-xl space-y-4 text-center">
      <h1 className="text-3xl">Something went wrong</h1>
      <p className="text-ink-soft">
        This page could not be loaded just now. The radio is not affected. Please try again in a moment.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => reset()}
          className="rounded-lg bg-ember px-5 py-2.5 font-semibold text-white transition active:scale-95 hover:bg-ember-dark"
        >
          Try again
        </button>
        <Link href="/" className="rounded-lg border border-sand px-5 py-2.5 text-ink no-underline transition active:scale-95 hover:border-gold">
          Back to the radio
        </Link>
      </div>
    </div>
  );
}
