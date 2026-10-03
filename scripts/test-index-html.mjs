/**
 * Checks index.html metadata against the files that actually exist.
 *
 * The OG and favicon tags point at assets in `public/`. A tag referencing a file
 * that was never generated is a silent 404 in a social preview, which never
 * shows up in a type check or a lint run. This asserts every referenced local
 * asset is present, and that the placeholder origin has not been half-swapped.
 *
 *   node scripts/test-index-html.mjs
 */

import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const html = readFileSync("index.html", "utf8");

let failures = 0;
const fail = (message) => {
  console.log(`FAIL ${message}`);
  failures++;
};

/* 1. Every local asset referenced by the head must exist. */
const assetRefs = [
  ...html.matchAll(/(?:href|content)=\"\/(?![\w-]*\/\/)((?:[\w.-]+\.(?:png|svg|ico|webmanifest)))\"/g),
].map((m) => m[1]);

if (assetRefs.length === 0) fail("no local asset references found — the matcher may be stale");

for (const asset of new Set(assetRefs)) {
  if (!existsSync(`public/${asset}`)) {
    fail(`index.html references /${asset} but public/${asset} does not exist`);
  }
}

/* 2. The favicon set the brief asked for must be present. */
for (const required of ["favicon-16.png", "favicon-32.png", "apple-touch-icon.png", "og-image.png", "logo.svg"]) {
  if (!existsSync(`public/${required}`)) fail(`missing generated asset public/${required}`);
}

/* 3. Required metadata must be present. */
const REQUIRED_META = [
  "<title>",
  'name="description"',
  'rel="canonical"',
  'property="og:title"',
  'property="og:description"',
  'property="og:image"',
  'name="twitter:card"',
  'application/ld+json',
  'name="theme-color"',
];

for (const tag of REQUIRED_META) {
  if (!html.includes(tag)) fail(`index.html is missing ${tag}`);
}

/* 4. Every absolute URL must share one origin. A half-replaced placeholder
 *    would leave og:image pointing somewhere the canonical does not. */
const origins = new Set(
  [...html.matchAll(/https:\/\/([\w.-]+\.[a-z]{2,})/g)].map((m) => m[1]),
);
// Vocabulary and tooling hosts are not deployment origins.
const NOT_SITE = /(^|\.)(schema\.org|w3\.org|shadcn\.com|githubusercontent\.com|freebuff\.com|json-schema\.org)$/;
const site = [...origins].filter((o) => !NOT_SITE.test(o));

if (site.length > 1) {
  fail(`index.html mixes multiple site origins: ${site.join(", ")}`);
}
if (site.length === 1) {
  const origin = site[0];
  // Only assert on the site origin; third-party/schema URLs are excluded above.
  const refs = [...html.matchAll(new RegExp(`https://${origin}[^"'\`]*`, "g"))].map((m) => m[0]);
  const allSlashed = refs.every((r) => r.endsWith("/") || /\.(png|svg|webmanifest|json)$/.test(r));
  if (!allSlashed) fail(`origin ${origin} is used inconsistently across tags`);
  console.log(`note: absolute URLs use the placeholder origin "${origin}"`);
  console.log("      confirm this matches the real deployment, or social previews will 404");
}

if (failures === 0) {
  console.log(`index.html: ${new Set(assetRefs).size} asset refs + ${REQUIRED_META.length} metadata checks passed`);
} else {
  console.log(`index.html: ${failures} check(s) failed`);
  process.exitCode = 1;
}