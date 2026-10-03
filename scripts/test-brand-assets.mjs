/**
 * Pixel checks for the generated brand assets.
 *
 * A preview that renders a dark background as bright is either an encoder bug
 * or a decoder bug, and guessing which one costs more time than this test. These
 * assertions pin exact brand colours at known coordinates, so a regression in
 * either the encoder or the generator is caught immediately.
 *
 * Run the generator first, then:
 *   node scripts/test-brand-assets.mjs
 */

import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { decodePng } from "./png-preview.mjs";

const INK = [11, 15, 23];
const SHELL = [232, 236, 242];
const CYAN = [6, 182, 212];
const GREEN = [16, 185, 129];
const RED = [244, 63, 94];
const WHITE = [248, 250, 252];

/** Coordinates follow the layout constants in generate-brand-assets.mjs. */
const CASES = [
  ["public/og-image.png", [
    [5, 5, INK, "background"],
    [1195, 625, INK, "background"],
    [472, 265, WHITE, "title glyph crossbar"],
    [500, 312, GREEN, "accent rule"],
    [455, 363, CYAN, "subtitle glyph"],
  ]],
  ["public/apple-touch-icon.png", [
    [3, 3, INK, "background"],
    [176, 176, INK, "background"],
    [90, 123, GREEN, "plinth"],
    [90, 42, RED, "apex beacon"],
    [66, 100, SHELL, "radome shell"],
  ]],
];

let failures = 0;
let checked = 0;

for (const [path, points] of CASES) {
  if (!existsSync(path)) {
    console.log(`FAIL missing ${path} — run: node scripts/generate-brand-assets.mjs`);
    failures++;
    continue;
  }

  const { width, height, px } = decodePng(path);

  for (const [x, y, expected, what] of points) {
    checked++;
    assert.ok(x < width && y < height, `${path}: point (${x},${y}) outside ${width}x${height}`);
    const i = (y * width + x) * 4;
    const actual = [px[i], px[i + 1], px[i + 2]];
    try {
      // Anti-aliasing means edge pixels vary, but interior pixels are exact.
      assert.deepEqual(actual, expected);
    } catch {
      console.log(
        `FAIL ${path} ${what} (${x},${y}) — expected rgb(${expected}), got rgb(${actual})`,
      );
      failures++;
    }
  }
}

if (failures === 0) {
  console.log(`brand assets: ${checked} pixel assertions passed`);
} else {
  console.log(`brand assets: ${failures} of ${checked} assertions failed`);
  process.exitCode = 1;
}