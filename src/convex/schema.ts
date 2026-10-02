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
    }).index("email", ["email"]), // index for the email. do not remove or modify

    // citizen issue tickets that residents report through the /report portal
    issues: defineTable({
      ticket: v.string(),
      id: v.string(),
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
      resolvedByAdminId: v.optional(v.string()),
      resolvedAt: v.optional(v.number()),
      resolution: v.optional(v.string()),
    })
      .index("by_ticket", ["ticket"])
      .index("by_status", ["status"]),

    // quiz results captured by the 15-question habit/usage/carbon-footprint quiz
    quizScores: defineTable({
      id: v.string(),
      email: v.string(),
      city: v.string(),
      country: v.string(),
      totalPoints: v.number(),
      categoryPoints: v.object({
        dailyHabits: v.number(),
        usage: v.number(),
        carbonFootprint: v.number(),
      }),
      createdAt: v.number(),
    }),

    // 10-year city-scale climate and mobility projections
    projections: defineTable({
      id: v.string(),
      baseMicroClimateTempDropPerPersonCelsius: v.number(),
      baseModalShiftPercentPerPerson: v.number(),
      baseMuniHealthEnergySavingsPerPerson: v.number(),
      population: v.number(),
      years: v.array(v.number()),
    }),

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
