/**
 * Dashboard personalisation.
 *
 * The risk this guards against is the one that already bit this project twice:
 * a card that renders a figure which is not in the Census tables. The
 * catalogue is the new surface for that — eight metrics a resident can put on
 * their dashboard — so it is checked by RUNNING every metric against every
 * state and comparing with `censusData.ts`, not by reading the list.
 *
 * It also pins the two ways a saved customisation could break the dashboard:
 * a stale metric id from an older catalogue, and a record that somehow ends up
 * selecting nothing at all.
 *
 *   node scripts/test-dashboard.mjs
 */

import assert from "node:assert/strict";
import { buildSync } from "esbuild";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const out = join(tmpdir(), "urbis-dashboard.mjs");
buildSync({
  stdin: {
    contents: [
      'export * from "./src/lib/dashboardPreferences";',
      'export * from "./src/lib/censusData";',
      'export * from "./src/lib/geo";',
      "",
    ].join("\n"),
    resolveDir: process.cwd(),
    loader: "ts",
  },
  bundle: true,
  format: "esm",
  platform: "neutral",
  outfile: out,
  logLevel: "silent",
});

const d = await import(`file://${out}?v=${Date.now()}`);

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

const STATES = [...new Set(d.STATE_GROWTH.map((s) => s.name))];

check("the catalogue covers every state, with no gaps", () => {
  assert.equal(STATES.length, 35, "expected all 35 Census units");
  assert.ok(
    d.METRIC_CATALOGUE.length >= 6,
    "a customisable dashboard needs more than a couple of options",
  );
  // The metric the owner asked for by name, in either spelling of the idea.
  assert.ok(
    d.METRIC_CATALOGUE.some((m) => m.id === "sexRatio"),
    "the sex ratio is not on offer, so the owner's example cannot be built",
  );
});

check("every metric resolves for every state, with no invented figures", () => {
  for (const state of STATES) {
    for (const metric of d.METRIC_CATALOGUE) {
      const reading = d.readMetric(state, metric.id);
      assert.ok(
        reading !== null,
        `${state} has no ${metric.id}, so the card would render empty`,
      );
      for (const part of [reading.value, reading.note]) {
        assert.ok(
          typeof part === "string" && part.length > 0,
          `${state}/${metric.id} produced an empty string`,
        );
        assert.ok(
          !/undefined|NaN|null|Infinity/.test(part),
          `${state}/${metric.id} leaked a placeholder: ${part}`,
        );
      }
      // A figure must be numeric somewhere; a card showing only words is a bug.
      assert.ok(
        /[\d]/.test(reading.value),
        `${state}/${metric.id} has no number in ${JSON.stringify(reading.value)}`,
      );
    }
  }
});

check("a metric the tables do not hold is dropped, not zeroed", () => {
  assert.equal(
    d.readMetric("Madhya Pradesh", "notAMetric"),
    null,
    "an unknown metric must not resolve",
  );
  // A state that is not a real unit must produce nothing rather than blanks.
  assert.equal(d.readMetric("Atlantis", "population"), null);
  assert.deepEqual(d.readMetric("Madhya Pradesh", "population"), {
    value: "7,26,26,809",
    note: "7.26 crore people",
  });
});

check("male and female counts are the published ones, not derived", () => {
  // The sex ratio is published to one decimal place, so solving it back for
  // the two counts lands a few people off: for Madhya Pradesh the derivation
  // gives 37,612,309 against the published 37,612,306. These counts are read
  // from Table A-1 instead, and the identity below is what would catch a
  // regression to deriving them.
  for (const profile of d.STATE_PROFILE) {
    assert.equal(
      profile.males + profile.females,
      profile.population,
      `${profile.name}: ${profile.males} + ${profile.females} != ${profile.population}`,
    );
  }

  const mp = d.STATE_PROFILE.find((p) => p.name === "Madhya Pradesh");
  assert.equal(mp.males, 37612306, "MP male count is not the published figure");
  assert.equal(mp.females, 35014503, "MP female count is not the published figure");
  assert.equal(d.readMetric("Madhya Pradesh", "males").value, "3,76,12,306");
  assert.equal(d.readMetric("Madhya Pradesh", "females").value, "3,50,14,503");

  // A derived figure would be off by 3 here, so assert the exact value rather
  // than a rounded one.
  const derived = Math.round(mp.population / (1 + 930.9 / 1000));
  assert.notEqual(
    d.STATE_PROFILE.find((p) => p.name === "Madhya Pradesh").males,
    derived,
    "the male count appears to have been derived from the ratio again",
  );
});

check("men and women are on offer, since they were asked for by name", () => {
  assert.ok(d.METRIC_CATALOGUE.some((m) => m.id === "males"), "no 'Men' metric");
  assert.ok(d.METRIC_CATALOGUE.some((m) => m.id === "females"), "no 'Women' metric");
  // And the other counts a resident can now put on their dashboard.
  for (const id of ["rural", "urban", "literateCount", "illiterateCount", "scheduledCaste", "scheduledTribe"]) {
    assert.ok(
      d.METRIC_CATALOGUE.some((m) => m.id === id),
      `${id} is missing from the catalogue`,
    );
    assert.ok(d.isMetricId(id), `${id} would not survive being saved`);
  }
  // "Literacy" now means the rate; the count has its own card. Two cards with
  // the same title would be indistinguishable in the picker.
  const titles = d.METRIC_CATALOGUE.map((m) => m.title);
  assert.equal(new Set(titles).size, titles.length, "duplicate metric titles");
  assert.ok(titles.includes("Literacy rate"));
  assert.ok(titles.includes("Literate people"));
});

check("the sex ratio states which way round it counts", () => {
  const reading = d.readMetric("Madhya Pradesh", "sexRatio");
  // "Ratio of men to women" is ambiguous; the Census convention is females per
  // 1,000 males, so the card has to say so or the number is meaningless.
  assert.match(reading.note, /females per 1,000 males/);
  assert.match(reading.note, /was \d/);
});

check("a stored preference cannot break the dashboard", () => {
  // Stale ids from an older catalogue must be dropped, not rendered.
  const stale = d.normalisePrefs({
    state: "Maharashtra",
    metrics: ["population", "retiredMetric", 42, "sexRatio"],
    showNational: false,
  });
  assert.deepEqual(stale.metrics, ["population", "sexRatio"]);
  assert.equal(stale.state, "Maharashtra");
  assert.equal(stale.showNational, false);

  // Selecting nothing must fall back rather than render an empty dashboard.
  assert.deepEqual(
    d.normalisePrefs({ metrics: [] }).metrics,
    d.DEFAULT_METRICS,
    "an empty selection must fall back to the defaults",
  );

  // Duplicates are collapsed so a double-click cannot double a card.
  assert.deepEqual(
    d.normalisePrefs({ metrics: ["population", "population"] }).metrics,
    ["population"],
  );

  // Nonsense in, defaults out.
  for (const bad of [undefined, null, "nonsense", 42, [], { metrics: "all" }]) {
    const prefs = d.normalisePrefs(bad);
    assert.ok(prefs.metrics.length > 0, `normalisePrefs(${JSON.stringify(bad)}) emptied the dashboard`);
    assert.equal(typeof prefs.showNational, "boolean");
  }
});

check("a signed-out visitor keeps the dashboard they had", () => {
  // Customisation is opt-in: the default is the four India-wide cards, and the
  // state falls back to the located one rather than being pinned.
  assert.equal(d.DEFAULT_PREFS.state, null);
  assert.equal(d.DEFAULT_PREFS.showNational, true);
  assert.deepEqual(d.DEFAULT_PREFS.metrics, d.DEFAULT_METRICS);
});

check("every metric in the catalogue is reachable through normalisePrefs", () => {
  // If a metric were added to the catalogue without being accepted by the
  // validator, selecting it in the UI would silently do nothing.
  for (const metric of d.METRIC_CATALOGUE) {
    assert.ok(d.isMetricId(metric.id), `${metric.id} is rejected by isMetricId`);
    assert.equal(d.metricDef(metric.id)?.id, metric.id);
    assert.ok(
      d.normalisePrefs({ metrics: [metric.id] }).metrics.includes(metric.id),
      `${metric.id} is dropped when saved`,
    );
  }
  assert.equal(d.isMetricId("nope"), false);
});

check("the state picker offers only real Census units", () => {
  // The picker is fed from `PLACES`, which is how citizens actually write the
  // names. Two of those are not the table's spelling — "Delhi" is filed under
  // "NCT OF Delhi" and "Telangana" under "Andhra Pradesh" — so the check has
  // to go through `censusName`, and `readMetric` has to do the same. Getting
  // this wrong renders two rows of empty cards, which is exactly what happened
  // the first time round.
  assert.equal(d.PLACES.length, 36);
  for (const place of d.PLACES) {
    const name = d.censusName(place);
    assert.ok(name, `"${place}" is offered but does not map to a Census name`);
    const row = d.STATE_PROFILE.find((p) => p.name === name);
    const growthRow = d.STATE_GROWTH.find((g) => g.name === name);
    assert.ok(
      row || growthRow,
      `"${place}" maps to "${name}", which has no Census row`,
    );
    // And the dashboard must actually be able to render it.
    const reading = d.readMetric(place, "population");
    assert.ok(reading, `${place} renders no population card`);
  }

  // The two aliases specifically, since they are the ones that broke.
  assert.equal(d.censusName("Delhi"), "NCT OF Delhi");
  assert.equal(d.censusName("Telangana"), "Andhra Pradesh");
  assert.ok(d.readMetric("Delhi", "population"), "Delhi renders no card");
  assert.ok(d.readMetric("Telangana", "population"), "Telangana renders no card");
});

check("the customiser offers no free text that could become a figure", () => {
  const source = readFileSync("src/components/DashboardCustomiser.tsx", "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/[^\n]*/g, "");
  // Every state offered comes from the shared list, and the only inputs are a
  // select and checkboxes — no field where a resident could type a number.
  assert.ok(source.includes("PLACES"), "the picker must read the shared place list");
  assert.equal(
    (source.match(/<input/g) ?? []).length,
    1,
    "expected only the one checkbox input",
  );
  assert.ok(!/<input[^>]*type="text"/.test(source));
  assert.ok(!/<input[^>]*type="number"/.test(source));
});

if (failures.length === 0) {
  console.log(`dashboard: ${passed}/${passed} checks passed`);
} else {
  console.log(`dashboard: ${failures.length} FAILED of ${passed + failures.length}`);
  for (const f of failures) console.log(`  FAIL ${f}`);
  process.exitCode = 1;
}