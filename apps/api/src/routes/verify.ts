import { Hono } from "hono";
import { verifyTokenSchema } from "@envoy/types";
import { verifyManifestToken } from "../lib/verifier";

export const verifyRouter = new Hono();

/**
 * POST /api/v1/verify
 * Public endpoint (no auth). Called by platforms to verify agent tokens.
 */
verifyRouter.post("/verify", async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json(
      { success: false, error: { code: "BAD_REQUEST", message: "Invalid JSON body" } },
      400
    );
  }

  const parsed = verifyTokenSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { success: false, error: { code: "BAD_REQUEST", message: parsed.error.message } },
      400
    );
  }

  const result = await verifyManifestToken(parsed.data.token);

  if (!result.valid) {
    const statusCode = result.expired || result.revoked ? 401 : 401;
    return c.json(
      {
        success: false,
        error: {
          code: result.revoked ? "REVOKED" : result.expired ? "TOKEN_EXPIRED" : "INVALID_SIGNATURE",
          message: result.error ?? "Verification failed",
        },
        data: {
          valid: false,
          revoked: result.revoked,
          expired: result.expired,
          manifest: result.manifest,
          scopes: result.scopes,
        },
      },
      401
    );
  }

  return c.json({
    success: true,
    data: {
      valid: true,
      manifest: result.manifest,
      revoked: false,
      expired: false,
      scopes: result.scopes,
    },
  });
});
