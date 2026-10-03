import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { Infer, v } from "convex/values";

// default user roles. can add / remove based on the project as needed
export const ROLES = {
  ADMIN: "admin",
  USER: "user",
  MEMBER: "member",
} as const;

export const roleValidator = v.union(
  v.literal(ROLES.ADMIN),
  v.literal(ROLES.USER),
  v.literal(ROLES.MEMBER),
);
export type Role = Infer<typeof roleValidator>;

const issueStatusValidator = v.union(
  v.literal("New"),
  v.literal("In Progress"),
  v.literal("On Review"),
  v.literal("Resolved"),
);

const projectionPointValidator = v.object({
  year: v.number(),
  /** Projected population for that year. */
  population: v.number(),
  /** India's projected population in the same year, for comparison. */
  india: v.number(),
  /** Cumulative growth from the 2011 base, as a multiple. */
  multiple: v.number(),
});

const schema = defineSchema(
  {
    // default auth tables using convex auth.
    ...authTables, // do not remove or modify

    // the users table is the default users table that is brought in by the authTables
    users: defineTable({
      name: v.optional(v.string()), // name of the user. do not remove
      image: v.optional(v.string()), // image of the user. do not remove
      email: v.optional(v.string()), // email of the user. do not remove
      emailVerificationTime: v.optional(v.number()), // email verification time. do not remove
      isAnonymous: v.optional(v.boolean()), // is the user anonymous. do not remove

      role: v.optional(roleValidator), // role of the user. do not remove
      city: v.optional(v.string()),
      country: v.optional(v.string()),
    }).index("email", ["email"]), // index for the email. do not remove or modify

    // citizen issue tickets filed through the /report portal
    issues: defineTable({
      ticket: v.string(),
      category: v.string(),
      tag: v.string(),
      tagColor: v.string(),
      district: v.string(),
      description: v.string(),
      urgency: v.string(),
      status: issueStatusValidator,
      upvotes: v.number(),
      createdAt: v.number(),
      aiTag: v.string(),
      reporterEmail: v.string(),
      resolvedBy: v.optional(v.string()),
      resolvedAt: v.optional(v.number()),
      resolution: v.optional(v.string()),
      /**
       * Convex file storage id for the photo attached to this report.
       * Without it the pick-a-photo control only ever produced a local blob
       * URL that vanished on submit, so attached images were never visible.
       */
      storageId: v.optional(v.string()),
    })
      .index("by_ticket", ["ticket"])
      .index("by_status", ["status"])
      .index("by_created_at", ["createdAt"]),

    // results from the 15-question habit / usage / carbon-footprint quiz
    quizScores: defineTable({
      email: v.string(),
      city: v.string(),
      country: v.string(),
      /** Estimated annual per-capita footprint in kg CO2e, summed from answers. */
      footprintKg: v.number(),
      createdAt: v.number(),
    }).index("by_email", ["email"]),

    // saved 10-year city outlooks from the climate & mobility simulator
    projections: defineTable({
      // State name, or "India" when the visitor is outside the country.
      state: v.string(),
      population: v.number(),
      /** The state's observed 2001-2011 decadal rate, as a percentage. */
      observedRatePercent: v.number(),
      points: v.array(projectionPointValidator),
      createdAt: v.number(),
    }).index("by_state", ["state"]),

    // -------------------------------------------------------------------------
    // Admin grants are keyed by EMAIL, not by user id.
    //
    // Convex Auth creates a separate `users` row for every distinct sign-in
    // provider (google / email-otp / password). The old admin flag lived on the
    // user row, so signing in through a different provider produced a NEW row
    // with no role, and the admin UI disappeared. Keying the grant on the
    // normalized email means the same human keeps admin no matter which
    // provider created the row, and no matter how many rows now exist for them.
    // -------------------------------------------------------------------------
    adminGrants: defineTable({
      email: v.string(),
      /** Who granted it, for the audit trail in the admin panel. */
      grantedBy: v.optional(v.string()),
      createdAt: v.number(),
    }).index("by_email", ["email"]),

    // Which sign-in providers an account has actually used, so the UI can
    // offer "set a password" only where it is meaningful and can report
    // "you already have a password" instead of silently failing.
    accountPasswords: defineTable({
      email: v.string(),
      /** Convex Auth user id the password account is attached to. */
      userId: v.optional(v.string()),
      createdAt: v.number(),
    }).index("by_email", ["email"]),

    // add other tables here

    // tableName: defineTable({
    //   ...
    //   // table fields
    // }).index("by_field", ["field"])
  },
  {
    schemaValidation: false,
  },
);

export default schema;
