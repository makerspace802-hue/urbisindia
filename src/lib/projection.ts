export interface ProjectionInput {
  canopy: number;
  toll: number;
  misting: boolean;
  population: number;
  city: string;
}

export interface YearPoint {
  year: number;
  label: string;
  tempDrop: number;
  modalShift: number;
  savings: number;
}

/**
 * Expands the simulator sliders into a 10-year outlook.
 *
 * Canopy planting and tolling compound slowly — they take years to reach full
 * effect — so each year eases toward the ceiling on a quadratic curve rather
 * than jumping straight to it.
 */
export function buildProjectionPoints({
  canopy,
  toll,
  misting,
  population,
}: ProjectionInput): YearPoint[] {
  const startYear = new Date().getFullYear();
  const perPersonTempDrop = canopy * 0.1 + (misting ? 0.5 : 0) + toll * 0.015;
  const perPersonModalShift = canopy * 1.3 + toll * 1.6;
  const perPersonSavings = canopy * 0.25 + toll * 0.15 + (misting ? 0.6 : 0);

  return Array.from({ length: 11 }, (_, year) => {
    const maturity = 1 - Math.pow(1 - year / 10, 2);

    return {
      year: startYear + year,
      label: String(startYear + year),
      tempDrop: Number((perPersonTempDrop * maturity).toFixed(2)),
      modalShift: Number((perPersonModalShift * maturity).toFixed(1)),
      savings: Number(
        ((perPersonSavings * maturity * population) / 1_000_000).toFixed(2),
      ),
    };
  });
}
