import { z } from "zod";

/** Schema for the token verification request body (called by platforms, no auth) */
export const verifyTokenSchema = z.object({
  token: z.string().min(1),
  /** Optional platform API key — when provided, platform-specific requirements are enforced */
  platformApiKey: z.string().optional(),
});

export type VerifyTokenInput = z.infer<typeof verifyTokenSchema>;
