import { CensusInsights } from "@/components/CensusInsights";
import { StateTrends } from "@/components/StateTrends";

/**
 * Analytics — every figure here comes from the uploaded Census of India 2011
 * tables.
 *
 * This page previously carried four charts built from hand-entered numbers: a
 * district heat-island series, a commuter modal split by hour, a shade-infrastructure
 * breakdown, and a climate/mobility simulator whose outputs were produced by
 * linear formulas over slider positions. None of it came from a Census table,
 * and the simulator presented its results as a "Live Model". All of that is gone.
 *
 * What replaces it divides cleanly and does not overlap with the command centre:
 *
 *   StateTrends     one state, resolved from the visitor's location, against
 *                   India, across all eleven censuses and the last decade
 *   CensusInsights  all 35 states compared with EACH OTHER on four dimensions
 *                   nothing else plots
 *
 * The command centre keeps the other four table views (decadal grid, spatial,
 * social, commute), so between the two pages each table is drawn once.
 */

export default function Analytics() {
  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 md:px-6 md:py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl font-black uppercase tracking-tight text-[var(--nb-text)] md:text-3xl">
          Urban Analytics
        </h1>
        <span className="nb-chip bg-[var(--nb-surface-2)] text-[var(--nb-text-muted)]">
          Census of India 2011
        </span>
      </div>

      <StateTrends />

      <CensusInsights />

      <p className="pt-2 text-[10px] font-bold uppercase tracking-widest text-[var(--nb-text-dim)]">
        Every figure on this page is read from the uploaded Census of India 2011
        tables — nothing here is hand-entered, modelled or estimated
      </p>
    </div>
  );
}