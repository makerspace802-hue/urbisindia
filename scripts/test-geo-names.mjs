/**
 * Cross-checks the location-to-chart path.
 *
 * `geo.ts` decides which Census row to show from a set of hand-written state
 * names, while `censusData.ts` is generated from the uploaded tables. Nothing in
 * the type system ties those two lists together: if a name drifts, the charts
 * silently fall back to showing nothing for that state, with no error anywhere.
 * This asserts every name the geolocation module can produce actually exists in
 * the generated data, after the Census aliases are applied.
 *
 *   node scripts/test-geo-names.mjs
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/** Pull the literal keys out of a TypeScript source without importing it. */
function objectKeys(source, marker) {
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `marker ${marker} not found`);
  const open = source.indexOf("{", start);
  let depth = 0;
  let end = open;
  for (let i = open; i < source.length; i++) {
    if (source[i] === "{") depth++;
    else if (source[i] === "}") {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  const body = source.slice(open, end);
  return [
    ...body.matchAll(/(?:^|[\s,{])(?:\"([^\"]+)\"|([A-Za-z][\w &-]*?))\s*:\s*\[/g),
  ]
    .map((m) => m[1] ?? m[2])
    .filter(Boolean);
}

const geo = readFileSync("src/lib/geo.ts", "utf8");
const data = readFileSync("src/lib/censusData.ts", "utf8");

/** Names `geo.ts` can emit, straight out of its BOXES map. */
const boxes = objectKeys(geo, "const BOXES");
/** Aliases applied before a name is looked up in the Census tables. */
const aliasBlock = geo.slice(geo.indexOf("const ALIASES"));
const aliases = Object.fromEntries(
  [...aliasBlock.matchAll(/\"?([\w &-]+)\"?\s*:\s*\"([^\"]+)\"/g)].map((m) => [
    m[1].trim(),
    m[2],
  ]),
);

/** Every distinct state name in the generated data. */
const dataNames = new Set(
  [...data.matchAll(/\{ name: \"([^\"]+)\"/g)].map((m) => m[1]),
);

const missing = [];
for (const box of boxes) {
  const resolved = aliases[box] ?? box;
  if (!dataNames.has(resolved)) {
    missing.push(`${box} -> ${resolved}`);
  }
}

console.log(`geo.ts exposes ${boxes.length} state names`);
console.log(`censusData.ts carries ${dataNames.size} distinct names`);
console.log(`aliases in play: ${JSON.stringify(aliases)}`);

if (missing.length === 0) {
  console.log("every geolocation name resolves to a generated Census row");
} else {
  console.log(`FAIL — ${missing.length} name(s) would render an empty chart:`);
  for (const m of missing) console.log(`  ${m}`);
  process.exitCode = 1;
}