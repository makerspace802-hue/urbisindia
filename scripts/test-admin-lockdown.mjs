/**
 * Admin is a code fact, not a database fact.
 *
 * This deployment had three separate ways for the admin set to change at
 * runtime, and all three were reachable:
 *
 *   - `bootstrapFirstAdmin`, offered on the sign-up screen as "Claim admin",
 *     granted the caller admin whenever `adminGrants` was empty. It threw a
 *     reassuring error only once a row already existed, so it was a live
 *     self-service admin grant for the whole period the table was empty.
 *   - `purgeOtherAdmins`, offered in the admin desk as "Sole Admin", let any
 *     signed-in admin delete every other grant.
 *   - `revokeAdminByEmail`, which could strip a grant.
 *
 * All three are deleted rather than hidden, and `isAdminEmail` now consults
 * `SEED_ADMIN_EMAILS` and nothing else. The suite checks the absence, because
 * an absent-but-unpinned export is exactly the kind of thing that comes back
 * with the next refactor.
 *
 * Also covered here: the sign-up flow can no longer be skipped, and /auth has
 * a way back to the site.
 *
 *   node scripts/test-admin-lockdown.mjs
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/** Comments stripped, whitespace collapsed. Comment patterns are anchored to
 *  the start of a line so `https://` is never mistaken for a comment. */
function flat(path) {
  return readFileSync(path, "utf8")
    .replace(/^\/\*[\s\S]*?\*\//gm, " ")
    .replace(/^\s*\/\/[^\n]*/gm, " ")
    .replace(/\s+/g, " ");
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

const identity = flat("src/convex/identity.ts");
const auth = flat("src/pages/Auth.tsx");
const desk = flat("src/components/AdminTicketDesk.tsx");
const admin = flat("src/convex/admin.ts");

/* ==========================================================================
   1. The admin set can only be changed in this file
   ========================================================================== */

check("the seeded admin is exactly one address", () => {
  const seed = identity.slice(
    identity.indexOf("SEED_ADMIN_EMAILS"),
    identity.indexOf(";", identity.indexOf("SEED_ADMIN_EMAILS")),
  );
  const addresses = seed.match(/[^\s,"']+@[^\s,"']+/g) ?? [];
  assert.deepEqual(
    addresses,
    ["pratyushdhote20@gmail.com"],
    `SEED_ADMIN_EMAILS must hold exactly one address, found ${addresses.length}`,
  );
});

check("no mutation anywhere can grant admin", () => {
  assert.ok(
    !/db\.insert\("adminGrants"/.test(identity) &&
      !/db\.insert\("adminGrants"/.test(admin),
    "something can still write an adminGrants row",
  );
  // The three removals, by name, in case they come back under another file.
  for (const gone of ["bootstrapFirstAdmin", "purgeOtherAdmins", "revokeAdminByEmail"]) {
    assert.ok(
      !new RegExp(`export const ${gone} =`).test(identity),
      `${gone} is exported again; it must be deleted, not just unlinked`,
    );
  }
});

check("identity.ts exports no mutation that touches the admin set", () => {
  const mutations = identity.match(/export const (\w+) = mutation\(/g) ?? [];
  assert.deepEqual(
    mutations,
    ["export const markPasswordSet = mutation("],
    `identity.ts should export exactly one mutation, found: ${mutations.join(", ")}`,
  );
});

check("isAdminEmail reads the seed and nothing else", () => {
  const body = identity.slice(
    identity.indexOf("export async function isAdminEmail"),
    identity.indexOf("requireAdminEmail"),
  );
  assert.match(body, /return isSeedAdmin\(normaliseEmail\(email\)\)/);
  assert.ok(
    !/ctx\.db/.test(body),
    "isAdminEmail queries the database again, so admin is a stored value " +
      "rather than a code fact",
  );
});

check("the admin grants table is no longer read anywhere", () => {
  assert.ok(
    !/ctx\.db\.query\("adminGrants"\)/.test(identity),
    "identity.ts reads adminGrants again",
  );
});

/* ==========================================================================
   2. The UI offers no way to become, or un-become, admin
   ========================================================================== */

check("no screen offers a way to claim admin", () => {
  for (const [label, text] of [["auth", auth], ["admin desk", desk]]) {
    assert.ok(
      !/Claim admin/i.test(text),
      `the ${label} screen offers "Claim admin" again`,
    );
    assert.ok(
      !/Sole Admin/i.test(text),
      `the ${label} screen offers "Sole Admin" again`,
    );
  }
});

check("the admin desk no longer imports an admin-purging mutation", () => {
  assert.ok(
    !/purgeOtherAdmins/.test(desk),
    "the admin desk still references purgeOtherAdmins",
  );
});

/* ==========================================================================
   3. Sign-up cannot be skipped
   ========================================================================== */

check("no account can be created without verifying the address", () => {
  // The password screen used to double as the sign-up form: a "Create one"
  // toggle turned it into a sign-up, and an account plus a chosen password
  // could be created for an address that had never been verified. Every
  // sign-up now goes through the emailed code first and sets a password on the
  // verified step, so the only `signUp` call left is the one after a code.
  assert.ok(
    !/handlePasswordSignUp/.test(auth),
    "the password screen can still create an account",
  );
  assert.ok(
    !/flow: "signUp"[\s\S]{0,400}email: step\.email/.test(auth),
    "sign-up is being called with an unverified address from the password step",
  );

  // Count the signUp flows and confirm the only one is on the verified step,
  // which is only reachable after `handleOtpSubmit` has succeeded.
  const signUps = auth.match(/flow: "signUp"/g)?.length ?? 0;
  assert.equal(
    signUps,
    1,
    `expected exactly one signUp flow, found ${signUps}; every other one would be ` +
      "a way to create an account without verifying the address",
  );
  const attach = auth.slice(auth.indexOf("handleAttachPassword"));
  assert.match(
    attach,
    /flow: "signUp"/,
    "the verified step is no longer where a password gets set",
  );
});

check("a verified user cannot walk past setting a password", () => {
  assert.ok(
    !/Skip for now/.test(auth),
    '"Skip for now" is back; a verified account could skip password setup',
  );
  // And the one button that does continue still submits the form.
  assert.match(
    auth,
    /form="attach-password"/,
    "the continue button is no longer wired to the password form",
  );
});

/* ==========================================================================
   4. /auth has a way back
   ========================================================================== */

check("/auth always offers a route back to the site", () => {
  // Placed above the card rather than inside a step, so it is present on every
  // step including "choose" — which is where a visitor used to be stranded
  // after picking a sign-in method.
  assert.match(auth, /Back to site/);
  assert.match(auth, /<Link\s+to="\/"/);
  assert.ok(
    auth.indexOf('Back to site') < auth.indexOf("<Card"),
    "the back link is rendered after the card, so it is not always reachable",
  );
});

/* ==========================================================================
   5. A report says who filed it and from where
   ========================================================================== */

check("submitIssue snapshots the reporter's identity", () => {
  assert.match(
    admin,
    /reporterName: trimmed\(user\?\.name\)/,
    "submitIssue no longer records who filed the report",
  );
  assert.match(admin, /reporterCity: trimmed\(user\?\.city\)/);
  assert.match(admin, /reporterCountry: trimmed\(user\?\.country\)/);
});

check("the admin query returns the reporter's identity", () => {
  assert.match(admin, /reporterName: row\.reporterName \?\? null/);
  assert.match(admin, /reporterCity: row\.reporterCity \?\? null/);
  assert.match(admin, /reporterCountry: row\.reporterCountry \?\? null/);
});

check("the report card leads with the author, before the complaint", () => {
  assert.match(desk, /reporterName\?: string \| null/);
  assert.match(desk, /reporterCity\?: string \| null/);
  assert.match(desk, /reporterCountry\?: string \| null/);

  const header = desk.indexOf("<header");
  const complaint = desk.indexOf("{report.description}");
  assert.notEqual(header, -1, "the report card has no author header");
  assert.notEqual(complaint, -1, "the report description is missing");
  assert.ok(
    header < complaint,
    "the author block must come before the description",
  );
  // A location line, not just a name.
  assert.match(desk, /reporterPlace\(report\)/);
  assert.match(desk, /MapPin/);
});

check("an unnamed reporter still shows something identifying", () => {
  // Falling back to the email's local part, because "URBIS resident" alone
  // tells an official nothing.
  assert.match(
    desk,
    /reporterEmail\.split\("@"\)\[0\]/,
    "the author label no longer falls back to the address",
  );
  assert.match(desk, /URBIS resident/);
});

/* -------------------------------------------------------------------------- */

console.log(`test-admin-lockdown: ${passed} passed, ${failures.length} failed`);
for (const f of failures) console.log(`  FAIL  ${f}`);
if (failures.length > 0) process.exit(1);