/**
 * Brand asset generator — favicons and the Open Graph card.
 *
 * The repo ships a vector logo (`public/logo.svg`) but no raster assets, and
 * index.html needs PNGs for `apple-touch-icon` and a 1200x630 image for social
 * previews. Social crawlers do not render SVG, and iOS ignores an SVG
 * apple-touch-icon, so the references would 404.
 *
 * Rather than add `sharp` as a production dependency purely for a build step,
 * this renders the mark with a tiny built-in rasteriser (Node's zlib is the only
 * thing needed) and writes the PNGs by hand. Everything is drawn at 4x and
 * box-downsampled, which is where the anti-aliasing comes from.
 *
 * Regenerate with:  node scripts/generate-brand-assets.mjs
 */

import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";

/* ------------------------------------------------------------------ *
 * PNG encoding
 * ------------------------------------------------------------------ */

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, "latin1"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([length, body, crc]);
}

/** RGBA pixel buffer -> PNG file bytes. */
export function encodePng(width, height, rgba) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0; // filter type 0 (None)
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: RGBA
  ihdr[10] = 0; // deflate
  ihdr[11] = 0; // adaptive filtering
  ihdr[12] = 0; // no interlace

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/* ------------------------------------------------------------------ *
 * Minimal drawing surface
 * ------------------------------------------------------------------ */

const SS = 4; // supersample factor

export function createCanvas(width, height) {
  const w = width * SS;
  const h = height * SS;
  const buf = new Float32Array(w * h * 4); // straight alpha

  return {
    width,
    height,
    w,
    h,
    buf,

    /**
     * Source-over composite of one supersampled pixel.
     *
     * `color` is 0-255 RGB, matching how the palette below is written, and is
     * normalised to 0-1 on the way in. The buffer is stored normalised so the
     * accumulator maths stays in float; `toPng` converts back.
     */
    blend(x, y, color, a) {
      if (a <= 0 || x < 0 || y < 0 || x >= w || y >= h) return;
      const i = (y * w + x) * 4;
      const dst = buf[i + 3];
      const out = a + dst * (1 - a);
      if (out <= 0) return;
      const keep = (dst * (1 - a)) / out;
      buf[i] = (color[0] / 255) * (a / out) + buf[i] * keep;
      buf[i + 1] = (color[1] / 255) * (a / out) + buf[i + 1] * keep;
      buf[i + 2] = (color[2] / 255) * (a / out) + buf[i + 2] * keep;
      buf[i + 3] = out;
    },

    /** Box-downsample to the output size and encode. */
    toPng() {
      const out = Buffer.alloc(width * height * 4);
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          let r = 0;
          let g = 0;
          let b = 0;
          let a = 0;
          for (let sy = 0; sy < SS; sy++) {
            for (let sx = 0; sx < SS; sx++) {
              const i = ((y * SS + sy) * w + (x * SS + sx)) * 4;
              const alpha = buf[i + 3];
              // Weight colour by alpha so transparent areas do not bleed black.
              r += buf[i] * alpha;
              g += buf[i + 1] * alpha;
              b += buf[i + 2] * alpha;
              a += alpha;
            }
          }
          const n = SS * SS;
          const o = (y * width + x) * 4;
          out[o] = a > 0 ? Math.round((r / a) * 255) : 0;
          out[o + 1] = a > 0 ? Math.round((g / a) * 255) : 0;
          out[o + 2] = a > 0 ? Math.round((b / a) * 255) : 0;
          out[o + 3] = Math.round((a / n) * 255);
        }
      }
      return encodePng(width, height, out);
    },
  };
}

/* ------------------------------------------------------------------ *
 * The mark
 * ------------------------------------------------------------------ */

const INK = [11, 15, 23];
export const INK_RGB = INK;
const SHELL = [232, 236, 242];
const CYAN = [6, 182, 212];
const GREEN = [16, 185, 129];
const RED = [244, 63, 94];

/**
 * Distance from a point to a polyline, and the polyline itself.
 *
 * The logo's meridian ribs are curves with no closed form worth solving here,
 * so they are sampled into short segments and treated as a polyline. At the
 * sizes involved (16px up) the sampling error is far below a pixel.
 */
function polyline(points) {
  return (x, y) => {
    let best = Infinity;
    for (let i = 0; i < points.length - 1; i++) {
      const [x1, y1] = points[i];
      const [x2, y2] = points[i + 1];
      const dx = x2 - x1;
      const dy = y2 - y1;
      const lenSq = dx * dx + dy * dy;
      const t = lenSq === 0 ? 0 : Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / lenSq));
      const px = x1 + t * dx;
      const py = y1 + t * dy;
      const d = Math.hypot(x - px, y - py);
      if (d < best) best = d;
    }
    return best;
  };
}

function line(x1, y1, x2, y2, steps = 64) {
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    pts.push([x1 + (x2 - x1) * t, y1 + (y2 - y1) * t]);
  }
  return polyline(pts);
}

/**
 * A meridian rib: an arc running from the apex down to the base, bowing
 * outward. Coordinates are absolute within the 96x96 viewBox, matching
 * `inShell`, so `sign`/`spread` are measured from the centreline at x = 48.
 */
function rib(sign, spread, apexY, baseY) {
  const pts = [];
  const steps = 96;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const y = apexY + (baseY - apexY) * t;
    // Widens from nothing at the apex to full spread at the base.
    const x = 48 + sign * spread * Math.sqrt(Math.max(0, 1 - (1 - t) ** 2));
    pts.push([x, y]);
  }
  return polyline(pts);
}

/** Inside the radome shell: upper semi-ellipse plus the straight-sided base. */
function inShell(x, y) {
  const inDome = y <= 52 && ((x - 48) / 40) ** 2 + ((y - 52) / 42) ** 2 <= 1;
  const inSides = y >= 52 && y <= 70 && x >= 8 && x <= 88;
  return inDome || inSides;
}

/**
 * Draw the mark into `canvas`, mapped from the logo's 96x96 viewBox.
 *
 * `ox`/`oy`/`scale` are in OUTPUT pixels, and all geometry is worked out in
 * viewBox units so the shapes stay resolution-independent. The conversion to
 * supersampled device pixels happens only at `blend` time.
 */
function drawMark(canvas, ox, oy, scale) {
  const STROKE = 3; // rib width, in viewBox units
  const OUTLINE = 2; // shell outline half-width, matching the source SVG's 4

  // Meridian ribs, including the centreline. Painted before the shell so the
  // outline covers where they meet the edge.
  const ribs = [[0, 0], [-1, 15], [1, 15], [-1, 29], [1, 29]].map(([sign, spread]) =>
    rib(sign, spread, 10, 70),
  );

  for (let py = 0; py < canvas.h; py++) {
    const vy = ((py + 0.5) / SS - oy) / scale;
    for (let px = 0; px < canvas.w; px++) {
      const vx = ((px + 0.5) / SS - ox) / scale;
      if (vx < -6 || vx > 102 || vy < -6 || vy > 98) continue;

      const fill = inShell(vx, vy);
      let color = null;

      if (fill) {
        color = SHELL;
        // Latitude bands, clipped to the shell.
        if ((Math.abs(vy - 36) < 2.2 || Math.abs(vy - 52) < 2.2) && vx > 12 && vx < 84) {
          color = CYAN;
        }
      } else {
        // Outside the shell: paint ink wherever a neighbour within the stroke
        // radius is inside it. That traces the boundary without needing a
        // closed form for the dome's edge.
        let near = false;
        for (let a = 0; a < 8 && !near; a++) {
          const angle = (a / 8) * Math.PI * 2;
          if (inShell(vx + Math.cos(angle) * OUTLINE, vy + Math.sin(angle) * OUTLINE)) {
            near = true;
          }
        }
        if (near) color = INK;
      }

      for (const d of ribs) {
        if (d(vx, vy) < STROKE / 2) color = INK;
      }

      if (color) canvas.blend(px, py, color, 1);
    }
  }

  // Plinth and base, drawn last so they sit under the shell edge.
  fillRect(canvas, ox + 3 * scale, oy + 69 * scale, 90 * scale, 8 * scale, GREEN);
  fillRect(canvas, ox + 3 * scale, oy + 78 * scale, 90 * scale, 13 * scale, INK);
  // Apex beacon.
  fillCircle(canvas, ox + 48 * scale, oy + 13 * scale, 6 * scale, RED, 2 * scale);
}

/** Output-pixel rectangle. */
function fillRect(canvas, x, y, w, h, color) {
  const x0 = Math.max(0, Math.round(x * SS));
  const y0 = Math.max(0, Math.round(y * SS));
  const x1 = Math.min(canvas.w, Math.round((x + w) * SS));
  const y1 = Math.min(canvas.h, Math.round((y + h) * SS));
  for (let py = y0; py < y1; py++) {
    for (let px = x0; px < x1; px++) canvas.blend(px, py, color, 1);
  }
}

/** Output-pixel disc with an optional ink outline. */
function fillCircle(canvas, cx, cy, r, color, stroke = 0) {
  const ccx = cx * SS;
  const ccy = cy * SS;
  const rr = r * SS;
  const sw = stroke * SS;
  const x0 = Math.max(0, Math.floor(ccx - rr - sw - 1));
  const x1 = Math.min(canvas.w, Math.ceil(ccx + rr + sw + 1));
  const y0 = Math.max(0, Math.floor(ccy - rr - sw - 1));
  const y1 = Math.min(canvas.h, Math.ceil(ccy + rr + sw + 1));
  for (let py = y0; py < y1; py++) {
    for (let px = x0; px < x1; px++) {
      const d = Math.hypot(px + 0.5 - ccx, py + 0.5 - ccy);
      if (d <= rr - sw / 2) canvas.blend(px, py, color, 1);
      else if (sw > 0 && d <= rr + sw / 2) canvas.blend(px, py, INK, 1);
    }
  }
}

/* ------------------------------------------------------------------ *
 * A 5x7 pixel font, for the Open Graph card only
 * ------------------------------------------------------------------ */

/**
 * Only the glyphs the card actually uses are defined. A full font would be
 * several hundred lines for no benefit here, and a missing glyph is caught the
 * moment this renders — it would show as a visible gap in the word.
 */
const FONT = {
  A: ".###./#...#/#...#/#####/#...#/#...#/#...#",
  B: "####./#...#/#...#/####./#...#/#...#/####.",
  C: ".###./#...#/#..../#..../#..../#...#/.###.",
  D: "####./#...#/#...#/#...#/#...#/#...#/####.",
  E: "#####/#..../#..../####./#..../#..../#####",
  F: "#####/#..../#..../####./#..../#..../#....",
  G: ".###./#...#/#..../#.###/#...#/#...#/.###.",
  I: "#####/..#../..#../..#../..#../..#../#####",
  M: "#...#/##.##/#.#.#/#.#.#/#...#/#...#/#...#",
  N: "#...#/##..#/#.#.#/#..##/#...#/#...#/#...#",
  O: ".###./#...#/#...#/#...#/#...#/#...#/.###.",
  R: "####./#...#/#...#/####./#.#../#..#./#...#",
  S: ".####/#..../#..../.###./....#/....#/####.",
  T: "#####/..#../..#../..#../..#../..#../..#..",
  U: "#...#/#...#/#...#/#...#/#...#/#####/.....",
  Y: "#...#/#...#/#...#/.###./..#../..#../..#..",
  "0": ".###./#...#/#..##/#.#.#/##..#/#...#/.###.",
  "1": "..#../.##../..#../..#../..#../..#../.###.",
  "2": ".###./#...#/....#/...#./..#../.#.../#####",
  " ": "...../...../...../...../...../...../.....",
};

function drawText(canvas, text, ox, oy, scale, color) {
  let cursor = ox;
  for (const char of text.toUpperCase()) {
    const glyph = FONT[char];
    if (!glyph) {
      cursor += 6 * scale;
      continue;
    }
    const rows = glyph.split("/");
    for (let ry = 0; ry < rows.length; ry++) {
      for (let rx = 0; rx < 5; rx++) {
        if (rows[ry][rx] === "#") {
          fillRect(canvas, cursor + rx * scale, oy + ry * scale, scale, scale, color);
        }
      }
    }
    cursor += 6 * scale;
  }
  return cursor;
}

/** Advance width of a rendered string, for centring. */
function textWidth(text, scale) {
  return text.length * 6 * scale;
}

/* ------------------------------------------------------------------ *
 * Assets
 * ------------------------------------------------------------------ */

function favicon(size) {
  const canvas = createCanvas(size, size);
  // The mark's plinth nearly touches the edge at 96 units, so it is inset a
  // little to stop the offset block from clipping on a rounded icon mask.
  const pad = size * 0.06;
  const scale = (size - pad * 2) / 96;
  drawMark(canvas, pad, pad, scale);
  return canvas.toPng();
}

function appleTouchIcon() {
  const size = 180;
  const canvas = createCanvas(size, size);
  fillRect(canvas, 0, 0, size, size, INK);
  const scale = (size * 0.72) / 96;
  drawMark(canvas, (size - size * 0.72) / 2, (size - size * 0.72) / 2, scale);
  return canvas.toPng();
}

function ogImage() {
  const W = 1200;
  const H = 630;
  const canvas = createCanvas(W, H);
  fillRect(canvas, 0, 0, W, H, INK);

  const scale = 300 / 96;
  drawMark(canvas, 90, (H - 300) / 2, scale);

  const title = "URBIS INDIA";
  const sub = "SMART CITY MANAGEMENT";
  const detail = "CENSUS OF INDIA 2011";

  // Each glyph is 5x7 font pixels plus 1 column of spacing, so a scale of S
  // gives a 6S-wide advance and a 7S-tall line.
  const titleScale = 11; // 11 chars -> 726px wide
  const subScale = 5; // 23 chars -> 690px wide
  const detailScale = 3; // 22 chars -> 396px wide

  const x = 450;
  const titleY = 205;

  drawText(canvas, title, x, titleY, titleScale, [248, 250, 252]);

  // Accent rule, sized to the title block rather than a fixed width.
  const ruleY = titleY + 7 * titleScale + 26;
  fillRect(canvas, x, ruleY, textWidth(title, titleScale) * 0.3, 8, GREEN);

  const subY = ruleY + 40;
  drawText(canvas, sub, x, subY, subScale, CYAN);
  drawText(canvas, detail, x, subY + 7 * subScale + 26, detailScale, [148, 163, 184]);

  return canvas.toPng();
}

/* ------------------------------------------------------------------ */

const outputs = [
  ["public/favicon-16.png", favicon(16)],
  ["public/favicon-32.png", favicon(32)],
  ["public/apple-touch-icon.png", appleTouchIcon()],
  ["public/og-image.png", ogImage()],
];

// Only write when run directly, so the test can import the encoder and
// round-trip it without regenerating the files as a side effect.
if (process.argv[1] && process.argv[1].endsWith("generate-brand-assets.mjs")) {
  for (const [path, bytes] of outputs) {
    writeFileSync(path, bytes);
    console.log(`wrote ${path} (${bytes.length} bytes)`);
  }
}