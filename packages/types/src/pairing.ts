import { z } from "zod";

/** Schema for the pair-confirm request body (called by agent runtime, no auth) */
export const confirmPairingSchema = z.object({
  pairingSecret: z.string().min(1),
  pairingId: z.string().uuid(),
});

export type ConfirmPairingInput = z.infer<typeof confirmPairingSchema>;
