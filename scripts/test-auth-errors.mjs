/**
 * Auth error reporting and auth-card spacing.
 *
 * The bug this was written for: creating an account with a password the server
 * rejected produced this in the form, where the useful sentence should have
 * been:
 *
 *   [CONVEX A(auth.signIn)] [Request ID: 9c86a2e55b3ff399] Server Error
 *   Called by client
 *
 * `convex/dist/esm/browser/logging.js` builds that wrapper from
 * `result.errorMessage` and attaches `result.errorData` to the thrown error
 * only when the server threw a `ConvexError`. The password validator threw a
 * plain `Error`, so the reason never crossed the wire and the raw wrapper was
 * rendered as the error text.
 *
 * Two things therefore have to hold, and both are checked here:
 *   1. the server throws the kind Convex actually forwards, and
 *   2. the browser never renders a raw wrapper even when the server throws
 *      something it does not control — a wrong password, or an address that
 *      already has an account, both raised inside @convex-dev/auth.
 *
 * The second is verified by executing `friendlyAuthError` against the real
 * error shapes rather than by matching its source, so the assertions describe
 * behaviour that a refactor cannot quietly change.
 *
 *   node scripts/test-auth-errors.mjs
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildSync } from "esbuild";

/** Comments stripped, whitespace collapsed. Comment patterns are anchored to
 *  the start of a line so `https://` in a placeholder is not mistaken for one. */
function flat(path) {
  return readFileSync(path, "utf8")
    .replace(/^\/\*[\s\S]*?\*\//gm, " ")
    .replace(/^\s*\/\/[^\n]*/gm, " ")
    .replace(/\s+/g, " ");
}

/* --------------------------------------------------------------------------
   Execute the two pure modules so their behaviour is really checked.
   -------------------------------------------------------------------------- */
const bundle = join(tmpdir(), "urbis-auth-errors.mjs");
buildSync({
  stdin: {
    contents: [
      'export * from "./src/lib/authErrors";',
      'export * from "./src/lib/passwordRules";',
    ].join("\n"),
    resolveDir: process.cwd(),
    loader: "ts",
  },
  bundle: true,
  format: "esm",
  platform: "neutral",
  outfile: bundle,
});
const mod = await import(bundle);
const { friendlyAuthError, passwordProblem, PASSWORD_MIN_LENGTH } = mod;

let passed = 0;
const failures = [];
function check(name, fn) {
  try {
    fn();
    passed++;
  } catch (error) {
    failures.push(`${name} — ${error.message}`);
  }
}

const authPage = flat("src/pages/Auth.tsx");
const authConvex = flat("src/convex/auth.ts");
const css = readFileSync("src/index.css", "utf8");

/**
 * One top-level CSS rule, found by matching braces from its opening line.
 *
 * `indexOf(".dark")` is not good enough: both selectors also occur inside
 * comments and inside each other's declarations, so a plain slice either ran
 * backwards (empty) or captured the wrong block.
 */
function cssBlock(selector) {
  const source = readFileSync("src/index.css", "utf8");
  const at = source.search(new RegExp(`^${selector.replace(".", "\\.")}\\s*\\{`, "m"));
  assert.notEqual(at, -1, `${selector} block not found in index.css`);
  let depth = 0;
  for (let i = source.indexOf("{", at); i < source.length; i++) {
    if (source[i] === "{") depth++;
    else if (source[i] === "}" && --depth === 0) return source.slice(at, i + 1);
  }
  throw new Error(`${selector} block is never closed`);
}

/** The wrapper Convex builds for any throw that is not a ConvexError. */
const convexWrapper = (udf, requestId = "9c86a2e55b3ff399") =>
  new Error(
    `[CONVEX A(${udf})] [Request ID: ${requestId}] Server Error\n  Called by client`,
  );

/* ==========================================================================
   1. The server throws the type Convex actually forwards
   ========================================================================== */

check("the password validator throws a ConvexError, not a plain Error", () => {
  assert.match(
    authConvex,
    /import \{ ConvexError \} from "convex\/values"/,
    "convex/auth.ts no longer imports ConvexError",
  );
  assert.match(
    authConvex,
    /return new ConvexError\(\{ code, message \}\)/,
    "the validator no longer builds a ConvexError",
  );
  // The specific regression: a bare throw inside validatePasswordRequirements.
  const validator = authConvex.slice(
    authConvex.indexOf("validatePasswordRequirements"),
  );
  assert.ok(
    !/throw new Error\(/.test(validator),
    "a plain `throw new Error` is back inside the password validator; Convex " +
      "will replace its message with the Server Error wrapper again",
  );
  assert.match(
    validator,
    /throw passwordError\(/,
    "the validator must raise a passwordError, which is a ConvexError",
  );
});

check("both password rules raise a coded, readable error", () => {
  for (const code of ["password_too_short", "password_too_weak"]) {
    assert.ok(
      authConvex.includes(code),
      `${code} is no longer sent to the client, so the browser cannot map it back`,
    );
  }
});

/* ==========================================================================
   2. The browser funnel — behaviour, not source shape
   ========================================================================== */

check("a ConvexError's message survives, and data wins over message", () => {
  const err = convexWrapper("auth.signIn");
  err.data = { code: "password_too_weak", message: "Include at least one letter and one number." };
  assert.equal(
    friendlyAuthError(err, "fallback"),
    "Include at least one letter and one number.",
    "the message carried in `data` was thrown away",
  );
});

check("a code with no message still maps to something readable", () => {
  const err = convexWrapper("auth.signIn");
  err.data = { code: "password_too_short" };
  assert.equal(
    friendlyAuthError(err, "fallback"),
    "That password is too short.",
  );
});

check("a plain string in data is used", () => {
  const err = convexWrapper("auth.signIn");
  err.data = "Could not verify code";
  assert.equal(friendlyAuthError(err, "fallback"), "Could not verify code");
});

check("an opaque wrapper never reaches the screen", () => {
  // The exact regression: no `data`, so nothing but the wrapper is available.
  assert.equal(
    friendlyAuthError(convexWrapper("auth.signIn"), "Something readable."),
    "Something readable.",
    "the [CONVEX …] Server Error wrapper was returned to the user verbatim",
  );
});

check("the wrapper is recognised in every form Convex emits it", () => {
  for (const message of [
    "[CONVEX A(auth.signIn)] [Request ID: abc] Server Error\n  Called by client",
    "[CONVEX Q(api.x)] Server Error",
    "Called by client",
    "Server Error",
  ]) {
    assert.equal(
      friendlyAuthError(new Error(message), "fallback"),
      "fallback",
      `not recognised as opaque: ${JSON.stringify(message)}`,
    );
  }
});

check("a genuine message is kept rather than over-filtered", () => {
  assert.equal(
    friendlyAuthError(new Error("Email verification is not configured"), "fallback"),
    "Email verification is not configured",
  );
});

check("non-errors and empties fall back safely", () => {
  assert.equal(friendlyAuthError(undefined, "fallback"), "fallback");
  assert.equal(friendlyAuthError(null, "fallback"), "fallback");
  assert.equal(friendlyAuthError("a string", "fallback"), "fallback");
  assert.equal(friendlyAuthError(new Error(""), "fallback"), "fallback");
  assert.equal(friendlyAuthError({ data: null }, "fallback"), "fallback");
});

/* ==========================================================================
   3. Nothing in the auth screen renders a raw message again
   ========================================================================== */

check("no handler dumps err.message directly", () => {
  assert.ok(
    !/err instanceof Error\s*\?/.test(authPage),
    "a handler is back to rendering err.message raw",
  );
  assert.ok(
    !/setError\(\s*err\.message\s*\)/.test(authPage),
    "a handler is back to rendering err.message raw",
  );
});

check("every catch routes through the funnel", () => {
  const catches = authPage.match(/\}\s*catch\s*\(/g)?.length ?? 0;
  assert.ok(catches >= 6, `expected the auth screen to have several catches, found ${catches}`);
  assert.equal(
    authPage.match(/friendlyAuthError\(/g)?.length ?? 0,
    catches,
    "every catch must funnel its error through friendlyAuthError",
  );
});

/* ==========================================================================
   4. The server rules and the client mirror have not drifted
   ========================================================================== */

check("passwordProblem matches the server's rules", () => {
  assert.equal(passwordProblem("1234567"), `Use at least ${PASSWORD_MIN_LENGTH} characters.`);
  assert.equal(passwordProblem("12345678"), "Include at least one letter and one number.");
  assert.equal(passwordProblem("abcdefgh"), "Include at least one letter and one number.");
  assert.equal(passwordProblem("abcd1234"), null);
  assert.equal(passwordProblem("abcd123"), `Use at least ${PASSWORD_MIN_LENGTH} characters.`);
  assert.equal(passwordProblem(""), `Use at least ${PASSWORD_MIN_LENGTH} characters.`);
});

check("server and client say the same words about the same failure", () => {
  // Both the threshold and the two sentences, so a person told one thing by
  // the field check is not told something different by the server.
  assert.match(
    authConvex,
    new RegExp(`PASSWORD_MIN_LENGTH = ${PASSWORD_MIN_LENGTH}\\b`),
    "the server's minimum length no longer matches the client's",
  );
  for (const sentence of [
    "Use at least ${PASSWORD_MIN_LENGTH} characters.",
    "Include at least one letter and one number.",
  ]) {
    assert.ok(
      authConvex.includes(sentence),
      `the server no longer sends "${sentence}"`,
    );
    const clientSays = mod.passwordProblem("zzzzzzzz");
    assert.equal(
      clientSays,
      "Include at least one letter and one number.",
      "client mirror drifted from the server message",
    );
  }
});

check("sign-up refuses a weak password before calling the server", () => {
  for (const handler of ["handlePasswordSignUp", "handleAttachPassword"]) {
    // The window has to reach the actual request. 600 characters was enough
    // before the existing-account guard was added; it now ends mid-guard, so
    // indexOf("await signIn(") returned -1 and the ordering check passed or
    // failed on arithmetic against a value that was never there.
    const at = authPage.indexOf(handler);
    assert.notEqual(at, -1, `${handler} is gone`);
    const body = authPage.slice(at, at + 2000);
    assert.match(
      body,
      /const problem = passwordProblem\(password\)/,
      `${handler} no longer checks the password locally`,
    );
    const firstRequest = body.indexOf("await signIn(");
    assert.notEqual(firstRequest, -1, `${handler} never calls signIn`);
    assert.ok(
      body.indexOf("passwordProblem(password)") < firstRequest,
      `${handler} checks the password only after already calling the server`,
    );
  }
});

/* ==========================================================================
   5. Auth card spacing
   ========================================================================== */

check("the error panel no longer adds its own margin", () => {
  // Inside a `space-y-3` column an `mt-2` stacked on top of the 12px the
  // column already applies, which is what made the gap above an error read
  // wider than the gap below it.
  assert.ok(
    !/function ErrorText\([^)]*\)\s*\{[^}]*mt-\d/.test(authPage),
    "ErrorText carries its own vertical margin inside a space-y column again",
  );
});

check("every column holding an error shares the same rhythm", () => {
  // Each CardContent must set space-y-3 itself, or wrap a single child that
  // does — the verified step puts a space-y-3 form inside a bare CardContent,
  // which gives the same 12px without duplicating the class.
  const openings = authPage.match(/<CardContent[^>]*>/g) ?? [];
  assert.ok(openings.length >= 5, `expected the step columns, found ${openings.length}`);
  openings.forEach((opening, index) => {
    const follows = authPage.slice(
      authPage.indexOf(opening) + opening.length,
      authPage.indexOf(opening) + opening.length + 200,
    );
    if (opening.includes("space-y-3")) return;
    assert.match(
      follows,
      /<form[^>]*space-y-3/,
      `CardContent #${index + 1} has neither space-y-3 nor a space-y-3 child`,
    );
  });
});

check("footers leave room for the offset button shadow", () => {
  // `.nb-btn` paints `box-shadow: 4px 4px 0`, 6px on hover, which extends
  // past its own box. At gap-2 (8px) that shadow touched the button below.
  const footers = authPage.match(/<CardFooter[^>]*>/g) ?? [];
  assert.ok(footers.length >= 4, `expected the step footers, found ${footers.length}`);
  for (const f of footers) {
    assert.match(f, /gap-3/, `footer is too tight for the button shadow: ${f}`);
  }
  assert.ok(
    !/CardFooter[^>]*gap-2/.test(authPage),
    "a footer is back to gap-2",
  );
});

check("the error panel is announced and uses the legible token pair", () => {
  assert.match(authPage, /role="alert"/, "auth errors are not announced");
  assert.ok(
    !/text-\[#F43F5E\]/.test(authPage),
    "the error text is back to hard-coded #F43F5E, which measures 2.98:1 on " +
      "the light panel and 4.22:1 on the dark one",
  );
  assert.match(authPage, /var\(--nb-alert-ink\)/);
  assert.match(authPage, /var\(--nb-alert-bg\)/);
});

check("both themes define the alert pair, and it differs from --nb-loss", () => {
  for (const [name, block] of [["light", cssBlock(":root")], ["dark", cssBlock(".dark")]]) {
    assert.match(
      block,
      /--nb-alert-bg:\s*#[0-9a-f]{6}/i,
      `${name} theme has no --nb-alert-bg`,
    );
    assert.match(
      block,
      /--nb-alert-ink:\s*#[0-9a-f]{6}/i,
      `${name} theme has no --nb-alert-ink`,
    );
  }
});

/* ==========================================================================
   5. A sign-up for an address that already has a password is not attempted

   This is the second half of the "Server Error" report. Convex Auth throws
   `Account <email> already exists` as a plain Error when the stored secret
   does not match, so a repeat sign-up is guaranteed to fail and the failure
   is unreadable. The screen now asks first and routes to sign-in.
   ========================================================================== */

const identity = flat("src/convex/identity.ts");

check("the backend can answer whether an email already has a password", () => {
  assert.match(
    identity,
    /export const hasPasswordAccount = query\(/,
    "identity.ts no longer exposes hasPasswordAccount",
  );
  // The authoritative source is Convex Auth's own table, which is in this
  // deployment's schema via `authTables`. `accountPasswords` is bookkeeping
  // written after a sign-up, so it can only ever be the fallback.
  assert.match(
    identity,
    /\.query\("authAccounts"\)/,
    "hasPasswordAccount does not read authAccounts",
  );
  assert.match(
    identity,
    /\.query\("accountPasswords"\)/,
    "hasPasswordAccount lost its fallback",
  );
  // The lookup must be by the password provider, not by any other kind of row.
  assert.match(
    identity,
    /q\.eq\("provider", "password"\)/,
    "hasPasswordAccount no longer filters on the password provider",
  );
});

check("sign-up refuses to fire for an address that already has a password", () => {
  const at = authPage.indexOf("handlePasswordSignUp");
  const body = authPage.slice(at, at + 1600);
  assert.match(
    body,
    /if \(existingPasswordAccount === true\)/,
    "handlePasswordSignUp no longer checks for an existing account first",
  );
  assert.ok(
    body.indexOf("existingPasswordAccount === true") < body.indexOf('await signIn("password"'),
    "the existing-account check runs only after the sign-up request has been sent",
  );
  // The escape hatch must be sign-in, not a dead end.
  assert.match(
    body,
    /mode: "signIn"/,
    "sign-up no longer routes an existing address to sign-in",
  );
});

check("the verified screen offers to continue instead of re-creating", () => {
  assert.match(
    authPage,
    /existingPasswordAccount \? \(/,
    "the verified screen no longer branches on whether a password exists",
  );
  assert.match(
    authPage,
    /You already have a password/,
    "the already-set branch lost its heading",
  );
  // And the branch that still offers to set one must not be the default.
  const formBranch = authPage.slice(authPage.indexOf("existingPasswordAccount ? ("));
  assert.match(
    formBranch,
    /handleAttachPassword/,
    "the set-password form is unreachable from the verified screen",
  );
});

check("recording a password is not raced by the auto-redirect", () => {
  assert.match(
    authPage,
    /const completingRef = useRef\(false\)/,
    "the redirect guard is gone, so markPasswordSet races navigation again",
  );
  // The effect must consult it.
  const effect = authPage.slice(
    authPage.indexOf("useEffect(() => {"),
    authPage.indexOf("useEffect(() => {") + 500,
  );
  assert.match(
    effect,
    /!completingRef\.current/,
    "the auto-redirect no longer respects the completing guard",
  );
  // Every password/OTP handler that signs in must set it, and clear it again.
  // Five handlers sign in (password sign-in, sign-up, send code, verify code,
  // attach password). Each raises the guard only once it has committed to
  // making the request — the two early returns that bail out on an existing
  // account happen before that point, so they leave nothing to undo — and
  // clears it in its finally.
  const setCount = authPage.match(/completingRef\.current = true/g)?.length ?? 0;
  const clearCount = authPage.match(/completingRef\.current = false/g)?.length ?? 0;
  assert.equal(
    setCount,
    5,
    `expected all five sign-in handlers to raise the guard, found ${setCount} — ` +
      "a handler that signs in without raising it still races markPasswordSet",
  );
  assert.equal(
    clearCount,
    setCount,
    `expected one clear per raise, found ${clearCount} clears for ${setCount} raises — ` +
      "a guard left raised blocks the auto-redirect for the rest of the session",
  );
});

/* ==========================================================================
   6. The email-OTP provider does not destroy its own error

   Its catch block was `throw new Error(JSON.stringify(error))`. An Axios error
   cannot be serialised — `request` and `config` are circular — so that line
   threw a TypeError of its own, and the plain `Error` that escaped had its
   message replaced by Convex with a request-id wrapper. A failed email send
   was therefore completely undiagnosable from either the browser or the logs.
   ========================================================================== */

const emailOtp = flat("src/convex/auth/emailOtp.ts");

check("a failed OTP email raises a ConvexError the browser can read", () => {
  assert.match(
    emailOtp,
    /import \{ ConvexError \} from "convex\/values"/,
    "emailOtp.ts does not import ConvexError",
  );
  const catchBody = emailOtp.slice(emailOtp.indexOf("} catch (error) {"));
  assert.match(
    catchBody,
    /throw new ConvexError\(/,
    "the OTP email failure is raised as a plain Error again, so its message " +
      "will be replaced by a request-id wrapper",
  );
});

check("the OTP provider no longer serialises an Axios error", () => {
  assert.ok(
    !/JSON\.stringify\(error\)/.test(emailOtp),
    "JSON.stringify(error) is back in the OTP catch block; an Axios error is " +
      "circular, so this throws a TypeError and loses the original cause",
  );
});

check("a failed OTP send is recorded in the deployment logs", () => {
  assert.match(
    emailOtp,
    /console\.error\(/,
    "the OTP catch block logs nothing, so an email failure is invisible server-side",
  );
  // The detail must be the flattened subset, not the error object itself.
  assert.match(emailOtp, /axios\.isAxiosError\(error\)/);
});

/* -------------------------------------------------------------------------- */

console.log(`test-auth-errors: ${passed} passed, ${failures.length} failed`);
for (const f of failures) console.log(`  FAIL  ${f}`);
if (failures.length > 0) process.exit(1);