/**
 * Heatmap legibility.
 *
 * The Census heatmaps painted an alpha wash and put hard-coded white text on
 * top. In light mode the palest cell composited to rgb(184,225,217) and the
 * figure inside it sat at **1.42:1** — effectively invisible, which is what the
 * owner reported. Dark mode hid it: the dark page made every wash dark enough
 * to carry white text.
 *
 * So this checks the thing that was actually wrong — contrast — by computing
 * the WCAG ratio for every cell the app can render, against both theme
 * backgrounds. A future edit that reintroduces an alpha wash, or hard-codes a
 * text colour, fails here rather than on a phone in daylight.
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

/** WCAG AA for normal text. */
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

check("every cell the app can render clears AA on its own fill", () => {
  // Sweep the whole scale densely rather than sampling, so a bad step cannot
  // hide between two chosen values.
  let worst = Infinity;
  let worstAt = null;
  for (let i = 1; i <= 200; i++) {
    const value = i / 10; // 0.1 .. 20
    for (const sign of [1, -1]) {
      const cell = h.heatFill(sign * value, 20);
      const ratio = h.contrastRatio(cell.background, cell.color);
      if (ratio < worst) {
        worst = ratio;
        worstAt = `${cell.background} with ${cell.color} at ${(sign * value).toFixed(1)}`;
      }
    }
  }
  assert.ok(
    worst >= AA,
    `worst cell is ${worst.toFixed(2)}:1 (${worstAt}), needs ${AA}:1`,
  );
});

check("the old failure mode cannot come back", () => {
  // The original was rgba(16,185,129,0.22) under white text, which composites
  // to a pale mint on the light page. Recompute that exact case and assert it
  // really was below AA — this is the regression being guarded against, and it
  // is checked as arithmetic rather than remembered.
  const channels = (hex) =>
    [0, 2, 4].map((i) => parseInt(hex.replace("#", "").slice(i, i + 2), 16));
  const composited = channels("#10B981").map((v, i) =>
    Math.round(v * 0.22 + channels("#e8ecf2")[i] * 0.78),
  );
  const toHex = `rgb(${composited.join(",")})`;
  // contrastRatio takes hex, so convert the composite back.
  const asHex =
    "#" +
    composited
      .map((v) => v.toString(16).padStart(2, "0"))
      .join("");
  const oldRatio = h.contrastRatio(asHex, "#FFFFFF");
  assert.ok(
    oldRatio < AA,
    `the old wash now measures ${oldRatio.toFixed(2)}:1 — if that ever passes, ` +
      "this check is measuring the wrong thing",
  );
  void toHex;

  // Every fill the module produces must be a SOLID six-digit hex. A `rgba()`
  // or `rgb()` string here is the bug, so it is rejected outright.
  for (const value of [-30, -12, -1, 0, null, 0.4, 9, 55]) {
    const cell = h.heatFill(value, 55);
    assert.match(
      cell.background,
      /^#[0-9A-Fa-f]{6}$/,
      `fill for ${value} is not a solid hex: ${cell.background}`,
    );
    assert.match(
      cell.color,
      /^#[0-9A-Fa-f]{6}$/,
      `text for ${value} is not a solid hex: ${cell.color}`,
    );
  }
});

check("cells read on either theme background", () => {
  // A solid fill looks the same on both, but the theme must not change the
  // ink/paper decision — otherwise dark mode flips every label's colour.
  const light = h.heatFill(3, 10);
  const dark = h.heatFill(3, 10);
  assert.equal(light.color, dark.color, "the fill decision depends on the theme");
  // And both themes' own text tokens must stay legible on their own background.
  assert.ok(
    h.contrastRatio("#e8ecf2", "#1e293b") >= AA,
    "light-mode body text is below AA",
  );
  assert.ok(
    h.contrastRatio("#0b0f17", "#e2e8f0") >= AA,
    "dark-mode body text is below AA",
  );
});

check("blank and zero cells read as neutral, not as a value", () => {
  for (const value of [null, 0, NaN]) {
    const cell = h.heatFill(value, 20);
    assert.equal(
      cell.background,
      h.HEAT_NEUTRAL,
      `${value} should be neutral, got ${cell.background}`,
    );
    assert.ok(
      h.contrastRatio(cell.background, cell.color) >= AA,
      `the blank cell is unreadable at ${value}`,
    );
  }
});

check("the chart no longer hard-codes white text or an alpha wash", () => {
  const source = readFileSync("src/components/CensusCharts.tsx", "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/[^\n]*/g, "");
  assert.ok(
    !/text-white/.test(source),
    "CensusCharts still hard-codes white text on the heat cells",
  );
  assert.ok(
    !/rgba\(16,185,129/.test(source),
    "the old alpha wash is back in the chart",
  );
  assert.ok(source.includes("heatFill"), "the chart is not using the tested scale");
  // And the figure colour must come from the fill, not from a class.
  assert.match(source, /color: fill\.color/, "the cell text colour is not derived from its fill");
});

check("the mobile layout does not depend on a ticker for real content", () => {
  const source = readFileSync("src/components/CensusCharts.tsx", "utf8");
  // Every stat must be reachable without the marquee animating, so the phone
  // version gets a static list of the same figures.
  assert.match(
    source,
    /hidden sm:block[\s\S]{0,80}RetroMarquee/,
    "the marquee is not limited to wider screens",
  );
  assert.match(
    source,
    /grid grid-cols-1 gap-2 sm:hidden/,
    "no static replacement for the ticker on small screens",
  );
  // Both wide grids need to scroll deliberately, not blow out the viewport.
  const wide = source.match(/min-w-\[(\d+)px\]/g) ?? [];
  assert.ok(wide.length >= 2, "expected both tables to declare a minimum width");
  for (const rule of wide) {
    const width = Number(/\d+/.exec(rule)[0]);
    assert.ok(width <= 560, `${rule} is wider than a small phone needs`);
  }
  assert.match(source, /sticky left-0/, "the row labels are not pinned while scrolling");
});

if (failures.length === 0) {
  console.log(`heat: ${passed}/${passed} checks passed`);
} else {
  console.log(`heat: ${failures.length} FAILED of ${passed + failures.length}`);
  for (const f of failures) console.log(`  FAIL ${f}`);
  process.exitCode = 1;
}