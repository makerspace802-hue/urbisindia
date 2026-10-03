/**
 * Checks the Census-grounded projection.
 *
 * This replaced a model that produced a temperature drop and an annual saving
 * from slider positions. Those quantities are gone; what is left is arithmetic
 * on published figures, which is exactly the kind of thing that can be wrong in
 * a way nobody notices — a base year off by ten, a rate that stops being the
 * observed one, or a compound that quietly uses the wrong starting population.
 *
 *   node scripts/test-projection.mjs
 */

import assert from "node:assert/strict";
import { buildSync } from "esbuild";
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const out = join(tmpdir(), "urbis-projection.mjs");
buildSync({
  stdin: {
    contents:
      'export * from "./src/lib/projection";\nexport * from "./src/lib/censusData";\n',
    resolveDir: process.cwd(),
    loader: "ts",
  },
  bundle: true,
  format: "esm",
  platform: "neutral",
  outfile: out,
  logLevel: "silent",
});
const p = await import(`file://${out}?v=${Date.now()}`);

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

check("projection starts at the 2011 Census, not the present year", () => {
  const points = p.buildProjectionPoints({ state: "Kerala" });
  assert.equal(points[0].year, 2011, "the Census ends in 2011");
  assert.equal(points[0].label, "2011");
  assert.equal(points[0].multiple, 1, "year 0 must be the unmodified base");
});

check("the base population is the state's published 2011 figure", () => {
  const growth = p.STATE_GROWTH.find((g) => g.name === "Kerala");
  const points = p.buildProjectionPoints({ state: "Kerala" });
  assert.equal(points[0].population, growth.population2011);
  assert.equal(p.basePopulation("Kerala"), 33_406_061);
});

check("the observed rate is the state's own last decadal change", () => {
  const growth = p.STATE_GROWTH.find((g) => g.name === "Kerala");
  // Kerala's published 2001-2011 rate is +4.914% (the table prints 4.91).
  assert.ok(Math.abs(p.observedDecadalRate("Kerala") * 100 - 4.914) < 0.001);
  assert.ok(
    Math.abs(p.observedDecadalRate("Kerala") * 100 - growth.percentChange) < 0.001,
    "rate must come from the table, not a constant",
  );
  assert.ok(Math.abs(p.observedDecadalRate("Maharashtra") * 100 - 15.99) < 0.01);
});

check("population compounds at the observed rate", () => {
  const points = p.buildProjectionPoints({ state: "Maharashtra" });
  const rate = p.observedDecadalRate("Maharashtra");
  for (let i = 1; i < points.length; i++) {
    const expected = points[i - 1].population * (1 + rate);
    // Allow a unit of rounding from the integer base.
    assert.ok(
      Math.abs(points[i].population - expected) <= 1,
      `${points[i].label}: ${points[i].population} vs expected ~${Math.round(expected)}`,
    );
    assert.ok(Math.abs(points[i].multiple - (1 + rate) ** i) < 1e-9);
  }
});

check("India's comparison line starts from the national total", () => {
  const points = p.buildProjectionPoints({ state: "Kerala" });
  assert.equal(points[0].india, p.INDIA_DECADAL.at(-1).population);
  assert.equal(points[0].india, 1_210_854_977);
  // India's own rate must be its own, not the state's.
  const indiaEnd = p.INDIA_DECADAL.at(-1).population * (1 + p.INDIA_DECADE_RATE) ** 3;
  assert.ok(Math.abs(points[3].india - indiaEnd) <= 1);
});

check("a fast state overtakes India, a slow one falls behind", () => {
  const fast = p.buildProjectionPoints({ state: "Bihar" }); // +25.42%
  const slow = p.buildProjectionPoints({ state: "Kerala" }); // +4.91%
  assert.ok(
    fast[3].multiple > slow[3].multiple,
    "Bihar's multiple should exceed Kerala's after three decades",
  );
});

check("an unknown or missing state falls back to India, not to zero", () => {
  const national = p.buildProjectionPoints({ state: null });
  const atlantis = p.buildProjectionPoints({ state: "Atlantis" });
  assert.equal(national[0].population, p.INDIA_DECADAL.at(-1).population);
  assert.equal(atlantis[0].population, p.INDIA_DECADAL.at(-1).population);
  assert.ok(atlantis[3].population > 0, "must never project to a zero population");
});

check("every state projects a series that follows the sign of its own rate", () => {
  for (const g of p.STATE_GROWTH) {
    const points = p.buildProjectionPoints({ state: g.name });
    assert.equal(points.length, 4);
    assert.equal(points[0].population, g.population2011, `${g.name} base`);
    const growing = g.percentChange > 0;
    for (let i = 1; i < points.length; i++) {
      assert.ok(Number.isFinite(points[i].population), `${g.name} ${points[i].label}`);
      if (growing) {
        assert.ok(
          points[i].population > points[i - 1].population,
          `${g.name} should grow under a positive rate`,
        );
      } else {
        assert.ok(
          points[i].population < points[i - 1].population,
          `${g.name} should shrink under a negative rate`,
        );
      }
      assert.ok(points[i].population > 0, `${g.name} must never reach zero`);
    }
  }
});

check("Nagaland's decline is carried through, not flattened", () => {
  // The only state to lose population between 2001 and 2011 in the source table.
  const g = p.STATE_GROWTH.find((x) => x.name === "Nagaland");
  assert.ok(g.percentChange < 0, "fixture should be a declining state");
  const points = p.buildProjectionPoints({ state: "Nagaland" });
  assert.ok(points[3].population < points[0].population);
  // Below India's growth, so it should pull further behind.
  assert.ok(points[3].multiple < points[0].india / p.INDIA_DECADAL.at(-1).population);
});

if (failures.length === 0) {
  console.log(`projection: ${passed}/${passed} checks passed`);
} else {
  console.log(`projection: ${failures.length} FAILED of ${passed + failures.length}`);
  for (const f of failures) console.log(`  FAIL ${f}`);
  process.exitCode = 1;
}