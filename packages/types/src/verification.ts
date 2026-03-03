import { z } from "zod";

/** Schema for the token verification request body (called by platforms, no auth) */
export const verifyTokenSchema = z.object({
  token: z.string().min(1),
});

export type VerifyTokenInput = z.infer<typeof verifyTokenSchema>;
