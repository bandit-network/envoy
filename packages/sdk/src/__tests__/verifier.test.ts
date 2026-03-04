import { describe, it, expect, beforeAll, afterAll, afterEach } from "bun:test";
import { importPKCS8, exportJWK, SignJWT, type JWK } from "jose";
import { EnvoyVerifier, EnvoyInsufficientScopesError, EnvoyVerificationError } from "../index";

// ----- Test Key Setup -----
// We sign JWTs with a real RSA key pair, then mock the JWKS endpoint to serve the public half.

const TEST_PRIVATE_KEY_PEM = `-----BEGIN PRIVATE KEY-----
MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQCqH9UmRZxZX6M4
HrmNvGHTvGbg6jpslazaoX9uTY4KqbDUsBMBeYz0mk47Mq9D+ypIhKLT7TSf0HuW
cLJLHTr0nR996HS1qRcEWBDUafB9qjvNNqoppgTXqMn1d/zjAamTqkZMnXRNbLSH
NFfAn+2dhn4eiM9QGXDaz/rGF+ZWLnCFfv97cIvIDykStq9z0VD7DyY1pnvOb+AY
qLuisUdC478rOA8aqhJg/qu6KDK/S6RKHYHkV4TkKmpnT0ik1iWKg32C1c6mQ3wK
t+dXTaZR2zIon9ch+i6LH6Ad3c758CLpqX0HqjX6VMK0qdtQC7gBTRB5MgVtfpJt
5Q5+7OyfAgMBAAECggEAT0/25dhXK12IcR314Mu+CeIQTnQ0l7Hx+52GFM0IVxVE
cOvDeJEL829K4JNhHX7neBaJ+OZh/c3LCFhy7szqUuc7qs3oN1bk+av68KSRL2zh
Y2tESpVxNX+l5BAz8DsyrTqZepd/hKcUxOHUtWN5+lIc0yxyBkROFl0W6ypyQqOy
GpOmsIiqmUlwFAJS2vYLT9cTAm8/a9ljC7poUKpXP4ebVAxwGmifLIwUE9nUZAsM
WEVTG3pHhd7uRLxBy1q43xURGCGcYxgOR8FVj8mFm9XLM8N+df6OAuzdsN6Dd+B8
lbZ5N6YRwRRN56gIfq9LZrkrvO/DfvDQ3Vk5T4jYkQKBgQDani0gtEplP4UzrGas
u6zaABxN0F2AwadP559b2dAVC2nPj8jeLfDuA97rgmXFYtq9/bgYJhZfP0Qz0ADo
wdbUcKK3uKHQHGeCd/aC0l7bF94ZwDGT+PFyeqmgefpzYIcLHBMKtzgxoIKw6qO7
3Ax/apHwMjWEPXN1hipe6dYR7wKBgQDHNuP/XH9HP6GFUD1TwIBG2o2bLjJln2Es
snne+1fy519eP0hc3CTbxvuxHrH7XGdgywKYXCg2PtAiU13ry0f5syjIQoqGj8ET
c93BmQUnRb2b+YYYA5fz1VmTsM5yIXCYsiJdIbovFu/PWrrEcPyPYT+y+LIBblhb
ssVInSLAUQKBgQC4qopWKNT654gd2RA18qYU06kU9eA1xd8NuQq8rKV/UU/E26EC
RG5Sr4RbDZ/n9xPtDue1xl55gFidJ6PM+Qf+FVLtvBE7WPL6m1josskbavLab6Wx
Z8SUPhcRDlhHo48PDFztXU0jZoFe7iT2p+8Kpju2WMMp/DqOWJFr8Tw5kwKBgB9B
6pZHwiTAxCwxwd2hR79WTX+6yOePEWU8/8hP8aXITftwvH7tf88IMrfA1DZXclUK
pXaYhyqzwl6QbB0yQTHZvZ1ma2vfpHDT7kiRJPDbjXuqtDKSZcY5hJua01mvC4a5
9JBeWWNIGwqS9tkZzVcF8EO5p9x3nt+Mdk4Fcc1xAoGBANYfQOUkpjiseoJOqYTY
AD90Td7F215waLFl3+kscOU1YDOja8L86RgkktV/r9lVSIAYLlqn7BbZNsFRUPzj
6PfHqa0tjRlfrQWFFxYJyXtjDzDQVyWmWqkLV4VQbbzaMj15lY+LqGehu16+CSbm
VBPfbWMrxMY1WF6VCegh1vuo
-----END PRIVATE KEY-----`;

const TEST_KEY_ID = "test-key-1";

let privateKey: CryptoKey;
let publicJwk: JWK;

// Save the original fetch so we can restore it
const originalFetch = globalThis.fetch;

beforeAll(async () => {
  privateKey = await importPKCS8(TEST_PRIVATE_KEY_PEM, "RS256", {
    extractable: true,
  });
  const jwk = await exportJWK(privateKey);
  publicJwk = {
    kty: jwk.kty,
    n: jwk.n,
    e: jwk.e,
    alg: "RS256",
    kid: TEST_KEY_ID,
    use: "sig",
  };
});

afterAll(() => {
  // Restore original fetch
  globalThis.fetch = originalFetch;
});

/** Sign a test JWT with a manifest payload. */
async function signTestToken(
  overrides: Record<string, unknown> = {},
  ttlSec = 3600
): Promise<string> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlSec * 1000);

  const payload = {
    agent_name: "Test Agent",
    agent_id: "00000000-0000-0000-0000-000000000001",
    owner_ref: "user-123",
    wallet_addresses: [],
    scopes: ["api_access"],
    policy_refs: {},
    issued_at: now.toISOString(),
    expires_at: expiresAt.toISOString(),
    ...overrides,
  };

  return new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: "RS256", kid: TEST_KEY_ID })
    .setIssuedAt()
    .setExpirationTime(expiresAt)
    .sign(privateKey);
}

/**
 * Install a global fetch mock that handles:
 * - JWKS at /.well-known/envoy-issuer
 * - Revocation checks at /api/v1/revocations/:id
 *
 * createRemoteJWKSet from jose uses globalThis.fetch, so we must
 * mock at the global level for JWKS resolution to work.
 */
function installMockFetch(options: {
  revoked?: boolean;
  revocationError?: boolean;
} = {}): void {
  globalThis.fetch = (async (
    input: string | URL | Request,
    init?: RequestInit
  ): Promise<Response> => {
    const url = typeof input === "string" ? input : input.toString();

    // JWKS endpoint
    if (url.includes("/.well-known/envoy-issuer")) {
      return new Response(
        JSON.stringify({ keys: [publicJwk] }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Revocation endpoint
    if (url.includes("/revocations/")) {
      if (options.revocationError) {
        throw new Error("Network error");
      }
      return new Response(
        JSON.stringify({
          success: true,
          data: { revoked: options.revoked ?? false },
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    return new Response("Not found", { status: 404 });
  }) as typeof globalThis.fetch;
}

// -------------------------------------------------------------------
// verifyOffline
// -------------------------------------------------------------------
describe("verifyOffline", () => {
  it("accepts a valid token", async () => {
    installMockFetch();
    const verifier = new EnvoyVerifier({
      issuerUrl: "https://api.useenvoy.dev",
    });

    const token = await signTestToken();
    const result = await verifier.verifyOffline(token);

    expect(result.valid).toBe(true);
    expect(result.manifest).not.toBeNull();
    expect(result.manifest!.agent_name).toBe("Test Agent");
    expect(result.scopes).toContain("api_access");
    expect(result.expired).toBe(false);
    expect(result.revoked).toBe(false);
  });

  it("rejects an expired token", async () => {
    installMockFetch();
    const verifier = new EnvoyVerifier({
      issuerUrl: "https://api.useenvoy.dev",
    });

    // Sign a token that jose considers expired (exp in the past)
    const pastDate = new Date(Date.now() - 3600000);
    const token = await new SignJWT({
      agent_name: "Test Agent",
      agent_id: "00000000-0000-0000-0000-000000000001",
      owner_ref: "user-123",
      wallet_addresses: [],
      scopes: ["api_access"],
      policy_refs: {},
      issued_at: new Date(Date.now() - 7200000).toISOString(),
      expires_at: pastDate.toISOString(),
    } as unknown as Record<string, unknown>)
      .setProtectedHeader({ alg: "RS256", kid: TEST_KEY_ID })
      .setIssuedAt(Math.floor((Date.now() - 7200000) / 1000))
      .setExpirationTime(Math.floor(pastDate.getTime() / 1000))
      .sign(privateKey);

    const result = await verifier.verifyOffline(token);

    // jose will throw on expired tokens, so the SDK catches it
    // as "Invalid or malformed token signature" rather than explicitly expired.
    // Either way, it should not be valid.
    expect(result.valid).toBe(false);
  });

  it("rejects a malformed token", async () => {
    installMockFetch();
    const verifier = new EnvoyVerifier({
      issuerUrl: "https://api.useenvoy.dev",
    });

    const result = await verifier.verifyOffline("not.a.jwt");
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  });

  it("rejects a token signed with wrong key", async () => {
    installMockFetch();
    const verifier = new EnvoyVerifier({
      issuerUrl: "https://api.useenvoy.dev",
    });

    const result = await verifier.verifyOffline(
      "eyJhbGciOiJSUzI1NiJ9.eyJ0ZXN0IjoidHJ1ZSJ9.invalid-sig"
    );
    expect(result.valid).toBe(false);
  });
});

// -------------------------------------------------------------------
// verify (online — includes revocation check)
// -------------------------------------------------------------------
describe("verify", () => {
  it("returns valid for non-revoked token", async () => {
    installMockFetch({ revoked: false });
    const verifier = new EnvoyVerifier({
      issuerUrl: "https://api.useenvoy.dev",
    });

    const token = await signTestToken();
    const result = await verifier.verify(token);

    expect(result.valid).toBe(true);
    expect(result.revoked).toBe(false);
  });

  it("returns revoked for revoked token", async () => {
    installMockFetch({ revoked: true });
    const verifier = new EnvoyVerifier({
      issuerUrl: "https://api.useenvoy.dev",
    });

    const token = await signTestToken();
    const result = await verifier.verify(token);

    expect(result.valid).toBe(false);
    expect(result.revoked).toBe(true);
    expect(result.error).toBe("Token has been revoked");
  });

  it("falls back to valid when revocation check fails", async () => {
    installMockFetch({ revocationError: true });
    const verifier = new EnvoyVerifier({
      issuerUrl: "https://api.useenvoy.dev",
    });

    const token = await signTestToken();
    const result = await verifier.verify(token);

    // Should fall back to valid (offline result)
    expect(result.valid).toBe(true);
    expect(result.revoked).toBe(false);
  });
});

// -------------------------------------------------------------------
// resetKeys
// -------------------------------------------------------------------
describe("resetKeys", () => {
  it("clears cached JWKS without throwing", async () => {
    installMockFetch();
    const verifier = new EnvoyVerifier({
      issuerUrl: "https://api.useenvoy.dev",
    });

    const token = await signTestToken();
    await verifier.verify(token);

    // resetKeys should not throw
    verifier.resetKeys();

    // Verify again after reset — should still work
    const result = await verifier.verify(token);
    expect(result.valid).toBe(true);
  });
});

// -------------------------------------------------------------------
// hasScopes
// -------------------------------------------------------------------
describe("hasScopes", () => {
  it("returns true when scopes are present", async () => {
    installMockFetch();
    const verifier = new EnvoyVerifier({
      issuerUrl: "https://api.useenvoy.dev",
    });

    const token = await signTestToken({ scopes: ["api_access", "trade", "write"] });
    const result = await verifier.verify(token);

    expect(verifier.hasScopes(result, ["api_access", "trade"])).toBe(true);
  });

  it("returns false when scopes are missing", async () => {
    installMockFetch();
    const verifier = new EnvoyVerifier({
      issuerUrl: "https://api.useenvoy.dev",
    });

    const token = await signTestToken({ scopes: ["api_access"] });
    const result = await verifier.verify(token);

    expect(verifier.hasScopes(result, ["api_access", "trade"])).toBe(false);
  });
});

// -------------------------------------------------------------------
// requireScopes
// -------------------------------------------------------------------
describe("requireScopes", () => {
  it("passes when scopes match", async () => {
    installMockFetch();
    const verifier = new EnvoyVerifier({
      issuerUrl: "https://api.useenvoy.dev",
    });

    const token = await signTestToken({ scopes: ["api_access", "trade"] });
    const result = await verifier.verify(token);

    // Should not throw
    expect(() => verifier.requireScopes(result, ["api_access"])).not.toThrow();
  });

  it("throws EnvoyInsufficientScopesError when scopes are missing", async () => {
    installMockFetch();
    const verifier = new EnvoyVerifier({
      issuerUrl: "https://api.useenvoy.dev",
    });

    const token = await signTestToken({ scopes: ["api_access"] });
    const result = await verifier.verify(token);

    try {
      verifier.requireScopes(result, ["api_access", "trade", "write"]);
      expect(true).toBe(false); // Should not reach here
    } catch (err) {
      expect(err).toBeInstanceOf(EnvoyInsufficientScopesError);
      const scopeErr = err as EnvoyInsufficientScopesError;
      expect(scopeErr.required).toEqual(["api_access", "trade", "write"]);
      expect(scopeErr.actual).toEqual(["api_access"]);
      expect(scopeErr.message).toContain("trade");
      expect(scopeErr.message).toContain("write");
    }
  });
});

// -------------------------------------------------------------------
// createMiddleware
// -------------------------------------------------------------------
describe("createMiddleware", () => {
  it("returns valid result for a good token", async () => {
    installMockFetch();
    const verifier = new EnvoyVerifier({
      issuerUrl: "https://api.useenvoy.dev",
    });

    const guard = verifier.createMiddleware({ scopes: ["api_access"] });
    const token = await signTestToken({ scopes: ["api_access", "trade"] });

    const result = await guard(token);
    expect(result.valid).toBe(true);
    expect(result.manifest!.agent_name).toBe("Test Agent");
  });

  it("throws EnvoyVerificationError for invalid token", async () => {
    installMockFetch();
    const verifier = new EnvoyVerifier({
      issuerUrl: "https://api.useenvoy.dev",
    });

    const guard = verifier.createMiddleware();

    try {
      await guard("not.a.valid.token");
      expect(true).toBe(false); // Should not reach here
    } catch (err) {
      expect(err).toBeInstanceOf(EnvoyVerificationError);
      const verErr = err as EnvoyVerificationError;
      expect(verErr.result.valid).toBe(false);
    }
  });

  it("throws EnvoyInsufficientScopesError when scopes are insufficient", async () => {
    installMockFetch();
    const verifier = new EnvoyVerifier({
      issuerUrl: "https://api.useenvoy.dev",
    });

    const guard = verifier.createMiddleware({ scopes: ["trade", "write"] });
    const token = await signTestToken({ scopes: ["api_access"] });

    try {
      await guard(token);
      expect(true).toBe(false); // Should not reach here
    } catch (err) {
      expect(err).toBeInstanceOf(EnvoyInsufficientScopesError);
    }
  });
});
