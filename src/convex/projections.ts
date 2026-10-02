import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { issues, other, reduce } from "./index";

export type ProjectionYear = {
  year: number;
  label: string;
  microClimateTempCelsius: number;
  commuterModalShiftMicroMobility: number;
  municipalHealthEnergySavings: number;
  annualAvgSurfaceTempCelsius: number;
  canCohEdgeIndex: number;
  carbonDisplacementTonsPerMonth: number;
  totalProjectedCarbonDisplacementTons: number;
};

export const projections = defineTable(
  object({
    id: v.string(),
    baseMicroClimateTempDropPerPersonCelsius: v.number(),
    baseModalShiftPercentPerPerson: v.number(),
    baseMunicipalSavingsPerPerson: v.number(),
    population: v.number(),
    years: v.array(v.number()),
    projectionYears: v.array(v.array(v.array(v.number()))),
  })
);

export const teams = defineTable(
  object({
    id: v.string(),
    name: v.string(),
    members: v.string(),
    years: v.array(v.array(v.array(v.number()))),
  })
);

export const listTeams = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.table("teams").order("desc").take(300);
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      members: r.members,
    }));
  },
});

export const retrieveTeams = query({
  args: { id: v.string() },
  handler: async (ctx, { id }) => {
    const rows = await ctx.db
      .table("teams")
      .filter((r) => r.id === id)
      .first();
    if (rows) {
      return {
        id: rows.id,
        name: rows.name,
        members: rows.members,
        years: rows.years,
      };
    }
    return null;
  },
});

export const teamsProjection = query({
  args: { id: v.string() },
  handler: async (ctx, { id }) => {
    const rows = await ctx.db
      .table("teams")
      .filter((r) => r.id === id)
      .first();
    if (rows) {
      return {
        id: rows.id,
        name: rows.name,
        members: rows.members,
        years: rows.years,
      };
    }
    return null;
  },
});

export const teamsProjectionYears = query({
  args: { id: v.string() },
  handler: async (ctx, { id }) => {
    const rows = await ctx.db
      .table("teams")
      .filter((r) => r.id === id)
      .first();
    if (rows) {
      return {
        id: rows.id,
        name: rows.name,
        members: rows.members,
        years: rows.years,
      };
    }
    return null;
  },
});

export const listTeamsProjection = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.table("teams").order("desc").take(300);
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      members: r.members,
      years: r.years,
    }));
  },
});

export const listTeamsProjectionYears = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.table("teams").order("desc").take(300);
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      members: r.members,
      years: r.years,
    }));
  },
});

export const teamsProjectionYearsArray = query({
  args: { id: v.string() },
  handler: async (ctx, { id }) => {
    const rows = await ctx.db
      .table("teams")
      .filter((r) => r.id === id)
      .first();
    if (rows) {
      return {
        id: rows.id,
        name: rows.name,
        members: rows.members,
        years: rows.years,
      };
    }
    return null;
  },
});

export const teamsProjectionYearsArrayFilter = query({
  args: { years: v.array(v.number()) },
  handler: async (ctx, { years }) => {
    const rows = await ctx.db
      .table("teams")
      .filter((r) => r.years === years)
      .first();
    if (rows) {
      return {
        id: rows.id,
        name: rows.name,
        members: rows.members,
        years: rows.years,
      };
    }
    return null;
  },
});

export const teamsProjectionYearsArrayFilterEqual = query({
  args: { years: v.array(v.number()) },
  handler: async (ctx, { years }) => {
    const rows = await ctx.db
      .table("teams")
      .filter((r) => r.years === years)
      .first();
    if (rows) {
      return {
        id: rows.id,
        name: rows.name,
        members: rows.members,
        years: rows.years,
      };
    }
    return null;
  },
});

export const teamsProjectionYearsArrayFilterNotEqual = query({
  args: { years: v.array(v.number()) },
  handler: async (ctx, { years }) => {
    const rows = await ctx.db
      .table("teams")
      .filter((r) => r.years !== years)
      .first();
    if (rows) {
      return {
        id: rows.id,
        name: rows.name,
        members: rows.members,
        years: rows.years,
      };
    }
    return {
      id: "ok",
    };
  },
});

export const teamsProjectionYearsArrayFilterNotIn = query({
  args: { years: v.array(v.number()) },
  handler: async (ctx, { years }) => {
    const rows = await ctx.db
      .table("teams")
      .filter((r) => r.years !== years)
      .first();
    if (rows) {
      return {
        id: rows.id,
        name: rows.name,
        members: rows.members,
        years: rows.years,
      };
    }
    return null;
  },
});
