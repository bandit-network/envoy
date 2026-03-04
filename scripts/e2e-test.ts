/**
 * End-to-end test script for the Envoy agent lifecycle.
 *
 * Usage:
 *   AUTH_TOKEN="your-privy-bearer-token" bun run scripts/e2e-test.ts
 *
 * Optional:
 *   API_URL="http://localhost:3001" (default)
 *
 * This script validates the full flow:
 *   1. Create agent
 *   2. Issue manifest
 *   3. Verify manifest token
 *   4. Refresh manifest
 *   5. Verify new token
 *   6. Suspend agent
 *   7. Unsuspend agent
 *   8. Revoke agent
 *   9. Verify old token is now invalid
 */

const API_URL = process.env.API_URL ?? "http://localhost:3001";
const AUTH_TOKEN = process.env.AUTH_TOKEN;

if (!AUTH_TOKEN) {
  console.error("❌ AUTH_TOKEN environment variable is required.");
  console.error("   Usage: AUTH_TOKEN=your-token bun run scripts/e2e-test.ts");
  process.exit(1);
}

const headers = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${AUTH_TOKEN}`,
};

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string) {
  if (condition) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.error(`  ❌ ${label}`);
    failed++;
  }
}

async function apiCall<T = Record<string, unknown>>(
  method: string,
  path: string,
  body?: unknown
): Promise<{ status: number; data: T; success: boolean }> {
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = (await res.json()) as { success: boolean; data: T; error?: { code: string; message: string } };
  return { status: res.status, data: json.data, success: json.success };
}

async function apiCallPublic<T = Record<string, unknown>>(
  method: string,
  path: string,
  body?: unknown
): Promise<{ status: number; data: T; success: boolean }> {
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = (await res.json()) as { success: boolean; data: T; error?: { code: string; message: string } };
  return { status: res.status, data: json.data, success: json.success };
}

console.log("╔══════════════════════════════════════════╗");
console.log("║     Envoy E2E Test — Agent Lifecycle     ║");
console.log("╚══════════════════════════════════════════╝");
console.log(`\n  API: ${API_URL}\n`);

// ─── Step 1: Create Agent ────────────────────────────────────────
console.log("─── Step 1: Create Agent ───");
const agentName = `e2e-test-${Date.now()}`;
const createRes = await apiCall<{
  id: string;
  name: string;
  status: string;
  pairing?: { pairingId: string; pairingSecret: string };
}>("POST", "/api/v1/agents", {
  name: agentName,
  description: "E2E test agent — safe to delete",
  scopes: ["api_access", "data_read"],
  defaultTtl: 3600,
});

assert(createRes.success, "Agent created successfully");
assert(createRes.data?.id !== undefined, "Agent has an ID");
assert(createRes.data?.name === agentName, `Agent name matches: ${agentName}`);

const agentId = createRes.data?.id;
if (!agentId) {
  console.error("\n❌ Cannot continue without agent ID. Aborting.");
  process.exit(1);
}
console.log(`  Agent ID: ${agentId}\n`);

// ─── Step 2: Issue Manifest ──────────────────────────────────────
console.log("─── Step 2: Issue Manifest ───");
const issueRes = await apiCall<{
  manifestId: string;
  signature: string;
  expiresAt: string;
}>("POST", `/api/v1/agents/${agentId}/manifest`, { ttl: 3600 });

assert(issueRes.success, "Manifest issued successfully");
assert(issueRes.data?.signature !== undefined, "Manifest has a signature/token");
assert(issueRes.data?.manifestId !== undefined, "Manifest has an ID");

const token1 = issueRes.data?.signature;
const manifestId1 = issueRes.data?.manifestId;
console.log(`  Manifest ID: ${manifestId1}\n`);

// ─── Step 3: Verify Manifest Token ──────────────────────────────
console.log("─── Step 3: Verify Manifest Token ───");
if (token1) {
  const verifyRes = await apiCallPublic<{
    valid: boolean;
    revoked: boolean;
    expired: boolean;
    scopes: string[];
  }>("POST", "/api/v1/verify", { token: token1 });

  assert(verifyRes.success, "Verification endpoint responded");
  assert(verifyRes.data?.valid === true, "Token is valid");
  assert(verifyRes.data?.revoked === false, "Token is not revoked");
  assert(verifyRes.data?.expired === false, "Token is not expired");
  assert(
    verifyRes.data?.scopes?.includes("api_access") === true,
    "Token has api_access scope"
  );
} else {
  console.error("  ❌ No token to verify");
  failed++;
}
console.log();

// ─── Step 4: Refresh Manifest ────────────────────────────────────
console.log("─── Step 4: Refresh Manifest ───");
const refreshRes = await apiCall<{
  manifestId: string;
  signature: string;
  expiresAt: string;
}>("POST", `/api/v1/agents/${agentId}/refresh`, {});

assert(refreshRes.success, "Manifest refreshed successfully");
assert(refreshRes.data?.manifestId !== manifestId1, "New manifest has different ID");
assert(refreshRes.data?.signature !== undefined, "New manifest has a token");

const token2 = refreshRes.data?.signature;
console.log(`  New Manifest ID: ${refreshRes.data?.manifestId}\n`);

// ─── Step 5: Verify New Token ────────────────────────────────────
console.log("─── Step 5: Verify New Token ───");
if (token2) {
  const verifyRes2 = await apiCallPublic<{
    valid: boolean;
    revoked: boolean;
  }>("POST", "/api/v1/verify", { token: token2 });

  assert(verifyRes2.data?.valid === true, "New token is valid");
  assert(verifyRes2.data?.revoked === false, "New token is not revoked");
} else {
  console.error("  ❌ No refreshed token to verify");
  failed++;
}

// Verify old token is now revoked (from refresh)
if (token1) {
  const verifyOld = await apiCallPublic<{
    valid: boolean;
    revoked: boolean;
  }>("POST", "/api/v1/verify", { token: token1 });

  assert(verifyOld.data?.valid === false, "Old token is no longer valid after refresh");
}
console.log();

// ─── Step 6: Suspend Agent ───────────────────────────────────────
console.log("─── Step 6: Suspend Agent ───");
const suspendRes = await apiCall<{ status: string }>(
  "PATCH",
  `/api/v1/agents/${agentId}`,
  { status: "suspended" }
);

assert(suspendRes.success, "Agent suspended successfully");
assert(suspendRes.data?.status === "suspended", "Agent status is suspended");

// Try issuing manifest while suspended — should fail
const issueWhileSuspended = await apiCall(
  "POST",
  `/api/v1/agents/${agentId}/manifest`,
  {}
);
assert(
  issueWhileSuspended.success === false,
  "Cannot issue manifest while suspended"
);
console.log();

// ─── Step 7: Unsuspend Agent ─────────────────────────────────────
console.log("─── Step 7: Unsuspend Agent ───");
const unsuspendRes = await apiCall<{ status: string }>(
  "PATCH",
  `/api/v1/agents/${agentId}`,
  { status: "active" }
);

assert(unsuspendRes.success, "Agent reactivated successfully");
assert(unsuspendRes.data?.status === "active", "Agent status is active again");

// Issue manifest after unsuspend — should work
const issueAfterUnsuspend = await apiCall<{
  manifestId: string;
  signature: string;
}>("POST", `/api/v1/agents/${agentId}/manifest`, {});
assert(
  issueAfterUnsuspend.success === true,
  "Can issue manifest after reactivation"
);
const token3 = issueAfterUnsuspend.data?.signature;
console.log();

// ─── Step 8: Revoke Agent ────────────────────────────────────────
console.log("─── Step 8: Revoke Agent ───");
const revokeRes = await apiCall<{ status: string }>(
  "DELETE",
  `/api/v1/agents/${agentId}`
);

assert(revokeRes.success, "Agent revoked successfully");
console.log();

// ─── Step 9: Verify Token is Invalid After Revocation ────────────
console.log("─── Step 9: Verify Token Invalid After Revocation ───");
if (token3) {
  const verifyRevoked = await apiCallPublic<{
    valid: boolean;
    revoked: boolean;
  }>("POST", "/api/v1/verify", { token: token3 });

  assert(verifyRevoked.data?.valid === false, "Token is invalid after revocation");
  assert(verifyRevoked.data?.revoked === true, "Token is marked as revoked");
}

// Verify agent detail shows revoked
const agentDetail = await apiCall<{
  agent: { status: string; revokedAt: string | null };
}>("GET", `/api/v1/agents/${agentId}`);
assert(
  agentDetail.data?.agent?.status === "revoked",
  "Agent status is revoked"
);
assert(
  agentDetail.data?.agent?.revokedAt !== null,
  "Agent has revokedAt timestamp"
);

// ─── Results ─────────────────────────────────────────────────────
console.log("\n╔══════════════════════════════════════════╗");
console.log(`║  Results: ${passed} passed, ${failed} failed${" ".repeat(Math.max(0, 18 - String(passed).length - String(failed).length))}║`);
console.log("╚══════════════════════════════════════════╝\n");

if (failed > 0) {
  console.error("❌ E2E test FAILED");
  process.exit(1);
} else {
  console.log("✅ E2E test PASSED — full agent lifecycle verified!");
  process.exit(0);
}
