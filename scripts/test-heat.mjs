/**
 * Heatmap legibility.
 *
 * This suite has been rewritten twice alongside the colour scheme, and each
 * rewrite was because the previous one stopped describing what ships.
 *
 *   v1  alpha wash under hard-coded white text — 1.42:1 in light mode.
 *   v2  solid fills, per-cell text colour from luminance — legible, but a
 *       saturated slab behind small digits, and it was rejected as ugly.
 *   v3  a low-alpha tint plus a figure painted in the accent's own colour,
 *       with each theme choosing the tone that reads on its own surface.
 *
 * Colours now live in `index.css`, so checking them means reading the
 * stylesheet and compositing each tint over the surface it actually sits on.
 * A step that drops below AA in either theme fails here rather than on a phone
 * in daylight.
 *
 *   node scripts/test-heat.mjs
 */

import assert from "node:assert/strict";
import { buildSync } from "esbuild";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const out = join(tmpdir(), "urbis-heat.mjs");
buildSync({
  stdin: {
    contents: ['export * from "./src/lib/heatScale";', ""].join("\n"),
    resolveDir: process.cwd(),
    loader: "ts",
  },
  bundle: true,
  format: "esm",
  platform: "neutral",
  outfile: out,
  logLevel: "silent",
});

const h = await import(`file://${out}?v=${Date.now()}`);
const css = readFileSync("src/index.css", "utf8");

const AA = 4.5;

let passed = 0;
const failures = [];
function check(name, fn) {
  try {
    fn();
    passed++;
  } catch (error) {
    failures.push(`${name} — ${error.message}`);
  }
}

/** Pull one declaration out of a rule. `className` may be `dark .heat-gain-1`. */
function declFor(className, property) {
  const selector = className
    .split(/\s+/)
    .map((part) => `.${part.replace(/[.]/g, "\\.")}`)
    .join("\\s+");
  const rule = new RegExp(`${selector}\\s*\\{([^}]*)\\}`).exec(css);
  assert.ok(rule, `no rule for "${className}" in index.css`);
  const m = new RegExp(`${property}\\s*:\\s*([^;]+)`).exec(rule[1]);
  assert.ok(m, `"${className}" has no ${property}`);
  return m[1].trim();
}

/** Surfaces the cells actually sit on, per theme. */
const LIGHT_SURFACE = "#ffffff";
const DARK_SURFACE = "#131b2a";

check("every cell step clears AA on both themes", () => {
  for (const direction of ["gain", "loss"]) {
    for (let step = 1; step <= h.HEAT_STEPS; step++) {
      const cls = `heat-${direction}-${step}`;

      // Light mode rule.
      const lightBg = h.composite(declFor(cls, "background"), LIGHT_SURFACE);
      const lightFg = declFor(cls, "color");
      const lightRatio = h.contrastRatio(lightFg, lightBg);
      assert.ok(
        lightRatio >= AA,
        `.${cls} in light mode is ${lightRatio.toFixed(2)}:1 ` +
          `(${lightFg} on ${lightBg}), needs ${AA}:1`,
      );

      // Dark mode override.
      const darkCls = `dark ${cls}`;
      const darkBg = h.composite(declFor(darkCls, "background"), DARK_SURFACE);
      const darkFg = declFor(darkCls, "color");
      const darkRatio = h.contrastRatio(darkFg, darkBg);
      assert.ok(
        darkRatio >= AA,
        `.${darkCls} is ${darkRatio.toFixed(2)}:1 ` +
          `(${darkFg} on ${darkBg}), needs ${AA}:1`,
      );
    }
  }
});

check("both themes are defined for every step", () => {
  // A step that only exists in one theme is invisible in the other — the exact
  // shape of the original bug, where light mode simply had no good colours.
  for (const direction of ["gain", "loss"]) {
    for (let step = 1; step <= h.HEAT_STEPS; step++) {
      const cls = `heat-${direction}-${step}`;
      assert.ok(css.includes(`.${cls} {`), `missing light rule .${cls}`);
      assert.ok(css.includes(`.dark .${cls} {`), `missing dark rule .${cls}`);
    }
  }
  assert.ok(css.includes(".heat-none {"), "the neutral cell is unstyled");
});

check("the tint is a wash, not a slab", () => {
  // The reason v2 looked like poster paint: an opaque or near-opaque fill.
  for (const direction of ["gain", "loss"]) {
    for (let step = 1; step <= h.HEAT_STEPS; step++) {
      for (const prefix of ["", ".dark "]) {
        const bg = declFor(`${prefix}heat-${direction}-${step}`, "background");
        const m = /rgba?\(([^)]+)\)/.exec(bg);
        assert.ok(m, `heat-${direction}-${step} background is not a tint: ${bg}`);
        const parts = m[1].split(",").map((s) => s.trim());
        const alpha = parts.length === 4 ? Number(parts[3]) : 1;
        assert.ok(
          alpha <= 0.5,
          `heat-${direction}-${step} tint is ${alpha}, too opaque to read as a tint`,
        );
      }
    }
  }
});

check("cells map to real classes and the blank cell stays neutral", () => {
  assert.equal(h.heatFill(null, 20).className, "heat-none");
  assert.equal(h.heatFill(0, 20).className, "heat-none");
  assert.equal(h.heatFill(NaN, 20).className, "heat-none");
  assert.equal(h.heatFill(5, 20).direction, "gain");
  assert.equal(h.heatFill(-5, 20).direction, "loss");
  // A quarter of the maximum is a quarter of the way up the ramp, not the top
  // of it: the top step belongs to the value that IS the maximum.
  assert.equal(h.heatFill(5, 20).step, 2);
  assert.equal(h.heatFill(20, 20).step, h.HEAT_STEPS);
  assert.equal(h.heatFill(-20, 20).step, h.HEAT_STEPS);

  // Every class the module can emit must exist in the stylesheet, or a cell
  // renders with no background at all.
  const emitted = new Set();
  for (let v = -20; v <= 20; v += 0.5) {
    emitted.add(h.heatFill(v, 20).className);
  }
  emitted.add(h.heatFill(null, 20).className);
  for (const cls of emitted) {
    assert.ok(css.includes(`.${cls}`), `.${cls} is emitted but never styled`);
    // The neutral cell is the one exception: it resolves through theme tokens
    // that are themselves redefined under `.dark`, so it needs no override of
    // its own. Every tinted step does need one, or it renders light-on-light.
    if (cls !== "heat-none") {
      assert.ok(
        css.includes(`.dark .${cls}`),
        `.${cls} has no dark-theme rule, so it renders unstyled in dark mode`,
      );
    }
  }

  // The neutral cell must actually resolve differently per theme, or it would
  // be the same grey on both backgrounds.
  const neutralBg = declFor("heat-none", "background");
  assert.ok(
    /var\(--nb-surface-2\)/.test(neutralBg),
    "the neutral cell should use a theme token, not a fixed colour",
  );
  const lightSurface = /--nb-surface-2:\s*([^;]+);/.exec(
    css.slice(0, css.indexOf(".dark {")),
  )[1].trim();
  const darkSurface = /--nb-surface-2:\s*([^;]+);/.exec(
    css.slice(css.indexOf(".dark {")),
  )[1].trim();
  assert.notEqual(lightSurface, darkSurface, "the neutral cell is identical in both themes");

  // The token is itself redefined per theme, so resolve it the way the browser
  // would rather than assuming one hex.
  const tokenValue = (token, theme) => {
    const scope = theme === "dark"
      ? css.slice(css.indexOf(".dark {"))
      : css.slice(0, css.indexOf(".dark {"));
    const m = new RegExp(`--${token}:\\s*([^;]+);`).exec(scope);
    assert.ok(m, `--${token} is not defined for the ${theme} theme`);
    return m[1].trim();
  };
  for (const theme of ["light", "dark"]) {
    const surface = theme === "dark" ? darkSurface : lightSurface;
    const fg = tokenValue("nb-text-muted", theme);
    const ratio = h.contrastRatio(fg, surface);
    assert.ok(
      ratio >= AA,
      `the neutral cell is ${ratio.toFixed(2)}:1 in ${theme} mode ` +
        `(${fg} on ${surface}), needs ${AA}:1`,
    );
  }

  // Step must climb with magnitude and never leave 1..STEPS.
  let previous = 0;
  for (let v = 0.5; v <= 20; v += 0.25) {
    const step = h.heatFill(v, 20).step;
    assert.ok(step >= previous, "step went backwards as magnitude grew");
    assert.ok(step >= 1 && step <= h.HEAT_STEPS, `step out of range: ${step}`);
    previous = step;
  }
});

check("the chart uses the classes and never hard-codes a colour", () => {
  const source = readFileSync("src/components/CensusCharts.tsx", "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/[^\n]*/g, "");
  assert.ok(source.includes("fill.className"), "the cell is not using the scale class");
  assert.ok(!/text-white/.test(source), "white text is hard-coded on the cells again");
  assert.ok(
    !/rgba\(16,185,129/.test(source),
    "the old alpha wash is back inline in the chart",
  );
  assert.ok(
    !/backgroundColor: fill\./.test(source),
    "the cell is still painting a colour from JS instead of using the theme",
  );
});

check("the mobile layout does not depend on a ticker for real content", () => {
  const source = readFileSync("src/components/CensusCharts.tsx", "utf8");
  assert.match(
    source,
    /hidden sm:block[\s\S]{0,80}RetroMarquee/,
    "the marquee is not limited to wider screens",
  );
  assert.match(source, /grid grid-cols-1 gap-2 sm:hidden/);
  const wide = source.match(/min-w-\[(\d+)px\]/g) ?? [];
  assert.ok(wide.length >= 2, "expected both tables to declare a minimum width");
  for (const rule of wide) {
    assert.ok(Number(/\d+/.exec(rule)[0]) <= 560, `${rule} is too wide for a phone`);
  }
  assert.match(source, /sticky left-0/, "row labels are not pinned while scrolling");
});

if (failures.length === 0) {
  console.log(`heat: ${passed}/${passed} checks passed`);
} else {
  console.log(`heat: ${failures.length} FAILED of ${passed + failures.length}`);
  for (const f of failures) console.log(`  FAIL ${f}`);
  process.exitCode = 1;
}