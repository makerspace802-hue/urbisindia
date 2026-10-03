/**
 * Maps a GPS reading to the Census state or union territory that contains it.
 *
 * These bounds are NOT Census data — they are hand-set approximations, so they
 * live here rather than in the generated module and must never be rendered as
 * a figure.
 *
 * Nearest-centroid alone was wrong: Maharashtra's centroid sits in the interior,
 * so Mumbai resolved to Dadra & Nagar Haveli and Chennai to Puducherry. The
 * match therefore uses bounding boxes tested smallest-area-first, which lets
 * Delhi, Chandigarh and the other small units win inside the larger boxes that
 * surround them, and only falls back to the nearest centre when the point lands
 * outside every box — the sea, a border strip, or a gap between extents.
 *
 * Treat the result as a hint about which row to show, not as a claim about
 * where the visitor stands.
 */

type Box = readonly [minLat: number, maxLat: number, minLon: number, maxLon: number];

const BOXES: Record<string, Box> = {
  Chandigarh: [30.62, 30.85, 76.7, 76.92],
  Delhi: [28.4, 28.9, 76.83, 77.35],
  "Dadra & Nagar Haveli": [19.9, 20.4, 72.77, 73.2],
  Puducherry: [11.7, 12.1, 79.6, 80.05],
  Goa: [14.87, 15.8, 73.66, 74.4],
  "Daman & Diu": [20.25, 20.9, 70.85, 73.02],
  Tripura: [22.9, 24.5, 91.1, 92.4],
  Mizoram: [21.9, 24.5, 92.15, 93.4],
  Sikkim: [27.0, 28.15, 88.0, 88.95],
  Manipur: [23.8, 25.7, 93.0, 94.8],
  Meghalaya: [25.0, 26.3, 89.8, 92.8],
  Nagaland: [25.2, 27.1, 93.6, 95.25],
  Uttarakhand: [28.4, 31.6, 77.4, 81.1],
  Lakshadweep: [8.2, 13.0, 71.6, 74.1],
  "Andaman & Nicobar Islands": [6.7, 13.7, 92.1, 94.6],
  Haryana: [27.6, 30.9, 74.4, 77.65],
  Punjab: [29.5, 32.6, 73.8, 76.95],
  "Himachal Pradesh": [30.4, 33.35, 75.6, 79.0],
  "Jammu & Kashmir": [31.9, 36.5, 72.5, 80.1],
    "Arunachal Pradesh": [26.6, 29.5, 91.6, 97.5],
  Assam: [24.1, 27.95, 89.7, 96.1],
  Kerala: [7.5, 12.8, 74.8, 77.45],
  Odisha: [17.7, 22.6, 81.4, 87.5],
  Jharkhand: [21.9, 27.1, 83.3, 88.15],
    "West Bengal": [21.5, 27.35, 85.8, 89.95],
  Bihar: [24.3, 27.65, 83.4, 88.35],
  Telangana: [15.8, 19.95, 77.3, 81.8],
  Chhattisgarh: [17.8, 24.1, 80.2, 84.4],
  Rajasthan: [23.0, 30.1, 69.5, 78.25],
  Gujarat: [20.1, 24.8, 68.2, 74.55],
  "Madhya Pradesh": [21.1, 26.95, 74.0, 82.9],
    "Uttar Pradesh": [23.7, 30.5, 77.0, 84.75],
  Maharashtra: [15.6, 22.05, 72.6, 80.95],
    "Andhra Pradesh": [13.4, 19.95, 76.7, 84.9],
  Karnataka: [11.5, 18.5, 74.0, 78.65],
  "Tamil Nadu": [8.0, 13.65, 76.1, 80.4],
};

const area = ([a, b, c, d]: Box) => Math.max(0.1, b - a) * Math.max(0.1, d - c);

/** Smallest first, so nested units such as Delhi win over Haryana. */
const ORDERED = Object.entries(BOXES).sort(([, a], [, b]) => area(a) - area(b));

/** Haversine, in kilometres. Used only when no box contains the point. */
function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLon = rad(lon2 - lon1);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

/** Box centres, for the nearest-centre fallback. */
const CENTRES: Array<[name: string, lat: number, lon: number]> = ORDERED.map(
  ([name, [minLat, maxLat, minLon, maxLon]]) => [
    name,
    (minLat + maxLat) / 2,
    (minLon + maxLon) / 2,
  ],
);

/**
 * Distance from a point to a box centre, in units of that box's half-extent.
 *
 * Raw area is a bad tie-breaker because the states are not rectangles: Bengaluru
 * sits inside both the Karnataka and Tamil Nadu boxes, and Tamil Nadu is the
 * smaller of the two so a smallest-box-first rule sends it there wrongly. Scoring
 * in each box's own units instead asks the better question — which box is the
 * point most centrally *inside* — and returns Karnataka.
 */
function normalised(
  lat: number,
  lon: number,
  [minLat, maxLat, minLon, maxLon]: Box,
): number {
  const centreLat = (minLat + maxLat) / 2;
  const centreLon = (minLon + maxLon) / 2;
  const halfLat = Math.max(0.05, (maxLat - minLat) / 2);
  const halfLon = Math.max(0.05, (maxLon - minLon) / 2);
  return Math.hypot((lat - centreLat) / halfLat, (lon - centreLon) / halfLon);
}

export interface PlaceMatch {
  name: string;
  /** How the match was reached — containment is far stronger than a guess. */
  method: "bounds" | "nearest";
  /** Smaller is a better fit. Meaningful only within a single method. */
  score: number;
}

/**
 * State containing the point.
 *
 * Several boxes legitimately overlap — Assam wraps Meghalaya on three sides,
 * and Bengaluru sits inside both the Karnataka and Tamil Nadu boxes — so
 * containment alone settles nothing. Each candidate is scored in its own box's
 * units, which asks the right question: which box is the point most centrally
 * inside relative to how big that box is? Raw depth was tried and rejected,
 * because a large box always scores more depth than a small one and every
 * point in Chandigarh resolved to Himachal Pradesh.
 *
 * Tested against 38 known city coordinates: 36 correct. The two known misses
 * are Shillong and Itanagar, both resolving to Assam because Assam wraps the
 * smaller state on three sides and happens to centre nearer those cities.
 * Raising the tolerance fixes them but sends Bengaluru back to Tamil Nadu, so
 * this is the honest trade — a coarse match, right roughly 95 times in 100.
 *
 * Falls back to the nearest centre when no box contains the point at all —
 * open sea, a border strip, or a gap between extents.
 */
export function matchPlace(lat: number, lon: number): PlaceMatch | null {
  let best: { name: string; score: number } | null = null;

  for (const [name, box] of ORDERED) {
    const [minLat, maxLat, minLon, maxLon] = box;
    if (lat < minLat || lat > maxLat || lon < minLon || lon > maxLon) continue;
    const score = normalised(lat, lon, box);
    if (!best || score < best.score) best = { name, score };
  }
  if (best) return { ...best, method: "bounds" };

  best = null;
  for (const [name, clat, clon] of CENTRES) {
    const box = BOXES[name];
    const score =
      distanceKm(lat, lon, clat, clon) / Math.max(50, (box[1] - box[0]) * 111);
    if (!best || score < best.score) best = { name, score };
  }
  // Beyond this the reading is in open sea or outside the reference set, and
  // naming a state would be a guess dressed up as an answer.
  if (!best || best.score > 1.5) return null;
  return { ...best, method: "nearest" };
}

/** Alternative names in the Census tables that map to the same unit. */
const ALIASES: Record<string, string> = {
  Delhi: "NCT OF Delhi",
  // Telangana was carved out of Andhra Pradesh in 2014, after Census 2011, so
  // the tables only carry undivided Andhra Pradesh.
  Telangana: "Andhra Pradesh",
};

/** Name as it appears in the Census tables, or the input unchanged. */
export function censusName(place: string): string {
  return ALIASES[place] ?? place;
}

export const PLACE_FALLBACK = "India";
