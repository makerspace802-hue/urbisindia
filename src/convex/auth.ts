// THIS FILE IS READ ONLY. Do not touch this file unless you are correctly adding a new auth provider in accordance to the vly auth documentation

import { convexAuth } from "@convex-dev/auth/server";
import { Anonymous } from "@convex-dev/auth/providers/Anonymous";
import { Password } from "@convex-dev/auth/providers/Password";
import { ConvexError } from "convex/values";
import { emailOtp } from "./auth/emailOtp";
import { googleProviders } from "./authGoogle";

/**
 * Password rules, authoritative on the server.
 *
 * `PASSWORD_MIN_LENGTH` and these two sentences are mirrored in
 * `src/lib/passwordRules.ts`, which the auth screen uses to check the field
 * before spending a round trip. The two are pinned together by
 * `scripts/test-auth-errors.mjs`; change one and that test fails.
 */
export const PASSWORD_MIN_LENGTH = 8;

/**
 * Throw something the browser can actually read.
 *
 * Convex replaces the message of any plain `Error` with an opaque
 * "[CONVEX A(auth.signIn)] [Request ID: …] Server Error Called by client"
 * wrapper. @convex-dev/auth calls `authorize()` from `handleCredentials` with
 * no try/catch, so whatever validation throws here escapes the action
 * untouched and the real reason is lost before it leaves the server.
 *
 * `ConvexError` is the one type Convex forwards verbatim as structured data,
 * so the message below is what the person actually reads in the form.
 */
type PasswordError = { code: string; message: string };

function passwordError(code: string, message: string): ConvexError<PasswordError> {
  return new ConvexError({ code, message });
}

/**
 * Sign-in providers for URBIS India.
 *
 * `Password` is what makes returning visits work without an inbox round trip.
 * It is listed before `emailOtp` on purpose: once somebody has set a password
 * they sign in with it, and the OTP flow is only there for the very first
 * verification and for password resets.
 *
 * Every provider here creates its own Convex Auth `users` row for the same
 * human, which is why admin rights are resolved by email in `identity.ts`
 * rather than read off the user row.
 */
export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Password({
      // Reject weak passwords at the source rather than accepting anything
      // non-empty, which is the library default.
      validatePasswordRequirements: (password: string) => {
        if (password.length < PASSWORD_MIN_LENGTH) {
          throw passwordError(
            "password_too_short",
            `Use at least ${PASSWORD_MIN_LENGTH} characters.`,
          );
        }
        if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
          throw passwordError(
            "password_too_weak",
            "Include at least one letter and one number.",
          );
        }
      },
    }),
    emailOtp,
    Anonymous,
    // Empty unless AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET are configured, so
    // Google simply does not appear until it is usable.
    ...googleProviders,
  ],
});
