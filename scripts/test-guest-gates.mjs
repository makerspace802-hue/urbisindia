/**
 * Guest gates.
 *
 * Personalisation and report filing are both account features. The server has
 * always refused them for an anonymous caller — this suite checks that, so it
 * cannot quietly stop being true — and it checks the two layers above it,
 * which is where the problem actually was:
 *
 *   - the UI kept presenting both features as available to a guest, so a
 *     visitor could fill in a profile and a full report and only be refused at
 *     the very end;
 *   - the report handler uploaded the visitor's photo to storage BEFORE the
 *     mutation rejected it. The refusal was correct, but it came after the
 *     expensive part, and the visitor had already given up a file.
 *
 *   node scripts/test-guest-gates.mjs
 */

import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";

/**
 * Comments stripped, whitespace collapsed, so formatting cannot break these.
 *
 * Both comment patterns are anchored to the start of a line. That is not
 * decoration: an unanchored `/\/\*[\s\S]*?\*\//` matches the `image/*` in
 * `accept="image/*"` and runs on to the next `/>`, silently deleting a third
 * of the file. An unanchored `//` stripper does the same to `https://` inside a
 * placeholder. Both produced passes that were checking truncated text.
 */
function flat(path) {
  return readFileSync(path, "utf8")
    .replace(/^\/\*[\s\S]*?\*\//gm, " ")
    .replace(/^\s*\/\/[^\n]*/gm, " ")
    .replace(/\s+/g, " ");
}

/**
 * One exported Convex function, from its opening brace to the matching close.
 *
 * Scanning starts at the FIRST brace after the export, which is the outer
 * object holding `args` and `handler` — not the args object, which is what
 * picking the second brace returns.
 */
function handler(source, name) {
  const at = source.indexOf(`export const ${name} =`);
  assert.notEqual(at, -1, `${name} is missing`);
  const open = source.indexOf("{", at);
  let depth = 0;
  for (let i = open; i < source.length; i++) {
    if (source[i] === "{") depth++;
    else if (source[i] === "}") {
      depth--;
      if (depth === 0) return source.slice(open, i + 1);
    }
  }
  throw new Error(`${name} is never closed`);
}

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

const report = flat("src/pages/ReportPortal.tsx");
const dash = flat("src/pages/Dashboard.tsx");
const entry = flat("src/main.tsx");
const auth = flat("src/pages/Auth.tsx");
const admin = readFileSync("src/convex/admin.ts", "utf8");
const profile = readFileSync("src/convex/profile.ts", "utf8");

/* ==========================================================================
   1. Report filing
   ========================================================================== */

check("the server refuses an anonymous report, and says why", () => {
  const body = handler(admin, "submitIssue");
  assert.match(body, /getAuthUserId\(ctx\)/, "submitIssue no longer checks who is calling");
  assert.match(
    body,
    /if \(!userId\) throw new Error\("Sign in to submit a report"\)/,
    "submitIssue no longer refuses an anonymous caller",
  );
});

check("the server refuses an anonymous photo upload", () => {
  const body = handler(admin, "uploadUrl");
  assert.match(body, /getAuthUserId\(ctx\)/);
  assert.match(body, /if \(!userId\) throw new Error\("Sign in to attach a photo"\)/);
});

check("a guest is never handed a submittable form", () => {
  assert.ok(
    /\{isAuthenticated \? \(\s*<form onSubmit=\{handleSubmit\}/.test(report),
    "the report form is rendered unconditionally, so a guest can fill it in",
  );
  // And the locked state is a real alternative, not an empty branch.
  assert.match(
    report,
    /Only signed-in residents can file a report/,
    "a guest is shown no explanation of why the form is gone",
  );
  assert.match(
    report,
    /to="\/auth\?returnTo=%2Freport"/,
    "the locked state offers no way to sign in and come back",
  );
});

check("the photo cannot be uploaded before the refusal", () => {
  // The ordering is the whole bug. This handler used to upload first and call
  // the mutation second, so a guest's image reached storage for a ticket that
  // was never created. Checking "the mutation is called" proves nothing; the
  // guard has to come first.
  const guardAt = report.indexOf("if (!isAuthenticated) {");
  const uploadAt = report.indexOf("await uploadPhoto(pendingFile)");
  assert.ok(guardAt !== -1, "handleSubmit has no signed-in guard");
  assert.ok(uploadAt !== -1, "the upload call has moved — re-check this test");
  assert.ok(
    guardAt < uploadAt,
    "the photo is still uploaded before the signed-in check refuses it",
  );

  const mutateAt = report.indexOf("await submitIssue({");
  assert.ok(
    guardAt < mutateAt,
    "the signed-in check comes after the mutation call",
  );
});

check("the button no longer offers a submit it will refuse", () => {
  assert.ok(
    !/Sign In To Submit/.test(report),
    'the button still reads "Sign In To Submit", which invites a press that cannot succeed',
  );
  assert.match(report, /Submit Citizen Report/);
});

check("the category and location taxonomy stays public", () => {
  // Reporting is account-only, but browsing the tables is not. Making the
  // whole page private would take away something guests are meant to get.
  assert.ok(
    !/<RequireAuth/.test(report),
    "the report page became entirely private — that is more than was asked",
  );
});

/* ==========================================================================
   2. Profile personalisation
   ========================================================================== */

check("the server refuses an anonymous profile write", () => {
  const body = handler(profile, "updateProfile");
  assert.match(body, /getAuthUserId\(ctx\)/);
  assert.match(body, /if \(!userId\) throw new Error\("Unauthenticated"\)/);
});

check("a guest is never handed the personalisation fields", () => {
  assert.ok(
    /\{!isAuthenticated \? \(\s*<div className="flex flex-col items-center gap-3/.test(dash),
    "the profile editor is rendered unconditionally",
  );
  assert.match(dash, /Sign in to personalise your profile/);
  assert.match(dash, /to="\/auth\?returnTo=%2Fdashboard"/);
});

check("every personalisation field sits inside the gated branch", () => {
  // Name, city, country and picture are the four the request named. All four
  // must be after the gate, or one of them leaks into the guest view.
  const gateAt = dash.indexOf("{!isAuthenticated ? (");
  assert.ok(gateAt !== -1, "no gate found in the settings card");
  for (const id of [
    "settings-name",
    "settings-city",
    "settings-country",
    "settings-image",
  ]) {
    const at = dash.indexOf(`id="${id}"`);
    assert.ok(at !== -1, `${id} is missing entirely`);
    assert.ok(
      at > gateAt,
      `${id} renders outside the signed-in gate, so a guest can still edit it`,
    );
  }
});

check("saving is refused in the handler, not only by the route", () => {
  // The route wrapper and the server both already refuse. This is the layer
  // that holds if the component is ever mounted somewhere unwrapped.
  assert.match(
    dash,
    /const handleSave[\s\S]*?if \(!isAuthenticated\) return;[\s\S]*?updateProfile\(/,
    "handleSave writes the profile without checking the session",
  );
  const guardAt = dash.indexOf("if (!isAuthenticated) return;");
  const mutateAt = dash.indexOf("await updateProfile({");
  assert.ok(
    guardAt !== -1 && guardAt < mutateAt,
    "the guard runs after the mutation",
  );
});

check("the dashboard route stays behind RequireAuth as well", () => {
  // `path` comes first and the wrapper is its `element`, so the order matters.
  assert.match(
    entry,
    /path="\/dashboard"[\s\S]{0,200}<RequireAuth>/,
    "/dashboard is no longer wrapped in RequireAuth",
  );
});

check("the public dashboard stays guest-usable apart from customisation", () => {
  // Guests still get the national census cards. Only the customiser and the
  // personalised readings are theirs to lose.
  assert.ok(!/<RequireAuth/.test(flat("src/pages/CommandCenter.tsx")));
  assert.match(flat("src/pages/CommandCenter.tsx"), /\{isAuthenticated && \(\s*<button/);
});

/* ==========================================================================
   3. No guest accounts
   ========================================================================== */

check("nothing can sign in anonymously any more", () => {
  // `signIn("anonymous")` is Convex Auth's anonymous provider, and it was not
  // a "no account" mode — it minted a real row in `users` with a real session.
  // Anyone who used it became an account holder, which is the opposite of what
  // "guest" implies on the button.
  assert.ok(
    !/signIn\(\s*"anonymous"/.test(auth),
    "the sign-in page can still start an anonymous session",
  );

  // The call is gone everywhere, not just from this page.
  const offenders = [];
  for (const file of walk("src")) {
    if (file.includes("_generated")) continue;
    const body = readFileSync(file, "utf8");
    if (/signIn\(\s*"anonymous"/.test(body)) offenders.push(file);
  }
  assert.deepEqual(offenders, [], "anonymous sign-in is still reachable");
});

check("the guest button and its handler are gone", () => {
  assert.ok(!/handleGuestLogin/.test(auth), "handleGuestLogin still exists");
  assert.ok(!/Continue as guest/i.test(auth), 'the "Continue as guest" button is back');
  assert.ok(!/UserX/.test(auth), "the guest icon import is still here");
  assert.ok(
    !/guest session/i.test(auth),
    "the guest-session error copy is still here",
  );
});

check("no page still speaks of a guest account", () => {
  // "Guest" as a word for a signed-out visitor is fine; a guest *account* is
  // not. Any source that still offers one has to be found.
  const offenders = [];
  for (const file of walk("src")) {
    if (file.includes("_generated")) continue;
    const body = readFileSync(file, "utf8");
    if (/guest/i.test(body)) offenders.push(file);
  }
  assert.deepEqual(offenders, [], "the word 'guest' survives somewhere in src/");
});

check("sign-in still offers the real ways in", () => {
  // Removing one option must not remove the others.
  assert.match(auth, /signIn\("google"\)/);
  assert.match(auth, /signIn\("email-otp"/);
  assert.match(auth, /flow: "signIn"/);
  assert.match(auth, /flow: "signUp"/);
});

check("the anonymous schema field is left alone, deliberately", () => {
  // `isAnonymous` is @convex-dev/auth's own field on the users table and its
  // comment says "do not remove". It is a library contract, not the guest
  // feature — the feature was the UI entry point, which is gone. Dropping the
  // field would break the auth library's writes for any row it still touches.
  const schema = readFileSync("src/convex/schema.ts", "utf8");
  assert.match(schema, /isAnonymous/);
});

/** Every source file under `dir`, recursively. */
function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = `${dir}/${entry.name}`;
    if (entry.isDirectory()) out.push(...walk(full));
    else if (/\.(ts|tsx)$/.test(entry.name)) out.push(full);
  }
  return out;
}

/* ==========================================================================
   Result
   ========================================================================== */

if (failures.length === 0) {
  console.log(`guest-gates: ${passed}/${passed} checks passed`);
} else {
  console.log(`guest-gates: ${failures.length} FAILED of ${passed + failures.length}`);
  for (const f of failures) console.log(`  FAIL ${f}`);
  process.exitCode = 1;
}