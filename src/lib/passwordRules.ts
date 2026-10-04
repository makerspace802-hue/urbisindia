/**
 * The password rules, checked before anything is sent.
 *
 * The server is the authority (`convex/auth.ts`) and has been since the
 * `validatePasswordRequirements` throw was changed to a `ConvexError`. This
 * copy exists for one reason: to answer "is this password acceptable?" without
 * a round trip, so the person finds out while the field is still full instead
 * of after a failed submit.
 *
 * Duplication is deliberate and enforced — `scripts/test-auth-errors.mjs`
 * reads both files and fails if the threshold or either sentence drifts.
 */

export const PASSWORD_MIN_LENGTH = 8;

export const PASSWORD_PLACEHOLDER = `At least ${PASSWORD_MIN_LENGTH} characters, with a number`;

/**
 * The first reason this password would be rejected, or null when it is fine.
 *
 * Ordered to match the server: length first, then composition, so the message
 * matches whichever rule actually trips first on the backend.
 */
export function passwordProblem(password: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `Use at least ${PASSWORD_MIN_LENGTH} characters.`;
  }
  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
    return "Include at least one letter and one number.";
  }
  return null;
}