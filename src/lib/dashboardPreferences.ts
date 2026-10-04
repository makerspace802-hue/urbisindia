/**
 * What the dashboard can be personalised to show.
 *
 * Kept pure, like `censusInsights.ts`, so the catalogue can be checked against
 * `censusData.ts` by running it rather than by reading it. Every metric here
 * resolves to a figure that already exists in the generated Census tables —
 * there is no option in this list that renders a number invented at the call
 * site, which is the failure mode that produced the four invented district
 * names and the invented "urban share" badges earlier in this project.
 *
 * The dashboard previously showed four fixed India-wide cards. Those are still
 * the default, so an un-customised visitor sees exactly what they saw before;
 * this only adds the ability to aim the same cards at one state and pick which
 * readings matter.
 */

import {
  LAST_CENSUS_YEAR,
  STATE_GROWTH,
  STATE_PROFILE,
} from "./censusData";
import { censusName } from "./geo";

const INDIAN = new Intl.NumberFormat("en-IN");
const num = (value: number): string => INDIAN.format(value);
const CRORE = 10_000_000;

export type MetricId =
  | "population"
  | "growth"
  | "sexRatio"
  | "literacy"
  | "density"
  | "urbanShare"
  | "households"
  | "area"
  | "males"
  | "females"
  | "rural"
  | "urban"
  | "literateCount"
  | "illiterateCount"
  | "scheduledCaste"
  | "scheduledTribe";

export interface MetricReading {
  /** Headline figure, already formatted for display. */
  value: string;
  /** Short unit/qualifier line under the figure. */
  note: string;
}

export interface MetricDef {
  id: MetricId;
  /** Sentence-case label, used as the card title. */
  title: string;
  /** What the figure counts, e.g. "females per 1,000 males". */
  unit: string;
  group: "Size" | "Change" | "People" | "Place";
}

/**
 * Every metric on offer, grouped so the picker reads as a set rather than a
 * list. The order here is the order they appear when un-customised.
 */
export const METRIC_CATALOGUE: readonly MetricDef[] = [
  { id: "population", title: "Population", unit: `people, Census ${LAST_CENSUS_YEAR}`, group: "Size" },
  { id: "growth", title: "Decadal growth", unit: `percent, ${LAST_CENSUS_YEAR - 10}–${LAST_CENSUS_YEAR}`, group: "Change" },
  { id: "households", title: "Households", unit: `count, Census ${LAST_CENSUS_YEAR}`, group: "Size" },
  { id: "area", title: "Area", unit: "square kilometres", group: "Place" },
  { id: "density", title: "Density", unit: "people per km²", group: "Place" },
  { id: "urbanShare", title: "Urban share", unit: "percent of population", group: "Place" },
  { id: "rural", title: "Rural population", unit: `people, Census ${LAST_CENSUS_YEAR}`, group: "Place" },
  { id: "urban", title: "Urban population", unit: `people, Census ${LAST_CENSUS_YEAR}`, group: "Place" },
  { id: "males", title: "Men", unit: `people, Census ${LAST_CENSUS_YEAR}`, group: "People" },
  { id: "females", title: "Women", unit: `people, Census ${LAST_CENSUS_YEAR}`, group: "People" },
  { id: "literacy", title: "Literacy rate", unit: "percent of population", group: "People" },
  { id: "literateCount", title: "Literate people", unit: `count, Census ${LAST_CENSUS_YEAR}`, group: "People" },
  { id: "illiterateCount", title: "Illiterate people", unit: `count, Census ${LAST_CENSUS_YEAR}`, group: "People" },
  { id: "scheduledCaste", title: "Scheduled Caste", unit: `people, Census ${LAST_CENSUS_YEAR}`, group: "People" },
  { id: "scheduledTribe", title: "Scheduled Tribe", unit: `people, Census ${LAST_CENSUS_YEAR}`, group: "People" },
  { id: "sexRatio", title: "Sex ratio", unit: "females per 1,000 males", group: "People" },
] as const;

/** Metrics shown before anyone customises anything. */
export const DEFAULT_METRICS: readonly MetricId[] = [
  "population",
  "growth",
  "literacy",
  "sexRatio",
];

const METRIC_BY_ID = new Map(METRIC_CATALOGUE.map((m) => [m.id, m]));

export function metricDef(id: MetricId): MetricDef | null {
  return METRIC_BY_ID.get(id) ?? null;
}

/** Is this a metric the catalogue actually offers? */
export function isMetricId(value: unknown): value is MetricId {
  return typeof value === "string" && METRIC_BY_ID.has(value as MetricId);
}

/**
 * Read one metric for one state.
 *
 * Returns null when the state has no row for that metric, so the caller can drop
 * the card instead of rendering a zero or a dash that reads like a real figure.
 * `sexRatio` is the one the visitor asked for by name — "the ratio of men to
 * women" — and it is stored the Census way round (females per 1,000 males),
 * which is the opposite convention from the phrase, so the label says which is
 * which on the card itself.
 */
export function readMetric(state: string, id: MetricId): MetricReading | null {
  // Two of the 36 names a citizen can pick are not the spelling the Census
  // table uses: "Delhi" is filed under "NCT OF Delhi" and "Telangana" under
  // "Andhra Pradesh". Resolving through `censusName` is what stops those two
  // from rendering a row of empty cards — a real bug this missed on first pass.
  const name = censusName(state) ?? state;

  const growth = STATE_GROWTH.find((g) => g.name === name);
  const profile = STATE_PROFILE.find((p) => p.name === name);
  if (!growth && !profile) return null;

  /**
   * Several `StateProfile` fields are nullable in the generated tables — a
   * Census cell that was blank for a small union territory is stored as null,
   * not zero. Returning null here means the card is dropped rather than showing
   * a 0 that would read as a real measurement.
   */
  const present = (value: number | null | undefined): value is number =>
    typeof value === "number" && Number.isFinite(value);

  switch (id) {
    case "population": {
      const value = growth?.population2011 ?? profile?.population;
      if (!present(value)) return null;
      return {
        value: num(value),
        note: `${(value / CRORE).toFixed(2)} crore people`,
      };
    }
    case "growth": {
      const value = growth?.percentChange;
      if (!present(value)) return null;
      return {
        value: `${value < 0 ? "" : "+"}${value.toFixed(2)}%`,
        note: `${num(growth!.population2001)} → ${num(growth!.population2011)}`,
      };
    }
    case "households": {
      const value = profile?.households;
      if (!present(value)) return null;
      return { value: num(value), note: "households" };
    }
    case "area": {
      const value = profile?.areaSqKm;
      if (!present(value)) return null;
      return { value: num(value), note: "square kilometres" };
    }
    case "density": {
      const value = profile?.density;
      if (!present(value)) return null;
      return { value: num(value), note: "people per km²" };
    }
    case "urbanShare": {
      const value = profile?.urbanSharePercent;
      if (!present(value)) return null;
      return { value: `${value}%`, note: "of the population" };
    }
    case "literacy": {
      const value = profile?.literacyPercent;
      if (!present(value)) return null;
      return { value: `${value}%`, note: "literate population" };
    }
    case "males": {
      const value = profile?.males;
      if (!present(value)) return null;
      return {
        value: num(value),
        note: `${((value / profile!.population) * 100).toFixed(2)}% of the population`,
      };
    }
    case "females": {
      const value = profile?.females;
      if (!present(value)) return null;
      return {
        value: num(value),
        note: `${((value / profile!.population) * 100).toFixed(2)}% of the population`,
      };
    }
    case "rural": {
      const value = profile?.ruralPopulation;
      if (!present(value)) return null;
      return { value: num(value), note: "people living in villages" };
    }
    case "urban": {
      const value = profile?.urbanPopulation;
      if (!present(value)) return null;
      return { value: num(value), note: "people living in towns and cities" };
    }
    case "literateCount": {
      const value = profile?.literate;
      if (!present(value)) return null;
      return { value: num(value), note: "people counted as literate" };
    }
    case "illiterateCount": {
      const value = profile?.illiterate;
      if (!present(value)) return null;
      return { value: num(value), note: "people counted as illiterate" };
    }
    case "scheduledCaste": {
      const value = profile?.scheduledCaste;
      if (!present(value)) return null;
      return { value: num(value), note: "people in Scheduled Castes" };
    }
    case "scheduledTribe": {
      const value = profile?.scheduledTribe;
      if (!present(value)) return null;
      return { value: num(value), note: "people in Scheduled Tribes" };
    }
    case "sexRatio": {
      const value = growth?.sexRatio2011;
      if (!present(value)) return null;
      return {
        value: num(value),
        // The Census stores only the ratio, not the two counts, so this states
        // the convention plainly rather than implying counts the tables do not
        // hold. Visitors asking for "men to women" usually mean this figure.
        note: `females per 1,000 males (was ${growth!.sexRatio2001} in ${LAST_CENSUS_YEAR - 10})`,
      };
    }
    default:
      // An id that is not in the catalogue. Returning `null` rather than
      // falling off the end of the switch keeps "no data, drop the card" the
      // single path, so an unrecognised id can never render a blank figure.
      return null;
  }
}

/**
 * A saved customisation, as stored.
 *
 * Deliberately narrow: which state, which metrics, and whether the India-wide
 * cards are shown alongside. Anything else about "what the dashboard looks
 * like" is derived from these three, so there is one place to change the rules.
 */
export interface DashboardPrefs {
  /** Census state name, or null to follow the located state. */
  state: string | null;
  metrics: MetricId[];
  /** Keep the four India-wide cards above the personalised ones. */
  showNational: boolean;
}

export const DEFAULT_PREFS: DashboardPrefs = {
  state: null,
  metrics: [...DEFAULT_METRICS],
  showNational: true,
};

/**
 * Coerce anything stored or typed into a valid DashboardPrefs.
 *
 * Preferences survive across sign-in providers and schema changes, so an old or
 * hand-edited record can name a metric that no longer exists. Dropping the
 * unknown ids here is what stops a stale record from rendering a broken card.
 */
export function normalisePrefs(input: unknown): DashboardPrefs {
  if (typeof input !== "object" || input === null) return { ...DEFAULT_PREFS };
  const raw = input as Partial<DashboardPrefs>;

  const metrics = Array.isArray(raw.metrics)
    ? raw.metrics.filter(isMetricId)
    : [...DEFAULT_METRICS];

  // Never let a customisation leave the dashboard with nothing on it.
  const unique = [...new Set(metrics)].slice(0, METRIC_CATALOGUE.length);

  return {
    state: typeof raw.state === "string" && raw.state.length > 0 ? raw.state : null,
    metrics: unique.length > 0 ? unique : [...DEFAULT_METRICS],
    showNational: raw.showNational !== false,
  };
}