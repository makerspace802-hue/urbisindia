import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { normaliseEmail } from "./identity";
import {
  DEFAULT_PREFS,
  isMetricId,
  normalisePrefs,
  type DashboardPrefs,
} from "../lib/dashboardPreferences";

/**
 * The signed-in resident's dashboard customisation.
 *
 * Returns the defaults when nobody is signed in, so the dashboard renders the
 * same India-wide cards it always did. This is what makes customisation opt-in:
 * there is no way to arrive at a blank dashboard.
 *
 * Keyed by email rather than by user id. Each sign-in provider creates its own
 * `users` row for the same human, so a preference saved against the row used
 * for a Google sign-in would vanish the moment they used a password instead.
 * Email is the identity this app already trusts for admin.
 */
export const myDashboard = query({
  args: {},
  handler: async (ctx): Promise<DashboardPrefs> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return { ...DEFAULT_PREFS };
    const user = await ctx.db.get(userId);
    if (!user) return { ...DEFAULT_PREFS };

    const email = normaliseEmail(user.email);
    if (!email) return { ...DEFAULT_PREFS };

    const row = await ctx.db
      .query("dashboardPrefs")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first();

    return normalisePrefs(row ? { ...row.prefs, state: row.prefs.state } : undefined);
  },
});

/**
 * Save a customisation. Requires a signed-in resident.
 *
 * The payload is normalised on the way in rather than trusted: the client picks
 * from a catalogue, but nothing stops a hand-crafted call, and an unknown metric
 * id would otherwise reach the dashboard as a card with no figure behind it.
 */
export const saveDashboard = mutation({
  args: {
    state: v.nullable(v.string()),
    metrics: v.array(v.string()),
    showNational: v.boolean(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Sign in to personalise your dashboard");
    const user = await ctx.db.get(userId);
    if (!user) throw new Error("No user record");

    const email = normaliseEmail(user.email);
    if (!email) throw new Error("No email on this account");

    const prefs = normalisePrefs({
      state: args.state,
      metrics: args.metrics.filter(isMetricId),
      showNational: args.showNational,
    });

    const existing = await ctx.db
      .query("dashboardPrefs")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, { prefs, updatedAt: Date.now() });
      return prefs;
    }

    await ctx.db.insert("dashboardPrefs", {
      email,
      prefs,
      updatedAt: Date.now(),
    });
    return prefs;
  },
});

/** Drop the customisation and fall back to the defaults. */
export const resetDashboard = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Sign in to personalise your dashboard");
    const user = await ctx.db.get(userId);
    if (!user) throw new Error("No user record");

    const email = normaliseEmail(user.email);
    if (!email) return { ...DEFAULT_PREFS };

    const existing = await ctx.db
      .query("dashboardPrefs")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first();
    if (existing) await ctx.db.delete(existing._id);

    return { ...DEFAULT_PREFS };
  },
});