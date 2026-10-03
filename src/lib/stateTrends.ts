import {
  DECADAL_LABELS,
  INDIA_DECADAL,
  STATE_DECADAL,
  STATE_GROWTH,
  STATE_PROFILE,
  type StateGrowth,
  type StateProfile,
} from "./censusData";

/**
 * Derives everything the state trends view shows, with no React involved.
 *
 * This is deliberately a pure module rather than a `useMemo` inside the
 * component. Three of these values are not present in the tables and have to be
 * worked out — the decade series aligned against India's, the rank, and the
 * back-chained first-census population. When that logic lived in the component
 * it could only be checked by duplicating it in a test, and a duplicated test
 * happily passes while the component computes something else.
 */

export interface DecadePoint {
  /** e.g. "1901-11". */
  label: string;
  /** This state's percentage change for that decade, or null if not enumerated. */
  state: number | null;
  /** India's percentage change for the same decade. */
  india: number | null;
}

export interface StateTrendModel {
  name: string;
  /** First census this unit appears in — not every state existed in 1901. */
  fromYear: number;
  series: DecadePoint[];
  growth: StateGrowth;
  profile: StateProfile;
  /**
   * Population at the first census in the series, reconstructed by back-chaining
   * the decadal percentages. Null when the chain has a gap, because carrying on
   * across a missing decade would invent a figure.
   */
  populationAtStart: number | null;
  populationRank: number;
  growthRank: number;
  stateCount: number;
}

/**
 * Population at the first census, reconstructed by inverting the chain.
 *
 * `STATE_DECADAL` carries percentage changes only, never populations, so this is
 * the only way to state a starting figure. Returns null if any decade in the
 * chain is missing.
 */
export function backChainedPopulation(name: string): number | null {
  const series = STATE_DECADAL.find((s) => s.name === name);
  const growth = STATE_GROWTH.find((g) => g.name === name);
  if (!series || !growth) return null;

  let product = 1;
  for (const change of series.changes) {
    if (change === null) return null;
    product *= 1 + change / 100;
  }
  return product > 0 ? growth.population2011 / product : null;
}

/**
 * Builds the view model for a state, or null when the name is not a Census unit.
 *
 * `name` must already be in Census-table form — the geolocation provider
 * applies the Delhi and Telangana aliases before calling this.
 */
export function stateTrendModel(name: string | null | undefined): StateTrendModel | null {
  if (!name) return null;

  const decadal = STATE_DECADAL.find((d) => d.name === name);
  const growth = STATE_GROWTH.find((g) => g.name === name);
  const profile = STATE_PROFILE.find((p) => p.name === name);
  if (!decadal || !growth || !profile) return null;

  // DECADAL_LABELS[i] is the step INTO census i+1, so India's rate for the same
  // step is INDIA_DECADAL[i + 1]. Indexing with [i] would plot every state's
  // growth against the previous decade.
  const series: DecadePoint[] = DECADAL_LABELS.map((label, i) => ({
    label,
    state: decadal.changes[i] ?? null,
    india: INDIA_DECADAL[i + 1]?.percentChange ?? null,
  }));

  const by2011 = [...STATE_GROWTH].sort((a, b) => b.population2011 - a.population2011);
  const byGrowth = [...STATE_GROWTH].sort((a, b) => b.percentChange - a.percentChange);

  return {
    name,
    fromYear: decadal.fromYear,
    series,
    growth,
    profile,
    populationAtStart: backChainedPopulation(name),
    populationRank: by2011.findIndex((g) => g.name === name) + 1,
    growthRank: byGrowth.findIndex((g) => g.name === name) + 1,
    stateCount: by2011.length,
  };
}

/** Every state name, sorted, for the manual picker. */
export function allStateNames(): string[] {
  return STATE_GROWTH.map((g) => g.name).sort((a, b) => a.localeCompare(b));
}