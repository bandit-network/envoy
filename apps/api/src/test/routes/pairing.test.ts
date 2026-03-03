import { describe, it, expect, beforeEach } from "bun:test";
import { Hono } from "hono";
import { db, pairings } from "@envoy/db";
import { eq } from "drizzle-orm";
import { createAuthenticatedApp } from "../helpers/create-test-app";
import { cleanDb, seedUser } from "../helpers/test-db";
import { pairingRouter } from "../../routes/pairing";
import { agentsRouter } from "../../routes/agents";

/**
 * The pairing router (pair-confirm) is public.
 * We use the agents router (auth'd) to create agents + generate pairing secrets.
 */
let pairApp: Hono;
let agentApp: ReturnType<typeof createAuthenticatedApp>;

beforeEach(async () => {
  await cleanDb();
  const user = await seedUser();

  // Pairing-confirm is public
  pairApp = new Hono();
  pairApp.route("/", pairingRouter);

  // Agents router needs auth
  agentApp = createAuthenticatedApp(agentsRouter, {
    userId: user.userId,
    privyUserId: user.privyUserId,
    email: "test@envoy.dev",
  });
});

/** Helper: create agent, generate pairing, return IDs + secret */
async function setupPairing(): Promise<{
  agentId: string;
  pairingId: string;
  pairingSecret: string;
}> {
  // Create agent
  const createRes = await agentApp.request("/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Pairing Agent" }),
  });
  const agentId = (await createRes.json()).data.id;

  // Generate pairing secret
  const pairRes = await agentApp.request(`/${agentId}/pair`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  const pairData = (await pairRes.json()).data;

  return {
    agentId,
    pairingId: pairData.pairingId,
    pairingSecret: pairData.pairingSecret,
  };
}

// -------------------------------------------------------------------
// POST /agents/:id/pair-confirm -- Confirm pairing
// -------------------------------------------------------------------
describe("POST /agents/:id/pair-confirm - Confirm pairing", () => {
  it("confirms a valid pairing and returns manifest", async () => {
    const { agentId, pairingId, pairingSecret } = await setupPairing();

    const res = await pairApp.request(`/agents/${agentId}/pair-confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pairingId, pairingSecret }),
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.manifestId).toBeDefined();
    expect(json.data.signature).toBeDefined();
    expect(json.data.expiresAt).toBeDefined();
  });

  it("rejects already-used pairing", async () => {
    const { agentId, pairingId, pairingSecret } = await setupPairing();

    // First confirm succeeds
    await pairApp.request(`/agents/${agentId}/pair-confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pairingId, pairingSecret }),
    });

    // Second confirm fails
    const res = await pairApp.request(`/agents/${agentId}/pair-confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pairingId, pairingSecret }),
    });

    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.success).toBe(false);
  });

  it("rejects invalid secret", async () => {
    const { agentId, pairingId } = await setupPairing();

    const res = await pairApp.request(`/agents/${agentId}/pair-confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pairingId, pairingSecret: "wrong-secret" }),
    });

    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.success).toBe(false);
  });

  it("rejects expired pairing", async () => {
    const { agentId, pairingId, pairingSecret } = await setupPairing();

    // Manually expire the pairing
    await db
      .update(pairings)
      .set({ expiresAt: new Date(Date.now() - 60000) })
      .where(eq(pairings.id, pairingId));

    const res = await pairApp.request(`/agents/${agentId}/pair-confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pairingId, pairingSecret }),
    });

    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.success).toBe(false);
  });

  it("rejects non-existent pairing", async () => {
    const { agentId } = await setupPairing();

    const res = await pairApp.request(`/agents/${agentId}/pair-confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pairingId: "00000000-0000-0000-0000-000000000099",
        pairingSecret: "any",
      }),
    });

    expect(res.status).toBe(401);
  });

  it("rejects missing fields", async () => {
    const { agentId } = await setupPairing();

    const res = await pairApp.request(`/agents/${agentId}/pair-confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(400);
  });
});
