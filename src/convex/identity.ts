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
 * The seed list in this file is the ONLY source of admin rights. It used to
 * also honour a row in `adminGrants`, which meant admin was a database value
 * rather than a code value: anybody with dashboard access could insert a row
 * and mint themselves an admin, and the app could never tell that apart from
 * a grant the owner intended. With the seed being the single source, changing
 * who administers this deployment is a code edit and nothing else.
 *
 * `ctx` is gone for the same reason — there is nothing left to look up.
 */
export async function isAdminEmail(
  email: string | undefined | null,
): Promise<boolean> {
  return isSeedAdmin(normaliseEmail(email));
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
  if (await isAdminEmail(email)) return { userId, email };
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
    return isAdminEmail(user.email);
  },
});

/**
 * Who administers this deployment.
 *
 * Read-only by construction: the seed is the only place an admin can come
 * from, so this reports exactly what `isAdmin` will allow and nothing more.
 */
export const listAdmins = query({
  args: {},
  handler: async (ctx) => {
    await requireAdminEmail(ctx);
    return SEED_ADMIN_EMAILS.map((email) => ({
      email,
      grantedBy: "seed",
    }));
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
 * Revoke an admin.
 *
 * Deleted. Every way of changing the admin set is gone from the backend, not
 * merely hidden in the UI: this, `bootstrapFirstAdmin` and `purgeOtherAdmins`
 * all used to be callable by any signed-in admin, which meant the admin set
 * was mutable at runtime by whoever happened to be signed in. The only way to
 * change it now is to edit `SEED_ADMIN_EMAILS` above and deploy.
 */

/**
 * Claim admin for yourself.
 *
 * Deleted, and this was the serious one. It was reachable from the sign-up
 * screen by anybody who reached the "you are verified" step, and it granted
 * admin to the caller whenever the `adminGrants` table happened to be empty.
 * With the seed now the only source of admin rights the table is never empty,
 * so even the original guard could not have saved it.
 */

/**
 * Strip admin grants and legacy role flags.
 *
 * Deleted along with the "Sole Admin" button that called it. It could only
 * ever remove rights, but with no way to add them it had nothing left to do,
 * and leaving a mutation that mutates the admin set contradicts the rule that
 * only the backend can.
 */

/**
 * Strip every admin grant except the seeded owner, and clear the legacy
 * `role: "admin"` flag off every user row.
 *
 * DELETED — see the note above. The "Sole Admin" button in the admin ticket
 * desk called this, which meant the admin set could be edited by whoever was
 * signed in at the time. It is no longer a mutation, and the button is gone
 * from the UI.
 */

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
 * Does this address already have a password account?
 *
 * The sign-up screen needs this before it can safely offer "create an
 * account". @convex-dev/auth's `createAccountFromCredentials` only throws when
 * the address exists AND the supplied password does not match the stored one —
 * when they match it silently signs in — so a failed sign-up always means "this
 * email is taken with a different password". But it throws a plain `Error`,
 * which Convex replaces with an opaque request-id wrapper, so the reason never
 * reaches the browser and the person is left staring at a server error for
 * what is a completely ordinary situation.
 *
 * Asking here instead means the screen can route them to sign-in before
 * attempting a request that cannot succeed. The authoritative answer is
 * Convex Auth's own `authAccounts` table, which is part of this deployment's
 * schema via `authTables`; `accountPasswords` is only our bookkeeping copy,
 * written after a successful sign-up, so it is the fallback rather than the
 * source of truth.
 */
export const hasPasswordAccount = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const email = normaliseEmail(args.email);
    if (!email) return false;

    try {
      const account = await ctx.db
        .query("authAccounts")
        .withIndex("providerAndAccountId", (q) =>
          q.eq("provider", "password").eq("providerAccountId", email),
        )
        .first();
      if (account !== null) return true;
    } catch {
      // The table or its index is not what this version of @convex-dev/auth
      // exposes. Fall through to our own record rather than failing a read.
    }

    const record = await ctx.db
      .query("accountPasswords")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first();
    return record !== null;
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
      isAdmin: await isAdminEmail(email),
    };
  },
});
