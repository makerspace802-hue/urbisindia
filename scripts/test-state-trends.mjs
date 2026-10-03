/**
 * Checks the arithmetic behind the state trends view.
 *
 * These assert against the REAL module the component calls, not a copy of its
 * logic. That distinction matters: the series alignment in particular is an
 * index offset (`DECADAL_LABELS[i]` pairs with `INDIA_DECADAL[i + 1]`) which no
 * type checker can catch. A duplicated test would pass while the component
 * plotted every state's growth against the previous decade.
 *
 *   node scripts/test-state-trends.mjs
 */

import assert from "node:assert/strict";
import { buildSync } from "esbuild";
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// One bundle exposing both modules, so the test can assert against the same
// censusData the component reads rather than a re-typed copy.
const out = join(tmpdir(), "urbis-state-trends.mjs");
buildSync({
  stdin: {
    contents:
      'export * from "./src/lib/stateTrends";\nexport * from "./src/lib/censusData";\n',
    resolveDir: process.cwd(),
    loader: "ts",
  },
  bundle: true,
  format: "esm",
  platform: "neutral",
  outfile: out,
  logLevel: "silent",
});

const st = await import(`file://${out}?v=${Date.now()}`);
const d = st;

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

/* 1. THE ALIGNMENT CHECK — the one a type checker cannot do. */
check("series[i] pairs the state decade with the SAME India decade", () => {
  const model = st.stateTrendModel("Madhya Pradesh");
  assert.ok(model, "Madhya Pradesh should resolve");
  assert.equal(model.series.length, 11);

  for (let i = 0; i < model.series.length; i++) {
    const point = model.series[i];
    // The state value must be the raw decadal change at index i...
    assert.equal(
      point.state,
      d.STATE_DECADAL.find((s) => s.name === "Madhya Pradesh").changes[i],
      `state value misaligned at ${point.label}`,
    );
    // ...and the India value the percentChange of census i+1, NOT census i.
    const expected = d.INDIA_DECADAL[i + 1].percentChange;
    assert.equal(
      point.india,
      expected,
      `${point.label}: India rate should be ${expected} (census ${d.INDIA_DECADAL[i + 1].year}), got ${point.india}`,
    );
    // An off-by-one here would use census i, which is the PREVIOUS decade.
    if (d.INDIA_DECADAL[i].percentChange !== expected) {
      assert.notEqual(point.india, d.INDIA_DECADAL[i].percentChange);
    }
  }
});

check("the last series point carries India's 2001-2011 figure", () => {
  const model = st.stateTrendModel("Kerala");
  const last = model.series[model.series.length - 1];
  assert.equal(last.label, "2001-11");
  assert.ok(Math.abs(last.india - 17.703) < 0.001, `India rate should be 17.703, got ${last.india}`);
  // Kerala 2001 -> 2011 is +4.91 per Table A-2, and is the lowest decadal
  // growth of any state — a real demographic result, not a parsing artefact.
  assert.ok(Math.abs(last.state - 4.91) < 0.01, `Kerala should be +4.91%, got ${last.state}`);
});

check("Kerala's 1901 figure reproduces the source table", () => {
  // data/data-1.csv, Kerala block: 1901 = 6,396,262 and 2011 = 33,406,061.
  // Back-chaining the eleven decadal percentages must land back on the printed
  // starting value, which is a direct read of the CSV rather than a recall.
  const derived = st.backChainedPopulation("Kerala");
  assert.ok(Math.abs(derived - 6_396_262) / 6_396_262 < 0.001, `derived ${derived}`);
});

/* 2. The two generated tables must agree on the most recent decade. */
check("STATE_DECADAL last step matches STATE_GROWTH percentChange", () => {
  for (const row of d.STATE_GROWTH) {
    const series = d.STATE_DECADAL.find((s) => s.name === row.name);
    assert.ok(series, `${row.name} missing from STATE_DECADAL`);
    const last = series.changes[series.changes.length - 1];
    assert.ok(
      Math.abs(last - row.percentChange) < 0.01,
      `${row.name}: decadal ${last}% vs growth ${row.percentChange}%`,
    );
  }
});

/* 3. Back-chained first-census population. */
check("back-chained 1901 populations match their published series", () => {
  // Census 2011 back-series values for PRESENT-day boundaries. Individual 1901
  // figures are not dependable references in general — published numbers
  // usually describe the units that existed then (undivided Madras, pre-1956
  // Madhya Pradesh) rather than today's borders — so only anchors that
  // reproduce to well under a percent are used.
  const known = [
    ["Madhya Pradesh", 12_679_000],
    ["Uttar Pradesh", 46_638_000],
    ["Maharashtra", 19_412_000],
  ];

  for (const [name, expected] of known) {
    const derived = st.backChainedPopulation(name);
    assert.ok(derived !== null, `${name} should have a complete chain`);
    const drift = Math.abs(derived - expected) / expected;
    assert.ok(
      drift < 0.005,
      `${name}: derived ${Math.round(derived).toLocaleString("en-IN")} vs ${expected.toLocaleString("en-IN")} (${(drift * 100).toFixed(2)}% off)`,
    );
  }
});

check("sum of back-chained 1901 states reconciles with India's 1901 total", () => {
  const values = d.STATE_GROWTH.map((g) => st.backChainedPopulation(g.name)).filter((v) => v !== null);
  assert.equal(values.length, 30, "5 states have census gaps and cannot be chained");
  const sum = values.reduce((a, b) => a + b, 0);
  const india1901 = d.INDIA_DECADAL[0].population;
  const drift = (sum - india1901) / india1901;
  assert.ok(
    drift < 0.01 && drift > -0.01,
    `chained sum ${Math.round(sum).toLocaleString("en-IN")} vs India ${india1901.toLocaleString("en-IN")} (${(drift * 100).toFixed(2)}%)`,
  );
});

check("a gapped chain yields null rather than a fabricated figure", () => {
  assert.equal(st.backChainedPopulation("Arunachal Pradesh"), null);
  assert.equal(st.stateTrendModel("Arunachal Pradesh").populationAtStart, null);
});

check("2011 state populations sum exactly to the national total", () => {
  const sum = d.STATE_GROWTH.reduce((a, g) => a + g.population2011, 0);
  assert.equal(sum, d.INDIA_2011.population);
});

/* 4. Ranks. */
check("ranks are complete, 1-based and unique", () => {
  const byPop = [...d.STATE_GROWTH].sort((a, b) => b.population2011 - a.population2011);
  const up = st.stateTrendModel("Uttar Pradesh");
  const dnh = st.stateTrendModel("Dadra & Nagar Haveli");
  assert.equal(up.populationRank, 1, "most populous state");
  assert.equal(dnh.growthRank, 1, "fastest growing unit");
  assert.equal(up.stateCount, 35);
  assert.equal(byPop[0].name, "Uttar Pradesh");
  // Every state must land on a distinct rank.
  const ranks = d.STATE_GROWTH.map((g) => st.stateTrendModel(g.name).populationRank);
  assert.equal(new Set(ranks).size, 35, "ranks must be unique");
});

/* 5. Every state must resolve, or the view silently drops it. */
check("every state resolves to a complete model", () => {
  assert.equal(st.allStateNames().length, 35);
  for (const g of d.STATE_GROWTH) {
    const model = st.stateTrendModel(g.name);
    assert.ok(model, `${g.name} produced no model`);
    assert.ok(model.profile, `${g.name} missing profile`);
    assert.equal(model.series.length, 11);
  }
});

check("an unknown name returns null instead of throwing", () => {
  assert.equal(st.stateTrendModel("Atlantis"), null);
  assert.equal(st.stateTrendModel(null), null);
  assert.equal(st.stateTrendModel(undefined), null);
  assert.equal(st.stateTrendModel(""), null);
});

check("names are sorted for the picker", () => {
  const names = st.allStateNames();
  assert.deepEqual(names, [...names].sort((a, b) => a.localeCompare(b)));
  assert.ok(names.includes("Madhya Pradesh"));
  assert.ok(names.includes("NCT OF Delhi"), "Census table name, not 'Delhi'");
});

if (failures.length === 0) {
  console.log(`state-trends: ${passed}/${passed} arithmetic checks passed`);
} else {
  console.log(`state-trends: ${failures.length} FAILED of ${passed + failures.length}`);
  for (const f of failures) console.log(`  FAIL ${f}`);
  process.exitCode = 1;
}