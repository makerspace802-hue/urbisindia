import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

const yearPointValidator = v.object({
  year: v.number(),
  tempDrop: v.number(),
  modalShift: v.number(),
  savings: v.number(),
});

/**
 * Store a simulated 10-year outlook. One row per city so re-running the
 * simulator overwrites the previous scenario instead of piling up history.
 */
export const saveProjection = mutation({
  args: {
    city: v.string(),
    population: v.number(),
    canopyBonus: v.number(),
    toll: v.number(),
    misting: v.boolean(),
    points: v.array(yearPointValidator),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("projections")
      .withIndex("by_city", (q) => q.eq("city", args.city))
      .unique();

    const doc = {
      city: args.city,
      population: args.population,
      canopyBonus: args.canopyBonus,
      toll: args.toll,
      misting: args.misting,
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

/** The stored outlook for a city, if the simulator has been run for it. */
export const getProjection = query({
  args: { city: v.string() },
  handler: async (ctx, { city }) => {
    const row = await ctx.db
      .query("projections")
      .withIndex("by_city", (q) => q.eq("city", city))
      .unique();
    if (!row) return null;
    return {
      city: row.city,
      population: row.population,
      canopyBonus: row.canopyBonus,
      toll: row.toll,
      misting: row.misting,
      points: row.points,
      createdAt: row.createdAt,
    };
  },
});

/** Every saved city outlook, newest first. */
export const listProjections = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("projections").order("desc").take(50);
    return rows.map((row) => ({
      city: row.city,
      population: row.population,
      points: row.points,
      createdAt: row.createdAt,
    }));
  },
});
