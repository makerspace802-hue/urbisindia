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
  /** Compact label for axis ticks, where the full label will not fit. */
  short: string;
  /** Census 2001 value. */
  y2001: number;
  /** Census 2011 value. */
  y2011: number;
  unit: string;
  /**
   * The natural range of this measure, used to place it on a shared 0-100
   * radar. Chosen to be a meaningful bound for the quantity (a literacy rate
   * runs 0-100; a sex ratio runs roughly 700-1100 per 1,000) rather than the
   * observed 2001-2011 span.
   *
   * This matters: scaling each axis to its own two data points forces 2001 to
   * sit at exactly 50 on every spoke, which draws a flat polygon and hides all
   * ten indicators behind a single constant.
   */
  domain: readonly [number, number];
  /** True when this row is derived rather than a published Census headline. */
  estimated?: boolean;
  /** Short note explaining the source or the derivation. */
  note: string;
}

export const CENSUS_INDICATORS: CensusIndicator[] = [
  {
    key: "population",
    label: "Total Population",
    short: "Total Pop.",
    y2001: 1_026_541_000,
    y2011: 1_210_854_977,
    unit: "people",
    domain: [0, 1_400_000_000],
    note: "Published Census headline. Decadal growth of 17.7%.",
  },
  {
    key: "literacy",
    label: "Overall Literacy Rate",
    short: "Literacy",
    y2001: 64.84,
    y2011: 74.04,
    unit: "%",
    domain: [0, 100],
    note: "Published Census headline, ages 7 and above.",
  },
  {
    key: "urban",
    label: "Urban Share of Population",
    short: "Urban Share",
    y2001: 27.81,
    y2011: 31.16,
    unit: "%",
    domain: [0, 70],
    note: "Published Census headline, based on the statutory definition of a town.",
  },
  {
    key: "sexratio",
    label: "Sex Ratio (all ages)",
    short: "Sex Ratio",
    y2001: 933,
    y2011: 943,
    unit: "per 1,000 males",
    domain: [700, 1100],
    note: "Published Census headline.",
  },
  {
    key: "childsexratio",
    label: "Child Sex Ratio (0-6)",
    short: "Child Sex",
    y2001: 908,
    y2011: 919,
    unit: "per 1,000 males",
    domain: [800, 1000],
    note: "Published Census headline, the weakest decadal gain in this table.",
  },
  {
    key: "female_literacy",
    label: "Female Literacy Rate",
    short: "Female Lit.",
    y2001: 53.7,
    y2011: 65.46,
    unit: "%",
    domain: [0, 100],
    note: "Published Census headline. The largest single gain in this table.",
  },
  {
    key: "density",
    label: "Population Density",
    short: "Density",
    y2001: 324,
    y2011: 382,
    unit: "per km²",
    domain: [0, 500],
    note: "Published Census headline, national average.",
  },
  {
    key: "households",
    label: "Households",
    short: "Households",
    y2001: 188_923_000,
    y2011: 253_651_000,
    unit: "households",
    domain: [0, 300_000_000],
    note: "Published Census headline. Household size fell from 5.4 to 4.8.",
  },
  {
    key: "sc",
    label: "Scheduled Caste Share",
    short: "SC Share",
    y2001: 16.6,
    y2011: 16.6,
    unit: "%",
    domain: [0, 30],
    note: "Published Census headline, essentially flat across the decade.",
  },
  {
    key: "st",
    label: "Scheduled Tribe Share",
    short: "ST Share",
    y2001: 1.1,
    y2011: 0.8,
    unit: "%",
    domain: [0, 5],
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
  short: "Rural BPL",
  y2001: 51.7,
  y2011: 29.9,
  unit: "%",
  domain: [0, 60],
  estimated: true,
  note: "ESTIMATE — not a Census figure. From NSS rounds 55 (2004-05) and 68 (2011-12); the Census collected no income data.",
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

/** Which way an indicator moved across the decade. */
export type Direction = "up" | "flat" | "down";

/**
 * Direction of travel for a row.
 *
 * Deliberately does NOT label movement as good or bad. A higher population, a
 * higher Scheduled Caste share and a higher urban share are all facts about
 * composition rather than judgements, and colouring them "improved" would put
 * an opinion into what is meant to be a neutral presentation of Census data.
 */
export function directionOf(absolute: number, tolerance = 0): Direction {
  if (absolute > tolerance) return "up";
  if (absolute < -tolerance) return "down";
  return "flat";
}

/**
 * Rows for the change chart: one entry per indicator showing how far it moved
 * from its 2001 level, largest move first.
 *
 * Charting the CHANGE rather than a 2001-vs-2011 pair is what makes a single
 * bar chart honest across ten different units. An index chart sets 2001 to
 * exactly 100 on every row, so the baseline series is a row of identical
 * bars that says nothing; here every bar carries its own value.
 */
export function changeRows() {
  return CENSUS_INDICATORS.map((row) => {
    const delta = censusDelta(row);
    return {
      ...row,
      changePct: delta.percent,
      absolute: delta.absolute,
      // A share that did not move should read as flat rather than as a
      // rounding artefact, so percentages use a small tolerance.
      direction: directionOf(delta.absolute, row.unit === "%" ? 0.05 : 0),
    };
  }).sort((a, b) => b.changePct - a.changePct);
}

/**
 * Rows placed on a shared 0-100 radar, each scaled to the natural range of its
 * own measure (see `domain`).
 *
 * Both decades land at genuinely different radii, so the outline shows India's
 * real profile and how it shifted — rather than the flat polygon produced by
 * rebasing every axis to its own two data points.
 */
export function normalisedIndicators() {
  return CENSUS_INDICATORS.map((row) => {
    const [low, high] = row.domain;
    const span = high - low || 1;
    const place = (value: number) =>
      Math.max(0, Math.min(100, ((value - low) / span) * 100));
    return {
      ...row,
      y2001: place(row.y2001),
      y2011: place(row.y2011),
      changePct: censusDelta(row).percent,
      raw2001: row.y2001,
      raw2011: row.y2011,
    };
  });
}
