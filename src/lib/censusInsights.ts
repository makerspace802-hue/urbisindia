import { INDIA_DECADAL, STATE_GROWTH, STATE_PROFILE } from "./censusData";

/**
 * Cross-state comparisons, derived without React.
 *
 * Same reasoning as `stateTrends.ts`: the joins here are the kind of thing that
 * fails quietly. A state present in one table but not the other simply
 * disappears from every panel, and a rate written as a literal in a component
 * drifts away from the table the moment the data is regenerated.
 */

export interface InsightRow {
  name: string;
  /** True for the visitor's own state, so the panels can mark it. */
  yours: boolean;
  percentChange: number;
  absoluteChange: number;
  population: number;
  /** Females per 1,000 males, and the change across the decade. */
  sexRatio2001: number;
  sexRatio2011: number;
  sexShift: number;
  density: number | null;
  urbanShare: number;
  literacy: number;
  households: number;
}

/** India's observed 2001-2011 decadal rate, read from the table every time. */
export function indiaDecadalRatePercent(): number {
  return INDIA_DECADAL[INDIA_DECADAL.length - 1].percentChange ?? 0;
}

/**
 * Joins every state that appears in both tables.
 *
 * A state missing from either table is dropped, and `insightCoverage` reports
 * the shortfall so it can be asserted on rather than disappearing from four
 * charts without trace.
 */
export function insightRows(yours: string | null): InsightRow[] {
  return STATE_PROFILE.flatMap((profile) => {
    const growth = STATE_GROWTH.find((g) => g.name === profile.name);
    if (!growth) return [];
    return [
      {
        name: profile.name,
        yours: profile.name === yours,
        percentChange: growth.percentChange,
        absoluteChange: growth.absoluteChange,
        population: growth.population2011,
        sexRatio2001: growth.sexRatio2001,
        sexRatio2011: growth.sexRatio2011,
        sexShift: Number((growth.sexRatio2011 - growth.sexRatio2001).toFixed(1)),
        density: profile.density,
        urbanShare: profile.urbanSharePercent,
        literacy: profile.literacyPercent,
        households: profile.households,
      },
    ];
  });
}

/** Every state that has an insight row. */
export function insightCoverage(): { rows: number; missing: string[] } {
  const present = new Set(STATE_PROFILE.map((p) => p.name));
  return {
    rows: STATE_GROWTH.filter((g) => present.has(g.name)).length,
    missing: STATE_GROWTH.map((g) => g.name).filter((name) => !present.has(name)),
  };
}

/** Ranked by percentage growth, fastest first. */
export function growthLeague(yours: string | null): InsightRow[] {
  return [...insightRows(yours)].sort((a, b) => b.percentChange - a.percentChange);
}

/** Ranked by change in sex ratio, biggest improvement first. */
export function sexRatioShift(yours: string | null): InsightRow[] {
  return [...insightRows(yours)].sort((a, b) => b.sexShift - a.sexShift);
}

export interface Point {
  name: string;
  x: number;
  y: number;
  yours: boolean;
}

/** Density against urban share. States with no recorded area are dropped. */
export function densityScatter(yours: string | null): Point[] {
  return insightRows(yours)
    .filter((r): r is InsightRow & { density: number } => r.density !== null)
    .map((r) => ({ name: r.name, x: r.density, y: r.urbanShare, yours: r.yours }));
}

/** Literacy against urban share. */
export function literacyScatter(yours: string | null): Point[] {
  return insightRows(yours).map((r) => ({
    name: r.name,
    x: r.literacy,
    y: r.urbanShare,
    yours: r.yours,
  }));
}