import { db, platformApiKeys, platforms } from "@envoy/db";
import { eq, and, isNull } from "drizzle-orm";
import { logAudit } from "./audit";

const KEY_PREFIX = "envk_";

/**
 * Generates a new API key for a platform.
 * Returns the full key (plaintext) exactly once.
 */
export async function generateApiKey(
  platformId: string,
  options?: { label?: string; scopes?: string[] }
): Promise<{
  keyId: string;
  key: string;
  keyPrefix: string;
  label: string | null;
  scopes: string[];
}> {
  // Verify platform exists and is not revoked
  const platform = await db.query.platforms.findFirst({
    where: and(eq(platforms.id, platformId), isNull(platforms.revokedAt)),
  });

  if (!platform) {
    throw new Error("Platform not found or has been revoked");
  }

  // Generate 32 random bytes -> hex string
  const randomBytes = crypto.getRandomValues(new Uint8Array(32));
  const hexString = Array.from(randomBytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const fullKey = `${KEY_PREFIX}${hexString}`;

  // SHA-256 hash for storage
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(fullKey));
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const keyHash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

  // Store the first 8 chars after prefix for display
  const keyPrefixDisplay = `${KEY_PREFIX}${hexString.slice(0, 8)}`;

  const scopes = options?.scopes ?? [];
  const label = options?.label ?? null;

  const [apiKey] = await db
    .insert(platformApiKeys)
    .values({
      platformId,
      keyHash,
      keyPrefix: keyPrefixDisplay,
      label,
      scopes,
    })
    .returning();

  if (!apiKey) {
    throw new Error("Failed to create API key");
  }

  logAudit({
    action: "api_key_created",
    metadata: { platformId, keyId: apiKey.id, keyPrefix: keyPrefixDisplay },
  });

  return {
    keyId: apiKey.id,
    key: fullKey,
    keyPrefix: keyPrefixDisplay,
    label,
    scopes,
  };
}

/**
 * Verifies an API key by hashing and looking up.
 * Returns the platform + key info if valid.
 */
export async function verifyApiKey(rawKey: string): Promise<{
  valid: boolean;
  platformId?: string;
  keyId?: string;
  scopes?: string[];
  error?: string;
}> {
  if (!rawKey.startsWith(KEY_PREFIX)) {
    return { valid: false, error: "Invalid key format" };
  }

  // Hash the provided key
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(rawKey));
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const keyHash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

  // Look up by hash
  const [apiKey] = await db
    .select()
    .from(platformApiKeys)
    .where(eq(platformApiKeys.keyHash, keyHash))
    .limit(1);

  if (!apiKey) {
    return { valid: false, error: "API key not found" };
  }

  if (apiKey.revokedAt) {
    return { valid: false, error: "API key has been revoked" };
  }

  // Check platform is not revoked
  const platform = await db.query.platforms.findFirst({
    where: eq(platforms.id, apiKey.platformId),
  });

  if (!platform || platform.revokedAt) {
    return { valid: false, error: "Platform has been revoked" };
  }

  return {
    valid: true,
    platformId: apiKey.platformId,
    keyId: apiKey.id,
    scopes: apiKey.scopes,
  };
}
