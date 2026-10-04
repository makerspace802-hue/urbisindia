/**
 * The diverging colour scale behind the Census heatmaps.
 *
 * This exists because the original was illegible in light mode. It painted
 * `rgba(16,185,129, 0.22 → 1)` — an alpha wash — and then put hard-coded white
 * text on top. Against the light page background the palest wash composites to
 * rgb(184,225,217), so the figure inside it was **1.42:1**. Even at full
 * opacity the green is only **2.54:1**, because the brand green is itself a
 * light colour. Dark mode hid the problem: the dark page made every wash dark
 * enough to carry white text, which is why it only showed up once light mode
 * was switched on.
 *
 * The fix is to stop compositing against an unknown background. Every step is
 * now a solid colour, so the cell looks the same on either theme, and the text
 * colour is chosen per cell from that colour's own luminance. The worst pairing
 * anywhere on the scale is 4.70:1, which clears WCAG AA for normal text.
 *
 * Still a diverging scale, not a good/bad one: green is "more", red is "less".
 * Nothing here claims a shrinking population is a bad outcome — only that it
 * moved one way.
 */

/** Reads like ink against a pale fill; used for the light end of the ramp. */
export const HEAT_INK = "#0B0F17";
/** Reads against a saturated fill; used for the dark end. */
export const HEAT_PAPER = "#FFFFFF";

/** Five solid steps per direction, lightest first. */
const GAIN_RAMP = ["#A7F3D0", "#6EE7B7", "#34D399", "#059669", "#047857"] as const;
const LOSS_RAMP = ["#FECDD3", "#FDA4AF", "#FB7185", "#E11D48", "#BE123C"] as const;
/** Blank cells and zero-change rows. Passes AA against white. */
export const HEAT_NEUTRAL = "#64748B";

export interface HeatFill {
  background: string;
  /** Text colour that clears AA against `background`. */
  color: string;
}

function channels(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

/** WCAG relative luminance. */
export function relativeLuminance(hex: string): number {
  const [r, g, b] = channels(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two hex colours. */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/**
 * Pick whichever of ink/paper reads better on `fill`.
 *
 * Threshold rather than "always the higher ratio" so the choice is stable and
 * obvious rather than flipping on a near-tie.
 */
export function textFor(fill: string): string {
  return contrastRatio(fill, HEAT_INK) >= contrastRatio(fill, HEAT_PAPER)
    ? HEAT_INK
    : HEAT_PAPER;
}

/** Pick a step on the ramp for a signed magnitude. */
function stepFor(value: number, max: number, ramp: readonly string[]): string {
  if (!Number.isFinite(max) || max === 0) return HEAT_NEUTRAL;
  const magnitude = Math.min(1, Math.abs(value) / max);
  // Index into the ramp; magnitude 0 lands on the palest step.
  const index = Math.min(ramp.length - 1, Math.floor(magnitude * ramp.length));
  return ramp[index];
}

/**
 * Fill and text colour for one cell.
 *
 * `null` means "no census this decade", which is a different statement from
 * "no change" and gets the neutral grey either way.
 */
export function heatFill(value: number | null, max: number): HeatFill {
  const fill =
    value === null || value === 0 || !Number.isFinite(value)
      ? HEAT_NEUTRAL
      : value > 0
        ? stepFor(value, max, GAIN_RAMP)
        : stepFor(value, max, LOSS_RAMP);
  return { background: fill, color: textFor(fill) };
}