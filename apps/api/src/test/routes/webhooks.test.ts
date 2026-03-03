import { describe, it, expect, beforeEach } from "bun:test";
import { Hono } from "hono";
import { createAuthenticatedApp } from "../helpers/create-test-app";
import { cleanDb, seedUser } from "../helpers/test-db";
import { webhooksRouter } from "../../routes/webhooks";
import { platformsRouter } from "../../routes/platforms";

let userId: string;
let webhookApp: ReturnType<typeof createAuthenticatedApp>;
let platformApp: ReturnType<typeof createAuthenticatedApp>;

beforeEach(async () => {
  await cleanDb();
  const user = await seedUser();
  userId = user.userId;

  const userCtx = {
    userId,
    privyUserId: user.privyUserId,
    email: "test@envoy.dev",
  };

  webhookApp = createAuthenticatedApp(webhooksRouter, userCtx);
  platformApp = createAuthenticatedApp(platformsRouter, userCtx);
});

/** Helper: create a platform and return its ID */
async function createPlatform(name = "Test Platform"): Promise<string> {
  const res = await platformApp.request("/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, domain: "example.com" }),
  });
  const json = await res.json();
  return json.data.id;
}

// -------------------------------------------------------------------
// POST /subscribe -- Create subscription
// -------------------------------------------------------------------
describe("POST /subscribe - Create webhook subscription", () => {
  it("creates a subscription and returns signing secret", async () => {
    const platformId = await createPlatform();

    const res = await webhookApp.request("/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        platformId,
        url: "https://hooks.example.com/webhook",
        eventTypes: ["manifest.revoked"],
      }),
    });

    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.id).toBeDefined();
    expect(json.data.signingSecret).toBeDefined();
    expect(json.data.signingSecret.startsWith("whsec_")).toBe(true);
    expect(json.data.eventTypes).toContain("manifest.revoked");
  });

  it("supports multiple event types", async () => {
    const platformId = await createPlatform();

    const res = await webhookApp.request("/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        platformId,
        url: "https://hooks.example.com/webhook",
        eventTypes: ["manifest.revoked", "agent.revoked", "manifest.issued"],
      }),
    });

    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.data.eventTypes).toHaveLength(3);
  });

  it("rejects missing event types", async () => {
    const platformId = await createPlatform();

    const res = await webhookApp.request("/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        platformId,
        url: "https://hooks.example.com/webhook",
        eventTypes: [],
      }),
    });

    expect(res.status).toBe(400);
  });

  it("rejects invalid URL", async () => {
    const platformId = await createPlatform();

    const res = await webhookApp.request("/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        platformId,
        url: "not-a-url",
        eventTypes: ["manifest.revoked"],
      }),
    });

    expect(res.status).toBe(400);
  });

  it("returns 404 for non-existent platform", async () => {
    const res = await webhookApp.request("/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        platformId: "00000000-0000-0000-0000-000000000099",
        url: "https://hooks.example.com/webhook",
        eventTypes: ["manifest.revoked"],
      }),
    });

    expect(res.status).toBe(404);
  });
});

// -------------------------------------------------------------------
// GET / -- List subscriptions
// -------------------------------------------------------------------
describe("GET / - List webhook subscriptions", () => {
  it("lists subscriptions for user's platforms", async () => {
    const platformId = await createPlatform();

    await webhookApp.request("/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        platformId,
        url: "https://hooks.example.com/webhook1",
        eventTypes: ["manifest.revoked"],
      }),
    });

    const res = await webhookApp.request("/");
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.subscriptions).toHaveLength(1);
    expect(json.data.subscriptions[0].url).toBe("https://hooks.example.com/webhook1");
  });

  it("returns empty list when no subscriptions", async () => {
    const res = await webhookApp.request("/");
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.subscriptions).toHaveLength(0);
  });
});

// -------------------------------------------------------------------
// DELETE /:id -- Delete subscription
// -------------------------------------------------------------------
describe("DELETE /:id - Delete webhook subscription", () => {
  it("deletes a subscription", async () => {
    const platformId = await createPlatform();

    const createRes = await webhookApp.request("/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        platformId,
        url: "https://hooks.example.com/webhook",
        eventTypes: ["manifest.revoked"],
      }),
    });
    const subId = (await createRes.json()).data.id;

    const res = await webhookApp.request(`/${subId}`, { method: "DELETE" });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.deleted).toBe(true);
  });

  it("returns 404 for non-existent subscription", async () => {
    const res = await webhookApp.request("/00000000-0000-0000-0000-000000000099", {
      method: "DELETE",
    });
    expect(res.status).toBe(404);
  });

  it("returns 403 for other user's subscription", async () => {
    const platformId = await createPlatform();

    const createRes = await webhookApp.request("/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        platformId,
        url: "https://hooks.example.com/webhook",
        eventTypes: ["manifest.revoked"],
      }),
    });
    const subId = (await createRes.json()).data.id;

    // Create second user's app
    const user2 = await seedUser("did:privy:other-user");
    const app2 = createAuthenticatedApp(webhooksRouter, {
      userId: user2.userId,
      privyUserId: user2.privyUserId,
      email: "other@envoy.dev",
    });

    const res = await app2.request(`/${subId}`, { method: "DELETE" });
    expect(res.status).toBe(403);
  });
});
