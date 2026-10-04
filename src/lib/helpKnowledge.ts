/**
 * The help bot's knowledge and matching, with no React in it.
 *
 * Split out of the component for the same reason `stateTrends.ts` is its own
 * module: everything here is a claim the site makes, and a claim that can only
 * be checked by looking at a rendered panel is a claim nobody checks. Being a
 * pure module means the tests can actually run `ask()` and compare the answer
 * against `censusData.ts`.
 *
 * Two rules govern every answer:
 *
 *   1. No figure is typed in. Every population, rate, density and ratio is read
 *      out of the same generated modules the charts use. If the tables change,
 *      the bot changes with them.
 *   2. Nothing off-site. If no intent matches, the bot says so and offers the
 *      questions it can answer. It does not guess, and it does not answer
 *      questions about the weather, politics, or anything else in the world.
 */

import {
  CENTURY_MULTIPLE,
  FIRST_CENSUS_YEAR,
  INDIA_2011,
  INDIA_SOCIAL,
  INDIA_SPATIAL,
  LAST_CENSUS_YEAR,
  OPENING_CENSUS,
  STATE_GROWTH,
  STATE_PROFILE,
} from "./censusData";
import { censusName, PLACES } from "./geo";
import { indiaDecadalRatePercent } from "./censusInsights";
import { observedDecadalRate } from "./projection";
import {
  REPORT_CATEGORIES,
  REPORT_GROUPS,
  REPORT_PLACES,
} from "./reportTaxonomy";
import { stateTrendModel } from "./stateTrends";

/* ------------------------------------------------------------- helpers */

/** Indian digit grouping — 1,21,08,4977 rather than 1,210,849,77. */
const INDIAN = new Intl.NumberFormat("en-IN");
const num = (value: number): string => INDIAN.format(value);

const CRORE = 10_000_000;

/** 33.41 crore — how an Indian reader actually says this number. */
function crore(value: number, places = 2): string {
  return `${(value / CRORE).toFixed(places)} crore`;
}

/**
 * Lowercase, strip punctuation, collapse whitespace, and pad with spaces.
 *
 * Punctuation has to become a space rather than vanish: "sign-in" and "sign in"
 * must land on the same keywords, and `&` in "Dadra & Nagar Haveli" has to
 * disappear without gluing the words together. The padding is what makes
 * keyword matching whole-word — without it "id" matches inside "Delhi".
 */
function normalise(text: string): string {
  return ` ${text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ")} `;
}

/**
 * Score a keyword list against an already-normalised question.
 *
 * Weight is the word count, so the two-word "sign in" outranks a stray
 * one-word hit, and a specific phrase like "on this site" outranks "pages".
 */
function score(haystack: string, keywords: readonly string[]): number {
  let total = 0;
  for (const keyword of keywords) {
    const needle = keyword.trim();
    if (haystack.includes(` ${needle} `)) {
      total += needle.split(/\s+/).length;
    }
  }
  return total;
}

/**
 * Default bar for an intent to count as matched.
 *
 * Two points means either one specific multi-word phrase or two separate
 * keywords — enough that a bare "report" or "hi" cannot fire a canned answer on
 * its own by accident. Intents that are meaningful on a single word may lower
 * their own bar with `minScore`.
 */
const MIN_SCORE = 2;

/* -------------------------------------------------------- site contents */

export interface SitePage {
  route: string;
  name: string;
  blurb: string;
}

/** The routes in `main.tsx`, in the order they appear in the header. */
export const SITE_PAGES: readonly SitePage[] = [
  {
    route: "/",
    name: "Dashboard",
    blurb:
      "India's population across all eleven censuses from 1901 to 2011, four headline cards, the latest citizen tickets, and four table views.",
  },
  {
    route: "/analytics",
    name: "Analytics",
    blurb:
      "Your own state against India decade by decade, plus four all-India comparisons: growth league table, sex-ratio shift, density against urban share, and literacy against urban share.",
  },
  {
    route: "/report",
    name: "Report Issue",
    blurb:
      "File a civic complaint against one of 35 categories, attach a photo, track the ticket's status and upvotes, and see the public feed.",
  },
  {
    route: "/quiz",
    name: "My Impact",
    blurb:
      "Fifteen questions on commuting, diet, home power and waste, scored into an annual per-capita carbon estimate, followed by a population outlook for your state.",
  },
  {
    route: "/dashboard",
    name: "Workspace",
    blurb: "Signed-in only. Your sustainability score, saved results and settings.",
  },
  {
    route: "/auth",
    name: "Sign In",
    blurb: "Email OTP, password or Google — whichever you prefer.",
  },
] as const;

/** Tabs in `CensusCharts`. */
const CHART_VIEWS: readonly string[] = [
  "Every Census",
  "Where We Live",
  "Who We Are",
  "Getting To Work",
] as const;

/** The 15 prompts in `Quiz.tsx`, condensed into topic names. */
const QUIZ_TOPICS: readonly string[] = [
  "how you get to work",
  "how long that commute takes",
  "flights taken in the last year",
  "plant-based meals in a week",
  "food thrown away in a month",
  "what heats or cools your home",
  "share of lights that are LEDs",
  "clothes dryer use",
  "devices charged overnight",
  "whether you own a petrol or diesel vehicle",
  "cooking fuel supply",
  "how much waste you recycle or compost",
  "new clothing bought in three months",
  "average shower length",
  "single-use plastic",
] as const;

/* ------------------------------------------------------ place matching */

/**
 * Cities mapped to the state they are in.
 *
 * Purely so the bot can redirect "what is the population of Mumbai" instead of
 * shrugging: the site has no city-level Census rows at all, only state rows, so
 * the honest answer is the city's state's figure plus a note about why. This is
 * geography, not measurement — nothing here is ever presented as a statistic.
 */
const CITY_PLACE: Readonly<Record<string, string>> = {
  mumbai: "Maharashtra",
  pune: "Maharashtra",
  nagpur: "Maharashtra",
  nashik: "Maharashtra",
  thane: "Maharashtra",
  aurangabad: "Maharashtra",
  bengaluru: "Karnataka",
  bangalore: "Karnataka",
  mysuru: "Karnataka",
  mysore: "Karnataka",
  hubballi: "Karnataka",
  hyderabad: "Telangana",
  warangal: "Telangana",
  chennai: "Tamil Nadu",
  coimbatore: "Tamil Nadu",
  madurai: "Tamil Nadu",
  tiruchirappalli: "Tamil Nadu",
  kolkata: "West Bengal",
  calcutta: "West Bengal",
  howrah: "West Bengal",
  lucknow: "Uttar Pradesh",
  kanpur: "Uttar Pradesh",
  varanasi: "Uttar Pradesh",
  agra: "Uttar Pradesh",
  prayagraj: "Uttar Pradesh",
  ghaziabad: "Uttar Pradesh",
  jaipur: "Rajasthan",
  jodhpur: "Rajasthan",
  udaipur: "Rajasthan",
  ahmedabad: "Gujarat",
  surat: "Gujarat",
  vadodara: "Gujarat",
  bhopal: "Madhya Pradesh",
  indore: "Madhya Pradesh",
  jabalpur: "Madhya Pradesh",
  gwalior: "Madhya Pradesh",
  patna: "Bihar",
  gaya: "Bihar",
  kochi: "Kerala",
  cochin: "Kerala",
  thiruvananthapuram: "Kerala",
  kozhikode: "Kerala",
  guwahati: "Assam",
  dibrugarh: "Assam",
  bhubaneswar: "Odisha",
  cuttack: "Odisha",
  ranchi: "Jharkhand",
  jamshedpur: "Jharkhand",
  raipur: "Chhattisgarh",
  bhilai: "Chhattisgarh",
  dehradun: "Uttarakhand",
  haridwar: "Uttarakhand",
  shimla: "Himachal Pradesh",
  srinagar: "Jammu & Kashmir",
  jammu: "Jammu & Kashmir",
  panaji: "Goa",
  panjim: "Goa",
  agartala: "Tripura",
  imphal: "Manipur",
  shillong: "Meghalaya",
  aizawl: "Mizoram",
  kohima: "Nagaland",
  gangtok: "Sikkim",
  itanagar: "Arunachal Pradesh",
  "port blair": "Andaman & Nicobar Islands",
  kavaratti: "Lakshadweep",
  pondicherry: "Puducherry",
  puducherry: "Puducherry",
  silvassa: "Dadra & Nagar Haveli",
  daman: "Daman & Diu",
  diu: "Daman & Diu",
};

export interface PlaceHit {
  /** Name as the site spells it, e.g. "Maharashtra". */
  place: string;
  /** The city that was named, when the question named a city. */
  city: string | null;
  /** True when the question named a city the site has no rows for. */
  viaCity: boolean;
}

/** Capitalises "port blair" to "Port Blair" for display. */
const titleCase = (value: string): string =>
  value.replace(/\b\w/g, (character) => character.toUpperCase());

/**
 * Find a place named anywhere in the question.
 *
 * Longest name first, so "andaman nicobar islands" is tried before anything
 * shorter sitting inside it. Matching happens on the padded-normalised form, so
 * "Dadra & Nagar Haveli" is findable however the visitor types it.
 */
export function resolvePlace(question: string): PlaceHit | null {
  const haystack = normalise(question);

  const byLength = [...PLACES].sort((a, b) => b.length - a.length);
  for (const name of byLength) {
    if (haystack.includes(normalise(name))) {
      return { place: name, city: null, viaCity: false };
    }
  }

  for (const [city, place] of Object.entries(CITY_PLACE)) {
    if (haystack.includes(` ${city} `)) {
      return { place, city: titleCase(city), viaCity: true };
    }
  }

  return null;
}

/* ------------------------------------------------------------- answers */

export interface HelpReply {
  /** The answer itself. Plain text — rendered as text, never as markup. */
  text: string;
  /** Follow-ups the visitor can tap. */
  suggestions: string[];
  /** Where the answer came from. Never blank, so a claim is always traceable. */
  source: string;
  /** Set when the answer points somewhere on the site. */
  route?: string;
  /** True when nothing on the site matched. */
  declined?: boolean;
}

const REFUSAL_SUGGESTIONS = [
  "What pages are on this site?",
  "Where does the data come from?",
  "How do I report an issue?",
  "How does the site know my state?",
];

function declined(question: string): HelpReply {
  const asked = question.trim();
  return {
    text:
      "I only answer questions about URBIS India — the pages, the data it shows, and how to use it. " +
      (asked.length > 0
        ? `I have nothing on site about "${asked.slice(0, 60)}".`
        : "Ask me something about the site itself.") +
      " Try one of these:",
    suggestions: REFUSAL_SUGGESTIONS,
    source: "scope guard — no intent matched",
    declined: true,
  };
}

function indiaCensus(): HelpReply {
  return {
    text:
      "Every figure comes from Census of India 2011.\n\n" +
      `• Population in ${LAST_CENSUS_YEAR}: ${num(INDIA_2011.population)} (${crore(INDIA_2011.population)})\n` +
      `• Population in ${FIRST_CENSUS_YEAR}: ${num(OPENING_CENSUS.population)} (${crore(OPENING_CENSUS.population)})\n` +
      `• Growth ${LAST_CENSUS_YEAR - 10}–${LAST_CENSUS_YEAR}: +${indiaDecadalRatePercent().toFixed(2)}%\n` +
      `• Multiple over the century: ${CENTURY_MULTIPLE}×\n` +
      `• Urban share: ${INDIA_2011.urbanSharePercent}%\n` +
      `• Density: ${num(INDIA_2011.density)} per km²\n` +
      `• Households: ${num(INDIA_2011.households)}\n` +
      `• Literacy: ${INDIA_SOCIAL.literacyPercent}%\n` +
      `• Sex ratio: ${INDIA_SOCIAL.sexRatio} females per 1,000 males\n` +
      `• Inhabited villages: ${num(INDIA_SPATIAL.inhabitedVillages)}`,
    suggestions: [
      "How fast did India grow 2001 to 2011?",
      "How many people are in Kerala?",
      "What are the four dashboard chart views?",
      "Where does the data come from?",
    ],
    source:
      "censusData.ts — Census of India 2011 tables A-1, A-2 and the Primary Census Abstract",
  };
}

/**
 * How a state got to where it is, across every census it appears in.
 *
 * The 1901 figure is reconstructed by inverting the eleven decadal
 * percentages, because `STATE_DECADAL` stores percentage changes and no
 * populations at all. That reconstruction is only valid where the chain has no
 * gap, and it is said so in the answer rather than presented as a printed
 * figure.
 */
function stateTrendAnswer(hit: PlaceHit, model: NonNullable<ReturnType<typeof stateTrendModel>>): HelpReply {
  const observed = model.series.filter((point) => point.state !== null);
  const best = observed.reduce((a, b) => ((b.state ?? 0) > (a.state ?? 0) ? b : a));
  const worst = observed.reduce((a, b) => ((b.state ?? 0) < (a.state ?? 0) ? b : a));

  const start = model.populationAtStart;
  const startLine =
    start === null
      ? `• Population in ${model.fromYear}: not reconstructible — this unit is missing a decadal step`
      : `• Population in ${model.fromYear}: ${num(Math.round(start))} (reconstructed from the decadal series, not a printed figure)`;

  return {
    text:
      `${model.name} across the whole Census of India series.\n\n` +
      `• First census it appears in: ${model.fromYear}\n` +
      `${startLine}\n` +
      `• Population in ${LAST_CENSUS_YEAR}: ${num(model.growth.population2011)}\n` +
      (start === null
        ? ""
        : `• Multiple over that span: ${(model.growth.population2011 / start).toFixed(2)}×\n`) +
      `• Fastest decade: ${best.label} at +${best.state?.toFixed(2)}%\n` +
      `• Slowest decade: ${worst.label} at ${(worst.state ?? 0) < 0 ? "" : "+"}${worst.state?.toFixed(2)}%\n` +
      `• Population rank today: ${model.populationRank} of ${model.stateCount}`,
    suggestions: [
      "Which state grew fastest?",
      "How does my state compare to India?",
      `What is the projection for ${hit.place}?`,
    ],
    source: `censusData.ts — ${model.name} decadal series, back-chained from Census 2011`,
    route: "/analytics",
  };
}

/**
 * The units at either end of a ranking, straight off the tables.
 *
 * Used when the question asks for an extreme ("which state grew fastest") —
 * answering with a description of the Analytics page instead of the answer is
 * technically correct and useless.
 */
interface Metric {
  title: string;
  words: readonly string[];
  /** Sort key; higher sorts first. */
  value: (name: string) => number | null;
  format: (value: number) => string;
}

const METRICS: readonly Metric[] = [
  {
    title: "Fastest growth, 2001–2011",
    words: ["fastest", "grew fastest", "quickest", "highest growth"],
    value: (name) => growthFor(name)?.percentChange ?? null,
    format: (v) => `${v < 0 ? "" : "+"}${v.toFixed(2)}%`,
  },
  {
    title: "Slowest growth, 2001–2011",
    words: ["slowest", "shrank", "declined", "lost population"],
    value: (name) => growthFor(name)?.percentChange ?? null,
    format: (v) => `${v < 0 ? "" : "+"}${v.toFixed(2)}%`,
  },
  {
    title: "Most populous, Census 2011",
    words: ["most populous", "highest population", "largest population", "biggest"],
    value: (name) => growthFor(name)?.population2011 ?? null,
    format: (v) => `${num(v)} (${(v / CRORE).toFixed(2)} crore)`,
  },
  {
    title: "Highest literacy, Census 2011",
    words: ["most literate", "highest literacy"],
    value: (name) => profileFor(name)?.literacyPercent ?? null,
    format: (v) => `${v}%`,
  },
  {
    title: "Highest sex ratio, Census 2011",
    words: ["best sex ratio", "highest sex ratio", "gender ratio"],
    value: (name) => growthFor(name)?.sexRatio2011 ?? null,
    format: (v) => `${num(v)} females per 1,000 males`,
  },
  {
    title: "Densest, Census 2011",
    words: ["densest", "most crowded", "highest density"],
    value: (name) => profileFor(name)?.density ?? null,
    format: (v) => `${num(v)} per km²`,
  },
  {
    title: "Most urban, Census 2011",
    words: ["most urban", "most urbanised", "most urbanized", "highest urban share"],
    value: (name) => profileFor(name)?.urbanSharePercent ?? null,
    format: (v) => `${v}%`,
  },
];

const growthFor = (name: string) =>
  STATE_GROWTH.find((g) => g.name === name) ?? null;
const profileFor = (name: string) =>
  STATE_PROFILE.find((p) => p.name === name) ?? null;

function rankedAnswer(question: string): HelpReply | null {
  const haystack = normalise(question);
  for (const metric of METRICS) {
    if (score(haystack, metric.words) === 0) continue;

    const rows = STATE_GROWTH.map((g) => ({
      name: g.name,
      value: metric.value(g.name),
    }))
      .filter((row): row is { name: string; value: number } => row.value !== null)
      .sort((a, b) => b.value - a.value);

    if (rows.length === 0) continue;

    // "Slowest" reads the same list from the bottom.
    const reversed = metric.words.some((word) =>
      ["slowest", "shrank", "declined", "lost population"].includes(word),
    );
    const shown = reversed ? rows.slice(-3).reverse() : rows.slice(0, 3);

    return {
      text:
        `${metric.title}:\n\n` +
        shown
          .map((row, index) => `${index + 1}. ${row.name} — ${metric.format(row.value)}`)
          .join("\n") +
        `\n\nAll ${rows.length} units are ranked, not just these three.`,
      suggestions: [
        "What is on the Analytics page?",
        "Where does the data come from?",
        "How many people are in Kerala?",
      ],
      source: `censusData.ts — ${metric.title}, ranked across all ${rows.length} units`,
      route: "/analytics",
    };
  }
  return null;
}

function stateAnswer(hit: PlaceHit): HelpReply {
  const model = stateTrendModel(censusName(hit.place));
  if (!model) {
    return {
      text: `${hit.place} is one of the ${REPORT_PLACES.length} places URBIS covers, but no Census row is loaded for it.`,
      suggestions: ["Which states do you cover?", "Where does the data come from?"],
      source: "reportTaxonomy.ts",
    };
  }

  const { growth, profile } = model;
  const lead = hit.viaCity
    ? `URBIS carries no city-level Census rows — only state and union-territory rows — so here is ${hit.city}'s state, ${hit.place}.`
    : `${hit.place}, from Census 2011:`;

  const shrank = growth.percentChange < 0;

  return {
    text:
      `${lead}\n\n` +
      `• Population: ${num(growth.population2011)} (${crore(growth.population2011)})\n` +
      `• Growth ${LAST_CENSUS_YEAR - 10}–${LAST_CENSUS_YEAR}: ${shrank ? "" : "+"}${growth.percentChange.toFixed(2)}%` +
      `${shrank ? " — the only state that shrank" : ""}\n` +
      `• Rank by population: ${model.populationRank} of ${model.stateCount}\n` +
      `• Density: ${profile.density === null ? "not published" : `${num(profile.density)} per km²`}\n` +
      `• Urban share: ${profile.urbanSharePercent}%\n` +
      `• Literacy: ${profile.literacyPercent}%\n` +
      `• Sex ratio: ${growth.sexRatio2011} females per 1,000 males\n` +
      `• Households: ${num(profile.households)}`,
    suggestions: [
      `How has ${hit.place} changed since ${model.fromYear}?`,
      "Which states grew fastest?",
      "How does my state compare to India?",
      `What is the projection for ${hit.place}?`,
    ],
    source: `censusData.ts — ${hit.place} rows, Census of India 2011`,
    route: "/analytics",
  };
}

/** Categories in a group, for the report summary. */
function categoriesIn(group: string): number {
  return REPORT_CATEGORIES.filter((entry) => entry.group === group).length;
}

/* ------------------------------------------------------------ intents */

interface Intent {
  id: string;
  keywords: readonly string[];
  /** The question must also mention one of these. */
  requires?: readonly string[];
  /** The question must name a place, so this never fires on the national answer. */
  placeRequired?: boolean;
  /** Override `MIN_SCORE` where a single word is already unambiguous. */
  minScore?: number;
  /** Skip unless the question is this short — stops a greeting swallowing a real one. */
  maxWords?: number;
  run: (question: string, hit: PlaceHit | null) => HelpReply;
}

const INTENTS: readonly Intent[] = [
  {
    id: "greeting",
    keywords: ["hello", "hi", "hey", "namaste", "good morning", "good evening"],
    minScore: 1,
    // "translate good morning into french" contains a greeting phrase but is not
    // a greeting. Anything longer than a hello is taken at face value instead.
    maxWords: 4,
    run: () => ({
      text:
        "I'm the URBIS assistant. I know what's on this site — the Census pages, the analytics, " +
        "the complaint portal, the carbon quiz and your account. What would you like to know?",
      suggestions: [
        "What pages are on this site?",
        "Where does the data come from?",
        "How do I report an issue?",
        "How fast did India grow 2001 to 2011?",
      ],
      source: "helpKnowledge.ts",
    }),
  },
  {
    id: "capabilities",
    keywords: [
      "what can you do",
      "who are you",
      "what are you",
      "help me",
      "what do you know",
      "how does this work",
    ],
    run: () => ({
      text:
        "I answer questions about this site only. I can tell you:\n\n" +
        "• what each page shows\n" +
        "• where the Census figures come from\n" +
        "• any state's 2011 population, growth, density, literacy or sex ratio\n" +
        "• how to file a complaint, and what the categories are\n" +
        "• how the site works out which state you are in\n" +
        "• how the carbon quiz is scored\n" +
        "• how to sign in, and what the workspace holds",
      suggestions: [
        "What pages are on this site?",
        "Where does the data come from?",
        "What is the carbon quiz?",
        "How do I sign in?",
      ],
      source: "helpKnowledge.ts",
    }),
  },
  {
    id: "state",
    keywords: [
      "population",
      "how many",
      "people",
      "literacy",
      "density",
      "sex ratio",
      "urban",
      "households",
      "grew",
      "growth",
      "changed",
      "how has",
      "tell me about",
      "number of",
      "profile",
      "changed",
      "how has",
      "history",
      "over the years",
      "every census",
    ],
    placeRequired: true,
    // A named place plus one data word is already unambiguous — "population of
    // Mumbai" is a single-word match on the data side, and there is nothing else
    // on the site it could mean.
    minScore: 1,
    run: (question, hit) => {
      const model = stateTrendModel(censusName((hit as PlaceHit).place));
      // "How has X changed" wants the century, not a single snapshot.
      if (model && score(normalise(question), ["changed", "how has", "history", "over the years"]) > 0) {
        return stateTrendAnswer(hit as PlaceHit, model);
      }
      return stateAnswer(hit as PlaceHit);
    },
  },
  {
    id: "pages",
    keywords: [
      "pages",
      "on this site",
      "sections",
      "menu",
      "navigate",
      "navigation",
      "navigate through",
      "navigate around",
      "get around",
      "move around",
      "find my way",
      "way around",
      "links",
      "route",
      "routes",
      "go to",
      "where is",
      "where do i go",
    ],
    // "How do I navigate through the website?" contains exactly one of these
    // words and is unmistakably a question about getting around the site, so
    // the two-point default bar rejected it. The bar exists to stop a stray
    // "report" or "hi" firing an answer; none of these words is ambiguous.
    minScore: 1,
    run: () => ({
      text:
        `URBIS India has ${SITE_PAGES.length} routes:\n\n` +
        SITE_PAGES.map(
          (page) => `• ${page.name} — ${page.route}\n  ${page.blurb}`,
        ).join("\n"),
      suggestions: [
        "What are the four dashboard chart views?",
        "Where does the data come from?",
        "How do I report an issue?",
        "What is in my workspace?",
      ],
      source: "main.tsx routes and AppHeader.tsx tabs",
      route: "/",
    }),
  },
  {
    id: "report",
    keywords: [
      "report",
      "report an issue",
      "file an issue",
      "file against",
      "complaint",
      "complain",
      "grievance",
      "ticket",
      "civic",
      "pothole",
      "garbage",
      "streetlight",
      "category",
      "categories",
      "upvote",
      "resolve",
      "how many",
      "how much",
    ],
    run: (question) => {
      // "How many states can I file against?" wants a number, not a list.
      const haystack = normalise(question);
      if (
        score(haystack, ["how many", "how much"]) > 0 &&
        score(haystack, ["state", "states", "city", "cities", "place", "places", "location", "locations"]) > 0
      ) {
        return {
          text:
            `All ${REPORT_PLACES.length} states and union territories are offered, and every one of them is a real current unit — Delhi and Telangana rather than the 2011 table's "NCT OF Delhi" and undivided "Andhra Pradesh".\n\n` +
            `If you allow location, the portal offers to fill it in from your fix. It never fills it in silently, because a ticket stamped to the wrong state is worse than one extra tap.`,
          suggestions: [
            "How do I report an issue?",
            "How does the site know my state?",
            "Where does the data come from?",
          ],
          source: "reportTaxonomy.ts — REPORT_PLACES",
          route: "/report",
        };
      }

      return {
      text:
        `On Report Issue you file against one of ${REPORT_CATEGORIES.length} categories in ${REPORT_GROUPS.length} groups:\n\n` +
        REPORT_GROUPS.map((group) => `• ${group} — ${categoriesIn(group)}`).join("\n") +
        `\n\nYou pick your state or union territory — all ${REPORT_PLACES.length} are offered — and optionally add a landmark, set an urgency, and attach a photo. ` +
        `You get a ticket number, and the ticket appears in the public feed where anyone can upvote it.`,
      suggestions: [
        "How many states can I file against?",
        "Do I need an account to report?",
        "How does the site know my state?",
        "What is in my workspace?",
      ],
      source: "reportTaxonomy.ts and ReportPortal.tsx",
      route: "/report",
      };
    },
  },
  {
    id: "signin",
    keywords: [
      "sign in",
      "signin",
      "log in",
      "login",
      "register",
      "sign up",
      "signup",
      "need an account",
      "account",
      "auth",
      "google",
      "otp",
      "password",
    ],
    run: () => ({
      text:
        "Sign in from the header, or go straight to /auth. There are three ways: an email OTP, a password, or Google.\n\n" +
        "Signing in is required to file a report and to attach a photo, and it unlocks the Workspace at /dashboard — your sustainability score and saved results. " +
        "Reading every other page on the site works without an account.",
      suggestions: [
        "Do I need an account to report?",
        "What is in my workspace?",
        "What pages are on this site?",
      ],
      source: "Auth.tsx, RequireAuth.tsx and main.tsx",
      route: "/auth",
    }),
  },
  {
    id: "workspace",
    keywords: [
      "workspace",
      "my workspace",
      "my account",
      "saved",
      "my results",
      "my score",
      "sustainability score",
    ],
    run: () => ({
      text:
        "The Workspace at /dashboard is the signed-in area. It shows your sustainability score from the quiz, links to your saved results, and holds your personal settings.\n\n" +
        "It is the only page behind a sign-in — everything else on URBIS is public.",
      suggestions: [
        "How do I sign in?",
        "What is the carbon quiz?",
        "What pages are on this site?",
      ],
      source: "Dashboard.tsx and RequireAuth.tsx",
      route: "/dashboard",
    }),
  },
  {
    id: "location",
    keywords: [
      "location",
      "geolocation",
      "gps",
      "where am i",
      "my city",
      "my state",
      "know my state",
      "states do you cover",
      "detect",
      "detected",
      "privacy",
      "coordinates",
      "ip address",
    ],
    run: () => ({
      text:
        "Every screen shares one location fix, resolved in this order:\n\n" +
        "1. A cached fix, if one was taken in the last 6 hours\n" +
        "2. Your browser's GPS, if you allow it\n" +
        "3. An approximate IP lookup, if GPS is unavailable\n" +
        "4. The configured default city, so nothing ever renders blank\n\n" +
        `The fix is matched against the boundaries of all ${PLACES.length} states and union territories. ` +
        "IP and default-city answers are always labelled as approximate, and if your browser refuses location the site tells you which fallback it used rather than pretending to know where you are.",
      suggestions: [
        "How does the site know my state?",
        "Which states do you cover?",
        "Where does the weather come from?",
      ],
      source: "locate.ts, geo.ts and LocationProvider.tsx",
    }),
  },
  {
    id: "weather",
    keywords: [
      "weather",
      "temperature",
      "forecast",
      "raining",
      "humidity",
      "wind",
      "what is the weather",
      "where does the weather",
    ],
    run: () => ({
      text:
        "The clock and weather widget at the top-left reads live conditions for your located fix. It is the only live, non-Census reading on the site, and it refreshes every 15 minutes.\n\n" +
        "I can't tell you the weather anywhere else, and can't forecast it: the site holds no forecast data, only the current reading at your own position.",
      suggestions: [
        "How does the site know my state?",
        "Where does the data come from?",
      ],
      source: "weather.ts and ClockWeatherWidget.tsx",
    }),
  },
  {
    id: "settings",
    keywords: [
      "settings",
      "theme",
      "dark mode",
      "light mode",
      "clock",
      "analog",
      "digital",
      "appearance",
    ],
    run: () => ({
      text:
        "The gear button at the top-right of the header opens settings. There are two:\n\n" +
        "• Theme — light or dark. Dark is the default and is applied before the page paints, so there is no flash of the wrong theme.\n" +
        "• Clock mode — digital or analog, for the widget at the top-left.\n\n" +
        "Both are remembered in your browser, not on your account.",
      suggestions: [
        "What pages are on this site?",
        "How do I sign in?",
        "What is the theme like?",
      ],
      source: "SettingsProvider.tsx and SettingsPanel.tsx",
    }),
  },
  {
    id: "quiz",
    keywords: [
      "quiz",
      "carbon",
      "footprint",
      "co2",
      "emissions",
      "my impact",
      "impact score",
      "questions",
      "habit",
      "habits",
      "sustainability",
      "greenhouse",
    ],
    run: () => ({
      text:
        `My Impact asks ${QUIZ_TOPICS.length} questions and sums them into an estimated annual per-capita footprint in kg CO2e.\n\n` +
        `It covers ${QUIZ_TOPICS.slice(0, 5).join(", ")}, ${QUIZ_TOPICS.slice(5, 10).join(", ")}, and ${QUIZ_TOPICS.slice(10).join(", ")}.\n\n` +
        "Your result is scaled against the population of the state you are actually in, read from Census 2011.\n\n" +
        "Worth being straight about: the per-answer coefficients are URBIS's own weighting, not a measured inventory. It is a comparison tool, not an audit.",
      suggestions: [
        "What does the outlook below the quiz do?",
        "How fast did India grow 2001 to 2011?",
        "What pages are on this site?",
      ],
      source: "Quiz.tsx and QuizPage.tsx",
      route: "/quiz",
    }),
  },
  {
    id: "projection",
    keywords: [
      "projection",
      "projection for",
      "outlook",
      "outlook for",
      "forecast",
      "2031",
      "2041",
      "predict",
      "prediction",
      "future",
      "grow by",
      "growth rate",
    ],
    run: (_question, hit) => {
      const state = hit ? censusName(hit.place) : null;
      const label = state ?? "India";
      const rate = observedDecadalRate(state) * 100;
      return {
        text:
          `The outlook on My Impact extrapolates ${label}'s own observed ${LAST_CENSUS_YEAR - 10}–${LAST_CENSUS_YEAR} decadal rate — currently ${rate.toFixed(2)}% a decade — forward to ${LAST_CENSUS_YEAR + 20} and ${LAST_CENSUS_YEAR + 30} on a flat rate, with India alongside for comparison.\n\n` +
          "Two honest limits. The Census stops at 2011, so nothing past that year is observed. And Indian decadal growth slowed steadily through the twentieth century, so holding the rate flat almost certainly overstates the later decades. It is labelled as an extrapolation everywhere it appears.",
        suggestions: [
          "How does the site know my state?",
          "What is the carbon quiz?",
          "Where does the data come from?",
        ],
        source: "projection.ts and ProjectionChart.tsx",
        route: "/quiz",
      };
    },
  },
  {
    id: "analytics",
    keywords: [
      "analytics",
      "chart",
      "charts",
      "compare",
      "comparison",
      "league",
      "insight",
      "insights",
      "fastest",
      "slowest",
      "densest",
      "grew fastest",
      "states grew",
      "which state",
      "literacy",
      "sex ratio",
      "density",
      "urban share",
    ],
    run: (question) => {
      // A question about an extreme is answered with the ranking, not a tour of
      // the page it happens to live on.
      const ranked = rankedAnswer(question);
      if (ranked) return ranked;

      return {
      text:
        "Analytics has two halves that deliberately do not overlap.\n\n" +
        "State Trends — one state, resolved from your location, charted against India across all eleven censuses and the last decade. You can pick a different state by hand.\n\n" +
        "Census Insights — all 35 states compared with each other on four things nothing else plots: the growth league table, the shift in sex ratio, density against urban share on a log axis, and literacy against urban share.\n\n" +
        "The dashboard keeps the other four table views, so between the two pages every Census table is drawn exactly once.",
      suggestions: [
        "What are the four dashboard chart views?",
        "Which state grew fastest?",
        "How many people are in Kerala?",
        "Where does the data come from?",
      ],
      source: "Analytics.tsx, StateTrends.tsx and CensusInsights.tsx",
      route: "/analytics",
      };
    },
  },
  {
    id: "datacharts",
    keywords: [
      "view",
      "views",
      "chart views",
      "table",
      "tables",
      "every census",
      "getting to work",
      "where we live",
      "who we are",
    ],
    run: () => ({
      text:
        `The dashboard draws the Census tables in ${CHART_VIEWS.length} tabs:\n\n` +
        CHART_VIEWS.map((view) => `• ${view}`).join("\n") +
        "\n\nEvery Census is the 1901–2011 population series. Where We Live splits rural and urban population, density and villages. Who We Are covers literacy, caste and tribe share, and the sex ratio. Getting To Work is Census Table B-28 — travel mode by distance band.",
      suggestions: [
        "What is on the Analytics page?",
        "Where does the data come from?",
        "What pages are on this site?",
      ],
      source: "CensusCharts.tsx VIEWS",
      route: "/",
    }),
  },
  {
    id: "datasource",
    keywords: [
      "data source",
      "where does the data",
      "where data",
      "source",
      "sources",
      "accurate",
      "real data",
      "reliable",
      "census of india",
      "trust",
      "verified",
      "made up",
      "fake",
      "2011",
      "1901",
    ],
    run: () => ({
      text:
        "Every figure on URBIS is read from the Census of India 2011 tables, and nothing is hand-entered. Four of them back the site:\n\n" +
        `• Table A-2 — decadal population ${FIRST_CENSUS_YEAR} to ${LAST_CENSUS_YEAR}\n` +
        "• Table A-1 — villages, towns, households, area\n" +
        "• Primary Census Abstract — literacy, caste and tribe, sex ratio, workers\n" +
        "• Table B-28 — travel mode by distance\n\n" +
        "Those are compiled into a generated TypeScript module, and a test cross-checks every place name the location detector can produce against the rows that actually exist — so a chart can never silently render nothing.\n\n" +
        "Earlier versions of this site carried invented charts: a district heat-island series, a modal split by hour, and a climate simulator whose numbers came out of linear formulas. All of that was removed rather than relabelled. The one live, non-Census reading on the site is the current weather at your own position.",
      suggestions: [
        "How fast did India grow 2001 to 2011?",
        "Which states grew fastest?",
        "What pages are on this site?",
      ],
      source: "data/data-1..4.csv via scripts/build-census-data.mjs",
    }),
  },
  {
    id: "india",
    keywords: [
      "india",
      "census",
      "population",
      "growth",
      "decade",
      "how many",
      "how fast",
      "national",
      "nationwide",
      "whole country",
    ],
    run: () => indiaCensus(),
  },
] as const;

/**
 * Ask the bot something.
 *
 * Keyword scoring rather than a model call, on purpose. Every answer here is
 * generated from the site's own modules, so it cannot invent a figure, it needs
 * no API key, and nothing the visitor types leaves the browser. The cost is that
 * it only knows what these intents cover — which is precisely why anything
 * unmatched is declined rather than answered with a guess.
 */
export function ask(question: string): HelpReply {
  if (!question.trim()) {
    return {
      text: "Ask me anything about URBIS India — the pages, the Census data, or how to use the site.",
      suggestions: [
        "What pages are on this site?",
        "Where does the data come from?",
        "How do I report an issue?",
      ],
      source: "helpKnowledge.ts",
    };
  }

  const haystack = normalise(question);
  const hit = resolvePlace(question);
  const wordCount = question.trim().split(/\s+/).length;

  let best: { intent: Intent; score: number } | null = null;
  for (const intent of INTENTS) {
    if (intent.placeRequired && !hit) continue;
    if (intent.maxWords !== undefined && wordCount > intent.maxWords) continue;

    const points = score(haystack, intent.keywords);
    if (points === 0) continue;
    if (intent.requires && score(haystack, intent.requires) === 0) continue;

    // A place-specific intent beats a general one on a tie: "population of
    // Mumbai" scores the same for the state lookup and the national answer, and
    // the state lookup is the correct one.
    const beatsTie =
      intent.placeRequired === true && best?.intent.placeRequired !== true;
    if (!best || points > best.score || (points === best.score && beatsTie)) {
      best = { intent, score: points };
    }
  }

  if (!best || best.score < (best.intent.minScore ?? MIN_SCORE)) {
    return declined(question);
  }

  return best.intent.run(question, hit);
}

/** Questions offered on the empty state and after a decline. */
export const STARTER_QUESTIONS: readonly string[] = [
  "What pages are on this site?",
  "Where does the data come from?",
  "How many people are in Kerala?",
  "How fast did India grow 2001 to 2011?",
  "How do I report an issue?",
  "How does the site know my state?",
  "What is the carbon quiz?",
  "Which state grew fastest?",
];