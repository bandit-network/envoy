import { describe, it, expect, beforeEach, mock } from "bun:test";
import { db, agents, manifests, users } from "@envoy/db";
import { cleanDb } from "../helpers/test-db";
import { eq } from "drizzle-orm";

// Mock deliverWebhook before importing the scanner
const mockDeliverWebhook = mock(() => {});
mock.module("../../services/webhook", () => ({
  deliverWebhook: mockDeliverWebhook,
}));

// Import scanner after mock is set up
const { scanExpiringManifests } = await import("../../services/expiry-scanner");

let userId: string;
let agentId: string;

beforeEach(async () => {
  await cleanDb();
  mockDeliverWebhook.mockClear();

  // Seed user
  const [user] = await db
    .insert(users)
    .values({ privyUserId: "did:privy:test-scanner", email: "scanner@test.dev" })
    .returning();
  userId = user!.id;

  // Seed agent
  const [agent] = await db
    .insert(agents)
    .values({ ownerId: userId, name: "Scanner Test Agent" })
    .returning();
  agentId = agent!.id;
});

describe("scanExpiringManifests", () => {
  it("fires webhook for manifest expiring within the window", async () => {
    // Create a manifest expiring in 10 minutes (within default 15-min window)
    const now = new Date();
    const expiresIn10Min = new Date(now.getTime() + 10 * 60 * 1000);

    await db.insert(manifests).values({
      agentId,
      manifestJson: { agent_name: "Scanner Test Agent", agent_id: agentId },
      signature: "test-sig",
      issuedAt: new Date(now.getTime() - 50 * 60 * 1000),
      expiresAt: expiresIn10Min,
    });

    const count = await scanExpiringManifests();

    expect(count).toBe(1);
    expect(mockDeliverWebhook).toHaveBeenCalledTimes(1);
    const callArg = mockDeliverWebhook.mock.calls[0]![0] as {
      type: string;
      data: Record<string, unknown>;
    };
    expect(callArg.type).toBe("manifest.expiring");
    expect(callArg.data.agentId).toBe(agentId);
    expect(callArg.data.agentName).toBe("Scanner Test Agent");
    expect(typeof callArg.data.minutesUntilExpiry).toBe("number");
  });

  it("skips already-notified manifests", async () => {
    const now = new Date();
    const expiresIn10Min = new Date(now.getTime() + 10 * 60 * 1000);

    await db.insert(manifests).values({
      agentId,
      manifestJson: { agent_name: "Scanner Test Agent", agent_id: agentId },
      signature: "test-sig",
      issuedAt: new Date(now.getTime() - 50 * 60 * 1000),
      expiresAt: expiresIn10Min,
      expiryNotifiedAt: now, // Already notified
    });

    const count = await scanExpiringManifests();

    expect(count).toBe(0);
    expect(mockDeliverWebhook).not.toHaveBeenCalled();
  });

  it("skips revoked manifests", async () => {
    const now = new Date();
    const expiresIn10Min = new Date(now.getTime() + 10 * 60 * 1000);

    await db.insert(manifests).values({
      agentId,
      manifestJson: { agent_name: "Scanner Test Agent", agent_id: agentId },
      signature: "test-sig",
      issuedAt: new Date(now.getTime() - 50 * 60 * 1000),
      expiresAt: expiresIn10Min,
      revokedAt: now, // Revoked
    });

    const count = await scanExpiringManifests();

    expect(count).toBe(0);
    expect(mockDeliverWebhook).not.toHaveBeenCalled();
  });

  it("skips manifests not yet in the expiry window", async () => {
    const now = new Date();
    // Expires in 2 hours — well outside the 15-minute window
    const expiresIn2Hours = new Date(now.getTime() + 2 * 60 * 60 * 1000);

    await db.insert(manifests).values({
      agentId,
      manifestJson: { agent_name: "Scanner Test Agent", agent_id: agentId },
      signature: "test-sig",
      issuedAt: now,
      expiresAt: expiresIn2Hours,
    });

    const count = await scanExpiringManifests();

    expect(count).toBe(0);
    expect(mockDeliverWebhook).not.toHaveBeenCalled();
  });

  it("marks manifest as notified after firing webhook", async () => {
    const now = new Date();
    const expiresIn10Min = new Date(now.getTime() + 10 * 60 * 1000);

    const [manifest] = await db
      .insert(manifests)
      .values({
        agentId,
        manifestJson: { agent_name: "Scanner Test Agent", agent_id: agentId },
        signature: "test-sig",
        issuedAt: new Date(now.getTime() - 50 * 60 * 1000),
        expiresAt: expiresIn10Min,
      })
      .returning();

    await scanExpiringManifests();

    // Verify the manifest was marked as notified
    const updated = await db.query.manifests.findFirst({
      where: eq(manifests.id, manifest!.id),
    });
    expect(updated!.expiryNotifiedAt).not.toBeNull();

    // Second scan should find nothing
    mockDeliverWebhook.mockClear();
    const count = await scanExpiringManifests();
    expect(count).toBe(0);
  });
});
