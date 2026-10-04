/**
 * Turning a failed auth action into something a person can act on.
 *
 * The bug this exists for: the sign-up handler displayed `err.message`
 * verbatim, and for anything the backend threw as a plain `Error` that string
 * is Convex's wrapper —
 *
 *   [CONVEX A(auth.signIn)] [Request ID: 9c86…] Server Error
 *   Called by client
 *
 * — a request id and the word "Error" where the actual reason used to be. That
 * is what the form was showing instead of "Include at least one letter and one
 * number."
 *
 * Why the reason is missing: `convex/dist/esm/browser/logging.js` builds that
 * message from `result.errorMessage`, and `forwardData` attaches
 * `result.errorData` to the thrown error **only when the server threw a
 * `ConvexError`**. A plain `throw new Error("…")` on the server carries no
 * data across, so the text is gone before the browser ever sees it. The server
 * side of this is fixed in `convex/auth.ts`; this module is what makes the
 * browser behave sensibly for the throws nobody controls — a wrong password,
 * or an address that already has an account, both raised inside
 * @convex-dev/auth.
 */

/** Keys the server may send as a machine-readable reason. */
const CODE_MESSAGES: Record<string, string> = {
  password_too_short: "That password is too short.",
  password_too_weak: "Include at least one letter and one number.",
};

/** Does this string look like Convex's wrapper rather than a real reason? */
function isOpaqueConvexMessage(message: string): boolean {
  return (
    message.includes("[CONVEX ") ||
    message.includes("Called by client") ||
    // `errorMessage` is the literal "Server Error" for any untyped throw.
    /\bServer Error\b/.test(message)
  );
}

/** Pull the readable text out of whatever the server actually sent. */
function fromErrorData(data: unknown): string | null {
  if (typeof data === "string" && data.trim() !== "") return data;
  if (data !== null && typeof data === "object") {
    const record = data as Record<string, unknown>;
    // Our own ConvexErrors carry { code, message }; prefer the prose.
    if (typeof record.message === "string" && record.message.trim() !== "") {
      return record.message;
    }
    if (typeof record.code === "string" && CODE_MESSAGES[record.code]) {
      return CODE_MESSAGES[record.code];
    }
  }
  return null;
}

/**
 * The one place an auth failure becomes a sentence.
 *
 * Every handler in the auth screen routes through this. The order matters:
 * `data` is checked before `message` because, for a `ConvexError`, `message`
 * is still the opaque wrapper — reading it first would throw away the good
 * text sitting right there in `data`.
 *
 * `fallback` is what to say when the server gave us nothing usable, and should
 * be specific to the attempt that failed rather than a generic apology.
 */
export function friendlyAuthError(err: unknown, fallback: string): string {
  if (err !== null && typeof err === "object") {
    const withData = fromErrorData((err as { data?: unknown }).data);
    if (withData) return withData;

    const message = (err as { message?: unknown }).message;
    if (typeof message === "string" && message.trim() !== "") {
      // A real, readable message is worth keeping — but never the wrapper.
      if (!isOpaqueConvexMessage(message)) return message;
    }
  }
  return fallback;
}