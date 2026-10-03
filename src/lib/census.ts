/**
 * Census of India — literacy, 2001 vs 2011.
 *
 * REDUCED FILE. This module previously held ten headline indicators plus a
 * poverty estimate and four chart helpers. Nothing imported it: the charts moved
 * to the generated `censusData.ts`, which is built from the uploaded Census
 * tables, and this file was left behind. Every series it carried other than
 * literacy is now either reproduced exactly by those tables or was a hand-typed
 * number with no source behind it, so all of it has gone.
 *
 * Literacy is the one exception and is deliberately kept. The uploaded tables
 * (data-1 through data-4) do not carry a literacy column at all, so these four
 * numbers cannot be regenerated from them and would be lost with this file. They
 * are retained as a record of the published figures, not wired into any view.
 *
 * PROVENANCE: Office of the Registrar General & Census Commissioner, India —
 * Census of India 2001 and Census of India 2011. Published headline figures for
 * the population aged 7 and above.
 */

export interface LiteracyFigures {
  /** Overall literacy rate, per cent. */
  overall: { y2001: number; y2011: number };
  /** Female literacy rate, per cent. */
  female: { y2001: number; y2011: number };
}

export const LITERACY: LiteracyFigures = {
  overall: { y2001: 64.84, y2011: 74.04 },
  female: { y2001: 53.7, y2011: 65.46 },
};

/** Absolute and percentage-point movement across the decade. */
export function literacyDelta(side: keyof LiteracyFigures) {
  const { y2001, y2011 } = LITERACY[side];
  return {
    absolute: y2011 - y2001,
    percent: y2001 === 0 ? 0 : ((y2011 - y2001) / y2001) * 100,
  };
}