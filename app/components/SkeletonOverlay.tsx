"use client";

import { useEffect, useState, type ComponentType } from "react";
import { useSlowPath } from "./NavigationProgress";

// The loading screens are downloaded only when they are needed (or quietly in the
// background by SiteHeader once the page has settled), so they add nothing to a
// page's first load.
let Skeletons: ComponentType<{ path: string }> | null = null;
let loading: Promise<void> | null = null;

export function preloadSkeletons(): Promise<void> {
  loading ??= import("./PageSkeletons")
    .then((module) => {
      Skeletons = module.default;
    })
    .catch(() => {
      loading = null; // try again next time
    });
  return loading;
}

/**
 * Covers the page content with a loading screen when moving to another page is
 * taking a moment. The menu, player and footer stay where they are. It never
 * shows a blank cover: until the loading screen itself has arrived, the current
 * page simply stays visible (with the progress bar). Renders nothing the rest of
 * the time.
 */
export default function SkeletonOverlay() {
  const path = useSlowPath();
  const [, update] = useState(0);

  useEffect(() => {
    if (path && !Skeletons) void preloadSkeletons().then(() => update((n) => n + 1));
  }, [path]);

  if (!path || path.startsWith("/admin") || !Skeletons) return null;
  const Skeleton = Skeletons;
  return (
    <div className="absolute inset-0 z-20 bg-cream px-4 py-10">
      <Skeleton path={path.split("?")[0]} />
    </div>
  );
}
