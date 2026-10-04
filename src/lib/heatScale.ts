/**
 * The heatmap scale behind the Census tables.
 *
 * This is the second rebuild. The first used an alpha wash under hard-coded
 * white text, which put the figure at **1.42:1** in light mode — invisible, and
 * the complaint that started it. The second used solid fills with a per-cell
 * text colour picked from luminance. That was legible in both themes, but it
 * was rejected as ugly: a large saturated slab behind small bold digits reads
 * as poster paint, and it only ever looked deliberate in one theme.
 *
 * What ships now carries intensity in a *tint* — a low-alpha wash over the card
 * surface — while the figure itself is painted in the accent's own colour. The
 * numerals stay crisp against the panel instead of sitting on a block, and each
 * theme picks the tone that reads on its own background: deep green on white in
 * light mode, neon on navy in dark.
 *
 * Colours live in `index.css`, not here. That is deliberate — choosing them in
 * JS would mean guessing which theme is active, and the whole point is that
 * the two themes do not share a tone.
 *
 * Still a diverging scale, not a good/bad one: green is "more", red is "less".
 * Nothing here claims a shrinking population is a bad outcome — only that it
 * moved one way.
 */

export interface HeatFill {
  /** Class name carrying the tint and the figure colour. */
  className: string;
  /** 1 smallest magnitude to 4 largest; 0 when there is no figure. */
  step: number;
  direction: "gain" | "loss" | "none";
}

/** Number of tint steps either side of neutral. */
export const HEAT_STEPS = 4;

function stepIndex(value: number, max: number): number {
  if (!Number.isFinite(max) || max === 0) return 1;
  const magnitude = Math.min(1, Math.abs(value) / max);
  const index = Math.floor(magnitude * HEAT_STEPS) + 1;
  return Math.min(HEAT_STEPS, Math.max(1, index));
}

/**
 * Tint and figure colour for one cell.
 *
 * `null` means "no census this decade", which is a different statement from
 * "no change" and gets the neutral cell either way.
 */
export function heatFill(value: number | null, max: number): HeatFill {
  if (value === null || value === 0 || !Number.isFinite(value)) {
    return { className: "heat-none", step: 0, direction: "none" };
  }
  const direction = value > 0 ? "gain" : "loss";
  const step = stepIndex(value, max);
  return { className: `heat-${direction}-${step}`, step, direction };
}

/* ---------------------------------------------------------- contrast maths */

/**
 * WCAG relative luminance and contrast, kept because the cell colours are
 * verified with them. The app does not use these to pick a colour at runtime —
 * CSS does that per theme — but a change to the stylesheet that drops a cell
 * below AA should fail a check rather than reach a screen.
 */
export function relativeLuminance(hex: string): number {
  const h = hex.replace("#", "");
  const channel = (i: number) => {
    const v = parseInt(h.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return (
    0.2126 * channel(0) + 0.7152 * channel(2) + 0.0722 * channel(4)
  );
}

export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Composite an `rgba()` tint over a solid background, as the browser would. */
export function composite(
  rgba: string,
  background: string,
): string {
  const match = /rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)/.exec(rgba);
  const bg = background.replace("#", "");
  const to = (i: number) => parseInt(bg.slice(i, i + 2), 16);
  if (!match) return background;
  const alpha = match[4] === undefined ? 1 : Number(match[4]);
  const mixed = [0, 1, 2].map((i) =>
    Math.round(Number(match[i + 1]) * alpha + to(i * 2) * (1 - alpha)),
  );
  return (
    "#" +
    mixed.map((v) => v.toString(16).padStart(2, "0")).join("")
  );
}