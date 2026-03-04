import { describe, it, expect, beforeEach } from "bun:test";
import { Hono } from "hono";
import { createAuthenticatedApp } from "../helpers/create-test-app";
import { cleanDb, seedUser } from "../helpers/test-db";
import { agentsRouter } from "../../routes/agents";
import { tokenRouter } from "../../routes/token";
import { db, agents, manifests } from "@envoy/db";
import { eq, and, isNull } from "drizzle-orm";

/**
 * Token router tests.
 *
 * The token endpoints are PUBLIC (no Privy auth) — they accept manifest
 * Bearer tokens, not Privy JWTs. We use the authenticated agents router
 * to create agents and issue manifests, then call the token endpoints
 * with the manifest signature as a Bearer token.
 */
let tokenApp: Hono;
let agentApp: ReturnType<typeof createAuthenticatedApp>;
let userId: string;

beforeEach(async () => {
  await cleanDb();
  const user = await seedUser();
  userId = user.userId;

  // Token router is public — no auth middleware
  tokenApp = new Hono();
  tokenApp.route("/", tokenRouter);

  // Agents router needs auth (for creating agents + issuing manifests)
  agentApp = createAuthenticatedApp(agentsRouter, {
    userId: user.userId,
    privyUserId: user.privyUserId,
    email: "test@envoy.dev",
  });
});

/**
 * Helper: create an agent and issue a manifest.
 * Returns the agentId and the manifest signature (used as Bearer token).
 */
async function setupAgentWithManifest(): Promise<{
  agentId: string;
  manifestId: string;
  signature: string;
}> {
  // Create agent
  const createRes = await agentApp.request("/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Token Test Agent" }),
  });
  const agentId = (await createRes.json()).data.id;

  // Issue manifest
  const manifestRes = await agentApp.request(`/${agentId}/manifest`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  const manifestData = (await manifestRes.json()).data;

  return {
    agentId,
    manifestId: manifestData.manifestId,
    signature: manifestData.signature,
  };
}

// -------------------------------------------------------------------
// POST /token/refresh -- Agent self-refresh
// -------------------------------------------------------------------
describe("POST /token/refresh - Refresh token", () => {
  it("refreshes a valid token", async () => {
    const { agentId, signature } = await setupAgentWithManifest();

    const res = await tokenApp.request("/token/refresh", {
      method: "POST",
      headers: { Authorization: `Bearer ${signature}` },
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.manifestId).toBeDefined();
    expect(json.data.signature).toBeDefined();
    expect(json.data.manifestJson).toBeDefined();
    expect(json.data.manifestJson.agent_id).toBe(agentId);
    expect(json.data.expiresAt).toBeDefined();
    // New signature should differ from the old one
    expect(json.data.signature).not.toBe(signature);
  });

  it("rejects missing Authorization header", async () => {
    const res = await tokenApp.request("/token/refresh", {
      method: "POST",
    });

    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error.code).toBe("INVALID_TOKEN");
  });

  it("rejects malformed token", async () => {
    const res = await tokenApp.request("/token/refresh", {
      method: "POST",
      headers: { Authorization: "Bearer garbage-not-a-real-jwt-token" },
    });

    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error.code).toBe("INVALID_TOKEN");
  });

  it("rejects revoked token", async () => {
    const { agentId, signature } = await setupAgentWithManifest();

    // Revoke the agent (which revokes all its manifests)
    await agentApp.request(`/${agentId}`, { method: "DELETE" });

    const res = await tokenApp.request("/token/refresh", {
      method: "POST",
      headers: { Authorization: `Bearer ${signature}` },
    });

    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error.code).toBe("TOKEN_REVOKED");
  });

  it("rejects suspended agent", async () => {
    const { agentId, signature } = await setupAgentWithManifest();

    // Suspend the agent via PATCH
    await agentApp.request(`/${agentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "suspended" }),
    });

    const res = await tokenApp.request("/token/refresh", {
      method: "POST",
      headers: { Authorization: `Bearer ${signature}` },
    });

    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error.code).toBe("AGENT_INACTIVE");
  });

  it("old manifest is revoked after refresh", async () => {
    const { agentId, manifestId, signature } = await setupAgentWithManifest();

    // Refresh the token
    const res = await tokenApp.request("/token/refresh", {
      method: "POST",
      headers: { Authorization: `Bearer ${signature}` },
    });

    expect(res.status).toBe(200);

    // Verify the old manifest now has revokedAt set
    const [oldManifest] = await db
      .select()
      .from(manifests)
      .where(eq(manifests.id, manifestId));

    expect(oldManifest).toBeDefined();
    expect(oldManifest.revokedAt).not.toBeNull();

    // Verify a new active manifest exists for the agent
    const [newManifest] = await db
      .select()
      .from(manifests)
      .where(and(eq(manifests.agentId, agentId), isNull(manifests.revokedAt)));

    expect(newManifest).toBeDefined();
    expect(newManifest.id).not.toBe(manifestId);
  });
});

// -------------------------------------------------------------------
// GET /token/status -- Agent status check
// -------------------------------------------------------------------
describe("GET /token/status - Token status", () => {
  it("returns status for valid token", async () => {
    const { agentId, signature } = await setupAgentWithManifest();

    const res = await tokenApp.request("/token/status", {
      method: "GET",
      headers: { Authorization: `Bearer ${signature}` },
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.agentId).toBe(agentId);
    expect(json.data.agentName).toBe("Token Test Agent");
    expect(json.data.status).toBe("active");
    expect(json.data.tokenExpired).toBe(false);
    expect(json.data.tokenRevoked).toBe(false);
    expect(json.data.tokenExpiresAt).toBeDefined();
    expect(json.data.scopes).toBeDefined();
    expect(Array.isArray(json.data.scopes)).toBe(true);
  });

  it("returns status for revoked agent", async () => {
    const { agentId, signature } = await setupAgentWithManifest();

    // Revoke the agent
    await agentApp.request(`/${agentId}`, { method: "DELETE" });

    const res = await tokenApp.request("/token/status", {
      method: "GET",
      headers: { Authorization: `Bearer ${signature}` },
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.agentId).toBe(agentId);
    expect(json.data.status).toBe("revoked");
    expect(json.data.tokenRevoked).toBe(true);
  });

  it("rejects missing Authorization header", async () => {
    const res = await tokenApp.request("/token/status", {
      method: "GET",
    });

    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error.code).toBe("INVALID_TOKEN");
  });
});
