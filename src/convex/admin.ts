import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { users, issues } from "./schema";

export const setRole = mutation({
  args: { role: v.union(v.literal("admin"), v.literal("user"), v.literal("member")) },
  handler: async (ctx) => {
    const userId = await ctx.auth.getUserIdentity();
    if (!userId) throw new Error("Unauthenticated");
    const user = await ctx.db.get(userId);
    if (!user) throw new Error("Unknown user");
    await ctx.db.patch(userId, { role: user.role ?? "user" });
  },
});

export const isAdmin = query({
  args: {},
  handler: async (ctx) => {
    const userId = await ctx.auth.getUserIdentity();
    if (!userId) return false;
    const user = await ctx.db.get(userId);
    return user?.role === "admin";
  },
});

export const issueStatusValidator = v.union(
  v.literal("New"),
  v.literal("In Progress"),
  v.literal("On Review"),
  v.literal("Resolved"),
);

export const issues = defineTable({
  ticket: v.string(),
  id: v.string(),
  category: v.string(),
  tag: v.string(),
  tagColor: v.string(),
  district: v.string(),
  description: v.string(),
  urgency: v.string(),
  status: issueStatusValidator,
  upvotes: v.number(),
  createdAt: v.number(),
  aiTag: v.string(),
  reporterEmail: v.string(),
  resolvedByAdminId: v.optional(v.string()),
  resolvedAt: v.optional(v.number()),
  resolution: v.optional(v.string()),
}).index("by_ticket", ["ticket"]);

export const listIssues = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db
      .table("issues")
      .order("desc")
      .take(300);
    return rows.map((r: any) => ({
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

export const retrieveIssuesForCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    return listIssues(ctx);
  },
});

export const retrieveIssueByTicket = query({
  args: { ticket: v.string() },
  handler: async (ctx, { ticket }) => {
    const row = await ctx.db
      .table("issues")
      .filter((r: any) => r.ticket === ticket)
      .first();
    if (row) {
      return {
        id: row.id,
        ticket: row.ticket,
        category: row.category,
        tag: row.tag,
        tagColor: row.tagColor,
        district: row.district,
        description: row.description,
        urgency: row.urgency,
        status: row.status,
        upvotes: row.upvotes,
        createdAt: row.createdAt,
        aiTag: row.aiTag,
        resolvedByAdminId: row.resolvedByAdminId,
        resolvedAt: row.resolvedAt,
        resolution: row.resolution,
      };
    }
    return null;
  },
});

export const submitIssue = mutation({
  args: {
    category: v.string(),
    tag: v.string(),
    tagColor: v.string(),
    district: v.string(),
    description: v.string(),
    urgency: v.string(),
    status: issueStatusValidator,
    aiTag: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await ctx.auth.getUserIdentity();
    if (!userId) throw new Error("Unauthenticated");
    const user = await ctx.db.get(userId);
    const ticket = `#URB-${Math.floor(Math.random() * 1_000_000)}`;
    const id = ticket;
    const row = {
      id,
      ticket,
      category: args.category,
      tag: args.tag,
      tagColor: args.tagColor,
      district: args.district,
      description: args.description,
      urgency: args.urgency,
      status: "New",
      upvotes: 0,
      createdAt: Date.now(),
      aiTag: args.aiTag,
      reporterEmail: user?.email ?? "",
      resolvedByAdminId: undefined,
      resolvedAt: undefined,
      resolution: undefined,
    };
    await ctx.db.insert("issues", row);
    return row;
  },
});

export const upvoteIssue = mutation({
  args: { ticket: v.string() },
  handler: async (ctx, { ticket }) => {
    const row = await ctx.db
      .table("issues")
      .filter((r: any) => r.ticket === ticket)
      .first();
    if (!row) throw new Error("Unknown issue");
    await ctx.db.patch(row._id, { upvotes: row.upvotes + 1 });
    return row.upvotes + 1;
  },
});

export const resolveIssue = mutation({
  args: {
    ticket: v.string(),
    resolution: v.string(),
  },
  handler: async (ctx, { ticket, resolution }) => {
    const userId = await ctx.auth.getUserIdentity();
    if (!userId) throw new Error("Unauthenticated");
    const user = await ctx.db.get(userId);
    if (user?.role !== "admin") throw new Error("Admins only");
    const row = await ctx.db
      .table("issues")
      .filter((r: any) => r.ticket === ticket)
      .first();
    if (!row) throw new Error("Unknown issue");
    await ctx.db.patch(row._id, {
      status: "Resolved",
      resolvedByAdminId: userId,
      resolvedAt: Date.now(),
      resolution,
    });
    return {
      ticket,
      status: "Resolved",
      resolution,
      resolvedByAdminEmail: user?.email ?? undefined,
      resolvedAt: Date.now(),
    };
  },
});

export const listAdminIssuesForCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const issues = await listIssues(ctx);
    const userId = await ctx.auth.getUserIdentity();
    if (!userId) return issues;
    const user = await ctx.db.get(userId);
    if (user?.role !== "admin") return issues;
    return issues;
  },
});

export const retrieveIssuesByTicketPrefix = query({
  args: { prefix: v.string() },
  handler: async (ctx, { prefix }) => {
    const rows = await ctx.db
      .table("issues")
      .filter((r: any) => r.ticket.startsWith(prefix))
      .order("desc")
      .take(300);
    return rows.map((r: any) => ({
      id: r.id,
      ticket: r.ticket,
      status: r.status,
      resolvedByAdminId: r.resolvedByAdminId,
      resolvedAt: r.resolvedAt,
      resolution: r.resolution,
    }));
  },
});

export const retrieveIssueByTicketPrefix = query({
  args: { prefix: v.string() },
  handler: async (ctx, { prefix }) => {
    const row = await ctx.db
      .table("issues")
      .filter((r: any) => r.ticket.startsWith(prefix))
      .first();
    if (row) {
      return {
        id: row.id,
        ticket: row.ticket,
        status: row.status,
        resolvedByAdminId: row.resolvedByAdminId,
        resolvedAt: row.resolvedAt,
        resolution: row.resolution,
      };
    }
    return null;
  },
});
