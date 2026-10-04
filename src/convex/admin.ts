import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { action, mutation, query } from "./_generated/server";
import { requireAdminEmail } from "./identity";

const issueStatusValidator = v.union(
  v.literal("New"),
  v.literal("In Progress"),
  v.literal("On Review"),
  v.literal("Resolved"),
);

/**
 * Is the signed-in user an URBIS admin? Used to gate the resolve controls.
 *
 * Delegates to the email-keyed check in `identity.ts`. The old version read
 * `role` off the user row, which is why admin appeared to vanish whenever
 * somebody signed in through a provider they had not used before.
 */
export const isAdmin = query({
  args: {},
  handler: async (ctx) => {
    try {
      await requireAdminEmail(ctx);
      return true;
    } catch {
      return false;
    }
  },
});

/** Every admin email, for the admin panel. */
export const listAdminEmails = query({
  args: {},
  handler: async (ctx) => {
    await requireAdminEmail(ctx);
    const grants = await ctx.db.query("adminGrants").collect();
    return grants.map((g) => g.email);
  },
});



/**
 * A one-time URL the browser POSTs an image file to.
 *
 * The upload has to go through Convex file storage rather than being kept as a
 * local `blob:` URL: a blob URL only exists in the tab that created it, so an
 * attached photo disappeared the moment the report was submitted.
 */
export const uploadUrl = action({
  args: {},
  handler: async (ctx) => {
    // Any signed-in resident can attach a photo; submitting the report itself
    // enforces the same requirement.
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Sign in to attach a photo");
    return ctx.storage.generateUploadUrl();
  },
});

/**
 * Resolves stored images to URLs for the admin ticket desk.
 *
 * Returns a map keyed by storage id so the client can render every attachment
 * with a single query instead of one request per ticket. Admin-only for the
 * same reason as `listAllIssues`: an attached photo shows the exact spot a
 * resident complained about.
 */
export const adminImageUrls = query({
  args: {},
  handler: async (ctx) => {
    await requireAdminEmail(ctx);
    const rows = await ctx.db
      .query("issues")
      .withIndex("by_created_at")
      .order("desc")
      .take(200);

    const entries = await Promise.all(
      rows
        .filter((row): row is typeof row & { storageId: string } =>
          typeof row.storageId === "string" && row.storageId.length > 0,
        )
        .map(async (row) => {
          try {
            const url = await ctx.storage.getUrl(row.storageId);
            return url ? ([row.storageId, url] as const) : null;
          } catch {
            // A storage id can outlive its blob; skip it rather than fail the
            // whole feed.
            return null;
          }
        }),
    );

    return Object.fromEntries(entries.filter((e) => e !== null));
  },
});

/**
 * Every filed report, for the admin desk on the profile page.
 *
 * Admin-only and enforced here rather than in the client. The public
 * `listIssues` feed was removed so reports stop being world-readable; this
 * query is the replacement, and it returns the same rows plus the reporter's
 * own address, which is only ever shown to an admin.
 */
export const listAllIssues = query({
  args: {},
  handler: async (ctx) => {
    await requireAdminEmail(ctx);
    const rows = await ctx.db.query("issues").order("desc").take(200);
    return rows.map((row) => ({
      ticket: row.ticket,
      category: row.category,
      tag: row.tag,
      storageId: row.storageId ?? null,
      tagColor: row.tagColor,
      district: row.district,
      description: row.description,
      urgency: row.urgency,
      status: row.status,
      upvotes: row.upvotes,
      createdAt: row.createdAt,
      aiTag: row.aiTag,
      reporterEmail: row.reporterEmail,
      resolution: row.resolution,
      resolvedAt: row.resolvedAt,
    }));
  },
});

/** Single ticket lookup, used to confirm a submission landed. */
export const retrieveIssueByTicket = query({
  args: { ticket: v.string() },
  handler: async (ctx, { ticket }) => {
    const row = await ctx.db
      .query("issues")
      .withIndex("by_ticket", (q) => q.eq("ticket", ticket))
      .unique();
    return row ?? null;
  },
});

/** File a new citizen report and hand back the generated ticket number. */
export const submitIssue = mutation({
  args: {
    category: v.string(),
    tag: v.string(),
    tagColor: v.string(),
    district: v.string(),
    description: v.string(),
    urgency: v.string(),
    aiTag: v.string(),
    /** File storage id from `uploadUrl`, when a photo was attached. */
    storageId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Sign in to submit a report");
    const user = await ctx.db.get(userId);

    /**
     * Next unused ticket number.
     *
     * The previous version derived the number from `createdAt % 1000` on the
     * most recent row. `createdAt` is a millisecond timestamp, so two reports
     * filed about a second apart produced the SAME ticket — and every later
     * `by_ticket` lookup calls `.unique()`, which throws on a duplicate. A busy
     * day would have made upvotes and resolves fail outright.
     *
     * Now it walks forward from the highest number actually in use, probing the
     * unique index each time, so a collision is impossible rather than merely
     * unlikely.
     */
    const recent = await ctx.db
      .query("issues")
      .withIndex("by_created_at")
      .order("desc")
      .take(500);

    const highest = recent.reduce((max, row) => {
      const parsed = Number.parseInt(row.ticket.replace("#URB-", ""), 10);
      return Number.isFinite(parsed) && parsed > max ? parsed : max;
    }, 9000);

    const findTaken = async (candidate: string) =>
      ctx.db
        .query("issues")
        .withIndex("by_ticket", (q) => q.eq("ticket", candidate))
        .unique();

    let number = highest + 1;
    let ticket = `#URB-${number}`;
    while (await findTaken(ticket)) {
      number += 1;
      ticket = `#URB-${number}`;
    }

    await ctx.db.insert("issues", {
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
      reporterEmail: user?.email ?? "anonymous",
      storageId: args.storageId,
    });

    return { ticket, aiTag: args.aiTag, status: "New" as const };
  },
});

/** Add one community upvote to a ticket. */
export const upvoteIssue = mutation({
  args: { ticket: v.string() },
  handler: async (ctx, { ticket }) => {
    const row = await ctx.db
      .query("issues")
      .withIndex("by_ticket", (q) => q.eq("ticket", ticket))
      .unique();
    if (!row) throw new Error("Unknown ticket");
    await ctx.db.patch(row._id, { upvotes: row.upvotes + 1 });
    return row.upvotes + 1;
  },
});

/**
 * Admin-only: delete every filed report.
 *
 * A deliberate wipe, not a per-ticket delete, because the request was to clear
 * the table. It also removes the attached blobs: leaving them would keep
 * residents' photographs in storage after the reports they belonged to are
 * gone. `requireAdminEmail` means this cannot be run by anyone else.
 */
export const purgeAllIssues = mutation({
  args: {},
  handler: async (ctx) => {
    await requireAdminEmail(ctx);
    const rows = await ctx.db.query("issues").collect();

    // Storage ids can outlive their blob, so a failed delete must not abort the
    // whole purge and leave the table half-emptied.
    for (const row of rows) {
      if (typeof row.storageId === "string" && row.storageId.length > 0) {
        try {
          await ctx.storage.delete(row.storageId);
        } catch {
          // Blob already gone; the row still gets deleted below.
        }
      }
    }

    await Promise.all(rows.map((row) => ctx.db.delete(row._id)));
    return { deleted: rows.length };
  },
});

/**
 * Admin-only: close a ticket with a resolution note. The status change is
 * written to Convex so the admin desk reflects it live.
 */
export const resolveIssue = mutation({
  args: {
    ticket: v.string(),
    resolution: v.string(),
    status: v.optional(issueStatusValidator),
  },
  handler: async (ctx, { ticket, resolution, status }) => {
    const { userId, email } = await requireAdminEmail(ctx);

    const row = await ctx.db
      .query("issues")
      .withIndex("by_ticket", (q) => q.eq("ticket", ticket))
      .unique();
    if (!row) throw new Error("Unknown ticket");

    const resolvedAt = Date.now();
    await ctx.db.patch(row._id, {
      status: status ?? "Resolved",
      resolution,
      resolvedAt,
      resolvedBy: email || userId,
    });

    return { ticket, status: status ?? "Resolved", resolvedAt };
  },
});
