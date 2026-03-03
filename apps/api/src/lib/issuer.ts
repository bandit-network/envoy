import { importPKCS8, exportJWK, SignJWT, type JWK } from "jose";
import type { ManifestPayload } from "@envoy/types";

const ALG = "RS256";

const privateKeyPem = process.env.ENVOY_ISSUER_PRIVATE_KEY;
const keyId = process.env.ENVOY_ISSUER_KEY_ID;

if (!privateKeyPem) {
  throw new Error("ENVOY_ISSUER_PRIVATE_KEY environment variable is required");
}
if (!keyId) {
  throw new Error("ENVOY_ISSUER_KEY_ID environment variable is required");
}

// Narrow to string after guards
const PRIVATE_KEY_PEM: string = privateKeyPem;
const KEY_ID: string = keyId;

let _privateKey: CryptoKey | null = null;
let _publicJwk: JWK | null = null;

async function getPrivateKey(): Promise<CryptoKey> {
  if (!_privateKey) {
    _privateKey = await importPKCS8(PRIVATE_KEY_PEM, ALG);
  }
  return _privateKey;
}

/**
 * Returns the public JWK for the JWKS endpoint.
 * Derives it from the private key on first call, then caches.
 */
export async function getPublicJWK(): Promise<JWK> {
  if (!_publicJwk) {
    const privateKey = await getPrivateKey();
    const jwk = await exportJWK(privateKey);
    // Only expose public components
    _publicJwk = {
      kty: jwk.kty,
      n: jwk.n,
      e: jwk.e,
      alg: ALG,
      kid: KEY_ID,
      use: "sig",
    };
  }
  return _publicJwk;
}

/**
 * Signs a manifest payload as a compact JWS (JWT).
 * Returns the signed token string.
 */
export async function signManifest(payload: ManifestPayload): Promise<string> {
  const privateKey = await getPrivateKey();

  const jwt = await new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: ALG, kid: KEY_ID })
    .setIssuedAt()
    .setExpirationTime(payload.expires_at)
    .sign(privateKey);

  return jwt;
}
