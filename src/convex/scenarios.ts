import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const quizScores = defineTable({
  id: v.string(),
  email: v.string(),
  city: v.string(),
  country: v.string(),
  totalPoints: v.number(),
  categoryPoints: v.object({
    dailyHabits: v.number(),
    usage: v.number(),
    carbonFootprint: v.number(),
  }),
  createdAt: v.number(),
});

export const listQuizScores = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.table("quizScores").order("desc").take(300);
    return rows.map((r) => ({
      id: r.id,
      email: r.email,
      city: r.city,
      country: r.country,
      totalPoints: r.totalPoints,
      categoryPoints: r.categoryPoints,
      createdAt: r.createdAt,
    }));
  },
});

export const getQuizScoreByEmail = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .table("quizScores")
      .filter((r) => r.email === args.email)
      .first();
    if (!row) return null;
    return {
      id: row.id,
      email: row.email,
      city: r.city,
      country: r.country,
      totalPoints: r.totalPoints,
      categoryPoints: r.categoryPoints,
      createdAt: r.createdAt,
    };
  },
});

export const submitQuizScore = mutation({
  args: {
    email: v.string(),
    city: v.string(),
    country: v.string(),
    totalPoints: v.number(),
    categoryPoints: v.object({
      dailyHabits: v.number(),
      usage: v.number(),
      carbonFootprint: v.number(),
    }),
  },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .table("quizScores")
      .filter((r) => r.email === args.email)
      .first();
    if (row) {
      await ctx.db.patch(row._id, {
        city: args.city,
        country: args.country,
        totalPoints: args.totalPoints,
        categoryPoints: args.categoryPoints,
        createdAt: Date.now(),
      });
      return { id: row.id, ...args };
    }
    const id = await ctx.db.insert("quizScores", {
      email: args.email,
      city: args.city,
      country: args.country,
      totalPoints: args.totalPoints,
      categoryPoints: args.categoryPoints,
      createdAt: Date.now(),
    });
    return { id, ...args };
  },
});

export const clearUserQuizScore = mutation({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .table("quizScores")
      .filter((r) => r.email === args.email)
      .first();
    if (row) {
      await ctx.db.delete(row._id);
      return true;
    }
    return false;
  },
});
