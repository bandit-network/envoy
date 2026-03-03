import { describe, it, expect, beforeEach } from "bun:test";
import { createAuthenticatedApp } from "../helpers/create-test-app";
import { cleanDb, seedUser } from "../helpers/test-db";
import { platformsRouter } from "../../routes/platforms";

let userId: string;
let app: ReturnType<typeof createAuthenticatedApp>;

beforeEach(async () => {
  await cleanDb();
  const user = await seedUser();
  userId = user.userId;
  app = createAuthenticatedApp(platformsRouter, {
    userId,
    privyUserId: user.privyUserId,
    email: "test@envoy.dev",
  });
});

// -------------------------------------------------------------------
// POST / -- Register platform
// -------------------------------------------------------------------
describe("POST / - Register platform", () => {
  it("creates a platform with valid data", async () => {
    const res = await app.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Test Platform", domain: "example.com" }),
    });

    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.name).toBe("Test Platform");
    expect(json.data.domain).toBe("example.com");
    expect(json.data.ownerId).toBe(userId);
  });

  it("creates a platform with webhookUrl", async () => {
    const res = await app.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Webhook Platform",
        domain: "hooks.example.com",
        webhookUrl: "https://hooks.example.com/webhook",
      }),
    });

    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.data.webhookUrl).toBe("https://hooks.example.com/webhook");
  });

  it("rejects missing name", async () => {
    const res = await app.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ domain: "example.com" }),
    });

    expect(res.status).toBe(400);
  });
});

// -------------------------------------------------------------------
// GET / -- List platforms
// -------------------------------------------------------------------
describe("GET / - List platforms", () => {
  it("lists platforms owned by user", async () => {
    await app.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "P1", domain: "p1.com" }),
    });
    await app.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "P2", domain: "p2.com" }),
    });

    const res = await app.request("/");
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.platforms).toHaveLength(2);
    expect(json.data.total).toBe(2);
  });

  it("returns empty list when no platforms", async () => {
    const res = await app.request("/");
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.platforms).toHaveLength(0);
  });
});

// -------------------------------------------------------------------
// GET /:id -- Platform detail
// -------------------------------------------------------------------
describe("GET /:id - Platform detail", () => {
  it("returns platform details", async () => {
    const createRes = await app.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Detail Platform", domain: "detail.com" }),
    });
    const created = await createRes.json();
    const platformId = created.data.id;

    const res = await app.request(`/${platformId}`);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.platform.name).toBe("Detail Platform");
    expect(json.data.apiKeyCount).toBe(0);
  });

  it("returns 404 for non-existent platform", async () => {
    const res = await app.request("/00000000-0000-0000-0000-000000000099");
    expect(res.status).toBe(404);
  });

  it("returns 404 for other user's platform", async () => {
    const createRes = await app.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Private", domain: "private.com" }),
    });
    const platformId = (await createRes.json()).data.id;

    const user2 = await seedUser("did:privy:other-user");
    const app2 = createAuthenticatedApp(platformsRouter, {
      userId: user2.userId,
      privyUserId: user2.privyUserId,
      email: "other@envoy.dev",
    });

    const res = await app2.request(`/${platformId}`);
    expect(res.status).toBe(404);
  });
});

// -------------------------------------------------------------------
// PATCH /:id -- Update platform
// -------------------------------------------------------------------
describe("PATCH /:id - Update platform", () => {
  it("updates platform name", async () => {
    const createRes = await app.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Old Name", domain: "old.com" }),
    });
    const platformId = (await createRes.json()).data.id;

    const res = await app.request(`/${platformId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "New Name" }),
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.name).toBe("New Name");
  });

  it("returns 404 for non-existent platform", async () => {
    const res = await app.request("/00000000-0000-0000-0000-000000000099", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Ghost" }),
    });
    expect(res.status).toBe(404);
  });
});

// -------------------------------------------------------------------
// DELETE /:id -- Revoke platform
// -------------------------------------------------------------------
describe("DELETE /:id - Revoke platform", () => {
  it("soft-deletes a platform", async () => {
    const createRes = await app.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Doomed", domain: "doomed.com" }),
    });
    const platformId = (await createRes.json()).data.id;

    const res = await app.request(`/${platformId}`, { method: "DELETE" });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.revokedAt).not.toBeNull();
  });

  it("returns 400 for already-revoked platform", async () => {
    const createRes = await app.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Double", domain: "double.com" }),
    });
    const platformId = (await createRes.json()).data.id;

    await app.request(`/${platformId}`, { method: "DELETE" });
    const res = await app.request(`/${platformId}`, { method: "DELETE" });
    expect(res.status).toBe(400);
  });
});

// -------------------------------------------------------------------
// POST /:id/api-keys -- Generate API key
// -------------------------------------------------------------------
describe("POST /:id/api-keys - Generate API key", () => {
  it("generates an API key", async () => {
    const createRes = await app.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Key Platform", domain: "key.com" }),
    });
    const platformId = (await createRes.json()).data.id;

    const res = await app.request(`/${platformId}/api-keys`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: "My Key" }),
    });

    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.data.key).toBeDefined();
    expect(json.data.key.startsWith("envk_")).toBe(true);
    expect(json.data.keyPrefix).toBeDefined();
    expect(json.data.label).toBe("My Key");
  });

  it("returns 404 for non-existent platform", async () => {
    const res = await app.request("/00000000-0000-0000-0000-000000000099/api-keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(404);
  });
});

// -------------------------------------------------------------------
// GET /:id/api-keys -- List API keys
// -------------------------------------------------------------------
describe("GET /:id/api-keys - List API keys", () => {
  it("lists API keys for a platform", async () => {
    const createRes = await app.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "List Keys", domain: "list.com" }),
    });
    const platformId = (await createRes.json()).data.id;

    // Generate 2 keys
    await app.request(`/${platformId}/api-keys`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    await app.request(`/${platformId}/api-keys`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    const res = await app.request(`/${platformId}/api-keys`);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.keys).toHaveLength(2);
    // Keys should NOT expose the full key
    expect(json.data.keys[0].keyPrefix).toBeDefined();
  });
});

// -------------------------------------------------------------------
// DELETE /:id/api-keys/:keyId -- Revoke API key
// -------------------------------------------------------------------
describe("DELETE /:id/api-keys/:keyId - Revoke API key", () => {
  it("revokes an API key", async () => {
    const createRes = await app.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Revoke Key", domain: "revoke.com" }),
    });
    const platformId = (await createRes.json()).data.id;

    const keyRes = await app.request(`/${platformId}/api-keys`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const keyId = (await keyRes.json()).data.keyId;

    const res = await app.request(`/${platformId}/api-keys/${keyId}`, {
      method: "DELETE",
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.revokedAt).not.toBeNull();
  });

  it("returns 400 for already-revoked key", async () => {
    const createRes = await app.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Double Rev", domain: "drev.com" }),
    });
    const platformId = (await createRes.json()).data.id;

    const keyRes = await app.request(`/${platformId}/api-keys`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const keyId = (await keyRes.json()).data.keyId;

    await app.request(`/${platformId}/api-keys/${keyId}`, { method: "DELETE" });
    const res = await app.request(`/${platformId}/api-keys/${keyId}`, { method: "DELETE" });
    expect(res.status).toBe(400);
  });
});
