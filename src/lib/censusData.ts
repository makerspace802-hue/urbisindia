/**
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
 */

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
  { year: 1901, population: 238396327, males: 120791301, females: 117358672, absoluteChange: null, percentChange: null },
  { year: 1911, population: 252093390, males: 128385368, females: 123708022, absoluteChange: 13697063, percentChange: 5.7455 },
  { year: 1921, population: 251321213, males: 128546225, females: 122774988, absoluteChange: -772177, percentChange: -0.3063 },
  { year: 1931, population: 278977238, males: 142929689, females: 135788921, absoluteChange: 27656025, percentChange: 11.0043 },
  { year: 1941, population: 318660580, males: 163685302, females: 154690267, absoluteChange: 39683342, percentChange: 14.2246 },
  { year: 1951, population: 361088090, males: 185528462, females: 175559628, absoluteChange: 42427510, percentChange: 13.3143 },
  { year: 1961, population: 439234771, males: 226293201, females: 212941570, absoluteChange: 78146681, percentChange: 21.642 },
  { year: 1971, population: 548159652, males: 284049276, females: 264110376, absoluteChange: 108924881, percentChange: 24.7988 },
  { year: 1981, population: 683329097, males: 353374460, females: 329954637, absoluteChange: 135169445, percentChange: 24.6588 },
  { year: 1991, population: 846421039, males: 439358440, females: 407062599, absoluteChange: 163091942, percentChange: 23.8673 },
  { year: 2001, population: 1028737436, males: 532223090, females: 496514346, absoluteChange: 182316397, percentChange: 21.5397 },
  { year: 2011, population: 1210854977, males: 623270258, females: 587584719, absoluteChange: 182117541, percentChange: 17.703 },
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
  { name: "Dadra & Nagar Haveli", population2001: 220490, population2011: 343709, absoluteChange: 123219, percentChange: 55.8842, sexRatio2001: 812.3, sexRatio2011: 773.9 },
  { name: "Daman & Diu", population2001: 158204, population2011: 243247, absoluteChange: 85043, percentChange: 53.7553, sexRatio2001: 710.1, sexRatio2011: 618.4 },
  { name: "Puducherry", population2001: 974345, population2011: 1247953, absoluteChange: 273608, percentChange: 28.0812, sexRatio2001: 1000.9, sexRatio2011: 1037.4 },
  { name: "Meghalaya", population2001: 2318822, population2011: 2966889, absoluteChange: 648067, percentChange: 27.9481, sexRatio2001: 971.6, sexRatio2011: 988.8 },
  { name: "Arunachal Pradesh", population2001: 1097968, population2011: 1383727, absoluteChange: 285759, percentChange: 26.0262, sexRatio2001: 893.2, sexRatio2011: 938.2 },
  { name: "Bihar", population2001: 82998509, population2011: 104099452, absoluteChange: 21100943, percentChange: 25.4233, sexRatio2001: 919.3, sexRatio2011: 917.9 },
  { name: "Manipur", population2001: 2293896, population2011: 2855794, absoluteChange: 561898, percentChange: 24.4954, sexRatio2001: 974.2, sexRatio2011: 985.1 },
  { name: "Jammu & Kashmir", population2001: 10143700, population2011: 12541302, absoluteChange: 2397602, percentChange: 23.6364, sexRatio2001: 892.2, sexRatio2011: 888.6 },
  { name: "Mizoram", population2001: 888573, population2011: 1097206, absoluteChange: 208633, percentChange: 23.4796, sexRatio2001: 935.4, sexRatio2011: 975.7 },
  { name: "Chhattisgarh", population2001: 20833803, population2011: 25545198, absoluteChange: 4711395, percentChange: 22.6142, sexRatio2001: 989.1, sexRatio2011: 990.6 },
  { name: "Jharkhand", population2001: 26945829, population2011: 32988134, absoluteChange: 6042305, percentChange: 22.4239, sexRatio2001: 940.6, sexRatio2011: 948.5 },
  { name: "Rajasthan", population2001: 56507188, population2011: 68548437, absoluteChange: 12041249, percentChange: 21.3092, sexRatio2001: 920.7, sexRatio2011: 928.2 },
  { name: "NCT OF Delhi", population2001: 13850507, population2011: 16787941, absoluteChange: 2937434, percentChange: 21.2081, sexRatio2001: 820.7, sexRatio2011: 868 },
  { name: "Madhya Pradesh", population2001: 60348023, population2011: 72626809, absoluteChange: 12278786, percentChange: 20.3466, sexRatio2001: 919.2, sexRatio2011: 930.9 },
  { name: "Uttar Pradesh", population2001: 166197921, population2011: 199812341, absoluteChange: 33614420, percentChange: 20.2255, sexRatio2001: 898, sexRatio2011: 912.4 },
  { name: "Haryana", population2001: 21144564, population2011: 25351462, absoluteChange: 4206898, percentChange: 19.8959, sexRatio2001: 860.7, sexRatio2011: 878.6 },
  { name: "Gujarat", population2001: 50671017, population2011: 60439692, absoluteChange: 9768675, percentChange: 19.2786, sexRatio2001: 920.4, sexRatio2011: 919.3 },
  { name: "Uttarakhand", population2001: 8489349, population2011: 10086292, absoluteChange: 1596943, percentChange: 18.8111, sexRatio2001: 962.4, sexRatio2011: 963.2 },
  { name: "Chandigarh", population2001: 900635, population2011: 1055450, absoluteChange: 154815, percentChange: 17.1895, sexRatio2001: 776.6, sexRatio2011: 817.7 },
  { name: "Assam", population2001: 26655528, population2011: 31205576, absoluteChange: 4550048, percentChange: 17.0698, sexRatio2001: 934.8, sexRatio2011: 957.8 },
  { name: "Maharashtra", population2001: 96878627, population2011: 112374333, absoluteChange: 15495706, percentChange: 15.995, sexRatio2001: 922.2, sexRatio2011: 929.4 },
  { name: "Tamil Nadu", population2001: 62405679, population2011: 72147030, absoluteChange: 9741351, percentChange: 15.6097, sexRatio2001: 987.4, sexRatio2011: 996.4 },
  { name: "Karnataka", population2001: 52850562, population2011: 61095297, absoluteChange: 8244735, percentChange: 15.6001, sexRatio2001: 964.8, sexRatio2011: 972.9 },
  { name: "Tripura", population2001: 3199203, population2011: 3673917, absoluteChange: 474714, percentChange: 14.8385, sexRatio2001: 948.1, sexRatio2011: 960.1 },
  { name: "Odisha", population2001: 36804660, population2011: 41974218, absoluteChange: 5169558, percentChange: 14.0459, sexRatio2001: 972.3, sexRatio2011: 978.8 },
  { name: "Punjab", population2001: 24358999, population2011: 27743338, absoluteChange: 3384339, percentChange: 13.8936, sexRatio2001: 875.9, sexRatio2011: 895.1 },
  { name: "West Bengal", population2001: 80176197, population2011: 91276115, absoluteChange: 11099918, percentChange: 13.8444, sexRatio2001: 933.5, sexRatio2011: 950 },
  { name: "Himachal Pradesh", population2001: 6077900, population2011: 6864602, absoluteChange: 786702, percentChange: 12.9436, sexRatio2001: 968.3, sexRatio2011: 971.5 },
  { name: "Sikkim", population2001: 540851, population2011: 610577, absoluteChange: 69726, percentChange: 12.8919, sexRatio2001: 874.8, sexRatio2011: 889.9 },
  { name: "Andhra Pradesh", population2001: 76210007, population2011: 84580777, absoluteChange: 8370770, percentChange: 10.9838, sexRatio2001: 978.1, sexRatio2011: 992.8 },
  { name: "Goa", population2001: 1347668, population2011: 1458545, absoluteChange: 110877, percentChange: 8.2273, sexRatio2001: 961, sexRatio2011: 973.3 },
  { name: "Andaman & Nicobar Islands", population2001: 356152, population2011: 380581, absoluteChange: 24429, percentChange: 6.8592, sexRatio2001: 845.6, sexRatio2011: 876 },
  { name: "Lakshadweep", population2001: 60650, population2011: 64473, absoluteChange: 3823, percentChange: 6.3034, sexRatio2001: 948.2, sexRatio2011: 946.5 },
  { name: "Kerala", population2001: 31841374, population2011: 33406061, absoluteChange: 1564687, percentChange: 4.914, sexRatio2001: 1058.5, sexRatio2011: 1084.3 },
  { name: "Nagaland", population2001: 1990036, population2011: 1978502, absoluteChange: -11534, percentChange: -0.5796, sexRatio2001: 900.4, sexRatio2011: 930.9 },
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
  population: 1210854977,
  males: 623270258,
  females: 587584719,
  children06: 164515253,
  households: 249501663,
  scheduledCaste: 201378372,
  scheduledTribe: 104545716,
  urbanPopulation: 377106125,
  ruralPopulation: 833748852,
  inhabitedVillages: 597608,
  uninhabitedVillages: 43324,
  towns: 7933,
  areaSqKm: 3287469,
  urbanAreaSqKm: 102252.03,
  scSharePercent: 16.63,
  stSharePercent: 8.63,
  urbanSharePercent: 31.14,
  density: 382,
  sexRatio: 943,
};

/** The decadal with the largest percentage gain in the series. */
export const PEAK_DECADAL = {
  from: 1961,
  to: 1971,
  percentChange: 24.8,
  absoluteChange: 108924881,
};

/** The most recent decadal, for comparison against the peak. */
export const LATEST_DECADAL = {
  from: 2001,
  to: 2011,
  percentChange: 17.7,
  absoluteChange: 182117541,
};

/** First census in the series, the baseline the whole century is measured from. */
export const OPENING_CENSUS = {
  year: 1901,
  population: 238396327,
};

/** Multiple the opening census on the closing one. */
export const CENTURY_MULTIPLE = 5.08;

export const FIRST_CENSUS_YEAR = 1901;
export const LAST_CENSUS_YEAR = 2011;

/** Every decadal step in the series, as "1901-11" … "2001-11". */
export const DECADAL_LABELS: string[] = ["1901-11","1911-21","1921-31","1931-41","1941-51","1951-61","1961-71","1971-81","1981-91","1991-01","2001-11"];

export interface StateDecadal {
  name: string;
  /** First census this unit appears in — not every state existed in 1901. */
  fromYear: number;
  /** Percentage change per decadal, aligned index-for-index to DECADAL_LABELS. */
  changes: (number | null)[];
}

/** Every state across every decadal, so losses are visible and not averaged away. */
export const STATE_DECADAL: StateDecadal[] = [
  { name: "Dadra & Nagar Haveli", fromYear: 1921, changes: [null, null, 23.23, null, null, null, null, 39.78, 33.57, 59.22, 55.88] },
  { name: "Daman & Diu", fromYear: 1921, changes: [null, null, 15.98, null, null, null, null, 26.07, 28.62, 55.73, 53.76] },
  { name: "Puducherry", fromYear: 1901, changes: [4.39, -5.06, 5.93, 10.2, null, null, 27.81, 28.15, 33.64, 20.62, 28.08] },
  { name: "Meghalaya", fromYear: 1901, changes: [15.71, 7.21, 13.83, 15.59, 8.97, 27.03, 31.5, 32.04, 32.86, 30.65, 27.95] },
  { name: "Arunachal Pradesh", fromYear: 1961, changes: [null, null, null, null, null, null, 38.91, 35.15, 36.83, 27, 26.03] },
  { name: "Bihar", fromYear: 1901, changes: [1.52, -0.97, 9.74, 12.22, 10.58, 19.79, 20.91, 24.16, 23.38, 28.62, 25.42] },
  { name: "Manipur", fromYear: 1901, changes: [21.71, 10.92, 16.04, 14.92, 12.8, 35.04, 37.53, 32.46, 29.29, 24.86, 24.5] },
  { name: "Jammu & Kashmir", fromYear: 1901, changes: [7.16, 5.75, 10.14, 10.36, 10.42, 9.44, 29.65, 29.69, 30.89, 29.43, 23.64] },
  { name: "Mizoram", fromYear: 1901, changes: [10.64, 7.9, 26.42, 22.81, 28.42, 35.61, 24.93, 48.55, 39.7, 28.82, 23.48] },
  { name: "Chhattisgarh", fromYear: 1901, changes: [24.15, 1.41, 14.51, 13.04, 9.42, 22.77, 27.12, 20.39, 25.73, 18.27, 22.61] },
  { name: "Jharkhand", fromYear: 1901, changes: [11.19, 0.31, 16.86, 12.13, 9.35, 19.69, 22.58, 23.79, 24.03, 23.36, 22.42] },
  { name: "Rajasthan", fromYear: 1901, changes: [6.7, -6.29, 14.14, 18.01, 15.2, 26.2, 27.83, 32.97, 28.44, 28.41, 21.31] },
  { name: "NCT OF Delhi", fromYear: 1901, changes: [1.98, 18.03, 30.26, 44.27, 90, 52.44, 52.93, 53, 51.45, 47.02, 21.21] },
  { name: "Madhya Pradesh", fromYear: 1901, changes: [12.38, -2.4, 10.21, 12.06, 8.38, 24.73, 29.28, 27.16, 27.24, 24.26, 20.35] },
  { name: "Uttar Pradesh", fromYear: 1901, changes: [-1.36, -3.16, 6.56, 13.57, 11.78, 16.38, 19.54, 25.39, 25.61, 25.85, 20.23] },
  { name: "Haryana", fromYear: 1901, changes: [-9.7, 1.95, 7.14, 15.63, 7.6, 33.79, 32.22, 28.75, 27.41, 28.43, 19.9] },
  { name: "Gujarat", fromYear: 1901, changes: [7.79, 3.79, 12.92, 19.25, 18.69, 26.88, 29.39, 27.67, 21.19, 22.66, 19.28] },
  { name: "Uttarakhand", fromYear: 1901, changes: [8.2, -1.23, 8.74, 13.63, 12.67, 22.57, 24.42, 27.45, 23.13, 20.41, 18.81] },
  { name: "Chandigarh", fromYear: 1901, changes: [-16.07, -1.65, 9.1, 14.11, 7.47, 394.13, 114.59, 75.55, 42.16, 40.28, 17.19] },
  { name: "Assam", fromYear: 1901, changes: [16.99, 20.48, 19.91, 20.4, 19.93, 34.98, 34.95, 23.36, 24.24, 18.92, 17.07] },
  { name: "Maharashtra", fromYear: 1901, changes: [10.74, -2.91, 14.91, 11.99, 19.27, 23.6, 27.45, 24.54, 25.73, 22.73, 15.99] },
  { name: "Tamil Nadu", fromYear: 1901, changes: [8.57, 3.47, 8.52, 11.91, 14.66, 11.85, 22.3, 17.5, 15.39, 11.72, 15.61] },
  { name: "Karnataka", fromYear: 1901, changes: [3.6, -1.09, 9.38, 11.09, 19.36, 21.57, 24.22, 26.75, 21.12, 17.51, 15.6] },
  { name: "Tripura", fromYear: 1901, changes: [32.48, 32.59, 25.63, 34.14, 24.56, 78.71, 36.28, 31.92, 34.3, 16.03, 14.84] },
  { name: "Odisha", fromYear: 1901, changes: [10.44, -1.94, 11.94, 10.22, 6.38, 19.82, 25.05, 20.17, 20.06, 16.25, 14.05] },
  { name: "Punjab", fromYear: 1901, changes: [-10.78, 6.26, 12.02, 19.82, -4.58, 21.56, 21.7, 23.89, 20.81, 20.1, 13.89] },
  { name: "West Bengal", fromYear: 1901, changes: [6.25, -2.91, 8.14, 22.93, 13.22, 32.8, 26.87, 23.17, 24.73, 17.77, 13.84] },
  { name: "Himachal Pradesh", fromYear: 1901, changes: [-1.22, 1.65, 5.23, 11.54, 5.42, 17.87, 23.04, 23.71, 20.79, 17.54, 12.94] },
  { name: "Sikkim", fromYear: 1901, changes: [48.98, -7.05, 34.37, 10.67, 13.34, 17.76, 29.38, 50.77, 28.47, 33.06, 12.89] },
  { name: "Andhra Pradesh", fromYear: 1901, changes: [12.49, -0.13, 12.99, 12.75, 14.02, 15.65, 20.9, 23.1, 24.2, 14.59, 10.98] },
  { name: "Goa", fromYear: 1921, changes: [null, null, 7.62, null, null, null, null, 26.74, 16.08, 15.21, 8.23] },
  { name: "Andaman & Nicobar Islands", fromYear: 1901, changes: [7.34, 2.37, 8.78, 14.61, -8.28, 105.19, 81.17, 63.93, 48.7, 26.9, 6.86] },
  { name: "Lakshadweep", fromYear: 1901, changes: [4.85, -6.31, 17.62, 14.43, 14.6, 14.61, 31.95, 26.53, 28.47, 17.3, 6.3] },
  { name: "Kerala", fromYear: 1901, changes: [11.75, 9.16, 21.85, 16.04, 22.82, 24.76, 26.29, 19.24, 14.32, 9.43, 4.91] },
  { name: "Nagaland", fromYear: 1901, changes: [46.76, 6.55, 12.62, 6.04, 12.3, 73.35, 39.88, 50.05, 56.08, 64.53, -0.58] },
];

export interface IndiaSpatial {
  ruralPopulation: number;
  urbanPopulation: number;
  ruralAreaSqKm: number;
  urbanAreaSqKm: number;
  ruralDensity: number;
  urbanDensity: number;
  densityRatio: number;
  inhabitedVillages: number;
  uninhabitedVillages: number;
  towns: number;
}

/** Where India actually lives, from Census 2011 Table A-1. */
export const INDIA_SPATIAL: IndiaSpatial = {
  ruralPopulation: 833748852,
  urbanPopulation: 377106125,
  ruralAreaSqKm: 3101473.97,
  urbanAreaSqKm: 102252.03,
  ruralDensity: 269,
  urbanDensity: 3688,
  densityRatio: 13.7,
  inhabitedVillages: 597608,
  uninhabitedVillages: 43324,
  towns: 7933,
};

export interface IndiaSocial {
  population: number;
  males: number;
  females: number;
  children06: number;
  maleChildren06: number;
  femaleChildren06: number;
  literate: number;
  illiterate: number;
  scheduledCaste: number;
  scheduledTribe: number;
  workers: number;
  marginalWorkers: number;
  nonWorkers: number;
  sexRatio: number;
  childSexRatio: number;
  literacyPercent: number;
}

/** Who India is, from the Census 2011 Primary Census Abstract. */
export const INDIA_SOCIAL: IndiaSocial = {
  population: 1210854977,
  males: 623270258,
  females: 587584719,
  children06: 164515253,
  maleChildren06: 85752254,
  femaleChildren06: 78762999,
  literate: 763638812,
  illiterate: 447216165,
  scheduledCaste: 201378372,
  scheduledTribe: 104545716,
  workers: 481888868,
  marginalWorkers: 119323297,
  nonWorkers: 728966109,
  sexRatio: 943,
  childSexRatio: 918,
  literacyPercent: 72.98,
};

export const COMMUTE_BANDS: string[] = ["No travel","0-1 km","2-5 km","6-10 km","11-20 km","21-30 km","31-50 km","51+ km","Not stated"];

export interface CommuteRow {
  mode: string;
  total: number;
  /** Aligned to COMMUTE_BANDS. A zero is meaningful, not missing. */
  values: (number | null)[];
}

/** Census 2011 Table B-28 — other workers by mode of travel and distance. */
export const COMMUTE: CommuteRow[] = [
  { mode: "All Modes", total: 200408230, values: [60174308, 32699104, 45752670, 27365589, 13323946, 7510524, 4864535, 5237375, 3480179] },
  { mode: "On foot", total: 45266568, values: [0, 23745884, 14297484, 7223200, 0, 0, 0, 0, 0] },
  { mode: "Bicycle", total: 26272609, values: [0, 3707522, 13030315, 5324105, 1944975, 2265692, 0, 0, 0] },
  { mode: "Moped/Scooter/Motor Cycle", total: 25464837, values: [0, 3181808, 9692650, 5695234, 3443182, 1115748, 765674, 332926, 1237615] },
  { mode: "Car/Jeep/Van", total: 5476050, values: [0, 451265, 1416759, 1173018, 1015482, 472356, 391698, 274099, 281373] },
  { mode: "Tempo/Autorickshaw/Taxi", total: 6040414, values: [0, 443486, 2106958, 1536981, 892688, 308772, 243986, 155089, 352454] },
  { mode: "Bus", total: 22901495, values: [0, 735997, 4303131, 5399703, 4745456, 2381647, 2193470, 2327868, 814223] },
  { mode: "Train", total: 7015528, values: [0, 242561, 490647, 692189, 1059169, 857873, 1147380, 1929085, 596624] },
  { mode: "Water transport", total: 489029, values: [0, 43912, 79863, 86721, 73540, 42179, 47148, 72418, 43248] },
  { mode: "Any other", total: 1307392, values: [0, 146669, 334863, 234438, 149454, 66257, 75179, 145890, 154642] },
  { mode: "No travel", total: 60174308, values: [60174308, 0, 0, 0, 0, 0, 0, 0, 0] },
];
