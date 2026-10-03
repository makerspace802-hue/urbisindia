import { Skeleton } from "@/components/ui/skeleton";

/**
 * Route-level loading state.
 *
 * This replaces a single line of text, which made a slow chunk download look
 * like an empty page. The shapes below mirror the command centre's own layout —
 * a KPI row, a wide chart panel, a stacked pair — so the skeleton reads as that
 * page filling in rather than as unrelated decoration.
 *
 * `animate-pulse` is opacity-only, so it composites without layout work.
 */
export function RouteSkeleton() {
  return (
    <div
      className="mx-auto max-w-7xl px-4 py-8 md:px-6"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <span className="sr-only">Loading view…</span>

      {/* Heading block */}
      <div className="mb-6 space-y-3">
        <Skeleton className="h-8 w-72 bg-[var(--nb-surface-2)]" />
        <Skeleton className="h-3 w-96 max-w-full bg-[var(--nb-surface-2)]" />
      </div>

      {/* KPI row */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="nb-panel space-y-3 p-4">
            <Skeleton className="h-2.5 w-20 bg-[var(--nb-surface-2)]" />
            <Skeleton className="h-7 w-28 bg-[var(--nb-surface-2)]" />
            <Skeleton className="h-2 w-full bg-[var(--nb-surface-2)]" />
          </div>
        ))}
      </div>

      {/* Main chart panel */}
      <div className="nb-panel mb-6 space-y-4 p-4">
        <div className="flex items-center justify-between gap-3">
          <Skeleton className="h-3.5 w-40 bg-[var(--nb-surface-2)]" />
          <Skeleton className="h-6 w-32 bg-[var(--nb-surface-2)]" />
        </div>
        <Skeleton className="h-56 w-full bg-[var(--nb-surface-2)]" />
      </div>

      {/* Stacked pair */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="nb-panel space-y-3 p-4">
          <Skeleton className="h-3.5 w-32 bg-[var(--nb-surface-2)]" />
          <Skeleton className="h-24 w-full bg-[var(--nb-surface-2)]" />
        </div>
        <div className="nb-panel space-y-3 p-4">
          <Skeleton className="h-3.5 w-32 bg-[var(--nb-surface-2)]" />
          <Skeleton className="h-24 w-full bg-[var(--nb-surface-2)]" />
        </div>
      </div>
    </div>
  );
}