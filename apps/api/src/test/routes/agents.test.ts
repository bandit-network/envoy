import { describe, it, expect, beforeEach, afterAll } from "bun:test";
import { createAuthenticatedApp } from "../helpers/create-test-app";
import { cleanDb, seedUser } from "../helpers/test-db";
import { agentsRouter } from "../../routes/agents";

let userId: string;
let app: ReturnType<typeof createAuthenticatedApp>;

beforeEach(async () => {
  await cleanDb();
  const user = await seedUser();
  userId = user.userId;
  app = createAuthenticatedApp(agentsRouter, {
    userId,
    privyUserId: user.privyUserId,
    email: "test@envoy.dev",
  });
});

// -------------------------------------------------------------------
// POST / -- Create agent
// -------------------------------------------------------------------
describe("POST / - Create agent", () => {
  it("creates an agent with valid name", async () => {
    const res = await app.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Test Agent" }),
    });

    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.name).toBe("Test Agent");
    expect(json.data.status).toBe("active");
    expect(json.data.ownerId).toBe(userId);
  });

  it("creates an agent with name and description", async () => {
    const res = await app.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Agent 2", description: "A test agent" }),
    });

    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.data.description).toBe("A test agent");
  });

  it("rejects empty name", async () => {
    const res = await app.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "" }),
    });

    expect(res.status).toBe(400);
  });

  it("rejects missing name", async () => {
    const res = await app.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(400);
  });
});

// -------------------------------------------------------------------
// GET / -- List agents
// -------------------------------------------------------------------
describe("GET / - List agents", () => {
  it("lists agents owned by the user", async () => {
    // Create two agents
    await app.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Agent A" }),
    });
    await app.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Agent B" }),
    });

    const res = await app.request("/");
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.agents).toHaveLength(2);
    expect(json.data.total).toBe(2);
  });

  it("returns empty list when no agents exist", async () => {
    const res = await app.request("/");
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.agents).toHaveLength(0);
    expect(json.data.total).toBe(0);
  });

  it("isolates agents by owner", async () => {
    // Create agent for test user
    await app.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "My Agent" }),
    });

    // Create second user's app
    const user2 = await seedUser("did:privy:other-user-456");
    const app2 = createAuthenticatedApp(agentsRouter, {
      userId: user2.userId,
      privyUserId: user2.privyUserId,
      email: "other@envoy.dev",
    });

    const res = await app2.request("/");
    const json = await res.json();
    expect(json.data.agents).toHaveLength(0);
  });

  it("supports pagination", async () => {
    // Create 3 agents
    for (let i = 0; i < 3; i++) {
      await app.request("/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: `Agent ${i}` }),
      });
    }

    const res = await app.request("/?limit=2&offset=0");
    const json = await res.json();
    expect(json.data.agents).toHaveLength(2);
    expect(json.data.total).toBe(3);

    const res2 = await app.request("/?limit=2&offset=2");
    const json2 = await res2.json();
    expect(json2.data.agents).toHaveLength(1);
  });
});

// -------------------------------------------------------------------
// GET /:id -- Agent detail
// -------------------------------------------------------------------
describe("GET /:id - Agent detail", () => {
  it("returns agent with null manifest when none issued", async () => {
    const createRes = await app.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Detail Agent" }),
    });
    const created = await createRes.json();
    const agentId = created.data.id;

    const res = await app.request(`/${agentId}`);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.agent.name).toBe("Detail Agent");
    expect(json.data.manifest).toBeNull();
  });

  it("returns 404 for non-existent agent", async () => {
    const res = await app.request("/00000000-0000-0000-0000-000000000099");
    expect(res.status).toBe(404);
  });

  it("returns 404 for other user's agent", async () => {
    const createRes = await app.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Private Agent" }),
    });
    const created = await createRes.json();
    const agentId = created.data.id;

    const user2 = await seedUser("did:privy:attacker-789");
    const app2 = createAuthenticatedApp(agentsRouter, {
      userId: user2.userId,
      privyUserId: user2.privyUserId,
      email: "attacker@evil.com",
    });

    const res = await app2.request(`/${agentId}`);
    expect(res.status).toBe(404);
  });
});

// -------------------------------------------------------------------
// PATCH /:id -- Update agent
// -------------------------------------------------------------------
describe("PATCH /:id - Update agent", () => {
  it("updates agent name", async () => {
    const createRes = await app.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Old Name" }),
    });
    const agentId = (await createRes.json()).data.id;

    const res = await app.request(`/${agentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "New Name" }),
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.name).toBe("New Name");
  });

  it("returns 404 for non-existent agent", async () => {
    const res = await app.request("/00000000-0000-0000-0000-000000000099", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Ghost" }),
    });
    expect(res.status).toBe(404);
  });
});

// -------------------------------------------------------------------
// DELETE /:id -- Revoke agent
// -------------------------------------------------------------------
describe("DELETE /:id - Revoke agent", () => {
  it("soft-deletes an agent", async () => {
    const createRes = await app.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Doomed Agent" }),
    });
    const agentId = (await createRes.json()).data.id;

    const res = await app.request(`/${agentId}`, { method: "DELETE" });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.status).toBe("revoked");
    expect(json.data.revokedAt).not.toBeNull();
  });

  it("returns 400 for already-revoked agent", async () => {
    const createRes = await app.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Double Revoke" }),
    });
    const agentId = (await createRes.json()).data.id;

    await app.request(`/${agentId}`, { method: "DELETE" });
    const res = await app.request(`/${agentId}`, { method: "DELETE" });
    expect(res.status).toBe(400);
  });

  it("returns 404 for non-existent agent", async () => {
    const res = await app.request("/00000000-0000-0000-0000-000000000099", {
      method: "DELETE",
    });
    expect(res.status).toBe(404);
  });
});

// -------------------------------------------------------------------
// POST /:id/manifest -- Issue manifest
// -------------------------------------------------------------------
describe("POST /:id/manifest - Issue manifest", () => {
  it("issues a signed manifest", async () => {
    const createRes = await app.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Manifest Agent" }),
    });
    const agentId = (await createRes.json()).data.id;

    const res = await app.request(`/${agentId}/manifest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.manifestId).toBeDefined();
    expect(json.data.signature).toBeDefined();
    expect(json.data.manifestJson.agent_id).toBe(agentId);
    expect(json.data.manifestJson.scopes).toContain("api_access");
  });

  it("returns 400 for revoked agent", async () => {
    const createRes = await app.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Revoked Agent" }),
    });
    const agentId = (await createRes.json()).data.id;
    await app.request(`/${agentId}`, { method: "DELETE" });

    const res = await app.request(`/${agentId}/manifest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(400);
  });
});

// -------------------------------------------------------------------
// POST /:id/refresh -- Refresh manifest
// -------------------------------------------------------------------
describe("POST /:id/refresh - Refresh manifest", () => {
  it("revokes old manifest and issues new one", async () => {
    const createRes = await app.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Refresh Agent" }),
    });
    const agentId = (await createRes.json()).data.id;

    // Issue first manifest
    await app.request(`/${agentId}/manifest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    // Refresh
    const res = await app.request(`/${agentId}/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.data.manifestId).toBeDefined();
  });
});

// -------------------------------------------------------------------
// POST /:id/pair -- Generate pairing secret
// -------------------------------------------------------------------
describe("POST /:id/pair - Generate pairing", () => {
  it("generates a pairing secret", async () => {
    const createRes = await app.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Pairing Agent" }),
    });
    const agentId = (await createRes.json()).data.id;

    const res = await app.request(`/${agentId}/pair`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.data.pairingId).toBeDefined();
    expect(json.data.pairingSecret).toBeDefined();
    expect(json.data.expiresAt).toBeDefined();
  });
});

// -------------------------------------------------------------------
// GET /:id/audit -- Agent audit log
// -------------------------------------------------------------------
describe("GET /:id/audit - Agent audit", () => {
  it("returns audit entries for an agent", async () => {
    const createRes = await app.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Audited Agent" }),
    });
    const agentId = (await createRes.json()).data.id;

    const res = await app.request(`/${agentId}/audit`);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.entries).toBeDefined();
    expect(Array.isArray(json.data.entries)).toBe(true);
    // Should have at least the agent_created entry
    expect(json.data.total).toBeGreaterThanOrEqual(1);
  });

  it("returns 404 for other user's agent", async () => {
    const createRes = await app.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Private Audit" }),
    });
    const agentId = (await createRes.json()).data.id;

    const user2 = await seedUser("did:privy:nosy-user-321");
    const app2 = createAuthenticatedApp(agentsRouter, {
      userId: user2.userId,
      privyUserId: user2.privyUserId,
      email: "nosy@envoy.dev",
    });

    const res = await app2.request(`/${agentId}/audit`);
    expect(res.status).toBe(404);
  });
});
