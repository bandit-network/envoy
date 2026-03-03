import { describe, it, expect, afterEach } from "bun:test";
import { EnvoyAgent } from "../agent";
import {
  EnvoyError,
  EnvoyPairingError,
  EnvoyTokenExpiredError,
  EnvoyNotPairedError,
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
