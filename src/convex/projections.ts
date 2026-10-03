import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

const projectionPointValidator = v.object({
  year: v.number(),
  population: v.number(),
  india: v.number(),
  multiple: v.number(),
});

/**
 * Stores a Census-grounded growth projection.
 *
 * This used to persist a simulator run: a canopy target, a congestion toll, a
 * misting toggle, and a series of temperature-drop, modal-shift and annual-saving
 * figures derived from them by linear formulas. None of those are Census
 * quantities, and no code read them back — the chart was write-only.
 *
 * What is stored now is the state's own observed decadal growth rate and the
 * population series produced by applying it. One row per state, so re-running
 * overwrites rather than accumulating.
 */
export const saveProjection = mutation({
  args: {
    state: v.string(),
    population: v.number(),
    observedRatePercent: v.number(),
    points: v.array(projectionPointValidator),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("projections")
      .withIndex("by_state", (q) => q.eq("state", args.state))
      .unique();

    const doc = {
      state: args.state,
      population: args.population,
      observedRatePercent: args.observedRatePercent,
      points: args.points,
      createdAt: Date.now(),
    };

    if (existing) {
      await ctx.db.patch(existing._id, doc);
      return existing._id;
    }
    return await ctx.db.insert("projections", doc);
  },
});

/** The stored projection for a state, if one has been run. */
export const getProjection = query({
  args: { state: v.string() },
  handler: async (ctx, { state }) => {
    const row = await ctx.db
      .query("projections")
      .withIndex("by_state", (q) => q.eq("state", state))
      .unique();
    if (!row) return null;
    return {
      state: row.state,
      population: row.population,
      observedRatePercent: row.observedRatePercent,
      points: row.points,
      createdAt: row.createdAt,
    };
  },
});

/** Every saved projection, newest first. */
export const listProjections = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("projections").order("desc").take(50);
    return rows.map((row) => ({
      state: row.state,
      population: row.population,
      observedRatePercent: row.observedRatePercent,
      points: row.points,
      createdAt: row.createdAt,
    }));
  },
});