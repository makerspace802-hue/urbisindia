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
 * Addresses that are always admin, without a row in `adminGrants`.
 *
 * This is the recovery path for a published deployment: every other grant is a
 * database row, and if that row is ever lost or the table is cleared there is
 * no signed-in admin left to re-grant it. Seeding the owner's address in code
 * means access survives that. To remove the owner, delete the entry here and
 * deploy — that is the only way to revoke it.
 */
const SEED_ADMIN_EMAILS = ["pratyushdhote20@gmail.com"];

function isSeedAdmin(key: string): boolean {
  return SEED_ADMIN_EMAILS.some((e) => e.toLowerCase() === key);
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
  if (isSeedAdmin(key)) return true;
  const grant = await ctx.db
    .query("adminGrants")
    .withIndex("by_email", (q) => q.eq("email", key))
    .first();
  return grant !== null;
}

/**
 * Resolve admin status for the current caller.
 *
 * Email is the only thing that grants admin. An earlier version also accepted
 * `role: "admin"` off the user row as a fallback, which left a second way in
 * that the admin panel could not see or revoke — the exact problem this module
 * exists to solve, reintroduced from the other side. With one admin, a
 * fallback is worse than useless: it silently re-admits anyone who ever had
 * the old flag set.
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
    return isAdminEmail(ctx, user.email);
  },
});

/** Every current admin grant, newest first. Admin panel listing. */
export const listAdmins = query({
  args: {},
  handler: async (ctx) => {
    await requireAdminEmail(ctx);
    const grants = await ctx.db.query("adminGrants").collect();
    const rows = grants.map((g) => ({
      email: g.email,
      createdAt: g.createdAt,
      grantedBy: g.grantedBy,
      seeded: false,
    }));
    // Show the seeded owner even though there is no row for them, otherwise
    // the admin panel would disagree with what `isAdmin` actually allows.
    for (const email of SEED_ADMIN_EMAILS) {
      const normalised = email.toLowerCase();
      if (!rows.some((r) => normaliseEmail(r.email) === normalised)) {
        rows.push({ email, createdAt: 0, grantedBy: "seed", seeded: true });
      }
    }
    return rows.sort((a, b) => b.createdAt - a.createdAt);
  },
});

/**
 * Grant admin to an email address.
 *
 * Removed. This deployment is deliberately single-admin — the owner is seeded in
 * `SEED_ADMIN_EMAILS` — and a mutation that can mint a second admin is exactly
 * the escape hatch that was asked to be closed. It is also unreachable from the
 * UI, so nothing depended on it. Admin is now the seed plus whatever
 * `purgeOtherAdmins` reports, and nothing else.
 */

/**
 * Remove an admin grant.
 *
 * Retained, and refuses to remove the seeded owner. Without that guard a single
 * admin could revoke themselves and leave the deployment with nobody able to
 * reach the admin desk, because the seed is the only recovery path left once
 * `grantAdminByEmail` is gone.
 */
export const revokeAdminByEmail = mutation({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    await requireAdminEmail(ctx);
    const email = normaliseEmail(args.email);
    if (isSeedAdmin(email)) {
      throw new Error(
        "This is the seeded owner account and cannot be revoked from the app. " +
          "Remove the address from SEED_ADMIN_EMAILS in identity.ts and deploy.",
      );
    }
    const existing = await ctx.db
      .query("adminGrants")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first();
    if (existing) await ctx.db.delete(existing._id);
    return email;
  },
});

/**
 * Promote the signed-in caller's own email to admin, but only while no admin
 * exists at all.
 *
 * This is the recovery path, not a way to add admins: if the seeded owner can
 * never sign in, this lets the first person to claim admin restore the
 * deployment. It is deliberately hard to abuse — once any admin exists, nobody
 * can self-promote, and because the owner is seeded in code there is always an
 * admin, so in practice this only fires if the seed is also removed.
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
    if (anyGrant) {
      throw new Error(
        "This deployment has a single seeded administrator. " +
          "There is no way to add a second admin.",
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
 * Strip every admin grant except the seeded owner, and clear the legacy
 * `role: "admin"` flag off every user row.
 *
 * Admin is meant to be a single account. Two things could break that: rows in
 * `adminGrants` granted earlier through the admin panel, and the old
 * `role: "admin"` flag on a user row. The second is why this exists — the
 * flag is no longer honoured by any check, but leaving it set means the data
 * still claims somebody is an admin, and any future check that reads it would
 * re-admit them.
 *
 * Requires the seeded owner, so nobody else can widen or narrow the admin set.
 */
export const purgeOtherAdmins = mutation({
  args: {},
  handler: async (ctx) => {
    await requireAdminEmail(ctx);

    const grants = await ctx.db.query("adminGrants").collect();
    const removedGrants: string[] = [];
    for (const grant of grants) {
      if (isSeedAdmin(normaliseEmail(grant.email))) continue;
      removedGrants.push(grant.email);
      await ctx.db.delete(grant._id);
    }

    // Clear the legacy flag everywhere. A user row can exist per provider, so
    // one person may have several; each is cleared separately.
    const users = await ctx.db.query("users").collect();
    let clearedRoles = 0;
    for (const user of users) {
      if (user.role === "admin") {
        await ctx.db.patch(user._id, { role: undefined });
        clearedRoles++;
      }
    }

    return { removedGrants, clearedRoles, admins: SEED_ADMIN_EMAILS };
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
      isAdmin: await isAdminEmail(ctx, email),
    };
  },
});
