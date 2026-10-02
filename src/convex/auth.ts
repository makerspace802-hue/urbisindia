// THIS FILE IS READ ONLY. Do not touch this file unless you are correctly adding a new auth provider in accordance to the vly auth documentation

import { convexAuth } from "@convex-dev/auth/server";
import { Anonymous } from "@convex-dev/auth/providers/Anonymous";
import { Password } from "@convex-dev/auth/providers/Password";
import { emailOtp } from "./auth/emailOtp";
import { googleProviders } from "./authGoogle";

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
        if (password.length < 8) {
          throw new Error("Password must be at least 8 characters");
        }
        if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
          throw new Error("Password must contain a letter and a number");
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
