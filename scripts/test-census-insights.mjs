/**
 * Checks the cross-state insight panels.
 *
 * The failure these guard against is silence. The panels JOIN two generated
 * tables, so a state present in one and not the other would simply vanish from
 * all four charts — no error, no empty state, just a quietly incomplete league
 * table. These assert the join is complete and that the plotted values are the
 * published ones.
 *
 *   node scripts/test-census-insights.mjs
 */

import assert from "node:assert/strict";
import { buildSync } from "esbuild";
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const out = join(tmpdir(), "urbis-census-insights.mjs");
buildSync({
  stdin: {
    contents:
      'export * from "./src/lib/censusInsights";\nexport * from "./src/lib/censusData";\n',
    resolveDir: process.cwd(),
    loader: "ts",
  },
  bundle: true,
  format: "esm",
  platform: "neutral",
  outfile: out,
  logLevel: "silent",
});
const ci = await import(`file://${out}?v=${Date.now()}`);

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

check("every state joins both tables — none silently dropped", () => {
  const coverage = ci.insightCoverage();
  assert.equal(coverage.rows, 35, "all 35 units must produce a row");
  assert.deepEqual(coverage.missing, [], "a state is missing from STATE_PROFILE");
  assert.equal(ci.insightRows(null).length, 35);
});

check("India's rate is read from the table, not hard-coded", () => {
  const expected = ci.INDIA_DECADAL.at(-1).percentChange;
  assert.ok(Math.abs(ci.indiaDecadalRatePercent() - expected) < 1e-9);
  assert.ok(Math.abs(ci.indiaDecadalRatePercent() - 17.703) < 0.001);
});

check("rows carry the published figures, unaltered", () => {
  for (const row of ci.insightRows(null)) {
    const growth = ci.STATE_GROWTH.find((g) => g.name === row.name);
    const profile = ci.STATE_PROFILE.find((p) => p.name === row.name);
    assert.ok(Math.abs(row.percentChange - growth.percentChange) < 1e-9, row.name);
    assert.equal(row.population, growth.population2011, row.name);
    assert.equal(row.sexRatio2001, growth.sexRatio2001, row.name);
    assert.equal(row.sexRatio2011, growth.sexRatio2011, row.name);
    assert.equal(row.urbanShare, profile.urbanSharePercent, row.name);
    assert.equal(row.literacy, profile.literacyPercent, row.name);
  }
});

check("sex shift is the decade difference, to one decimal", () => {
  const row = ci.insightRows(null).find((r) => r.name === "Kerala");
  const growth = ci.STATE_GROWTH.find((g) => g.name === "Kerala");
  const expected = Number((growth.sexRatio2011 - growth.sexRatio2001).toFixed(1));
  assert.equal(row.sexShift, expected);
  // Kerala 1058.5 -> 1084.3
  assert.ok(Math.abs(row.sexShift - 25.8) < 0.001, `got ${row.sexShift}`);
});

check("growth league is sorted fastest first", () => {
  const league = ci.growthLeague(null);
  assert.equal(league[0].name, "Dadra & Nagar Haveli");
  for (let i = 1; i < league.length; i++) {
    assert.ok(league[i - 1].percentChange >= league[i].percentChange, "out of order");
  }
  // The one declining state must be last.
  assert.equal(league.at(-1).name, "Nagaland");
  assert.ok(league.at(-1).percentChange < 0);
});

check("sex-ratio panel is sorted by improvement", () => {
  const sorted = ci.sexRatioShift(null);
  for (let i = 1; i < sorted.length; i++) {
    assert.ok(sorted[i - 1].sexShift >= sorted[i].sexShift, "out of order");
  }
});

check("scatter panels carry one point per state", () => {
  assert.equal(ci.literacyScatter(null).length, 35);
  const density = ci.densityScatter(null);
  // Only states with a recorded area can be plotted on a density axis.
  assert.ok(density.length <= 35);
  for (const point of density) {
    assert.equal(typeof point.x, "number", `${point.name} density must be numeric`);
    assert.ok(Number.isFinite(point.x) && point.x > 0, point.name);
  }
});

check("the visitor's state is marked, and only that one", () => {
  const rows = ci.insightRows("Kerala");
  assert.equal(rows.filter((r) => r.yours).length, 1);
  assert.ok(rows.find((r) => r.yours).name === "Kerala");
  // A name that is not a state marks nothing rather than throwing.
  assert.equal(ci.insightRows("Atlantis").filter((r) => r.yours).length, 0);
  assert.equal(ci.insightRows(null).filter((r) => r.yours).length, 0);
  assert.equal(ci.densityScatter("Kerala").filter((p) => p.yours).length, 1);
});

check("spot-check extremes the panels will draw", () => {
  const rows = ci.insightRows(null);
  const byName = Object.fromEntries(rows.map((r) => [r.name, r]));
  // NCT of Delhi is the densest unit in the tables, ahead of Chandigarh and
  // Puducherry. These are the outlying dots that justify the log axis.
  const densities = rows.filter((r) => r.density !== null).map((r) => r.density);
  assert.equal(byName["NCT OF Delhi"].density, Math.max(...densities));
  assert.equal(byName["NCT OF Delhi"].density, 11_320);
  // Kerala has the highest literacy in India.
  const literacy = rows.map((r) => r.literacy);
  assert.equal(byName["Kerala"].literacy, Math.max(...literacy));
  assert.equal(byName["Kerala"].literacy, 94);
});

if (failures.length === 0) {
  console.log(`census-insights: ${passed}/${passed} checks passed`);
} else {
  console.log(`census-insights: ${failures.length} FAILED of ${passed + failures.length}`);
  for (const f of failures) console.log(`  FAIL ${f}`);
  process.exitCode = 1;
}