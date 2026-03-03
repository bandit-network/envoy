import { z } from "zod";

export const AgentStatus = {
  ACTIVE: "active",
  SUSPENDED: "suspended",
  REVOKED: "revoked",
} as const;

export type AgentStatus = (typeof AgentStatus)[keyof typeof AgentStatus];

export const agentStatusSchema = z.enum(["active", "suspended", "revoked"]);

/** Reserved usernames that cannot be claimed */
const RESERVED_USERNAMES = [
  "admin",
  "system",
  "envoy",
  "api",
  "root",
  "support",
  "help",
  "bot",
  "agent",
  "platform",
  "null",
  "undefined",
];

/** Username validation: lowercase alphanumeric + hyphens, 3-39 chars */
export const usernameSchema = z
  .string()
  .min(3, "Username must be at least 3 characters")
  .max(39, "Username must be at most 39 characters")
  .regex(
    /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/,
    "Username must be lowercase alphanumeric with hyphens, no leading/trailing hyphens"
  )
  .refine(
    (val) => !val.includes("--"),
    "Username must not contain consecutive hyphens"
  )
  .refine(
    (val) => !RESERVED_USERNAMES.includes(val),
    "This username is reserved"
  );

/** Optional URL field for social links and avatar */
const optionalUrlSchema = z
  .string()
  .url("Must be a valid URL")
  .max(500)
  .nullable()
  .optional();

export const createAgentSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1000).nullable().optional(),
  username: usernameSchema.optional(),
  avatarUrl: optionalUrlSchema,
  socialMoltbook: optionalUrlSchema,
  socialX: optionalUrlSchema,
});

export const updateAgentSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).nullable().optional(),
  username: usernameSchema.optional(),
  avatarUrl: optionalUrlSchema,
  socialMoltbook: optionalUrlSchema,
  socialX: optionalUrlSchema,
  status: agentStatusSchema.optional(),
});

export type CreateAgentInput = z.infer<typeof createAgentSchema>;
export type UpdateAgentInput = z.infer<typeof updateAgentSchema>;
