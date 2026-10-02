import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const projections = defineTable({
  id: v.string(),
  baseMicroClimateTempDropPerPersonCelsius: v.number(),
  baseModalShiftPercentPerPerson: v.number(),
  baseMuniHealthEnergySavingsPerPerson: v.number(),
  population: v.number(),
  years: v.array(v.number()),
});

export const listProjections = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.table("projections").order("desc").take(300);
    return rows.map((r) => ({
      id: r.id,
      baseMicroClimateTempDropPerPersonCelsius: r.baseMicroClimateTempDropPerPersonCelsius,
      baseModalShiftPercentPerPerson: r.baseModalShiftPercentPerPerson,
      baseMuniHealthEnergySavingsPerPerson: r.baseMuniHealthEnergySavingsPerPerson,
      population: r.population,
      years: r.years,
    }));
  },
});

export const retrieveProjectionsById = query({
  args: { id: v.string() },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .table("projections")
      .filter((r) => r.id === args.id)
      .first();
    if (row) {
      return {
        id: row.id,
        baseMicroClimateTempDropPerPersonCelsius: row.baseMicroClimateTempDropPerPersonCelsius,
        baseModalShiftPercentPerPerson: row.baseModalShiftPercentPerPerson,
        baseMuniHealthEnergySavingsPerPerson: row.baseMuniHealthEnergySavingsPerPerson,
        population: r.population,
        years: r.years,
      };
    }
    return null;
  },
});

export const listProjectionYears = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.table("projections").order("desc").take(300);
    return rows.map((r) => r.years);
  },
});

export const retrieveProjectionYearsById = query({
  args: { id: v.string() },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .table("projections")
      .filter((r) => r.id === args.id)
      .first();
    if (row) {
      return {
        id: row.id,
        years: r.years,
      };
    }
    return null;
  },
});
