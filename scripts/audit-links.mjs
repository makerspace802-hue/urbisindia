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

if (findings.length > 0) {
  console.log(`links: ${findings.length} dead end(s) of ${checked} destinations`);
  for (const finding of findings) console.log(`  DEAD ${finding}`);
  process.exitCode = 1;
} else {
  console.log(
    `links: ${checked} internal destinations all resolve to a declared route`,
  );
}