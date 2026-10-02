import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/** Persist (or replace) the signed-in resident's latest footprint estimate. */
export const submitQuizScore = mutation({
  args: {
    city: v.string(),
    country: v.string(),
    footprintKg: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Sign in to save your result");
    const user = await ctx.db.get(userId);
    const email = user?.email ?? "anonymous";

    const existing = await ctx.db
      .query("quizScores")
      .withIndex("by_email", (q) => q.eq("email", email))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        city: args.city,
        country: args.country,
        footprintKg: args.footprintKg,
        createdAt: Date.now(),
      });
      return existing._id;
    }

    return await ctx.db.insert("quizScores", {
      email,
      city: args.city,
      country: args.country,
      footprintKg: args.footprintKg,
      createdAt: Date.now(),
    });
  },
});

/** The signed-in resident's most recent result, or null if never taken. */
export const myQuizScore = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const user = await ctx.db.get(userId);
    if (!user?.email) return null;

    const row = await ctx.db
      .query("quizScores")
      .withIndex("by_email", (q) => q.eq("email", user.email!))
      .unique();

    if (!row) return null;
    return {
      city: row.city,
      country: row.country,
      footprintKg: row.footprintKg,
      createdAt: row.createdAt,
    };
  },
});

/** Recent submissions across the city, for the live results strip. */
export const listQuizScores = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("quizScores").order("desc").take(25);
    return rows.map((row) => ({
      city: row.city,
      country: row.country,
      footprintKg: row.footprintKg,
      createdAt: row.createdAt,
    }));
  },
});