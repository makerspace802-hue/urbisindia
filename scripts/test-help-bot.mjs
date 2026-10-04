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
      'export * from "./src/lib/typewriter";',
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

check("the ticket chip still reads the ticket's own colour, wherever it lives", () => {
  // This check moved with the ticket UI: the public dashboard feed was removed
  // and the admin desk on the profile page is now the only place a ticket is
  // rendered. The original bug — a hard-coded four-tag table greying out every
  // category added later — must not simply reappear in the new file.
  const dashboard = codeOnly("src/pages/CommandCenter.tsx");
  const desk = codeOnly("src/components/AdminTicketDesk.tsx");

  assert.ok(
    !dashboard.includes("TAG_COLORS"),
    "CommandCenter still maps tags to colours itself",
  );
  assert.ok(
    !dashboard.includes("listIssues"),
    "the public dashboard must not query the ticket feed any more",
  );
  assert.ok(
    !desk.includes("TAG_COLORS"),
    "AdminTicketDesk still maps tags to colours itself, so new categories render grey",
  );
  assert.ok(
    desk.includes("report.tagColor"),
    "the ticket's own colour should drive the chip",
  );
});

check("reports are private: no public feed, and the desk is admin-gated twice", () => {
  // Reports name a place and can carry a photo of it, so the feed that used to
  // sit on the public portal is gone. The replacement is admin-only both in the
  // UI (rendered only behind isAdmin on the profile page) and on the server.
  const portal = codeOnly("src/pages/ReportPortal.tsx");
  assert.ok(
    !portal.includes("listIssues") && !portal.includes("imageUrls"),
    "the report portal must not read or render any ticket feed",
  );
  assert.ok(
    !portal.includes("resolveIssue") && !portal.includes("Resolve Ticket"),
    "resolve controls must not be reachable from the public portal",
  );

  const server = codeOnly("src/convex/admin.ts");
  for (const fn of ["listAllIssues", "adminImageUrls"]) {
    const body = server.slice(server.indexOf(`export const ${fn}`));
    const start = body.indexOf("handler");
    assert.ok(
      body.slice(start, start + 220).includes("requireAdminEmail"),
      `${fn} must call requireAdminEmail in its handler, not just in the UI`,
    );
  }
  assert.ok(
    server.includes("purgeAllIssues"),
    "the wipe used to clear the table should remain available to an admin",
  );

  // And the desk must only ever be mounted from the admin-gated branch.
  const profile = codeOnly("src/pages/Dashboard.tsx");
  assert.match(
    profile,
    /\{isAdmin && <AdminTicketDesk \/>\}/,
    "the ticket desk must be mounted only behind the isAdmin gate",
  );
});

check("there is exactly one admin, and it is the address the owner chose", () => {
  const identity = readFileSync("src/convex/identity.ts", "utf8");
  for (const revoked of [
    "makerspace802@gmail.com",
    "makpratyushdhote20@gmail.com",
  ]) {
    assert.ok(
      !identity.includes(revoked),
      `${revoked} is still seeded in identity.ts`,
    );
  }

  const seeds = identity.match(/SEED_ADMIN_EMAILS = \[([^\]]*)\]/)[1];
  const addresses = seeds.match(/"([^"]+)"/g).map((e) => e.slice(1, -1));
  assert.deepEqual(
    addresses,
    ["pratyushdhote20@gmail.com"],
    "the seeded admin list must be exactly the owner's address and nothing else",
  );
  // A seed with a space, or without an @, can never match a real account, and
  // the symptom is an admin desk nobody can see.
  for (const email of addresses) {
    assert.ok(
      !/\s/.test(email) && email.includes("@"),
      `"${email}" is not a usable email address`,
    );
  }
});

check("email is the only route to admin", () => {
  // A second path to admin defeats the point of having one, so this pins both
  // that the old `role` fallback is gone and that nothing can mint an admin.
  const identity = readFileSync("src/convex/identity.ts", "utf8");
  const admin = readFileSync("src/convex/admin.ts", "utf8");

  // `purgeOtherAdmins` is the one legitimate reader, and it only clears.
  const checks = identity.match(/role === "admin"/g) ?? [];
  assert.ok(
    checks.length <= 1,
    "the users.role admin fallback has been reintroduced",
  );
  assert.ok(
    /grantAdminByEmail = mutation/.test(identity) === false,
    "a mutation that can grant admin to a second account still exists",
  );
  assert.ok(
    /export const grantAdmin = mutation/.test(admin) === false,
    "admin.grantAdmin can still mint a second admin",
  );
  // Revoking is no longer a guarded operation, because it is no longer an
  // operation. `revokeAdminByEmail` and `purgeOtherAdmins` used to be required
  // by this check: it demanded a way to strip admin from other accounts, which
  // is precisely the runtime mutability that has since been removed. The admin
  // set now comes from SEED_ADMIN_EMAILS alone, so the correct assertion is
  // the opposite of what was here — neither may exist, and nothing may read
  // the grant table.
  for (const gone of ["revokeAdminByEmail", "purgeOtherAdmins"]) {
    assert.ok(
      new RegExp(`export const ${gone} = mutation`).test(identity) === false,
      `${gone} is back; the admin set must only change by editing the seed`,
    );
  }
  assert.ok(
    /ctx\.db\.query\("adminGrants"\)/.test(identity) === false,
    "identity.ts reads adminGrants again, so admin is a stored value",
  );
});

check("the bot no longer promises a public feed", () => {
  for (const question of ["how do i report an issue", "what pages are on this site"]) {
    const reply = kb.ask(question);
    assert.ok(!reply.declined, `refused "${question}"`);
    assert.ok(
      // A statement that reports are *not* published is the point, so match
      // only affirmative claims that a report is visible to everyone.
      !/(appears? in the public|anyone can upvote|is published on a public|visible to everyone)/i.test(
        reply.text,
      ),
      `the bot still tells visitors their report is published: ${reply.text.slice(0, 120)}`,
    );
    assert.ok(
      /not published|privately|read privately/i.test(reply.text),
      `the bot should say reports are private: ${reply.text.slice(0, 120)}`,
    );
  }
  // And the route blurb must not advertise tracking an upvote count either.
  for (const page of kb.SITE_PAGES) {
    if (page.route === "/report") {
      assert.ok(
        !/track the ticket/i.test(page.blurb),
        "the report page still advertises public ticket tracking",
      );
    }
  }
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

check("questions about getting around the site are answered, not refused", () => {
  // Regression: "how do i navigate through the website" scored a single point
  // against the two-point bar and was refused, even though navigation is
  // exactly what the pages intent answers.
  const navigation = [
    "how do i navigate through the website",
    "how do I navigate the site",
    "how can i navigate",
    "how do i get around the site",
    "how do i move around this website",
    "how do i find my way around here",
    "where do i go",
    "whats the menu",
    "list the routes",
  ];
  for (const question of navigation) {
    const reply = kb.ask(question);
    assert.ok(
      !reply.declined,
      `refused a navigation question: "${question}"`,
    );
    // And it must answer with the real routes, not some other intent.
    for (const page of kb.SITE_PAGES) {
      assert.ok(
        reply.text.includes(page.route),
        `"${question}" answered without listing ${page.route}`,
      );
    }
  }
});

check("lowering the bar for navigation did not let anything else through", () => {
  // The pages intent now clears on one keyword, so the off-site guard is the
  // thing standing between a visitor and a confident wrong answer.
  for (const question of [
    "who won the cricket match",
    "translate good morning into french",
    "what should i eat for dinner",
    "what is the price of gold",
  ]) {
    const reply = kb.ask(question);
    assert.ok(
      reply.declined,
      `answered something off-site: "${question}"`,
    );
  }
});

check("a navigation word cannot smuggle the bot into inventing content", () => {
  // "Navigate to a PDF of my bank statement" contains a navigation keyword, so
  // it reaches the pages intent. That is acceptable only because the answer is
  // the real route list — what must never happen is a bot claiming to hold
  // something it does not.
  const reply = kb.ask("navigate to a pdf of my bank statement");
  assert.ok(
    !/bank statement|statement|pdf|download/i.test(reply.text),
    "it must not pretend to hold a document it does not have",
  );
  for (const page of kb.SITE_PAGES) {
    assert.ok(
      reply.text.includes(page.route),
      "anything it does answer must be the real site contents",
    );
  }
});

check("the weather answer explains the widget without forecasting", () => {
  // This one is deliberately answered rather than refused: the widget is on
  // site. But it must hand back no forecast and no figure for anywhere else,
  // which is the line a helpful-sounding bot would be tempted to cross.
  const reply = kb.ask("what is the weather in mumbai tomorrow");
  assert.ok(!reply.declined, "the widget is on site, so it should answer");
  assert.match(reply.text, /can't tell you the weather/i);
  assert.match(reply.text, /can't forecast/i);
  assert.ok(
    !/\d+\s*(°|degrees)/.test(reply.text),
    "it must not quote a temperature it does not have",
  );
});

check("the bot never leaves a second hidden copy of an answer in the DOM", () => {
  const source = codeOnly("src/components/HelpBot.tsx");
  // `sr-only` clips rather than removes, so a permanent hidden copy would stay
  // selectable and every copied reply would come out duplicated. The full text
  // must therefore live inside the isTyping branch, with a plain fallback.
  const branch = source.indexOf("{isTyping(message) ? (");
  assert.ok(branch !== -1, "the reveal must branch on isTyping");
  const srOnly = source.indexOf('className="sr-only"', branch);
  assert.ok(
    srOnly > branch,
    "the sr-only full-text copy must sit inside the isTyping branch",
  );
  // Past the sr-only copy there must be a plain-text fallback, not a second
  // unconditional render of message.text.
  const tail = source.slice(srOnly, srOnly + 900);
  assert.match(
    tail,
    /\)\s*:\s*\(?\s*message\.text\s*\)?\s*\)/,
    "the non-typing branch must render message.text once, plainly",
  );
});

check("no real answer takes long enough to lose the reader", () => {
  // Measured against the real answers, punctuation pauses included. An earlier
  // fixed rate took 17s on the longest one, which fails this.
  for (const question of kb.STARTER_QUESTIONS) {
    const text = kb.ask(question).text;
    let shown = 0;
    let ms = 0;
    let guard = 0;
    while (shown < text.length) {
      const step = kb.revealStep(text, shown);
      ms += step.delay;
      shown = step.shown;
      if (++guard > text.length + 10) assert.fail("never terminated");
    }
    assert.ok(
      ms <= 8000,
      `"${question}" would take ${(ms / 1000).toFixed(1)}s to type out`,
    );
    // And not so fast that it reads as one block appearing.
    assert.ok(ms >= 1200, `"${question}" types in under a second and reads as instant`);
  }
});

check("the typewriter reveal is monotonic and terminates", () => {
  for (const question of kb.STARTER_QUESTIONS) {
    const text = kb.ask(question).text;
    let shown = 0;
    let guard = 0;
    for (;;) {
      const step = kb.revealStep(text, shown);
      assert.ok(
        step.shown >= shown,
        `"${question}" went backwards: ${shown} -> ${step.shown}`,
      );
      assert.ok(
        step.shown <= text.length,
        `"${question}" overshot: ${step.shown} > ${text.length}`,
      );
      assert.ok(step.delay >= 0, "a step had a negative delay");
      shown = step.shown;
      if (step.done) break;
      // A reveal that never terminates would hang the panel forever.
      if (++guard > text.length + 10) {
        assert.fail(`"${question}" never finished revealing`);
      }
    }
    assert.equal(shown, text.length, `"${question}" did not land its last character`);
  }
});

check("the reveal slows at sentence ends and line breaks", () => {
  // The pause keys off the character just revealed, so stepping past the
  // punctuation at index 3 is what carries it: shown 0 -> 4 on "One. Two".
  const flat = kb.revealStep("a b c d e f g h", 0).delay;
  const stopped = kb.revealStep("One. Two", 3).delay;
  const broken = kb.revealStep("One\nTwo", 3).delay;
  const clause = kb.revealStep("One, Two", 3).delay;
  assert.ok(stopped > flat, "a full stop should pause longer than a plain character");
  assert.ok(broken > flat, "a line break should pause longer than a plain character");
  assert.ok(
    clause < stopped,
    "a comma should be a shorter breath than a full stop",
  );
  assert.equal(kb.pauseAfter("word.", 5), kb.SENTENCE_PAUSE_MS);
  assert.equal(kb.pauseAfter("word,", 5), kb.CLAUSE_PAUSE_MS);
  assert.equal(kb.pauseAfter("wordx", 5), 0, "an ordinary character should not pause");
});

check("revealing a finished or empty answer is a no-op", () => {
  assert.deepEqual(kb.revealStep("abc", 3), { shown: 3, delay: 0, done: true });
  assert.deepEqual(kb.revealStep("abc", 99), { shown: 3, delay: 0, done: true });
  assert.deepEqual(kb.revealStep("", 0), { shown: 0, delay: 0, done: true });
  assert.ok(kb.revealStep("", 0).done, "an empty answer must not leave a caret running");
});

check("the bot streams only its own answers", () => {
  const source = codeOnly("src/components/HelpBot.tsx");
  // A visitor's own message must appear the instant they send it. Matched
  // across line breaks, because the guard is written one clause per line.
  assert.match(
    source,
    /const isTyping = \(message: Message\) =>\s*message\.from === "urbis" &&/,
    "the reveal must be gated on the answer being from the bot",
  );
  assert.match(
    source,
    /revealing\?\.id === message\.id &&\s*revealing\.shown < message\.text\.length/,
    "the reveal must be gated on the answer being the one currently arriving",
  );
  assert.ok(
    source.includes("prefers-reduced-motion"),
    "the reveal must respect prefers-reduced-motion",
  );
  assert.ok(
    /aria-hidden="true"/.test(source) && source.includes("sr-only"),
    "the animated slice must be hidden from assistive tech while the full text stays available",
  );
});

if (failures.length === 0) {
  console.log(`help-bot: ${passed}/${passed} checks passed`);
} else {
  console.log(`help-bot: ${failures.length} FAILED of ${passed + failures.length}`);
  for (const f of failures) console.log(`  FAIL ${f}`);
  process.exitCode = 1;
}