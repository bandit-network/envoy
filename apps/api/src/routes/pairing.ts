import { Hono } from "hono";
import { confirmPairingSchema } from "@envoy/types";
import { confirmPairing, confirmPairingDirect } from "../services/pairing";

export const pairingRouter = new Hono();

/**
 * POST /api/v1/pair-confirm
 * Public endpoint (no auth). Preferred flow for agent runtimes.
 * Resolves the agent automatically from the pairing ID — the human
 * only needs to give the agent the pairing ID and secret.
 */
pairingRouter.post("/pair-confirm", async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json(
      { success: false, error: { code: "BAD_REQUEST", message: "Invalid JSON body" } },
      400
    );
  }

  const parsed = confirmPairingSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { success: false, error: { code: "BAD_REQUEST", message: parsed.error.message } },
      400
    );
  }

  try {
    const result = await confirmPairingDirect(parsed.data.pairingId, parsed.data.pairingSecret);
    return c.json({ success: true, data: result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Pairing confirmation failed";
    return c.json(
      { success: false, error: { code: "UNAUTHORIZED", message } },
      401
    );
  }
});

/**
 * POST /api/v1/agents/:id/pair-confirm
 * Legacy endpoint (no auth). Requires agent ID in URL.
 * Kept for backward compatibility — prefer POST /api/v1/pair-confirm.
 */
pairingRouter.post("/agents/:id/pair-confirm", async (c) => {
  const agentId = c.req.param("id");

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json(
      { success: false, error: { code: "BAD_REQUEST", message: "Invalid JSON body" } },
      400
    );
  }

  const parsed = confirmPairingSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { success: false, error: { code: "BAD_REQUEST", message: parsed.error.message } },
      400
    );
  }

  try {
    const result = await confirmPairing(agentId, parsed.data.pairingId, parsed.data.pairingSecret);
    return c.json({ success: true, data: result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Pairing confirmation failed";
    return c.json(
      { success: false, error: { code: "UNAUTHORIZED", message } },
      401
    );
  }
});
