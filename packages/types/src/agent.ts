import { z } from "zod";

export const AgentStatus = {
  ACTIVE: "active",
  SUSPENDED: "suspended",
  REVOKED: "revoked",
} as const;

export type AgentStatus = (typeof AgentStatus)[keyof typeof AgentStatus];

export const agentStatusSchema = z.enum(["active", "suspended", "revoked"]);

export const createAgentSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1000).nullable().optional(),
});

export const updateAgentSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).nullable().optional(),
  status: agentStatusSchema.optional(),
});
