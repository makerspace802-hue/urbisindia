import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

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

    const clean = (value: string | undefined) => {
      if (value === undefined) return undefined;
      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : undefined;
    };

    await ctx.db.patch(userId, {
      name: clean(args.name),
      city: clean(args.city),
      country: clean(args.country),
      image: clean(args.image),
    });
    return userId;
  },
});
