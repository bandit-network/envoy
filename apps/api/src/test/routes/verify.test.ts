import { describe, it, expect, beforeEach } from "bun:test";
import { Hono } from "hono";
import { createAuthenticatedApp } from "../helpers/create-test-app";
import { cleanDb, seedUser } from "../helpers/test-db";
import { verifyRouter } from "../../routes/verify";
import { agentsRouter } from "../../routes/agents";

/**
 * The verify router is public (no auth), so we mount it directly.
 * But we need the agents router (auth'd) to create agents + issue manifests.
 */
let verifyApp: Hono;
let agentApp: ReturnType<typeof createAuthenticatedApp>;

beforeEach(async () => {
  await cleanDb();
  const user = await seedUser();

  // Verify router is public
  verifyApp = new Hono();
  verifyApp.route("/", verifyRouter);

  // Agent router needs auth
  agentApp = createAuthenticatedApp(agentsRouter, {
    userId: user.userId,
    privyUserId: user.privyUserId,
    email: "test@envoy.dev",
  });
});

/** Helper: create agent, issue manifest, return token */
async function issueToken(): Promise<{
  agentId: string;
  token: string;
  manifestId: string;
}> {
  // Create agent
  const createRes = await agentApp.request("/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Verify Agent" }),
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
    token: manifestData.signature,
    manifestId: manifestData.manifestId,
  };
}

// -------------------------------------------------------------------
// POST /verify -- Verify token
// -------------------------------------------------------------------
describe("POST /verify - Verify token", () => {
  it("verifies a valid token", async () => {
    const { token } = await issueToken();

    const res = await verifyApp.request("/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.valid).toBe(true);
    expect(json.data.manifest.agent_name).toBe("Verify Agent");
    expect(json.data.scopes).toContain("api_access");
  });

  it("rejects a revoked token", async () => {
    const { agentId, token } = await issueToken();

    // Revoke the agent (which revokes its manifests)
    await agentApp.request(`/${agentId}`, { method: "DELETE" });

    const res = await verifyApp.request("/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });

    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.data.revoked).toBe(true);
  });

  it("rejects a malformed token", async () => {
    const res = await verifyApp.request("/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: "not.a.valid.jwt" }),
    });

    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.success).toBe(false);
  });

  it("rejects missing token", async () => {
    const res = await verifyApp.request("/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(400);
  });

  it("rejects invalid JSON", async () => {
    const res = await verifyApp.request("/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not json",
    });

    expect(res.status).toBe(400);
  });
});
