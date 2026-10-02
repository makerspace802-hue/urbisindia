import { query } from "./_generated/server";
import { googleEnabled } from "./authGoogle";

/**
 * Which optional sign-in methods the backend actually has configured.
 *
 * The auth screen reads this so it never renders a Google button that would
 * fail on click. Email + password and emailed OTP are always available.
 */
export const authOptions = query({
  args: {},
  handler: async () => ({
    google: googleEnabled,
    password: true,
    emailOtp: true,
  }),
});
