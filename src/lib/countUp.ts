/**
 * Rolling a formatted figure up from zero.
 *
 * The dashboard does not hold raw numbers by the time a card renders them —
 * `compact()` has already turned 1210905792 into "1,210.9M", and
 * `dashboardPreferences` has already run the integer through the Indian
 * digit grouping. So an animation cannot simply lerp a number: it has to take
 * the finished string apart, keep the author's format, and rebuild it on every
 * frame. `parseFigure` is that teardown; `formatFigure` is the rebuild.
 *
 * Both are pure and total. Anything that is not a figure — an em dash for a
 * census that was not held, a bare year — comes back as `numeric: false` and
 * is rendered verbatim, so a roll-up can never mangle text into "NaN".
 */

export interface Figure {
  /** Whether the string contained a number at all. */
  numeric: boolean;
  /** Leading sign and anything before the digits, e.g. "+" or "-". */
  prefix: string;
  /** The digits with separators removed. */
  digits: string;
  /** The number itself, or 0 when `numeric` is false. */
  value: number;
  /** Decimal places the source string used. */
  decimals: number;
  /** Thousands separators in the source, so grouping is preserved. */
  grouped: boolean;
  /** Everything after the digits, e.g. "%" or "M". */
  suffix: string;
  /** The original string, returned untouched when `numeric` is false. */
  raw: string;
}

/**
 * Splits `text` into its parts.
 *
 * `^` anchored, and the number pattern requires at least one digit, so a
 * string like "—" or "n/a" falls straight through to the non-numeric branch.
 */
export function parseFigure(text: string): Figure {
  const match = /^([+-]?)([0-9][0-9,]*\.?[0-9]*)(.*)$/.exec(text.trim());

  if (!match) {
    return {
      numeric: false,
      prefix: "",
      digits: "",
      value: 0,
      decimals: 0,
      grouped: false,
      suffix: "",
      raw: text,
    };
  }

  const [, prefix, digits, suffix] = match;
  const dot = digits.indexOf(".");
  const decimals = dot === -1 ? 0 : digits.length - dot - 1;
  const value = Number(digits.replace(/,/g, ""));

  return {
    numeric: Number.isFinite(value),
    prefix,
    digits,
    value: Number.isFinite(value) ? value : 0,
    decimals,
    grouped: digits.includes(","),
    suffix,
    raw: text,
  };
}

const INDIAN = new Intl.NumberFormat("en-IN");

/**
 * Rebuilds a figure at an arbitrary value, in the format `parseFigure`
 * recorded.
 *
 * Grouped figures use `en-IN`, which is what `compact()` and
 * `dashboardPreferences` both format with — using `toLocaleString()` bare would
 * group a crore as 12,10,90,579 rather than 1,21,09,057 and the digits would
 * visibly jump sidewards as the number counts up.
 *
 * Grouping and decimals are handled separately rather than by rounding the
 * whole number first: `Intl.NumberFormat` is fixed at zero decimal places, so
 * routing "1,210.9M" through it would silently drop the ".9" on its way past.
 * The sign lives in `prefix`, never in `value`, so the integer and fractional
 * halves are taken from a value that is never negative.
 */
export function formatFigure(figure: Figure, value: number): string {
  if (!figure.numeric) return figure.raw;

  const decimals = figure.decimals;
  const body = figure.grouped
    ? decimals > 0
      ? `${INDIAN.format(Math.floor(value))}.${(value % 1).toFixed(decimals).slice(2)}`
      : INDIAN.format(Math.round(value))
    : value.toFixed(decimals);

  return `${figure.prefix}${body}${figure.suffix}`;
}

/** The figure rendered at its own target value — i.e. unchanged. */
export function figureTarget(text: string): string {
  const figure = parseFigure(text);
  return formatFigure(figure, figure.value);
}