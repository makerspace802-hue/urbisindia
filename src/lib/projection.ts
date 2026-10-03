import { INDIA_DECADAL, STATE_GROWTH } from "./censusData";

/**
 * Forward projection for the quiz result.
 *
 * The previous version of this took canopy, congestion-toll and misting slider
 * positions and produced a temperature drop, a modal-shift percentage and an
 * annual saving from three linear formulas. None of those quantities are
 * measured by any census, the coefficients were arbitrary, and the results were
 * presented under a "Live Model" badge and written to the database.
 *
 * What replaces it is the one thing the Census tables genuinely support: a
 * straight extrapolation of the state's OWN observed decadal growth rate, taken
 * from Census 2011 Table A-2, carried forward two decades. The observed rate is
 * shown alongside so the assumption is visible rather than buried.
 *
 * This is an extrapolation and is labelled as one everywhere it appears. The
 * Census stopped in 2011; nothing here is a Census figure beyond that year.
 */

export interface ProjectionPoint {
  year: number;
  label: string;
  population: number;
  /** Cumulative growth from the 2011 base, as a multiple. */
  multiple: number;
  /** India's projected population in the same year, for comparison. */
  india: number;
}

export interface ProjectionInput {
  /** Census state name, or null when the visitor is outside India. */
  state: string | null;
}

/** India's observed 2001 to 2011 decadal rate, used as the comparison line. */
export const INDIA_DECADE_RATE =
  (INDIA_DECADAL[INDIA_DECADAL.length - 1].percentChange ?? 0) / 100;

const BASE_YEAR = INDIA_DECADAL[INDIA_DECADAL.length - 1].year;
const BASE_POPULATION = INDIA_DECADAL[INDIA_DECADAL.length - 1].population;

/** Last observed decadal growth for a state, as a decimal. Falls back to India. */
export function observedDecadalRate(state: string | null): number {
  const row = state ? STATE_GROWTH.find((g) => g.name === state) : null;
  const percent = row?.percentChange ?? INDIA_DECADE_RATE * 100;
  return percent / 100;
}

/** The 2011 population the projection starts from. */
export function basePopulation(state: string | null): number {
  const row = state ? STATE_GROWTH.find((g) => g.name === state) : null;
  return row?.population2011 ?? BASE_POPULATION;
}

/**
 * Projects `decades` forward from 2011 at a constant observed rate.
 *
 * Constant rate is the only assumption made, and it is a weak one — Indian
 * decadal growth slowed steadily across the twentieth century, so a flat rate
 * almost certainly overstates later decades. The alternative of fitting a decay
 * curve would imply a precision these tables do not support.
 */
export function buildProjectionPoints({
  state,
}: ProjectionInput): ProjectionPoint[] {
  const rate = observedDecadalRate(state);
  const start = basePopulation(state);

  return Array.from({ length: 4 }, (_, decade) => {
    const multiple = Math.pow(1 + rate, decade);
    return {
      year: BASE_YEAR + decade * 10,
      label: String(BASE_YEAR + decade * 10),
      population: Math.round(start * multiple),
      multiple,
      india: Math.round(BASE_POPULATION * Math.pow(1 + INDIA_DECADE_RATE, decade)),
    };
  });
}