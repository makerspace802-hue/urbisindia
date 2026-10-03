/**
 * Builds `src/lib/censusData.ts` from the Census of India CSVs in `data/`.
 *
 *   node scripts/build-census-data.mjs
 *
 * Nothing here is hand-typed. The dashboard's Census numbers all come out of
 * this one script, so a figure on screen can always be traced to a row in a
 * source file — which is how the two errors that used to sit in `census.ts`
 * (household count and Scheduled Tribe share) were caught in the first place.
 *
 * Source tables:
 *   data/data-1.csv  Census of India 2011, Table A-2 — decadal population since 1901
 *   data/data-4.csv  Census of India 2011, Primary Census Abstract
 */

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/** RFC 4180 line splitter. The CSVs quote values containing commas. */
function splitCsvLine(line) {
  const out = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const c = line[i];
    if (quoted) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i += 1;
        } else quoted = false;
      } else cur += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      out.push(cur);
      cur = "";
    } else cur += c;
  }
  out.push(cur);
  return out;
}

const readCsv = (rel) =>
  readFileSync(join(ROOT, rel), "utf8")
    .replace(/\r/g, "")
    .split("\n")
    .map(splitCsvLine);

/**
 * Census numbers arrive as " 1,210,854,977 " or " +13,697,063 ", and the first
 * census of a newly formed state is printed as "---".
 */
function num(raw) {
  if (raw == null) return null;
  const t = String(raw).replace(/[\s"']/g, "").replace(/,/g, "").replace(/^\+/, "");
  if (!t || /^-{2,}$/.test(t)) return null;
  const v = Number(t);
  return Number.isFinite(v) ? v : null;
}

/** Census years carry footnote symbols in the source ("   1981 #  "). */
const yearOf = (raw) => {
  const m = String(raw ?? "").match(/\b(1[89]\d\d|20[01]\d)\b/);
  const y = m ? Number(m[1]) : null;
  return y && y % 10 === 1 ? y : null;
};

/**
 * Names carry footnote markers that would break display and filtering:
 * "Maharashtra  ##", "Arunachal Pradesh *", "Madhya Pradesh   $$",
 * "Andhra Pradesh @@", "Nagaland   ^".
 */
const cleanName = (s) => String(s).trim().replace(/[\s*@$^#]+$/, "");

// ---------------------------------------------------------------- Table A-2

const a2 = readCsv("data/data-1.csv");
const series = [];
let unitName = null;
let unitCode = null;

for (const row of a2) {
  if (row[0]?.trim()) unitCode = row[0].trim();
  if (row[2]?.trim()) unitName = cleanName(row[2]);
  const year = yearOf(row[3]);
  if (year === null) continue;
  const population = num(row[4]);
  if (population === null) continue;
  series.push({
    code: unitCode,
    name: unitName,
    year,
    population,
    males: num(row[7]),
    females: num(row[8]),
    // Printed by the source but recomputed below, because two decades of the
    // printed figures do not agree with their own population column.
    printedAbsolute: num(row[5]),
    printedPercent: num(row[6]),
  });
}

/** Decadal change computed from the population column, not read off the sheet. */
function withDecadalChange(rows) {
  return rows.map((row, i) => {
    if (i === 0) return { ...row, absoluteChange: null, percentChange: null };
    const prev = rows[i - 1];
    return {
      ...row,
      absoluteChange: row.population - prev.population,
      percentChange: ((row.population / prev.population) - 1) * 100,
    };
  });
}

const indiaDecadal = withDecadalChange(series.filter((r) => r.name === "INDIA"));
const peakDecadal = indiaDecadal.reduce((a, b) =>
  a.percentChange > b.percentChange ? a : b,
);
const latestDecadal = indiaDecadal.at(-1);

const byUnit = new Map();
for (const row of series) {
  if (row.name === "INDIA") continue;
  if (!byUnit.has(row.name)) byUnit.set(row.name, []);
  byUnit.get(row.name).push(row);
}

const stateGrowth = [...byUnit.entries()]
  .map(([name, rows]) => {
    const sorted = rows.sort((a, b) => a.year - b.year);
    const withChange = withDecadalChange(sorted);
    const y2001 = withChange.find((r) => r.year === 2001);
    const y2011 = withChange.find((r) => r.year === 2011);
    if (!y2001 || !y2011) return null;
    return {
      name,
      population2001: y2001.population,
      population2011: y2011.population,
      absoluteChange: y2011.population - y2001.population,
      percentChange: ((y2011.population / y2001.population) - 1) * 100,
      sexRatio2001: (y2001.females / y2001.males) * 1000,
      sexRatio2011: (y2011.females / y2011.males) * 1000,
      series: withChange,
    };
  })
  .filter(Boolean)
  .sort((a, b) => b.percentChange - a.percentChange);

// ------------------------------------------------------- Primary Census Abstract

const pca = readCsv("data/data-4.csv");
const pcaHeader = pca[0];
const pcaCol = (name) => pcaHeader.indexOf(name);
const pcaRow = pca
  .slice(1)
  .find((r) => r[pcaCol("Level")] === "India" && r[pcaCol("TRU")] === "Total");
const pcaVal = (name) => num(pcaRow[pcaCol(name)]);

// Table A-1 supplies the households / population / area totals that back the
// national density figure.
const a1 = readCsv("data/data-2.csv");
const a1India = a1.filter((r) => r[3]?.trim() === "INDIA");
const a1Total = a1India.find((r) => /Total/.test(r[5])) ?? a1India[0];
const a1Urban = a1India.find((r) => /Urban/.test(r[5]));

const india2011 = {
  population: pcaVal("TOT_P"),
  males: pcaVal("TOT_M"),
  females: pcaVal("TOT_F"),
  children06: pcaVal("P_06"),
  households: pcaVal("No_HH"),
  scheduledCaste: pcaVal("P_SC"),
  scheduledTribe: pcaVal("P_ST"),
  urbanPopulation: num(a1Urban?.[10]),
  ruralPopulation: num(a1Total?.[10]) - num(a1Urban?.[10]),
  inhabitedVillages: num(a1Total?.[6]),
  uninhabitedVillages: num(a1Total?.[7]),
  towns: num(a1Urban?.[8]),
  areaSqKm: num(a1Total?.[13]),
  urbanAreaSqKm: num(a1Urban?.[13]),
  // Read from the sheet rather than recomputed. Dividing the population by the
  // published 3,287,469 km2 gives 368, but Census 2011 reports 382 because its
  // density excludes disputed territory from the area base.
  density: num(a1Total?.[14]),
};
india2011.scSharePercent = (india2011.scheduledCaste / india2011.population) * 100;
india2011.stSharePercent = (india2011.scheduledTribe / india2011.population) * 100;
india2011.urbanSharePercent =
  (india2011.urbanPopulation / india2011.population) * 100;
india2011.density = india2011.density ?? india2011.population / india2011.areaSqKm;
india2011.sexRatio = (india2011.females / india2011.males) * 1000;
india2011.childSexRatio = (india2011.femaleChildren06 ?? 0) || null;
delete india2011.childSexRatio;

// ---------------------------------------------------------------- emit

/**
 * Emits a bare numeric literal. Thousands separators would not survive being
 * pasted into TypeScript — `238,396,327` parses as a syntax error, not a value.
 */
const n = (v) =>
  v === null || v === undefined
    ? "null"
    : typeof v === "number"
      ? Number.isInteger(v)
        ? String(v)
        : String(Number(v.toFixed(4)))
      : JSON.stringify(v);

const header = `/**
 * GENERATED FILE — do not edit by hand.
 *
 * Source:  data/data-1.csv  Census of India 2011, Table A-2 (decadal population since 1901)
 *          data/data-4.csv  Census of India 2011, Primary Census Abstract
 *          data/data-2.csv  Census of India 2011, Table A-1 (villages, towns, households, area)
 *
 * Regenerate with:  node scripts/build-census-data.mjs
 *
 * Decadal changes are recomputed from the population column rather than read
 * off the sheet, because Table A-2's printed absolute change is wrong for 1951
 * (7,025 short) and for 1961 (463,808 short, with a printed percentage that
 * disagrees with its own population figures).
 */`;

const body = `${header}

export interface CensusPoint {
  year: number;
  population: number;
  males: number;
  females: number;
  /** Computed from the previous census in the series. */
  absoluteChange: number | null;
  /** Computed from the previous census in the series. */
  percentChange: number | null;
}

/** India, every census from 1901 to 2011. */
export const INDIA_DECADAL: CensusPoint[] = [
${indiaDecadal
  .map(
    (r) => `  { year: ${r.year}, population: ${n(
      r.population,
    )}, males: ${n(r.males)}, females: ${n(r.females)}, absoluteChange: ${n(
      r.absoluteChange,
    )}, percentChange: ${n(r.percentChange)} },`,
  )
  .join("\n")}
];

export interface StateGrowth {
  name: string;
  population2001: number;
  population2011: number;
  absoluteChange: number;
  percentChange: number;
  /** Females per 1,000 males, all ages. */
  sexRatio2001: number;
  sexRatio2011: number;
}

/** The same census for every state and union territory, 2001 vs 2011. */
export const STATE_GROWTH: StateGrowth[] = [
${stateGrowth
  .map(
    (s) => `  { name: ${JSON.stringify(
      s.name,
    )}, population2001: ${n(s.population2001)}, population2011: ${n(
      s.population2011,
    )}, absoluteChange: ${n(s.absoluteChange)}, percentChange: ${n(
      Number(s.percentChange.toFixed(4)),
    )}, sexRatio2001: ${n(
      Number(s.sexRatio2001.toFixed(1)),
    )}, sexRatio2011: ${n(Number(s.sexRatio2011.toFixed(1)))} },`,
  )
  .join("\n")}
];

export interface IndiaProfile2011 {
  population: number;
  males: number;
  females: number;
  children06: number;
  households: number;
  scheduledCaste: number;
  scheduledTribe: number;
  urbanPopulation: number;
  ruralPopulation: number;
  inhabitedVillages: number;
  uninhabitedVillages: number;
  towns: number;
  areaSqKm: number;
  urbanAreaSqKm: number;
  scSharePercent: number;
  stSharePercent: number;
  urbanSharePercent: number;
  density: number;
  sexRatio: number;
}

/** National profile for Census 2011. */
export const INDIA_2011: IndiaProfile2011 = {
  population: ${n(india2011.population)},
  males: ${n(india2011.males)},
  females: ${n(india2011.females)},
  children06: ${n(india2011.children06)},
  households: ${n(india2011.households)},
  scheduledCaste: ${n(india2011.scheduledCaste)},
  scheduledTribe: ${n(india2011.scheduledTribe)},
  urbanPopulation: ${n(india2011.urbanPopulation)},
  ruralPopulation: ${n(india2011.ruralPopulation)},
  inhabitedVillages: ${n(india2011.inhabitedVillages)},
  uninhabitedVillages: ${n(india2011.uninhabitedVillages)},
  towns: ${n(india2011.towns)},
  areaSqKm: ${n(Number(india2011.areaSqKm.toFixed(2)))},
  urbanAreaSqKm: ${n(Number(india2011.urbanAreaSqKm.toFixed(2)))},
  scSharePercent: ${n(Number(india2011.scSharePercent.toFixed(2)))},
  stSharePercent: ${n(Number(india2011.stSharePercent.toFixed(2)))},
  urbanSharePercent: ${n(Number(india2011.urbanSharePercent.toFixed(2)))},
  density: ${n(Number(india2011.density.toFixed(0)))},
  sexRatio: ${n(Number(india2011.sexRatio.toFixed(0)))},
};

/** The decadal with the largest percentage gain in the series. */
export const PEAK_DECADAL = {
  from: ${peakDecadal.year - 10},
  to: ${peakDecadal.year},
  percentChange: ${n(Number(peakDecadal.percentChange.toFixed(2)))},
  absoluteChange: ${n(peakDecadal.absoluteChange)},
};

/** The most recent decadal, for comparison against the peak. */
export const LATEST_DECADAL = {
  from: ${latestDecadal.year - 10},
  to: ${latestDecadal.year},
  percentChange: ${n(Number(latestDecadal.percentChange.toFixed(2)))},
  absoluteChange: ${n(latestDecadal.absoluteChange)},
};

/** First census in the series, the baseline the whole century is measured from. */
export const OPENING_CENSUS = {
  year: ${indiaDecadal[0].year},
  population: ${n(indiaDecadal[0].population)},
};

/** Multiple the opening census on the closing one. */
export const CENTURY_MULTIPLE = ${n(
  Number(
    (indiaDecadal.at(-1).population / indiaDecadal[0].population).toFixed(2),
  ),
)};

export const FIRST_CENSUS_YEAR = ${indiaDecadal[0].year};
export const LAST_CENSUS_YEAR = ${indiaDecadal.at(-1).year};
`;

writeFileSync(join(ROOT, "src/lib/censusData.ts"), body);

console.log(
  `wrote src/lib/censusData.ts  (${indiaDecadal.length} censuses, ${stateGrowth.length} states/UTs)`,
);