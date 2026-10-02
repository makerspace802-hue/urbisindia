import { array, bool, number, object, string, union, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { issues, roleValidator } from "./admin";

export const projects = defineTable(
  object({
    id: v.string(),
    name: v.string(),
    description: v.string(),
    status: v.union(v.literal("Planned"), v.literal("Active"), v.literal("Completed")),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
);

export const retrieveProjectById = query({
  args: { id: v.string() },
  handler: async (ctx, { id }) => {
    const rows = await ctx.db
      .table("projects")
      .filter((r) => r.id === id)
      .first();
    if (rows) {
      return {
        id: rows.id,
        name: rows.name,
        description: rows.description,
        status: rows.status,
        createdAt: rows.createdAt,
        updatedAt: rows.updatedAt,
      };
    }
    return null;
  },
});

export const listProjects = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.table("projects").order("desc").take(300);
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      status: r.status,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));
  },
});

export const retrieveIssuesAsString = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.table("issues").order("desc").take(300);
    return rows.map((r) => ({
      id: r.id,
      ticket: r.ticket,
      category: r.category,
      tag: r.tag,
      tagColor: r.tagColor,
      district: r.district,
      description: r.description,
      urgency: r.urgency,
      status: r.status,
      upvotes: r.upvotes,
      createdAt: r.createdAt,
      aiTag: r.aiTag,
      resolvedByAdminId: r.resolvedByAdminId,
      resolvedAt: r.resolvedAt,
      resolution: r.resolution,
    }));
  },
});

export const retrieveUsersAsString = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.table("users").order("desc").take(300);
    return rows.map((r) => ({
      id: r._id,
      name: r.name,
      email: r.email,
      role: r.role,
    }));
  },
});

export const retrieveIssuesByTicket = query({
  args: { ticket: string() },
  handler: async (ctx, { ticket }) => {
    const rows = await ctx.db
      .table("issues")
      .filter((r) => r.ticket === ticket)
      .first();
    if (rows) {
      return {
        id: rows.id,
        ticket: rows.ticket,
        category: rows.category,
        tag: rows.tag,
        tagColor: rows.tagColor,
        district: rows.district,
        description: rows.description,
        urgency: rows.urgency,
        status: rows.status,
        upvotes: rows.upvotes,
        createdAt: rows.createdAt,
        aiTag: rows.aiTag,
        resolvedByAdminId: rows.resolvedByAdminId,
        resolvedAt: rows.resolvedAt,
        resolution: rows.resolution,
      };
    }
    return null;
  },
});

export const resolveAdminIssueByTicket = mutation({
  args: {
    ticket: string(),
    resolution: string(),
  },
  handler: async (ctx, { ticket, resolution }) => {
    const row = await ctx.db
      .table("issues")
      .filter((r) => r.ticket === ticket)
      .first();
    if (!row) throw new Error("Unknown issue");
    await ctx.db.patch(row._id, {
      status: "Resolved",
      resolution,
      resolvedAt: Date.now(),
    });
    return resolution;
  },
});

export const listAllIssues = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.table("issues").order("desc").take(300);
    return rows.map((r) => ({
      id: r.id,
      ticket: r.ticket,
      category: r.category,
      tag: r.tag,
      tagColor: r.tagColor,
      district: r.district,
      description: r.description,
      urgency: r.urgency,
      status: r.status,
      upvotes: r.upvotes,
      createdAt: r.createdAt,
      aiTag: r.aiTag,
      resolvedByAdminId: r.resolvedByAdminId,
      resolvedAt: r.resolvedAt,
      resolution: r.resolution,
    }));
  },
});

export const retrieveIssuesByTicketPrefix = query({
  args: { prefix: string() },
  handler: async (ctx, { prefix }) => {
    const rows = await ctx.db
      .table("issues")
      .filter((r) => r.ticket.startsWith(prefix))
      .first();
    if (rows) {
      return {
        id: rows.id,
        ticket: rows.ticket,
        status: rows.status,
        resolvedByAdminId: rows.resolvedByAdminId,
        resolvedAt: rows.resolvedAt,
        resolution: rows.resolution,
      };
    }
    return null;
  },
});

export const resolveIssuesByTicketPrefix = mutation({
  args: {
    prefix: string(),
    resolution: string(),
  },
  handler: async (ctx, { prefix, resolution }) => {
    const rows = await ctx.db
      .table("issues")
      .filter((r) => r.ticket.startsWith(prefix))
      .order("desc")
      .take(300);
    for (const row of rows) {
      await ctx.db.patch(row._id, {
        status: "Resolved",
        resolution,
        resolvedAt: Date.now(),
      });
    }
    return "ok";
  },
});
