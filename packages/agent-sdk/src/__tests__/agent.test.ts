import { describe, it, expect, afterEach, beforeEach } from "bun:test";
import { EnvoyAgent } from "../agent";
import {
  EnvoyError,
  EnvoyPairingError,
  EnvoyTokenExpiredError,
  EnvoyNotPairedError,
  EnvoyRefreshError,
} from "../errors";
import type { ManifestPayload, TokenData } from "../types";

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const TEST_AGENT_ID = "00000000-0000-0000-0000-000000000001";
const TEST_ENVOY_URL = "https://api.useenvoy.dev";
const TEST_PAIRING_ID = "pairing-abc-123";
const TEST_SECRET = "deadbeef1234567890abcdef";

const TEST_MANIFEST: ManifestPayload = {
  agent_name: "Test Agent",
  agent_username: "testagent",
  agent_id: TEST_AGENT_ID,
  owner_ref: "user-123",
  wallet_addresses: [],
  scopes: ["api_access", "data_read"],
  policy_refs: {},
  issued_at: new Date().toISOString(),
  expires_at: new Date(Date.now() + 3600000).toISOString(), // 1 hour from now
};

const TEST_EXPIRED_MANIFEST: ManifestPayload = {
  ...TEST_MANIFEST,
  expires_at: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
};

function makeSuccessResponse(
  manifest: ManifestPayload = TEST_MANIFEST
): Response {
  return new Response(
    JSON.stringify({
      success: true,
      data: {
        manifestId: "manifest-001",
        manifestJson: manifest,
        signature: "eyJhbGciOiJSUzI1NiJ9.test-signed-token",
        expiresAt: manifest.expires_at,
      },
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}

function makeErrorResponse(
  status: number,
  code: string,
  message: string
): Response {
  return new Response(
    JSON.stringify({
      success: false,
      error: { code, message },
    }),
    { status, headers: { "Content-Type": "application/json" } }
  );
}

function makeTokenData(
  manifest: ManifestPayload = TEST_MANIFEST
): TokenData {
  return {
    manifestId: "manifest-001",
    manifestJson: manifest,
    signature: "eyJhbGciOiJSUzI1NiJ9.test-signed-token",
    expiresAt: manifest.expires_at,
  };
}

// Save/restore globalThis.fetch
const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});

// ---------------------------------------------------------------------------
// pair()
// ---------------------------------------------------------------------------
describe("pair", () => {
  it("exchanges pairing credentials for a signed manifest", async () => {
    const mockFetch = async () => makeSuccessResponse();

    const agent = new EnvoyAgent({
      envoyUrl: TEST_ENVOY_URL,
      agentId: TEST_AGENT_ID,
      fetch: mockFetch as typeof globalThis.fetch,
    });

    const result = await agent.pair(TEST_PAIRING_ID, TEST_SECRET);

    expect(result.manifestId).toBe("manifest-001");
    expect(result.signature).toBe("eyJhbGciOiJSUzI1NiJ9.test-signed-token");
    expect(result.manifestJson.agent_name).toBe("Test Agent");
    expect(result.manifestJson.scopes).toEqual(["api_access", "data_read"]);
    expect(agent.isPaired()).toBe(true);
  });

  it("invokes onTokenReceived callback on success", async () => {
    let receivedData: TokenData | null = null;
    const mockFetch = async () => makeSuccessResponse();

    const agent = new EnvoyAgent({
      envoyUrl: TEST_ENVOY_URL,
      agentId: TEST_AGENT_ID,
      fetch: mockFetch as typeof globalThis.fetch,
      onTokenReceived: (data) => {
        receivedData = data;
      },
    });

    await agent.pair(TEST_PAIRING_ID, TEST_SECRET);

    expect(receivedData).not.toBeNull();
    expect(receivedData!.manifestId).toBe("manifest-001");
    expect(receivedData!.signature).toBe(
      "eyJhbGciOiJSUzI1NiJ9.test-signed-token"
    );
  });

  it("throws EnvoyPairingError on 401 response", async () => {
    const mockFetch = async () =>
      makeErrorResponse(401, "UNAUTHORIZED", "Invalid pairing secret");

    const agent = new EnvoyAgent({
      envoyUrl: TEST_ENVOY_URL,
      agentId: TEST_AGENT_ID,
      fetch: mockFetch as typeof globalThis.fetch,
    });

    try {
      await agent.pair(TEST_PAIRING_ID, TEST_SECRET);
      expect(true).toBe(false); // Should not reach here
    } catch (err) {
      expect(err).toBeInstanceOf(EnvoyPairingError);
      expect((err as EnvoyPairingError).code).toBe("UNAUTHORIZED");
      expect((err as EnvoyPairingError).message).toBe(
        "Invalid pairing secret"
      );
    }
  });

  it("throws EnvoyPairingError on 400 response", async () => {
    const mockFetch = async () =>
      makeErrorResponse(400, "BAD_REQUEST", "Invalid JSON body");

    const agent = new EnvoyAgent({
      envoyUrl: TEST_ENVOY_URL,
      agentId: TEST_AGENT_ID,
      fetch: mockFetch as typeof globalThis.fetch,
    });

    try {
      await agent.pair(TEST_PAIRING_ID, TEST_SECRET);
      expect(true).toBe(false);
    } catch (err) {
      expect(err).toBeInstanceOf(EnvoyPairingError);
      expect((err as EnvoyPairingError).code).toBe("BAD_REQUEST");
    }
  });

  it("throws EnvoyError on network failure", async () => {
    const mockFetch = async () => {
      throw new Error("Connection refused");
    };

    const agent = new EnvoyAgent({
      envoyUrl: TEST_ENVOY_URL,
      agentId: TEST_AGENT_ID,
      fetch: mockFetch as typeof globalThis.fetch,
    });

    try {
      await agent.pair(TEST_PAIRING_ID, TEST_SECRET);
      expect(true).toBe(false);
    } catch (err) {
      expect(err).toBeInstanceOf(EnvoyError);
      expect((err as EnvoyError).message).toContain("Network request failed");
      expect((err as EnvoyError).message).toContain("Connection refused");
    }
  });

  it("throws EnvoyError on malformed success response", async () => {
    const mockFetch = async () =>
      new Response(JSON.stringify({ success: true, data: { bad: "shape" } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });

    const agent = new EnvoyAgent({
      envoyUrl: TEST_ENVOY_URL,
      agentId: TEST_AGENT_ID,
      fetch: mockFetch as typeof globalThis.fetch,
    });

    try {
      await agent.pair(TEST_PAIRING_ID, TEST_SECRET);
      expect(true).toBe(false);
    } catch (err) {
      expect(err).toBeInstanceOf(EnvoyError);
      expect((err as EnvoyError).message).toContain("Malformed pair-confirm");
    }
  });

  it("constructs the correct URL from envoyUrl and agentId", async () => {
    let capturedUrl = "";
    const mockFetch = async (
      input: string | URL | Request,
    ) => {
      capturedUrl =
        typeof input === "string" ? input : input.toString();
      return makeSuccessResponse();
    };

    const agent = new EnvoyAgent({
      envoyUrl: "https://api.useenvoy.dev/", // trailing slash
      agentId: TEST_AGENT_ID,
      fetch: mockFetch as typeof globalThis.fetch,
    });

    await agent.pair(TEST_PAIRING_ID, TEST_SECRET);

    expect(capturedUrl).toBe(
      `https://api.useenvoy.dev/api/v1/agents/${TEST_AGENT_ID}/pair-confirm`
    );
  });

  it("uses direct /pair-confirm endpoint when no agentId is provided", async () => {
    let capturedUrl = "";
    const mockFetch = async (
      input: string | URL | Request,
    ) => {
      capturedUrl =
        typeof input === "string" ? input : input.toString();
      return makeSuccessResponse();
    };

    const agent = new EnvoyAgent({
      envoyUrl: "https://api.useenvoy.dev",
      fetch: mockFetch as typeof globalThis.fetch,
    });

    await agent.pair(TEST_PAIRING_ID, TEST_SECRET);

    expect(capturedUrl).toBe(
      "https://api.useenvoy.dev/api/v1/pair-confirm"
    );
  });

  it("resolves agentId from manifest when not provided in constructor", async () => {
    const mockFetch = async () => makeSuccessResponse();

    const agent = new EnvoyAgent({
      envoyUrl: TEST_ENVOY_URL,
      fetch: mockFetch as typeof globalThis.fetch,
    });

    expect(agent.getAgentId()).toBeNull();

    await agent.pair(TEST_PAIRING_ID, TEST_SECRET);

    expect(agent.getAgentId()).toBe(TEST_AGENT_ID);
  });
});

// ---------------------------------------------------------------------------
// getToken()
// ---------------------------------------------------------------------------
describe("getToken", () => {
  it("returns the signature after pairing", async () => {
    const mockFetch = async () => makeSuccessResponse();

    const agent = new EnvoyAgent({
      envoyUrl: TEST_ENVOY_URL,
      agentId: TEST_AGENT_ID,
      fetch: mockFetch as typeof globalThis.fetch,
    });

    await agent.pair(TEST_PAIRING_ID, TEST_SECRET);

    expect(agent.getToken()).toBe(
      "eyJhbGciOiJSUzI1NiJ9.test-signed-token"
    );
  });

  it("throws EnvoyNotPairedError when not paired", () => {
    const agent = new EnvoyAgent({
      envoyUrl: TEST_ENVOY_URL,
      agentId: TEST_AGENT_ID,
    });

    expect(() => agent.getToken()).toThrow(EnvoyNotPairedError);
  });

  it("throws EnvoyTokenExpiredError when token is expired", () => {
    const agent = new EnvoyAgent({
      envoyUrl: TEST_ENVOY_URL,
      agentId: TEST_AGENT_ID,
    });

    agent.loadToken(makeTokenData(TEST_EXPIRED_MANIFEST));

    expect(() => agent.getToken()).toThrow(EnvoyTokenExpiredError);
  });
});

// ---------------------------------------------------------------------------
// getManifest()
// ---------------------------------------------------------------------------
describe("getManifest", () => {
  it("returns the manifest payload after pairing", async () => {
    const mockFetch = async () => makeSuccessResponse();

    const agent = new EnvoyAgent({
      envoyUrl: TEST_ENVOY_URL,
      agentId: TEST_AGENT_ID,
      fetch: mockFetch as typeof globalThis.fetch,
    });

    await agent.pair(TEST_PAIRING_ID, TEST_SECRET);

    const manifest = agent.getManifest();
    expect(manifest.agent_name).toBe("Test Agent");
    expect(manifest.agent_id).toBe(TEST_AGENT_ID);
    expect(manifest.scopes).toEqual(["api_access", "data_read"]);
  });

  it("works even when the token is expired", () => {
    const agent = new EnvoyAgent({
      envoyUrl: TEST_ENVOY_URL,
      agentId: TEST_AGENT_ID,
    });

    agent.loadToken(makeTokenData(TEST_EXPIRED_MANIFEST));

    // Should NOT throw — inspecting identity is allowed post-expiry
    const manifest = agent.getManifest();
    expect(manifest.agent_name).toBe("Test Agent");
  });

  it("throws EnvoyNotPairedError when not paired", () => {
    const agent = new EnvoyAgent({
      envoyUrl: TEST_ENVOY_URL,
      agentId: TEST_AGENT_ID,
    });

    expect(() => agent.getManifest()).toThrow(EnvoyNotPairedError);
  });
});

// ---------------------------------------------------------------------------
// isExpired()
// ---------------------------------------------------------------------------
describe("isExpired", () => {
  it("returns false for a valid (non-expired) token", async () => {
    const mockFetch = async () => makeSuccessResponse();

    const agent = new EnvoyAgent({
      envoyUrl: TEST_ENVOY_URL,
      agentId: TEST_AGENT_ID,
      fetch: mockFetch as typeof globalThis.fetch,
    });

    await agent.pair(TEST_PAIRING_ID, TEST_SECRET);

    expect(agent.isExpired()).toBe(false);
  });

  it("returns true for an expired token", () => {
    const agent = new EnvoyAgent({
      envoyUrl: TEST_ENVOY_URL,
      agentId: TEST_AGENT_ID,
    });

    agent.loadToken(makeTokenData(TEST_EXPIRED_MANIFEST));

    expect(agent.isExpired()).toBe(true);
  });

  it("returns true when not paired (no token)", () => {
    const agent = new EnvoyAgent({
      envoyUrl: TEST_ENVOY_URL,
      agentId: TEST_AGENT_ID,
    });

    expect(agent.isExpired()).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// isPaired()
// ---------------------------------------------------------------------------
describe("isPaired", () => {
  it("returns false before pairing", () => {
    const agent = new EnvoyAgent({
      envoyUrl: TEST_ENVOY_URL,
      agentId: TEST_AGENT_ID,
    });

    expect(agent.isPaired()).toBe(false);
  });

  it("returns true after pair()", async () => {
    const mockFetch = async () => makeSuccessResponse();

    const agent = new EnvoyAgent({
      envoyUrl: TEST_ENVOY_URL,
      agentId: TEST_AGENT_ID,
      fetch: mockFetch as typeof globalThis.fetch,
    });

    await agent.pair(TEST_PAIRING_ID, TEST_SECRET);

    expect(agent.isPaired()).toBe(true);
  });

  it("returns true after loadToken()", () => {
    const agent = new EnvoyAgent({
      envoyUrl: TEST_ENVOY_URL,
      agentId: TEST_AGENT_ID,
    });

    agent.loadToken(makeTokenData());

    expect(agent.isPaired()).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// getScopes()
// ---------------------------------------------------------------------------
describe("getScopes", () => {
  it("returns scopes from the manifest", async () => {
    const mockFetch = async () => makeSuccessResponse();

    const agent = new EnvoyAgent({
      envoyUrl: TEST_ENVOY_URL,
      agentId: TEST_AGENT_ID,
      fetch: mockFetch as typeof globalThis.fetch,
    });

    await agent.pair(TEST_PAIRING_ID, TEST_SECRET);

    expect(agent.getScopes()).toEqual(["api_access", "data_read"]);
  });

  it("throws EnvoyNotPairedError when not paired", () => {
    const agent = new EnvoyAgent({
      envoyUrl: TEST_ENVOY_URL,
      agentId: TEST_AGENT_ID,
    });

    expect(() => agent.getScopes()).toThrow(EnvoyNotPairedError);
  });
});

// ---------------------------------------------------------------------------
// getAgentId()
// ---------------------------------------------------------------------------
describe("getAgentId", () => {
  it("returns the agent ID from the constructor", () => {
    const agent = new EnvoyAgent({
      envoyUrl: TEST_ENVOY_URL,
      agentId: TEST_AGENT_ID,
    });

    expect(agent.getAgentId()).toBe(TEST_AGENT_ID);
  });

  it("returns null when no agentId provided and not yet paired", () => {
    const agent = new EnvoyAgent({
      envoyUrl: TEST_ENVOY_URL,
    });

    expect(agent.getAgentId()).toBeNull();
  });

  it("returns resolved agentId after loadToken when not provided in constructor", () => {
    const agent = new EnvoyAgent({
      envoyUrl: TEST_ENVOY_URL,
    });

    expect(agent.getAgentId()).toBeNull();

    agent.loadToken(makeTokenData());

    expect(agent.getAgentId()).toBe(TEST_AGENT_ID);
  });
});

// ---------------------------------------------------------------------------
// toAuthHeaders()
// ---------------------------------------------------------------------------
describe("toAuthHeaders", () => {
  it("returns correct Authorization header format", async () => {
    const mockFetch = async () => makeSuccessResponse();

    const agent = new EnvoyAgent({
      envoyUrl: TEST_ENVOY_URL,
      agentId: TEST_AGENT_ID,
      fetch: mockFetch as typeof globalThis.fetch,
    });

    await agent.pair(TEST_PAIRING_ID, TEST_SECRET);

    const headers = agent.toAuthHeaders();
    expect(headers.Authorization).toBe(
      "Bearer eyJhbGciOiJSUzI1NiJ9.test-signed-token"
    );
  });

  it("throws EnvoyNotPairedError when not paired", () => {
    const agent = new EnvoyAgent({
      envoyUrl: TEST_ENVOY_URL,
      agentId: TEST_AGENT_ID,
    });

    expect(() => agent.toAuthHeaders()).toThrow(EnvoyNotPairedError);
  });

  it("throws EnvoyTokenExpiredError when token is expired", () => {
    const agent = new EnvoyAgent({
      envoyUrl: TEST_ENVOY_URL,
      agentId: TEST_AGENT_ID,
    });

    agent.loadToken(makeTokenData(TEST_EXPIRED_MANIFEST));

    expect(() => agent.toAuthHeaders()).toThrow(EnvoyTokenExpiredError);
  });
});

// ---------------------------------------------------------------------------
// loadToken()
// ---------------------------------------------------------------------------
describe("loadToken", () => {
  it("restores state from valid token data", () => {
    const agent = new EnvoyAgent({
      envoyUrl: TEST_ENVOY_URL,
      agentId: TEST_AGENT_ID,
    });

    const data = makeTokenData();
    agent.loadToken(data);

    expect(agent.isPaired()).toBe(true);
    expect(agent.getManifest().agent_name).toBe("Test Agent");
    expect(agent.getToken()).toBe(
      "eyJhbGciOiJSUzI1NiJ9.test-signed-token"
    );
  });

  it("rejects invalid token data", () => {
    const agent = new EnvoyAgent({
      envoyUrl: TEST_ENVOY_URL,
      agentId: TEST_AGENT_ID,
    });

    expect(() => agent.loadToken({ bad: "data" })).toThrow(EnvoyError);
    expect(agent.isPaired()).toBe(false);
  });

  it("rejects null / undefined", () => {
    const agent = new EnvoyAgent({
      envoyUrl: TEST_ENVOY_URL,
      agentId: TEST_AGENT_ID,
    });

    expect(() => agent.loadToken(null)).toThrow(EnvoyError);
    expect(() => agent.loadToken(undefined)).toThrow(EnvoyError);
  });

  it("accepts expired token data (expiry enforced on use)", () => {
    const agent = new EnvoyAgent({
      envoyUrl: TEST_ENVOY_URL,
      agentId: TEST_AGENT_ID,
    });

    const data = makeTokenData(TEST_EXPIRED_MANIFEST);
    agent.loadToken(data);

    // Should be paired but expired
    expect(agent.isPaired()).toBe(true);
    expect(agent.isExpired()).toBe(true);

    // getManifest works even if expired
    expect(agent.getManifest().agent_name).toBe("Test Agent");

    // But getToken throws
    expect(() => agent.getToken()).toThrow(EnvoyTokenExpiredError);
  });
});

// ---------------------------------------------------------------------------
// getTokenData()
// ---------------------------------------------------------------------------
describe("getTokenData", () => {
  it("returns the full token data object", async () => {
    const mockFetch = async () => makeSuccessResponse();

    const agent = new EnvoyAgent({
      envoyUrl: TEST_ENVOY_URL,
      agentId: TEST_AGENT_ID,
      fetch: mockFetch as typeof globalThis.fetch,
    });

    await agent.pair(TEST_PAIRING_ID, TEST_SECRET);

    const data = agent.getTokenData();
    expect(data.manifestId).toBe("manifest-001");
    expect(data.signature).toBe(
      "eyJhbGciOiJSUzI1NiJ9.test-signed-token"
    );
    expect(data.manifestJson.agent_name).toBe("Test Agent");
  });

  it("throws EnvoyNotPairedError when not paired", () => {
    const agent = new EnvoyAgent({
      envoyUrl: TEST_ENVOY_URL,
      agentId: TEST_AGENT_ID,
    });

    expect(() => agent.getTokenData()).toThrow(EnvoyNotPairedError);
  });
});

// ---------------------------------------------------------------------------
// Error hierarchy
// ---------------------------------------------------------------------------
describe("error hierarchy", () => {
  it("EnvoyPairingError is an instance of EnvoyError", () => {
    const err = new EnvoyPairingError("test", "TEST_CODE");
    expect(err).toBeInstanceOf(EnvoyError);
    expect(err).toBeInstanceOf(Error);
  });

  it("EnvoyTokenExpiredError is an instance of EnvoyError", () => {
    const err = new EnvoyTokenExpiredError(new Date());
    expect(err).toBeInstanceOf(EnvoyError);
    expect(err).toBeInstanceOf(Error);
  });

  it("EnvoyNotPairedError is an instance of EnvoyError", () => {
    const err = new EnvoyNotPairedError();
    expect(err).toBeInstanceOf(EnvoyError);
    expect(err).toBeInstanceOf(Error);
  });
});

// ---------------------------------------------------------------------------
// refresh()
// ---------------------------------------------------------------------------
describe("refresh", () => {
  const REFRESHED_MANIFEST: ManifestPayload = {
    ...TEST_MANIFEST,
    issued_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 7200000).toISOString(), // 2 hours from now
  };

  function makeRefreshResponse(
    manifest: ManifestPayload = REFRESHED_MANIFEST
  ): Response {
    return new Response(
      JSON.stringify({
        success: true,
        data: {
          manifestId: "new-manifest-id",
          manifestJson: manifest,
          signature: "new-signature",
          expiresAt: manifest.expires_at,
        },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }

  it("refreshes token and returns new data", async () => {
    let callCount = 0;
    const mockFetch = async () => {
      callCount++;
      // First call is pair, second is refresh
      if (callCount === 1) return makeSuccessResponse();
      return makeRefreshResponse();
    };

    const agent = new EnvoyAgent({
      envoyUrl: TEST_ENVOY_URL,
      agentId: TEST_AGENT_ID,
      fetch: mockFetch as typeof globalThis.fetch,
    });

    await agent.pair(TEST_PAIRING_ID, TEST_SECRET);

    const result = await agent.refresh();

    expect(result.manifestId).toBe("new-manifest-id");
    expect(result.signature).toBe("new-signature");
    expect(result.expiresAt).toBe(REFRESHED_MANIFEST.expires_at);
    expect(agent.getToken()).toBe("new-signature");
  });

  it("invokes onTokenReceived callback on refresh", async () => {
    const receivedTokens: TokenData[] = [];
    let callCount = 0;
    const mockFetch = async () => {
      callCount++;
      if (callCount === 1) return makeSuccessResponse();
      return makeRefreshResponse();
    };

    const agent = new EnvoyAgent({
      envoyUrl: TEST_ENVOY_URL,
      agentId: TEST_AGENT_ID,
      fetch: mockFetch as typeof globalThis.fetch,
      onTokenReceived: (data) => {
        receivedTokens.push(data);
      },
    });

    await agent.pair(TEST_PAIRING_ID, TEST_SECRET);
    await agent.refresh();

    // Should have been called twice: once for pair, once for refresh
    expect(receivedTokens).toHaveLength(2);
    expect(receivedTokens[1]!.manifestId).toBe("new-manifest-id");
    expect(receivedTokens[1]!.signature).toBe("new-signature");
  });

  it("throws EnvoyNotPairedError when not paired", async () => {
    const agent = new EnvoyAgent({
      envoyUrl: TEST_ENVOY_URL,
      agentId: TEST_AGENT_ID,
    });

    try {
      await agent.refresh();
      expect(true).toBe(false); // Should not reach here
    } catch (err) {
      expect(err).toBeInstanceOf(EnvoyNotPairedError);
    }
  });

  it("throws EnvoyRefreshError on API error", async () => {
    let callCount = 0;
    const mockFetch = async () => {
      callCount++;
      if (callCount === 1) return makeSuccessResponse();
      return makeErrorResponse(401, "TOKEN_REVOKED", "Token has been revoked");
    };

    const agent = new EnvoyAgent({
      envoyUrl: TEST_ENVOY_URL,
      agentId: TEST_AGENT_ID,
      fetch: mockFetch as typeof globalThis.fetch,
    });

    await agent.pair(TEST_PAIRING_ID, TEST_SECRET);

    try {
      await agent.refresh();
      expect(true).toBe(false); // Should not reach here
    } catch (err) {
      expect(err).toBeInstanceOf(EnvoyRefreshError);
      expect((err as EnvoyRefreshError).code).toBe("TOKEN_REVOKED");
      expect((err as EnvoyRefreshError).message).toBe(
        "Token has been revoked"
      );
    }
  });

  it("handles network failure", async () => {
    let callCount = 0;
    const mockFetch = async () => {
      callCount++;
      if (callCount === 1) return makeSuccessResponse();
      throw new Error("Connection refused");
    };

    const agent = new EnvoyAgent({
      envoyUrl: TEST_ENVOY_URL,
      agentId: TEST_AGENT_ID,
      fetch: mockFetch as typeof globalThis.fetch,
    });

    await agent.pair(TEST_PAIRING_ID, TEST_SECRET);

    try {
      await agent.refresh();
      expect(true).toBe(false); // Should not reach here
    } catch (err) {
      expect(err).toBeInstanceOf(EnvoyError);
      expect((err as EnvoyError).message).toContain("Network request failed");
      expect((err as EnvoyError).message).toContain("Connection refused");
    }
  });
});

// ---------------------------------------------------------------------------
// status()
// ---------------------------------------------------------------------------
describe("status", () => {
  function makeStatusResponse(): Response {
    return new Response(
      JSON.stringify({
        success: true,
        data: {
          agentId: TEST_AGENT_ID,
          agentName: "Test Agent",
          status: "active",
          tokenExpired: false,
          tokenRevoked: false,
          tokenExpiresAt: "2026-03-04T17:00:00.000Z",
          scopes: ["api_access"],
        },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }

  it("returns agent status", async () => {
    let callCount = 0;
    const mockFetch = async () => {
      callCount++;
      if (callCount === 1) return makeSuccessResponse();
      return makeStatusResponse();
    };

    const agent = new EnvoyAgent({
      envoyUrl: TEST_ENVOY_URL,
      agentId: TEST_AGENT_ID,
      fetch: mockFetch as typeof globalThis.fetch,
    });

    await agent.pair(TEST_PAIRING_ID, TEST_SECRET);

    const result = await agent.status();

    expect(result.agentId).toBe(TEST_AGENT_ID);
    expect(result.agentName).toBe("Test Agent");
    expect(result.status).toBe("active");
    expect(result.tokenExpired).toBe(false);
    expect(result.tokenRevoked).toBe(false);
    expect(result.tokenExpiresAt).toBe("2026-03-04T17:00:00.000Z");
    expect(result.scopes).toEqual(["api_access"]);
  });

  it("throws EnvoyNotPairedError when not paired", async () => {
    const agent = new EnvoyAgent({
      envoyUrl: TEST_ENVOY_URL,
      agentId: TEST_AGENT_ID,
    });

    try {
      await agent.status();
      expect(true).toBe(false); // Should not reach here
    } catch (err) {
      expect(err).toBeInstanceOf(EnvoyNotPairedError);
    }
  });

  it("handles API error", async () => {
    let callCount = 0;
    const mockFetch = async () => {
      callCount++;
      if (callCount === 1) return makeSuccessResponse();
      return makeErrorResponse(500, "INTERNAL_ERROR", "Something went wrong");
    };

    const agent = new EnvoyAgent({
      envoyUrl: TEST_ENVOY_URL,
      agentId: TEST_AGENT_ID,
      fetch: mockFetch as typeof globalThis.fetch,
    });

    await agent.pair(TEST_PAIRING_ID, TEST_SECRET);

    try {
      await agent.status();
      expect(true).toBe(false); // Should not reach here
    } catch (err) {
      expect(err).toBeInstanceOf(EnvoyError);
      expect((err as EnvoyError).message).toBe("Something went wrong");
    }
  });
});

// ---------------------------------------------------------------------------
// auto-refresh
// ---------------------------------------------------------------------------
describe("auto-refresh", () => {
  let originalSetTimeout: typeof globalThis.setTimeout;
  let originalClearTimeout: typeof globalThis.clearTimeout;
  let capturedTimeouts: Array<{ callback: Function; delay: number; id: number }>;
  let nextTimerId: number;

  beforeEach(() => {
    originalSetTimeout = globalThis.setTimeout;
    originalClearTimeout = globalThis.clearTimeout;
    capturedTimeouts = [];
    nextTimerId = 1000;

    // @ts-expect-error -- fake timer override
    globalThis.setTimeout = (callback: Function, delay: number) => {
      const id = nextTimerId++;
      capturedTimeouts.push({ callback, delay, id });
      return id;
    };

    globalThis.clearTimeout = (id: unknown) => {
      capturedTimeouts = capturedTimeouts.filter((t) => t.id !== id);
    };
  });

  afterEach(() => {
    globalThis.setTimeout = originalSetTimeout;
    globalThis.clearTimeout = originalClearTimeout;
  });

  it("schedules timer after pair when autoRefresh is true", async () => {
    const mockFetch = async () => makeSuccessResponse();

    const agent = new EnvoyAgent({
      envoyUrl: TEST_ENVOY_URL,
      agentId: TEST_AGENT_ID,
      fetch: mockFetch as typeof globalThis.fetch,
      autoRefresh: true,
      refreshBeforeExpiry: 300,
    });

    await agent.pair(TEST_PAIRING_ID, TEST_SECRET);

    // A setTimeout should have been scheduled
    expect(capturedTimeouts.length).toBeGreaterThanOrEqual(1);

    // The delay should be roughly (token expiry - refreshBeforeExpiry - now)
    // Token expires in 1 hour (3600s), refresh 300s before = ~3300s delay
    const lastTimeout = capturedTimeouts[capturedTimeouts.length - 1]!;
    expect(lastTimeout.delay).toBeGreaterThan(0);
    expect(lastTimeout.delay).toBeLessThanOrEqual(3600000); // at most 1 hour
  });

  it("stopAutoRefresh clears timer", async () => {
    const mockFetch = async () => makeSuccessResponse();

    const agent = new EnvoyAgent({
      envoyUrl: TEST_ENVOY_URL,
      agentId: TEST_AGENT_ID,
      fetch: mockFetch as typeof globalThis.fetch,
      autoRefresh: true,
      refreshBeforeExpiry: 300,
    });

    await agent.pair(TEST_PAIRING_ID, TEST_SECRET);

    // Timer should be scheduled
    const timerCountBefore = capturedTimeouts.length;
    expect(timerCountBefore).toBeGreaterThanOrEqual(1);

    // Stop auto-refresh
    agent.stopAutoRefresh();

    // The timer should have been cleared
    expect(capturedTimeouts.length).toBe(timerCountBefore - 1);
  });
});
