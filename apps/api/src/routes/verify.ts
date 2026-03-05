import { Hono } from "hono";
import { verifyTokenSchema } from "@envoy/types";
import { db, platforms } from "@envoy/db";
import { eq } from "drizzle-orm";
import { verifyManifestToken } from "../lib/verifier";
import { verifyApiKey } from "../services/platform";

export const verifyRouter = new Hono();

/**
 * POST /api/v1/verify
 * Public endpoint (no auth). Called by platforms to verify agent tokens.
 * When a platform API key is provided (body or X-API-Key header),
 * platform-specific requirements (e.g. on-chain identity) are enforced.
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
          onchainIdentity: result.onchainIdentity,
          registry: result.registry,
        },
      },
      401
    );
  }

  // ── Platform requirement enforcement ──────────────────────────
  // Resolve platform API key from body or X-API-Key header
  const apiKey = parsed.data.platformApiKey ?? c.req.header("X-API-Key");

  if (apiKey) {
    const keyResult = await verifyApiKey(apiKey);

    if (keyResult.valid && keyResult.platformId) {
      const platform = await db.query.platforms.findFirst({
        where: eq(platforms.id, keyResult.platformId),
        columns: { requireOnchainIdentity: true },
      });

      // Check on-chain identity requirement
      if (platform?.requireOnchainIdentity && !result.onchainIdentity.verified) {
        const agentId = result.manifest?.agent_id ?? "unknown";
        return c.json(
          {
            success: false,
            error: {
              code: "ONCHAIN_REQUIRED",
              message:
                "This platform requires on-chain identity. Register your agent on the Solana registry first.",
              instructions: {
                for_human: `Go to your agent's detail page on the Envoy dashboard and click 'Register On-Chain' to create an on-chain identity.`,
                for_agent: `Your identity token is valid but this platform requires on-chain identity. Ask your human operator to register you on-chain via the Envoy dashboard.`,
                dashboardUrl: `https://useenvoy.dev/agents/${agentId}`,
              },
            },
            data: {
              valid: true,
              manifest: result.manifest,
              revoked: false,
              expired: false,
              scopes: result.scopes,
              onchainIdentity: result.onchainIdentity,
              registry: result.registry,
            },
          },
          403
        );
      }

      // Check scope requirements — if the API key has scopes, enforce them
      const requiredScopes = keyResult.scopes ?? [];
      if (requiredScopes.length > 0 && result.scopes) {
        const missingScopes = requiredScopes.filter(
          (s) => !result.scopes!.includes(s)
        );
        if (missingScopes.length > 0) {
          return c.json(
            {
              success: false,
              error: {
                code: "INSUFFICIENT_SCOPES",
                message: `Agent is missing required scopes: ${missingScopes.join(", ")}`,
                requiredScopes,
                agentScopes: result.scopes,
                missingScopes,
              },
              data: {
                valid: true,
                manifest: result.manifest,
                revoked: false,
                expired: false,
                scopes: result.scopes,
                onchainIdentity: result.onchainIdentity,
                registry: result.registry,
              },
            },
            403
          );
        }
      }
    }
    // If API key is invalid, we still return the verification result
    // (platform key is optional — bad key doesn't block verification)
  }

  return c.json({
    success: true,
    data: {
      valid: true,
      manifest: result.manifest,
      revoked: false,
      expired: false,
      scopes: result.scopes,
      onchainIdentity: result.onchainIdentity,
      registry: result.registry,
    },
  });
});
