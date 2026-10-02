import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { normaliseEmail } from "./identity";

/** The signed-in resident's editable profile fields. */
export const myProfile = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const user = await ctx.db.get(userId);
    if (!user) return null;
    return {
      name: user.name ?? "",
      email: user.email ?? "",
      image: user.image ?? "",
      city: user.city ?? "",
      country: user.country ?? "",
      role: user.role ?? "member",
    };
  },
});

/**
 * Copy profile details across every user row that shares this email.
 *
 * Each sign-in provider creates its own `users` row, so somebody who verified
 * over email and later added a password ends up with two rows. Without this,
 * the second sign-in looks like a brand new account with an empty name and
 * city. The email is the real identity, so the newest row that actually has
 * values is copied onto whichever row the person is currently using.
 */
export const syncProfileAcrossProviders = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthenticated");
    const user = await ctx.db.get(userId);
    if (!user) throw new Error("No user record");

    const email = normaliseEmail(user.email);
    if (!email) return { synced: false };

    // Every row that belongs to this person.
    const siblings = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", email))
      .collect();

    // Donors are rows that actually carry profile detail.
    const donor = siblings.find(
      (row) =>
        row._id !== userId &&
        (row.name !== undefined || row.city !== undefined || row.country !== undefined),
    );

    if (!donor) return { synced: false };

    const patch: {
      name?: string;
      city?: string;
      country?: string;
      image?: string;
    } = {};
    if (user.name === undefined && donor.name !== undefined) patch.name = donor.name;
    if (user.city === undefined && donor.city !== undefined) patch.city = donor.city;
    if (user.country === undefined && donor.country !== undefined) {
      patch.country = donor.country;
    }
    if (user.image === undefined && donor.image !== undefined) {
      patch.image = donor.image;
    }

    if (Object.keys(patch).length === 0) return { synced: false };
    await ctx.db.patch(userId, patch);
    return { synced: true, from: donor._id };
  },
});

/**
 * Save profile settings. Every field is optional and empty strings are stored
 * as "unset" rather than blank, so the settings form can clear a value.
 */
export const updateProfile = mutation({
  args: {
    name: v.optional(v.string()),
    city: v.optional(v.string()),
    country: v.optional(v.string()),
    image: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthenticated");
    const user = await ctx.db.get(userId);
    if (!user) throw new Error("No user record");

    const clean = (value: string | undefined) => {
      if (value === undefined) return undefined;
      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : undefined;
    };

    const patch = {
      name: clean(args.name),
      city: clean(args.city),
      country: clean(args.country),
      image: clean(args.image),
    };

    await ctx.db.patch(userId, patch);

    // Keep sibling rows in step so switching sign-in method later does not
    // appear to wipe the profile.
    const email = normaliseEmail(user.email);
    if (email) {
      const siblings = await ctx.db
        .query("users")
        .withIndex("email", (q) => q.eq("email", email))
        .collect();
      for (const row of siblings) {
        if (row._id !== userId) await ctx.db.patch(row._id, patch);
      }
    }

    return userId;
  },
});
