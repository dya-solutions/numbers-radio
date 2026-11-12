"use client";

import { useActionState } from "react";
import { runCleanup, type CleanupResult } from "./actions";

export default function CleanupButton() {
  const [state, action, pending] = useActionState<CleanupResult | null, FormData>(
    (prev) => runCleanup(prev),
    null,
  );

  return (
    <form action={action} className="flex flex-wrap items-center gap-3">
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg border border-gold px-3 py-1.5 text-sm font-semibold text-gold transition-colors hover:bg-gold hover:text-black disabled:opacity-60"
      >
        {pending ? "Cleaning up..." : "Clean up now"}
      </button>
      <p aria-live="polite" className={`m-0 text-sm ${state && !state.ok ? "text-red-300" : "text-ink-soft"}`}>
        {state?.message}
      </p>
    </form>
  );
}
