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
