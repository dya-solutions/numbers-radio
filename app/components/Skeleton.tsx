import type { ReactNode } from "react";

/**
 * Building blocks for the loading screens (the loading.tsx files). Each is a
 * dim, softly pulsing shape in the site's own dark theme, so the page frame
 * appears straight away and the content "fills in" where the shapes were.
 */

/** One placeholder shape. */
export function Bone({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse rounded-md bg-white/10 motion-reduce:animate-none ${className}`}
    />
  );
}

/** Wraps a whole loading screen: announces "Loading" to screen readers. */
export function LoadingFrame({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div role="status" aria-busy="true" aria-live="polite" className={className}>
      <span className="sr-only">Loading...</span>
      {children}
    </div>
  );
}

/** A page title and a one-line intro. */
export function TitleBones() {
  return (
    <div className="space-y-3">
      <Bone className="h-9 w-56 max-w-full sm:w-72" />
      <Bone className="h-4 w-full max-w-md" />
    </div>
  );
}

/** A card with a title line and two text lines. */
export function CardBones({ lines = 2 }: { lines?: number }) {
  return (
    <div className="space-y-3 rounded-xl border border-sand bg-surface p-5">
      <Bone className="h-5 w-2/5" />
      {Array.from({ length: lines }, (_, i) => (
        <Bone key={i} className={`h-3.5 ${i === lines - 1 ? "w-3/5" : "w-full"}`} />
      ))}
    </div>
  );
}
