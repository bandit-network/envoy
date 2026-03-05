import { jwtVerify, importJWK } from "jose";
import { db, manifests, agents } from "@envoy/db";
import { eq } from "drizzle-orm";
import type { ManifestPayload } from "@envoy/types";
import { getPublicJWK } from "./issuer";

interface OnchainIdentity {
  verified: boolean;
  walletAddress: string | null;
}

interface RegistryInfo {
  registered: boolean;
  assetId: string | null;
}

interface VerificationResult {
  valid: boolean;
  manifest: ManifestPayload | null;
  revoked: boolean;
  expired: boolean;
  scopes: string[];
  onchainIdentity: OnchainIdentity;
  registry: RegistryInfo;
  error?: string;
}

/**
 * Verify a manifest token (JWS).
 * Checks signature, expiry, and revocation status.
 */
export async function verifyManifestToken(
  token: string
): Promise<VerificationResult> {
  const noOnchain: OnchainIdentity = { verified: false, walletAddress: null };
  const noRegistry: RegistryInfo = { registered: false, assetId: null };

  const invalid = (error: string, extra?: Partial<VerificationResult>): VerificationResult => ({
    valid: false,
    manifest: null,
    revoked: false,
    expired: false,
    scopes: [],
    onchainIdentity: noOnchain,
    registry: noRegistry,
    error,
    ...extra,
  });

  // Step 1: Verify JWS signature
  let payload: ManifestPayload;
  try {
    const jwk = await getPublicJWK();
    const publicKey = await importJWK(jwk, "RS256");
    const { payload: rawPayload } = await jwtVerify(token, publicKey);
    payload = rawPayload as unknown as ManifestPayload;
  } catch (err) {
    return invalid("Invalid or malformed token signature");
  }

  // Step 2: Check expiry
  const expiresAt = new Date(payload.expires_at);
  if (expiresAt < new Date()) {
    return {
      valid: false,
      manifest: payload,
      revoked: false,
      expired: true,
      scopes: payload.scopes ?? [],
      onchainIdentity: noOnchain,
      registry: noRegistry,
      error: "Token has expired",
    };
  }

  // Step 3: Check revocation in DB
  // Find the manifest by matching agent_id and signature
  const [manifest] = await db
    .select({ revokedAt: manifests.revokedAt })
    .from(manifests)
    .where(eq(manifests.agentId, payload.agent_id))
    .orderBy(manifests.issuedAt)
    .limit(1);

  // Check if any manifest for this agent at this issued time is revoked
  const matchingManifests = await db
    .select({ id: manifests.id, revokedAt: manifests.revokedAt, issuedAt: manifests.issuedAt })
    .from(manifests)
    .where(eq(manifests.agentId, payload.agent_id));

  // Find the manifest that matches the issued_at from the token
  const issuedAt = new Date(payload.issued_at);
  const matchedManifest = matchingManifests.find(
    (m) => Math.abs(m.issuedAt.getTime() - issuedAt.getTime()) < 1000
  );

  if (matchedManifest?.revokedAt) {
    return {
      valid: false,
      manifest: payload,
      revoked: true,
      expired: false,
      scopes: payload.scopes ?? [],
      onchainIdentity: noOnchain,
      registry: noRegistry,
      error: "Token has been revoked",
    };
  }

  // Look up agent's on-chain identity (wallet address) and registry status
  const agent = await db.query.agents.findFirst({
    where: eq(agents.id, payload.agent_id),
    columns: { walletAddress: true, registryAssetId: true },
  });

  return {
    valid: true,
    manifest: payload,
    revoked: false,
    expired: false,
    scopes: payload.scopes ?? [],
    onchainIdentity: {
      verified: !!agent?.walletAddress,
      walletAddress: agent?.walletAddress ?? null,
    },
    registry: {
      registered: !!agent?.registryAssetId,
      assetId: agent?.registryAssetId ?? null,
    },
  };
}
