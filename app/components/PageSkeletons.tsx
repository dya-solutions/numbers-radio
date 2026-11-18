import { Bone, CardBones, LoadingFrame, TitleBones } from "./Skeleton";

/**
 * Loading screens for each public page, in the site's own dark theme. They are
 * shown by SkeletonOverlay only when moving to a page takes noticeably long, so
 * the page frame (menu, player, footer) is already there and the content area
 * shows where things will appear.
 *
 * (They are deliberately not Next.js "loading.tsx" files: on pages that are served
 * from cache those make the browser draw the skeleton first and swap the real
 * content in afterwards, which measured slower than not having them.)
 */

function Home() {
  return (
    <LoadingFrame className="space-y-10">
      <div className="space-y-3 text-center">
        <Bone className="mx-auto h-10 w-72 max-w-full sm:w-96" />
        <Bone className="mx-auto h-5 w-40" />
      </div>
      <Bone className="h-40 w-full rounded-xl" />
      <div className="grid gap-4 sm:grid-cols-3">
        <CardBones />
        <CardBones />
        <CardBones />
      </div>
    </LoadingFrame>
  );
}

function ProgramGuide() {
  return (
    <LoadingFrame className="space-y-8">
      <header className="space-y-3">
        <TitleBones />
        <Bone className="h-9 w-72 max-w-full" />
      </header>

      {/* Wide screens: seven columns */}
      <div className="hidden grid-cols-7 gap-2 lg:grid">
        {Array.from({ length: 7 }, (_, i) => (
          <div key={i} className="space-y-2">
            <Bone className="h-10 w-full rounded-lg" />
            <div className="space-y-4 rounded-lg border border-sand bg-surface p-3">
              {Array.from({ length: 4 }, (_, j) => (
                <div key={j} className="space-y-1.5">
                  <Bone className="h-3 w-10" />
                  <Bone className="h-4 w-4/5" />
                  <Bone className="h-3 w-full" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Phones: day buttons and one day */}
      <div className="lg:hidden">
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: 7 }, (_, i) => (
            <Bone key={i} className="h-11 rounded-lg" />
          ))}
        </div>
        <div className="mt-4 space-y-5 rounded-xl border border-sand bg-surface p-4">
          <Bone className="h-6 w-32" />
          {Array.from({ length: 3 }, (_, j) => (
            <div key={j} className="space-y-2">
              <Bone className="h-3 w-12" />
              <Bone className="h-5 w-2/3" />
              <Bone className="h-3.5 w-full" />
            </div>
          ))}
        </div>
      </div>
    </LoadingFrame>
  );
}

function Devotion() {
  return (
    <LoadingFrame className="mx-auto max-w-2xl space-y-6">
      <div className="space-y-3">
        <Bone className="h-4 w-40" />
        <Bone className="h-3.5 w-64 max-w-full" />
        <Bone className="h-9 w-4/5" />
      </div>
      <Bone className="h-12 w-56 rounded-xl" />
      <div className="space-y-3 rounded-xl border border-sand bg-surface p-5">
        <Bone className="h-4 w-28" />
        <Bone className="h-3.5 w-full" />
        <Bone className="h-3.5 w-full" />
        <Bone className="h-3.5 w-2/3" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: 8 }, (_, i) => (
          <Bone key={i} className={`h-3.5 ${i % 4 === 3 ? "w-2/3" : "w-full"}`} />
        ))}
      </div>
    </LoadingFrame>
  );
}

function List() {
  return (
    <LoadingFrame className="space-y-8">
      <TitleBones />
      <div className="space-y-4">
        {Array.from({ length: 5 }, (_, i) => (
          <CardBones key={i} lines={1} />
        ))}
      </div>
    </LoadingFrame>
  );
}

function Feedback() {
  return (
    <LoadingFrame className="space-y-8">
      <TitleBones />
      {Array.from({ length: 2 }, (_, i) => (
        <div key={i} className="space-y-4 rounded-xl border border-sand bg-surface p-6">
          <Bone className="h-6 w-1/3" />
          <Bone className="h-10 w-full" />
          <Bone className="h-10 w-full" />
          <Bone className="h-24 w-full" />
          <Bone className="h-10 w-32" />
        </div>
      ))}
    </LoadingFrame>
  );
}

function Plain() {
  return (
    <LoadingFrame className="space-y-6">
      <TitleBones />
      <CardBones lines={3} />
      <CardBones lines={3} />
    </LoadingFrame>
  );
}

/** The loading screen for a page address, or null for pages that have none (the admin area). */
export default function PageSkeleton({ path }: { path: string }) {
  if (path === "/") return <Home />;
  if (path.startsWith("/program-guide")) return <ProgramGuide />;
  if (path.startsWith("/daily-devotion")) return <Devotion />;
  if (path.startsWith("/prayer-points") || path.startsWith("/sermons")) return <List />;
  if (path.startsWith("/feedback")) return <Feedback />;
  if (path.startsWith("/admin") || path.startsWith("/api")) return null;
  return <Plain />;
}
