/**
 * Internal link and redirect audit.
 *
 * The public ticket feed was removed and the admin desk moved to the profile
 * page, which is exactly the kind of change that strands a link: a page still
 * points at something that no longer exists, or the bot sends somebody to a
 * route the router does not have. Nothing catches that at build time — a bad
 * `to="/whatever"` is perfectly valid TypeScript — so it is checked here
 * instead, by comparing every destination the app can navigate to against the
 * routes `main.tsx` actually declares.
 *
 *   node scripts/audit-links.mjs
 */

import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = "src";

function walk(dir) {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      return entry === "_generated" ? [] : walk(full);
    }
    return /\.(ts|tsx)$/.test(entry) ? [full] : [];
  });
}

/** Routes the router actually serves. */
const main = readFileSync(join(ROOT, "main.tsx"), "utf8");
const declared = new Set(
  [...main.matchAll(/<Route\s+path="([^"]*)"/g)].map((m) => m[1]),
);
/**
 * A catch-all `*` route exists and renders NotFound, but that makes it useless
 * as evidence of correctness: every typo also "matches" it. So an undeclared
 * destination is always a dead end here, because in the running app it lands a
 * visitor on the 404 page.
 */

/**
 * Every way the app can send a visitor somewhere. Deliberately broad: a route
 * typed into a bot answer, a header tab and a redirect after sign-in are the
 * same class of bug.
 */
const PATTERNS = [
  { name: "Link to", re: /to="(\/[^"]*)"/g },
  { name: "navigate()", re: /navigate\("(\/[^"]*)"\)/g },
  { name: "redirectAfterAuth", re: /redirectAfterAuth="(\/[^"]*)"/g },
  { name: "returnTo", re: /returnTo=(\/[^"']*)/g },
  { name: "bot route", re: /route: "(\/[^"]*)"/g },
];

const findings = [];
let checked = 0;

for (const file of walk(ROOT)) {
  const source = readFileSync(file, "utf8");
  for (const { name, re } of PATTERNS) {
    for (const match of source.matchAll(re)) {
      const raw = match[1];
      const path = raw.split("?")[0].split("#")[0] || "/";
      checked++;
      const resolves = declared.has(path);
      if (!resolves) {
        findings.push(
          `${relative(ROOT, file)}: ${name} "${raw}" has no matching <Route>`,
        );
      }
    }
  }
}

// A signed-in-only destination must still be gated, or signing in would drop
// somebody somewhere they cannot reach.
const requireAuth = readFileSync(join(ROOT, "components/RequireAuth.tsx"), "utf8");
assert.ok(
  /returnTo=\$\{encodeURIComponent\(returnTo\)\}/.test(requireAuth),
  "RequireAuth stopped preserving the requested path through sign-in",
);

const authPage = readFileSync(join(ROOT, "pages/Auth.tsx"), "utf8");
assert.match(
  authPage,
  /returnTo\?\.startsWith\("\/"\) && !returnTo\.startsWith\("\/\/"\)/,
  "Auth must accept only same-site returnTo values, or it is an open redirect",
);

// A failed dynamic import leaves a tab running a stale build, and "try again"
// cannot fix it: React.lazy caches the rejected import, so the retry re-requests
// the same missing chunk forever. Assert the boundary escalates to a reload.
const boundary = readFileSync(join(ROOT, "components/RouteBoundary.tsx"), "utf8");
assert.match(
  boundary,
  /Failed to fetch dynamically imported module/,
  "the error boundary no longer recognises a stale-chunk failure",
);
assert.match(
  boundary,
  /staleChunk[\s\S]{0,400}window\.location\.reload\(\)/,
  "a stale chunk must trigger a document reload, not a state-only retry",
);
assert.match(
  boundary,
  /const staleChunk = isStaleChunkError\(error\)/,
  "the boundary computes staleChunk but never uses it",
);

// Chart discrepancies: Recharts silently drops category ticks and truncates
// long labels rather than erroring, so both are asserted from the real data.
const insights = readFileSync(join(ROOT, "components/CensusInsights.tsx"), "utf8");
const census = readFileSync(join(ROOT, "lib/censusData.ts"), "utf8");

const stateNames = [
  ...new Set(
    [...census.matchAll(/\{ name: "([^"]+)", population2001:/g)].map((m) => m[1]),
  ),
];
assert.ok(stateNames.length >= 35, "could not read the state list from censusData");
const longestName = stateNames.reduce((a, b) => (b.length > a.length ? b : a), "");

// Every state bar needs a legible row: Recharts drops a tick whose band is
// narrower than fontSize + tickMargin. Madhya Pradesh was silently dropped.
const rowHeight = Number(
  /const ROW_HEIGHT = (\d+)/.exec(insights)?.[1] ?? "0",
);
const tickRequirement = 10 + 8; // AXIS_TICK fontSize + Recharts' default tickMargin
assert.ok(
  rowHeight >= tickRequirement,
  `rows are ${rowHeight}px but Recharts needs ${tickRequirement}px before it drops a label`,
);
assert.equal(stateNames.length, 35, "expected all 35 states in the league tables");

// The axis must be wide enough for the longest name or it truncates.
const axisWidth = Number(
  /const AXIS_NAME_WIDTH = (\d+)/.exec(insights)?.[1] ?? "0",
);
const longestNeeded = Math.ceil(longestName.length * 6.6) + 12;
assert.ok(
  axisWidth >= longestNeeded,
  `axis is ${axisWidth}px but "${longestName}" needs ~${longestNeeded}px`,
);

// Both category axes must opt out of tick thinning.
const yAxes = [...insights.matchAll(/<YAxis[\s\S]{0,320}?\/>/g)].map((m) => m[0]);
const categoryAxes = yAxes.filter((a) => a.includes('type="category"'));
assert.equal(categoryAxes.length, 2, "expected two category axes");
for (const axis of categoryAxes) {
  assert.match(axis, /interval=\{0\}/, "a category axis can still drop state labels");
  assert.match(axis, /AXIS_NAME_WIDTH/, "a category axis is not using the shared name width");
}

// Every tooltip must be themed: Recharts' default is grey-on-white, which is
// what made the state name unreadable in the growth table. Scan line-wise
// instead of by regex: the inner `<XTooltip />` contains its own `/>`, so a
// lazy pattern stops in the middle of the element.
const tooltipCount = (insights.match(/<Tooltip\b/g) ?? []).length;
assert.equal(tooltipCount, 4, "expected one tooltip per panel");
const themedTooltipUse = (
  insights.match(/content=\{<\w+Tooltip\s*\/>\}/g) ?? []
).length;
assert.equal(
  themedTooltipUse,
  tooltipCount,
  "a panel is still using Recharts' unthemed default tooltip",
);
// The bar panels additionally must not use the `formatter` prop, which only
// applies to the default tooltip and would silently stop rendering.
const formatterUse = (insights.match(/<Tooltip[\s\S]{0,240}?formatter=/g) ?? [])
  .length;
assert.equal(
  formatterUse,
  0,
  "a themed tooltip was given a `formatter`, which it ignores",
);

if (findings.length > 0) {
  console.log(`links: ${findings.length} dead end(s) of ${checked} destinations`);
  for (const finding of findings) console.log(`  DEAD ${finding}`);
  process.exitCode = 1;
} else {
  console.log(
    `links: ${checked} internal destinations all resolve to a declared route`,
  );
}