import { z } from "zod";

/** Schema for the signed manifest payload embedded in a JWS */
export const manifestPayloadSchema = z.object({
  agent_name: z.string(),
  agent_id: z.string().uuid(),
  owner_ref: z.string(),
  wallet_addresses: z.array(z.string()),
  scopes: z.array(z.string()),
  policy_refs: z.object({
    envoy_policy_url: z.string().optional(),
    privy_policy_url: z.string().optional(),
  }),
  issued_at: z.string().datetime(),
  expires_at: z.string().datetime(),
});

export type ManifestPayload = z.infer<typeof manifestPayloadSchema>;

/** Schema for the issue manifest request body */
export const issueManifestSchema = z.object({
  ttl: z.number().int().positive().max(86400).optional(),
});

export type IssueManifestInput = z.infer<typeof issueManifestSchema>;
