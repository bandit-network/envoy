import { describe, it, expect, beforeEach } from "bun:test";
import { Hono } from "hono";
import { createAuthenticatedApp } from "../helpers/create-test-app";
import { cleanDb, seedUser } from "../helpers/test-db";
import { revocationsRouter } from "../../routes/revocations";
import { agentsRouter } from "../../routes/agents";

/**
 * The revocations router is public (no auth).
 * We use the agents router (auth'd) to create agents + manifests + revoke.
 */
let revApp: Hono;
let agentApp: ReturnType<typeof createAuthenticatedApp>;

beforeEach(async () => {
  await cleanDb();
  const user = await seedUser();

  // Revocations router is public
  revApp = new Hono();
  revApp.route("/", revocationsRouter);

  // Agents router needs auth
  agentApp = createAuthenticatedApp(agentsRouter, {
    userId: user.userId,
    privyUserId: user.privyUserId,
    email: "test@envoy.dev",
  });
});

/** Helper: create agent + issue manifest, return IDs */
async function issueManifest(): Promise<{ agentId: string; manifestId: string }> {
  const createRes = await agentApp.request("/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Rev Agent" }),
  });
  const agentId = (await createRes.json()).data.id;

  const manifestRes = await agentApp.request(`/${agentId}/manifest`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  const manifestId = (await manifestRes.json()).data.manifestId;

  return { agentId, manifestId };
}

// -------------------------------------------------------------------
// GET /revocations/:id -- Check revocation status
// -------------------------------------------------------------------
describe("GET /revocations/:id - Check revocation", () => {
  it("returns not-revoked for active manifest", async () => {
    const { manifestId } = await issueManifest();

    const res = await revApp.request(`/revocations/${manifestId}`);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.revoked).toBe(false);
  });

  it("returns revoked for revoked agent's manifest", async () => {
    const { agentId, manifestId } = await issueManifest();

    // Revoke the agent
    await agentApp.request(`/${agentId}`, { method: "DELETE" });

    const res = await revApp.request(`/revocations/${manifestId}`);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.revoked).toBe(true);
    expect(json.data.reason).not.toBeNull();
  });

  it("returns 404 for non-existent manifest", async () => {
    const res = await revApp.request("/revocations/00000000-0000-0000-0000-000000000099");
    expect(res.status).toBe(404);
  });
});
