/**
 * Tiny PNG decoder + ASCII previewer, used to eyeball generated brand assets.
 *
 * There is no image tooling on this host, so this decodes the PNGs the brand
 * generator writes and prints them as luminance ramps. Verification only —
 * nothing in the app imports it.
 *
 *   node scripts/png-preview.mjs public/og-image.png 80
 */

import { readFileSync } from "node:fs";
import { inflateSync } from "node:zlib";

export function decodePng(path) {
  const file = readFileSync(path);
  let offset = 8;
  let width = 0;
  let height = 0;
  const idat = [];

  while (offset < file.length) {
    const length = file.readUInt32BE(offset);
    const type = file.subarray(offset + 4, offset + 8).toString("latin1");
    const data = file.subarray(offset + 8, offset + 8 + length);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
    }
    if (type === "IDAT") idat.push(data);
    offset += 12 + length;
  }

  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * 4;
  const px = Buffer.alloc(stride * height);
  let pos = 0;

  for (let y = 0; y < height; y++) {
    const filter = raw[pos++];
    for (let x = 0; x < stride; x++) {
      const cur = raw[pos + x];
      const a = x >= 4 ? px[y * stride + x - 4] : 0;
      const b = y > 0 ? px[(y - 1) * stride + x] : 0;
      const c = x >= 4 && y > 0 ? px[(y - 1) * stride + x - 4] : 0;
      let value;
      switch (filter) {
        case 1: value = cur + a; break;
        case 2: value = cur + b; break;
        case 3: value = cur + ((a + b) >> 1); break;
        case 4: {
          const p = a + b - c;
          const pa = Math.abs(p - a);
          const pb = Math.abs(p - b);
          const pc = Math.abs(p - c);
          value = cur + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c);
          break;
        }
        default: value = cur;
      }
      px[y * stride + x] = value & 255;
    }
    pos += stride;
  }

  return { width, height, px };
}

export function preview(path, cols = 60) {
  const { width, height, px } = decodePng(path);
  const rows = Math.max(1, Math.round((height / width) * cols * 0.5));
  const ramp = " .:-=+*#%@";
  console.log(`\n=== ${path} (${width}x${height}) ===`);
  for (let ry = 0; ry < rows; ry++) {
    let line = "";
    for (let rx = 0; rx < cols; rx++) {
      const x = Math.floor((rx + 0.5) * (width / cols));
      const y = Math.floor((ry + 0.5) * (height / rows));
      const i = (y * width + x) * 4;
      const alpha = px[i + 3];
      if (alpha < 40) {
        line += " ";
        continue;
      }
      const lum = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
      line += ramp[Math.min(9, Math.floor((lum / 256) * 10))];
    }
    console.log(line);
  }
}

if (process.argv[1] && process.argv[1].endsWith("png-preview.mjs")) {
  for (const arg of process.argv.slice(2)) {
    preview(arg, 76);
  }
}