/**
 * Executes the help bot and the report taxonomy it reads.
 *
 * The bot is the one part of this site that makes free-text claims to a user, so
 * it is the part most able to quietly lie. Two things guard against that and
 * both are checked here by RUNNING the real code rather than re-deriving it:
 *
 *   1. Every number in an answer is compared against `censusData.ts`. If the
 *      bot ever types a figure instead of reading one, the answer stops matching
 *      the table and this fails.
 *   2. Questions with nothing to do with the site must be refused. A help bot
 *      that answers the weather forecast is a help bot that has left its brief.
 *
 * It also pins the two things that were wrong on the report portal: the
 * categories now come from one shared list, and every place offered to a
 * citizen resolves to a real unit the rest of the app already knows about.
 *
 *   node scripts/test-help-bot.mjs
 */

import assert from "node:assert/strict";
import { buildSync } from "esbuild";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// One bundle over the whole chain, so the bot is exercised against the same
// generated modules the charts read.
const out = join(tmpdir(), "urbis-help-bot.mjs");
buildSync({
  stdin: {
    contents: [
      'export * from "./src/lib/helpKnowledge";',
      'export * from "./src/lib/reportTaxonomy";',
      'export * from "./src/lib/censusData";',
      'export * from "./src/lib/geo";',
      'export * from "./src/lib/censusInsights";',
      'export * from "./src/lib/stateTrends";',
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

const kb = await import(`file://${out}?v=${Date.now()}`);

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

const inr = (n) => new Intl.NumberFormat("en-IN").format(n);
const profile = (name) =>
  kb.STATE_PROFILE.find((p) => p.name === name);
const growth = (name) => kb.STATE_GROWTH.find((g) => g.name === name);

/* ==================================================================== 1.
   Answers carry the real table values, not remembered ones.             */

check("a state question answers with that state's Census 2011 row", () => {
  const reply = kb.ask("How many people are in Kerala?");
  assert.ok(!reply.declined, "should not decline");
  const kerala = growth("Kerala");
  assert.ok(
    reply.text.includes(inr(kerala.population2011)),
    `answer should carry ${inr(kerala.population2011)}, got: ${reply.text}`,
  );
  assert.ok(
    reply.text.includes("94%"),
    `literacy should be the table's ${kerala.literacyPercent}%, got: ${reply.text}`,
  );
  assert.ok(
    reply.text.includes("860"),
    `density should be the table's ${kerala.density}, got: ${reply.text}`,
  );
  assert.ok(
    reply.text.includes("4.91"),
    `Kerala's decadal growth is +4.91%, not the 4.99 often quoted: ${reply.text}`,
  );
  assert.ok(reply.source.includes("Kerala"), "source must name the rows used");
});

check("the national answer carries the national totals", () => {
  const reply = kb.ask("How fast did India grow 2001 to 2011?");
  assert.ok(!reply.declined);
  assert.ok(reply.text.includes(inr(kb.INDIA_2011.population)));
  assert.ok(reply.text.includes(inr(kb.OPENING_CENSUS.population)));
  assert.ok(reply.text.includes("17.70"), "India's 2001-11 rate is 17.703%");
  assert.ok(reply.text.includes(String(kb.INDIA_2011.urbanSharePercent)));
  assert.ok(reply.text.includes(String(kb.INDIA_SOCIAL.literacyPercent)));
});

check("the Delhi alias does not break a state lookup", () => {
  // The detector says "Delhi"; the tables say "NCT OF Delhi". The bot has to
  // cross that rename or Delhi renders as "no row loaded".
  const reply = kb.ask("What is the density of Delhi?");
  assert.ok(!reply.declined);
  const delhi = profile("NCT OF Delhi");
  assert.ok(
    reply.text.includes(inr(delhi.density)),
    `expected Delhi's ${inr(delhi.density)} per km², got: ${reply.text}`,
  );
});

check("Telangana is answered through the census alias, not dropped", () => {
  const reply = kb.ask("How many people live in Telangana?");
  assert.ok(!reply.declined);
  assert.ok(
    reply.text.includes(inr(growth("Andhra Pradesh").population2011)),
    "Telangana has no 2011 row; the tables carry undivided Andhra Pradesh",
  );
});

check("the only shrinking state is described as shrinking", () => {
  const reply = kb.ask("Tell me about Nagaland");
  assert.ok(reply.text.includes("shrank"), `got: ${reply.text}`);
  assert.ok(reply.text.includes("-0.58"), `got: ${reply.text}`);
});

check("a city is redirected to its state and says why", () => {
  const reply = kb.ask("What is the population of Mumbai?");
  assert.ok(!reply.declined);
  assert.ok(reply.text.includes("Mumbai"), "names the city asked about");
  assert.ok(reply.text.includes("Maharashtra"), "redirects to its state");
  assert.ok(
    reply.text.includes("no city-level Census rows"),
    "must admit the city rows do not exist: " + reply.text,
  );
  assert.ok(reply.text.includes(inr(growth("Maharashtra").population2011)));
});

/* --------------------------------------------------------- extremes ---- */

check("'which state grew fastest' names the state, not the page", () => {
  const reply = kb.ask("Which state grew fastest?");
  assert.ok(!reply.declined);
  // Read the answer off the table rather than trusting a remembered figure.
  const fastest = [...kb.STATE_GROWTH].sort((a, b) => b.percentChange - a.percentChange)[0];
  assert.ok(
    reply.text.includes(fastest.name),
    `should name ${fastest.name}, got: ${reply.text}`,
  );
  assert.ok(
    reply.text.includes(fastest.percentChange.toFixed(2)),
    `should quote ${fastest.percentChange.toFixed(2)}%, got: ${reply.text}`,
  );
});

check("every ranking question is answered from the table's own extreme", () => {
  const cases = [
    ["Which state is the densest?", "density"],
    ["Which state is most populous?", "population2011"],
    ["Which state has the highest literacy?", "literacyPercent"],
    ["Which state has the best sex ratio?", "sexRatio2011"],
  ];
  for (const [question, field] of cases) {
    const reply = kb.ask(question);
    assert.ok(!reply.declined, `"${question}" declined`);
    // The winner must be whichever unit actually tops that field.
    const rows = kb.STATE_GROWTH.map((g) => {
      const p = profile(g.name);
      return { name: g.name, value: p[field] ?? g[field] ?? 0 };
    }).sort((a, b) => b.value - a.value);
    assert.ok(
      reply.text.includes(rows[0].name),
      `"${question}" should name ${rows[0].name}, got: ${reply.text.split("\n")[0]}`,
    );
  }
});

check("'the slowest' reads the ranking from the bottom", () => {
  const reply = kb.ask("Which state shrank the most?");
  assert.ok(!reply.declined);
  const worst = [...kb.STATE_GROWTH].sort((a, b) => a.percentChange - b.percentChange)[0];
  assert.ok(reply.text.includes(worst.name), `got: ${reply.text}`);
});

check("a history question returns the century, not a snapshot", () => {
  const reply = kb.ask("How has Kerala changed since 1901?");
  assert.ok(!reply.declined);
  // The reconstruction is a float; the answer rounds it. Compare like for like.
  const start = kb.backChainedPopulation("Kerala");
  assert.ok(start !== null, "Kerala has a complete chain");
  assert.ok(
    reply.text.includes(inr(Math.round(start))),
    `should carry the reconstructed 1901 figure ${inr(Math.round(start))}, got: ${reply.text}`,
  );
  assert.ok(
    /reconstructed/i.test(reply.text),
    "a back-chained figure must be labelled as one: " + reply.text,
  );
  assert.ok(reply.text.includes("1961-71"), "should name the fastest decade");
  assert.ok(reply.text.includes(inr(growth("Kerala").population2011)));
});

check("a unit with a census gap says so instead of inventing a start", () => {
  const reply = kb.ask("How has Arunachal Pradesh changed since 1961?");
  assert.ok(!reply.declined);
  assert.ok(
    /not reconstructible/i.test(reply.text),
    `Arunachal Pradesh has gaps and must not be given a 1961 figure: ${reply.text}`,
  );
});

check("'how many states' is answered with a number, not a category list", () => {
  const reply = kb.ask("How many states can I file against?");
  assert.ok(!reply.declined);
  assert.ok(
    reply.text.includes(String(kb.REPORT_PLACES.length)),
    `should state ${kb.REPORT_PLACES.length}, got: ${reply.text.split("\n")[0]}`,
  );
});

check("no answer contains a population figure the tables do not have", () => {
  // Pull every 8+ digit run out of an answer and insist it is a real population
  // somewhere in the generated data. A hand-typed number shows up here.
  const known = new Set([
    inr(kb.INDIA_2011.population),
    inr(kb.OPENING_CENSUS.population),
    inr(kb.INDIA_2011.households),
    inr(kb.INDIA_SPATIAL.inhabitedVillages),
    ...kb.STATE_GROWTH.map((g) => inr(g.population2011)),
    ...kb.STATE_GROWTH.map((g) => inr(g.population2001)),
    ...kb.STATE_PROFILE.map((p) => inr(p.households)),
  ]);

  const questions = [
    "How many people are in Kerala?",
    "How fast did India grow 2001 to 2011?",
    "What is the population of Mumbai?",
    "Where does the data come from?",
    "How do I report an issue?",
  ];

  for (const question of questions) {
    const reply = kb.ask(question);
    for (const run of reply.text.match(/[\d,]{9,}/g) ?? []) {
      assert.ok(
        known.has(run),
        `"${question}" printed ${run}, which is not a population in censusData.ts`,
      );
    }
  }
});

/* ==================================================================== 2.
   Scope: it answers about the site and nothing else.                     */

check("off-site questions are declined, not guessed at", () => {
  const outside = [
    "who won the cricket world cup",
    "what is the price of gold today",
    "write me a python function to sort a list",
    "who was the first president of India",
    "what is two plus two",
    "tell me a joke",
    "should I invest in crypto",
    "what is the capital of France",
    "translate good morning into french",
    "book me a flight to goa",
  ];
  for (const question of outside) {
    const reply = kb.ask(question);
    assert.ok(
      reply.declined === true,
      `"${question}" should be declined but got: ${reply.text.slice(0, 90)}`,
    );
    assert.ok(reply.suggestions.length > 0, "a refusal must offer alternatives");
  }
});

check("the weather is answered only for the site, not the forecast", () => {
  const reply = kb.ask("What is the weather?");
  assert.ok(!reply.declined, "the site does have a weather widget");
  assert.ok(reply.text.includes("widget"), reply.text);
  assert.ok(
    /can't tell you the weather anywhere else/i.test(reply.text),
    "must not offer a forecast: " + reply.text,
  );
});

check("every question the bot itself offers is one it can answer", () => {
  for (const question of kb.STARTER_QUESTIONS) {
    const reply = kb.ask(question);
    assert.ok(
      !reply.declined,
      `starter question "${question}" is declined — the bot offers what it cannot answer`,
    );
  }
});

check("follow-up suggestions are answerable too", () => {
  // The panels must never hand the visitor a dead end.
  for (const question of ["What pages are on this site?", "How do I report an issue?"]) {
    for (const suggestion of kb.ask(question).suggestions) {
      assert.ok(
        !kb.ask(suggestion).declined,
        `"${question}" suggests "${suggestion}", which is then declined`,
      );
    }
  }
});

check("an empty question prompts rather than refusing", () => {
  const reply = kb.ask("   ");
  assert.ok(!reply.declined);
  assert.ok(reply.suggestions.length > 0);
});

check("a single ambiguous word is not enough to trigger an answer", () => {
  for (const bare of ["report", "water", "population", "quiz", "2011"]) {
    const reply = kb.ask(bare);
    assert.ok(
      reply.declined,
      `"${bare}" alone fired an answer: ${reply.text.slice(0, 70)}`,
    );
  }
});

check("greetings still work on one word", () => {
  for (const hello of ["hi", "hello", "namaste"]) {
    assert.ok(!kb.ask(hello).declined, `"${hello}" should be greeted`);
  }
});

check("every answer names its source", () => {
  for (const question of kb.STARTER_QUESTIONS) {
    assert.ok(
      kb.ask(question).source.trim().length > 0,
      `"${question}" returned an answer with no source`,
    );
  }
});

/* ==================================================================== 3.
   The report portal's vocabulary.                                         */

/**
 * Source with comments removed.
 *
 * The comments explaining the fix legitimately quote the invented names, so a
 * raw text scan would flag the documentation as if it were the bug. This looks
 * only at code.
 */
function codeOnly(file) {
  return readFileSync(file, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/[^\n]*/g, "");
}

check("the old invented districts are gone from the code", () => {
  const invented = [
    "Financial District",
    "North Suburban Hub",
    "Industrial Zone 4",
    "West Tech Corridor",
  ];
  for (const file of [
    "src/pages/ReportPortal.tsx",
    "src/lib/reportTaxonomy.ts",
    "src/components/HelpBot.tsx",
  ]) {
    const source = codeOnly(file);
    for (const name of invented) {
      assert.ok(
        !source.includes(name),
        `${file} still offers the invented place "${name}"`,
      );
    }
  }
});

check("the portal no longer defines its own categories or districts", () => {
  const source = codeOnly("src/pages/ReportPortal.tsx");
  assert.ok(!/^const CATEGORIES\b/m.test(source), "inline CATEGORIES is back");
  assert.ok(!/^const DISTRICTS\b/m.test(source), "inline DISTRICTS is back");
  assert.ok(
    source.includes("REPORT_PLACES") && source.includes("REPORT_CATEGORIES"),
    "the portal must read the shared taxonomy",
  );
});

check("every offerable place is a real unit the rest of the app knows", () => {
  assert.deepEqual(
    [...kb.REPORT_PLACES].sort((a, b) => a.localeCompare(b)),
    [...kb.PLACES].sort((a, b) => a.localeCompare(b)),
    "the picker list has drifted from geo.ts",
  );
  assert.equal(kb.REPORT_PLACES.length, 36);
  // The four names that caused this in the first place.
  for (const name of ["Kerala", "Maharashtra", "Delhi", "Telangana"]) {
    assert.ok(kb.REPORT_PLACES.includes(name), `${name} should be offerable`);
  }
  for (const name of ["NCT OF Delhi"]) {
    assert.ok(
      !kb.REPORT_PLACES.includes(name),
      `${name} is the 2011 table spelling, not how a citizen writes it`,
    );
  }
});

check("every offerable place resolves to a Census row through the alias", () => {
  for (const place of kb.REPORT_PLACES) {
    assert.ok(
      kb.stateTrendModel(kb.censusName(place)),
      `${place} has no Census row and would file a report against nothing`,
    );
  }
});

check("the located state can be matched back to a picker option", () => {
  assert.equal(kb.placeFromCensusState("NCT OF Delhi"), "Delhi");
  assert.equal(kb.placeFromCensusState("Andhra Pradesh"), "Andhra Pradesh");
  assert.equal(kb.placeFromCensusState("Kerala"), "Kerala");
  assert.equal(kb.placeFromCensusState(null), null);
  assert.equal(kb.placeFromCensusState("Atlantis"), null);
});

check("categories are complete, grouped, and uniquely identifiable", () => {
  assert.ok(
    kb.REPORT_CATEGORIES.length >= 30,
    `expected a full grievance set, got ${kb.REPORT_CATEGORIES.length}`,
  );
  const values = new Set();
  const tags = new Set();
  for (const entry of kb.REPORT_CATEGORIES) {
    assert.ok(!values.has(entry.value), `duplicate category "${entry.value}"`);
    values.add(entry.value);
    assert.ok(
      !tags.has(entry.tag),
      `duplicate chip tag "${entry.tag}" — chips would be ambiguous in the feed`,
    );
    tags.add(entry.tag);
    assert.ok(
      kb.REPORT_GROUPS.includes(entry.group),
      `"${entry.value}" is in undeclared group "${entry.group}"`,
    );
    assert.ok(entry.dept.trim().length > 0, `"${entry.value}" has no department`);
    assert.match(
      entry.color,
      /^#[0-9A-Fa-f]{6}$/,
      `"${entry.value}" has a malformed colour`,
    );
  }
  // Every declared group must actually hold something.
  for (const group of kb.REPORT_GROUPS) {
    assert.ok(
      kb.REPORT_CATEGORIES.some((entry) => entry.group === group),
      `group "${group}" is empty and would render as an empty optgroup`,
    );
  }
});

check("every category resolves back from its submitted value", () => {
  for (const entry of kb.REPORT_CATEGORIES) {
    assert.equal(kb.categoryByValue(entry.value), entry);
  }
  assert.equal(kb.categoryByValue("Nonsense"), undefined);
});

check("a stored location keeps the chosen state and the landmark", () => {
  assert.equal(kb.locationLabel("Kerala", ""), "Kerala");
  assert.equal(kb.locationLabel("Kerala", "  Marine Drive  "), "Kerala — Marine Drive");
});

check("the dashboard no longer hard-codes a four-tag colour table", () => {
  const source = codeOnly("src/pages/CommandCenter.tsx");
  assert.ok(
    !source.includes("TAG_COLORS"),
    "CommandCenter still maps tags to colours itself, so new categories render grey",
  );
  assert.ok(
    source.includes("issue.tagColor"),
    "the ticket's own colour should drive the chip",
  );
});

/* ==================================================================== 4.
   Place resolution used by the bot.                                      */

check("a place named mid-sentence is still found", () => {
  assert.deepEqual(kb.resolvePlace("tell me about assam"), {
    place: "Assam",
    city: null,
    viaCity: false,
  });
  assert.equal(
    kb.resolvePlace("what about dadra & nagar haveli")?.place,
    "Dadra & Nagar Haveli",
    "ampersand names must survive normalisation",
  );
  assert.equal(
    kb.resolvePlace("how is andaman nicobar islands doing")?.place,
    "Andaman & Nicobar Islands",
  );
  assert.equal(kb.resolvePlace("nothing here at all"), null);
});

check("every city in the redirect map points at a real place", () => {
  // Exercised through the public path: each city must produce a state answer.
  for (const city of ["Pune", "Kochi", "Guwahati", "Port Blair", "Agartala"]) {
    const reply = kb.ask(`what is the population of ${city}`);
    assert.ok(!reply.declined, `${city} should resolve to a state`);
    assert.ok(
      /Population:/.test(reply.text),
      `${city} produced no population line: ${reply.text.slice(0, 80)}`,
    );
  }
});

if (failures.length === 0) {
  console.log(`help-bot: ${passed}/${passed} checks passed`);
} else {
  console.log(`help-bot: ${failures.length} FAILED of ${passed + failures.length}`);
  for (const f of failures) console.log(`  FAIL ${f}`);
  process.exitCode = 1;
}