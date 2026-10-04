/**
 * What a citizen report can be filed against.
 *
 * This was a pair of arrays written inline in `ReportPortal.tsx`. They had two
 * problems, both of which come from the same root cause — the values were typed
 * in rather than derived from anything:
 *
 *   1. Only four categories, all of them the same four, so a resident with a
 *      water complaint or a dead streetlight had nowhere to put it.
 *   2. `DISTRICTS` was `["Financial District", "North Suburban Hub",
 *      "Industrial Zone 4", "West Tech Corridor"]`. None of those is anywhere in
 *      India. Every ticket filed through the form was stamped with a place that
 *      does not exist.
 *
 * The categories below are the complaints an Indian municipal corporation
 * actually receives, each routed to the department that owns it. The places are
 * NOT hand-typed: they are the names `geo.ts` uses for the state bounding
 * boxes, which are the same names the Census charts resolve against, so a
 * report filed in Kerala says Kerala and cannot drift out of step with the data
 * shown beside it.
 */

import { PLACES } from "./geo";

export interface ReportCategory {
  /** What the citizen reads in the dropdown. */
  value: string;
  /** Short label for the chip on a filed ticket. */
  tag: string;
  /** Dropdown group, so 30 options stay navigable. */
  group: string;
  /** Where the ticket is routed. */
  dept: string;
  /** Accent for the chip, from the site palette. */
  color: string;
}

/** Dropdown group order. Groups are the way a citizen thinks about a complaint. */
export const REPORT_GROUPS: readonly string[] = [
  "Roads & Surfaces",
  "Water & Sanitation",
  "Environment",
  "Traffic & Transit",
  "Power & Utilities",
  "Health & Safety",
  "Parks & Public Space",
] as const;

export const REPORT_CATEGORIES: readonly ReportCategory[] = [
  /* ------------------------------------------------ Roads & Surfaces */
  {
    value: "Pothole / Damaged Road",
    tag: "Pothole",
    group: "Roads & Surfaces",
    dept: "Roads & Buildings Dept",
    color: "#F43F5E",
  },
  {
    value: "Waterlogging / Blocked Drain",
    tag: "Waterlogging",
    group: "Roads & Surfaces",
    dept: "Drainage & Sewerage Dept",
    color: "#06B6D4",
  },
  {
    value: "Open Manhole / Uncovered Pit",
    tag: "Open Manhole",
    group: "Roads & Surfaces",
    dept: "Drainage & Sewerage Dept",
    color: "#F43F5E",
  },
  {
    value: "Broken Footpath or Crossing",
    tag: "Footpath",
    group: "Roads & Surfaces",
    dept: "Roads & Buildings Dept",
    color: "#FBBF24",
  },
  {
    value: "Damaged Road Divider or Median",
    tag: "Divider",
    group: "Roads & Surfaces",
    dept: "Roads & Buildings Dept",
    color: "#06B6D4",
  },
  {
    value: "Unmarked Speed Breaker / Road Hump",
    tag: "Speed Breaker",
    group: "Roads & Surfaces",
    dept: "Traffic Police Dept",
    color: "#F43F5E",
  },

  /* ---------------------------------------------- Water & Sanitation */
  {
    value: "Water Supply Interruption",
    tag: "No Water",
    group: "Water & Sanitation",
    dept: "Water Supply Dept",
    color: "#06B6D4",
  },
  {
    value: "Contaminated or Brown Water",
    tag: "Bad Water",
    group: "Water & Sanitation",
    dept: "Water Supply Dept",
    color: "#F43F5E",
  },
  {
    value: "Sewage Overflow / Falling Waste",
    tag: "Sewage",
    group: "Water & Sanitation",
    dept: "Drainage & Sewerage Dept",
    color: "#F43F5E",
  },
  {
    value: "Garbage Not Collected",
    tag: "Garbage",
    group: "Water & Sanitation",
    dept: "Sanitation Dept",
    color: "#10B981",
  },
  {
    value: "Overflowing or Unusable Public Toilet",
    tag: "Public Toilet",
    group: "Water & Sanitation",
    dept: "Sanitation Dept",
    color: "#10B981",
  },
  {
    value: "Dead Animal or Stray Cattle on Road",
    tag: "Stray Cattle",
    group: "Water & Sanitation",
    dept: "Animal Husbandry Dept",
    color: "#A78BFA",
  },

  /* --------------------------------------------------- Environment */
  {
    value: "Air Pollution / Industrial Smoke",
    tag: "Air",
    group: "Environment",
    dept: "Environment Dept",
    color: "#F43F5E",
  },
  {
    value: "Noise Pollution",
    tag: "Noise",
    group: "Environment",
    dept: "Environment Dept",
    color: "#A78BFA",
  },
  {
    value: "Industrial Effluent in a Water Body",
    tag: "Effluent",
    group: "Environment",
    dept: "Environment Dept",
    color: "#F43F5E",
  },
  {
    value: "Construction Dust or Uncovered Site",
    tag: "Dust",
    group: "Environment",
    dept: "Building Permissions Dept",
    color: "#FBBF24",
  },
  {
    value: "Illegal Dumping of Waste",
    tag: "Dumping",
    group: "Environment",
    dept: "Sanitation Dept",
    color: "#F43F5E",
  },

  /* --------------------------------------------- Traffic & Transit */
  {
    value: "Traffic Signal Not Working",
    tag: "Signal",
    group: "Traffic & Transit",
    dept: "Traffic Police Dept",
    color: "#FBBF24",
  },
  {
    value: "Illegal Parking or Road Encroachment",
    tag: "Encroachment",
    group: "Traffic & Transit",
    dept: "Traffic Police Dept",
    color: "#06B6D4",
  },
  {
    value: "Overcrowded Transit Hub or Bus Shelter",
    tag: "Transit Hub",
    group: "Traffic & Transit",
    dept: "Transport Dept",
    color: "#FBBF24",
  },
  {
    value: "Missing or Dangerous Cycle Track",
    tag: "Cycle Track",
    group: "Traffic & Transit",
    dept: "Transport Dept",
    color: "#06B6D4",
  },
  {
    value: "Broken Divider or Median on a Highway",
    tag: "Highway",
    group: "Traffic & Transit",
    dept: "National Highways Dept",
    color: "#F43F5E",
  },

  /* --------------------------------------------- Power & Utilities */
  {
    value: "Streetlight Not Working",
    tag: "Streetlight",
    group: "Power & Utilities",
    dept: "Electrical Dept",
    color: "#FBBF24",
  },
  {
    value: "Power Cut or Transformer Failure",
    tag: "Power Cut",
    group: "Power & Utilities",
    dept: "Power Distribution Dept",
    color: "#F43F5E",
  },
  {
    value: "Gas Pipeline Leak or Supply Failure",
    tag: "Gas",
    group: "Power & Utilities",
    dept: "Gas Authority Dept",
    color: "#F43F5E",
  },
  {
    value: "Dangling or Fallen Cable / Wire",
    tag: "Cable",
    group: "Power & Utilities",
    dept: "Electricity Dept",
    color: "#A78BFA",
  },

  /* ------------------------------------------------ Health & Safety */
  {
    value: "Mosquito / Vector Borne Disease",
    tag: "Mosquito",
    group: "Health & Safety",
    dept: "Public Health Dept",
    color: "#F43F5E",
  },
  {
    value: "Hospital or Ambulance Service Complaint",
    tag: "Health",
    group: "Health & Safety",
    dept: "Health Dept",
    color: "#F43F5E",
  },
  {
    value: "Damaged School Building or Playground",
    tag: "School",
    group: "Health & Safety",
    dept: "Education Dept",
    color: "#10B981",
  },
  {
    value: "Unlit or Unsafe Public Place at Night",
    tag: "Dark Spot",
    group: "Health & Safety",
    dept: "Police / Safety Dept",
    color: "#A78BFA",
  },
  {
    value: "Other Safety or Security Concern",
    tag: "Safety",
    group: "Health & Safety",
    dept: "General Administration",
    color: "#64748B",
  },

  /* -------------------------------------- Parks & Public Space */
  {
    value: "Request Tree Planting",
    tag: "Tree Planting",
    group: "Parks & Public Space",
    dept: "Parks & Forestry Dept",
    color: "#10B981",
  },
  {
    value: "Illegal Tree Felling or Damaged Avenue",
    tag: "Tree Felling",
    group: "Parks & Public Space",
    dept: "Parks & Forestry Dept",
    color: "#F43F5E",
  },
  {
    value: "Park Not Maintained",
    tag: "Park",
    group: "Parks & Public Space",
    dept: "Parks Dept",
    color: "#10B981",
  },
  {
    value: "Unauthorised Hawking or Encroachment",
    tag: "Hawking",
    group: "Parks & Public Space",
    dept: "Trade & Hawkers Dept",
    color: "#A78BFA",
  },
] as const;

/** Categories in one dropdown group, in declaration order. */
export function categoriesInGroup(group: string): ReportCategory[] {
  return REPORT_CATEGORIES.filter((entry) => entry.group === group);
}

/** Look a category up by its dropdown value, which is what the form submits. */
export function categoryByValue(value: string): ReportCategory | undefined {
  return REPORT_CATEGORIES.find((entry) => entry.value === value);
}

/**
 * Every state and union territory a report can be filed against.
 *
 * Straight from `geo.ts`, so these are the same 36 names the Census charts use
 * and the same names the location detector emits. Nothing here is invented, and
 * every entry is a real unit of the Indian Union as it exists today — which is
 * why it lists Delhi and Telangana rather than the 2011 table's "NCT OF Delhi"
 * and undivided "Andhra Pradesh".
 */
export const REPORT_PLACES: readonly string[] = PLACES;

/** Matches the resolved location provider name to the picker's spelling. */
export function placeFromCensusState(state: string | null): string | null {
  if (!state) return null;
  // The provider resolves through the Census alias table, so a GPS fix in Delhi
  // arrives as "NCT OF Delhi". Only Delhi has a one-way rename that matters here;
  // "Andhra Pradesh" must stay as it is, because it is a real current unit and
  // the 2011 table simply does not know about Telangana.
  const back = state === "NCT OF Delhi" ? "Delhi" : state;
  return REPORT_PLACES.includes(back) ? back : null;
}

/**
 * The single string stored on a ticket.
 *
 * The state is chosen from a real list; the landmark is whatever the citizen
 * typed. Keeping the free-text half optional means a report can still be filed
 * by someone who only knows their state, and means the location field can never
 * offer a place that does not exist.
 */
export function locationLabel(place: string, landmark: string): string {
  const detail = landmark.trim();
  return detail ? `${place} — ${detail}` : place;
}