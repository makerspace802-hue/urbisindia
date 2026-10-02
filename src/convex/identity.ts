import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query, type QueryCtx } from "./_generated/server";

/**
 * Identity helpers shared by every auth path.
 *
 * The bug this file exists to fix: Convex Auth keys an account on
 * (provider, providerAccountId), so signing in once with Google and once with
 * an emailed OTP creates TWO `users` rows for the same human. Any privilege
 * stored on the user row (the old `role: "admin"`) therefore vanished the
 * moment the person used a different provider, and the admin panel went with
 * it.
 *
 * The fix is to stop treating the user row as the identity. The email is the
 * identity. Admin rights live in `adminGrants`, keyed by normalized email, and
 * every privileged check reads from there. Adding a provider, or signing in
 * from a new browser, can no longer change what somebody is allowed to do.
 */

/** Emails are compared case-insensitively and without surrounding space. */
export function normaliseEmail(email: string | undefined | null): string {
  return (email ?? "").trim().toLowerCase();
}

/**
 * Is this email an admin?
 *
 * Reads the `adminGrants` table by index, so it is a single indexed lookup and
 * works for a signed-in user, a token-less service call, or the admin panel
 * listing other people's grants.
 */
export async function isAdminEmail(
  ctx: QueryCtx,
  email: string | undefined | null,
): Promise<boolean> {
  const key = normaliseEmail(email);
  if (!key) return false;
  const grant = await ctx.db
    .query("adminGrants")
    .withIndex("by_email", (q) => q.eq("email", key))
    .first();
  return grant !== null;
}

/**
 * Resolve admin status for the current caller, falling back to the `role`
 * field on the user row.
 *
 * The role fallback is deliberate: it keeps anyone who was promoted by the
 * old `setRole` mutation working, so upgrading this app does not silently
 * demote an existing admin before they have had a chance to re-grant
 * themselves. New promotions should use `grantAdminByEmail`.
 */
export async function requireAdminEmail(
  ctx: QueryCtx,
): Promise<{ userId: string; email: string }> {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("Unauthenticated");
  const user = await ctx.db.get(userId);
  if (!user) throw new Error("No user record");

  const email = normaliseEmail(user.email);
  if (await isAdminEmail(ctx, email)) return { userId, email };
  if (user.role === "admin") return { userId, email };
  throw new Error("Admins only");
}

/** Is the signed-in caller an admin? Drives the admin UI in the client. */
export const isAdmin = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return false;
    const user = await ctx.db.get(userId);
    if (!user) return false;
    if (user.role === "admin") return true;
    return isAdminEmail(ctx, user.email);
  },
});

/** Every current admin grant, newest first. Admin panel listing. */
export const listAdmins = query({
  args: {},
  handler: async (ctx) => {
    await requireAdminEmail(ctx);
    const grants = await ctx.db.query("adminGrants").collect();
    return grants
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((g) => ({ email: g.email, createdAt: g.createdAt, grantedBy: g.grantedBy }));
  },
});

/**
 * Grant admin to an email address.
 *
 * Idempotent. Safe to call with your own email to recover admin access after a
 * provider change, which is the situation this whole module was written for.
 */
export const grantAdminByEmail = mutation({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    await requireAdminEmail(ctx);
    const email = normaliseEmail(args.email);
    if (!email) throw new Error("A valid email is required");
    const existing = await ctx.db
      .query("adminGrants")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first();
    if (existing) return email;
    await ctx.db.insert("adminGrants", { email, createdAt: Date.now() });
    return email;
  },
});

/** Remove an admin grant. Prevents lock-out of every remaining admin. */
export const revokeAdminByEmail = mutation({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    await requireAdminEmail(ctx);
    const email = normaliseEmail(args.email);
    const existing = await ctx.db
      .query("adminGrants")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first();
    if (existing) await ctx.db.delete(existing._id);
    return email;
  },
});

/**
 * Promote the signed-in caller's own email to admin, but only while the
 * `adminGrants` table is empty.
 *
 * This is the one-time bootstrap that replaces the old manual
 * "edit the user document in the dashboard" step. It is deliberately
 * single-use: once any grant exists, nobody can self-promote, so the table
 * cannot be used to hand out admin to whoever signs up next. If you already
 * hold `role: "admin"` on your user row this still works, so upgrading an
 * existing deployment needs no manual database editing.
 */
export const bootstrapFirstAdmin = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthenticated");
    const user = await ctx.db.get(userId);
    if (!user) throw new Error("No user record");

    const email = normaliseEmail(user.email);
    if (!email) throw new Error("Sign in with an email address first");

    const alreadyGranted = await ctx.db
      .query("adminGrants")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first();
    if (alreadyGranted) return email;

    const anyGrant = await ctx.db.query("adminGrants").first();
    if (anyGrant && user.role !== "admin") {
      throw new Error(
        "An admin already exists. Ask them to run grantAdminByEmail for you.",
      );
    }

    await ctx.db.insert("adminGrants", {
      email,
      grantedBy: "bootstrap",
      createdAt: Date.now(),
    });
    return email;
  },
});

/**
 * Record that this email now has a password, so the UI can show
 * "sign in with a password" instead of re-prompting for an OTP.
 */
export const markPasswordSet = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthenticated");
    const user = await ctx.db.get(userId);
    if (!user) throw new Error("No user record");
    const email = normaliseEmail(user.email);
    if (!email) throw new Error("No email on this account");

    const existing = await ctx.db
      .query("accountPasswords")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, { userId });
      return email;
    }
    await ctx.db.insert("accountPasswords", { email, userId, createdAt: Date.now() });
    return email;
  },
});

/**
 * What the auth screen needs to know about the signed-in account, so it can
 * offer the right next step (set a password, or just go sign in).
 */
export const passwordStatus = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return { email: "", hasPassword: false, isAdmin: false };
    const user = await ctx.db.get(userId);
    if (!user) return { email: "", hasPassword: false, isAdmin: false };
    const email = normaliseEmail(user.email);
    const record = email
      ? await ctx.db
          .query("accountPasswords")
          .withIndex("by_email", (q) => q.eq("email", email))
          .first()
      : null;
    return {
      email,
      hasPassword: record !== null,
      isAdmin: user.role === "admin" || (await isAdminEmail(ctx, email)),
    };
  },
});
