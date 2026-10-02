/**
 * Census of India — 2001 vs 2011.
 *
 * PROVENANCE: figures below are the published headline numbers from the
 * Office of the Registrar General & Census Commissioner, India (Census of
 * India 2001 and Census of India 2011, provisional/final reports).
 *
 * Anything that is NOT a published Census headline is flagged
 * `estimated: true` and labelled as a derived estimate in the UI. Do not
 * present an estimated value as an official figure.
 */

export interface CensusIndicator {
  key: string;
  label: string;
  /** Census 2001 value. */
  y2001: number;
  /** Census 2011 value. */
  y2011: number;
  unit: string;
  /** True when this row is derived rather than a published Census headline. */
  estimated?: boolean;
  /** Short note explaining the source or the derivation. */
  note: string;
}

export const CENSUS_INDICATORS: CensusIndicator[] = [
  {
    key: "population",
    label: "Total Population",
    y2001: 1_026_541_000,
    y2011: 1_210_854_977,
    unit: "people",
    note: "Published Census headline. Decadal growth of 17.7%.",
  },
  {
    key: "literacy",
    label: "Overall Literacy Rate",
    y2001: 64.84,
    y2011: 74.04,
    unit: "%",
    note: "Published Census headline, ages 7 and above.",
  },
  {
    key: "urban",
    label: "Urban Share of Population",
    y2001: 27.81,
    y2011: 31.16,
    unit: "%",
    note: "Published Census headline, based on the statutory definition of a town.",
  },
  {
    key: "sexratio",
    label: "Sex Ratio (all ages)",
    y2001: 933,
    y2011: 943,
    unit: "per 1,000 males",
    note: "Published Census headline.",
  },
  {
    key: "childsexratio",
    label: "Child Sex Ratio (0–6)",
    y2001: 908,
    y2011: 919,
    unit: "per 1,000 males",
    note: "Published Census headline, the single worst decadal fall in the table.",
  },
  {
    key: "female_literacy",
    label: "Female Literacy Rate",
    y2001: 53.7,
    y2011: 65.46,
    unit: "%",
    note: "Published Census headline. The largest single gain in this table.",
  },
  {
    key: "density",
    label: "Population Density",
    y2001: 324,
    y2011: 382,
    unit: "per km²",
    note: "Published Census headline, national average.",
  },
  {
    key: "households",
    label: "Households",
    y2001: 188_923_000,
    y2011: 253_651_000,
    unit: "households",
    note: "Published Census headline. Household size fell from 5.4 to 4.8.",
  },
  {
    key: "sc",
    label: "Scheduled Caste Share",
    y2001: 16.6,
    y2011: 16.6,
    unit: "%",
    note: "Published Census headline, essentially flat across the decade.",
  },
  {
    key: "st",
    label: "Scheduled Tribe Share",
    y2001: 1.1,
    y2011: 0.8,
    unit: "%",
    note: "Published Census headline, down 0.3 points.",
  },
];

/**
 * NSS-derived poverty share. This is NOT a Census indicator — the Census does
 * not collect income — so it is explicitly flagged as an estimate and drawn
 * from the NSS 55th round (2004–05) and NSS 68th round (2011–12).
 */
export const BPL_SHARE: CensusIndicator = {
  key: "bpl",
  label: "Rural Below-Poverty-Line Share",
  y2001: 51.7,
  y2011: 29.9,
  unit: "%",
  estimated: true,
  note: "ESTIMATE — not a Census figure. From NSS rounds 55 (2004–05) and 68 (2011–12); the Census collected no income data.",
};

export const CENSUS_ESTIMATED: CensusIndicator[] = [
  BPL_SHARE,
];

/** Absolute change and percent change across the decade for a row. */
export function censusDelta(row: CensusIndicator) {
  const absolute = row.y2011 - row.y2001;
  return {
    absolute,
    percent: row.y2001 === 0 ? 0 : (absolute / row.y2001) * 100,
  };
}

export function formatCensusValue(value: number, unit: string) {
  if (unit === "people" || unit === "households") {
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
    if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  }
  return value.toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

/**
 * Rows rebased to a 0-100 index so wildly different units (people, %, ratio)
 * can share one radar shape.
 *
 * Each indicator is rescaled against ITS OWN observed 2001->2011 span, mapped
 * onto 50 -> 100. So the 2001 ring always sits at the 50 spoke and the 2011
 * ring shows how far that indicator moved, which is what the radar is for.
 * A no-change row falls back to its own magnitude as the denominator.
 * This is an index for shape comparison only - never quote it as a value.
 */
export function normalisedIndicators() {
  return CENSUS_INDICATORS.map((row) => {
    const base = row.y2001;
    const span = row.y2011 - row.y2001;
    const denom = span === 0 ? Math.abs(base) || 1 : span;
    const index = (value: number) => {
      const t = (value - base) / denom;
      return Math.max(0, Math.min(100, 50 + t * 50));
    };
    return {
      ...row,
      y2001: index(base),
      y2011: index(row.y2011),
      moved: span !== 0,
      changePct: base === 0 ? 0 : (span / Math.abs(base)) * 100,
      raw2001: row.y2001,
      raw2011: row.y2011,
    };
  });
}
