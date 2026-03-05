/**
 * Following envoy-identity SKILL.md (simplified flow)
 *
 * Step 2: Human provided pairing ID + secret (shown right after agent creation)
 * Step 3: Complete pairing via @envoy/agent-sdk — no agent ID needed
 * Step 4: Store identity
 * Step 5: Verify
 */
import { EnvoyAgent } from "@envoy/agent-sdk";
import { writeFileSync } from "fs";

const PAIRING_ID = "c811b80b-28d8-4742-bf6c-703d0fa93d20";
const PAIRING_SECRET = "1286d18651f6f631cde798030a0e4db1f5b7d4af8be0a4b8f67cc3c4e90eef94";
const ENVOY_URL = "http://localhost:3001";

// Step 3: Complete pairing — agent ID resolved automatically
const agent = new EnvoyAgent({
  envoyUrl: ENVOY_URL,
  onTokenReceived: (data) => {
    // Step 4: Persist identity to disk
    writeFileSync("scripts/.envoy-identity.json", JSON.stringify(data, null, 2));
    console.log("\n💾 Identity persisted to scripts/.envoy-identity.json");
  },
});

console.log("🔄 Completing pairing (no agent ID needed)...\n");

try {
  const tokenData = await agent.pair(PAIRING_ID, PAIRING_SECRET);

  // Step 5: Confirm success
  const manifest = agent.getManifest();
  console.log("✅ Pairing complete!");
  console.log(`   Agent Name:  ${manifest.agent_name}`);
  console.log(`   Agent ID:    ${agent.getAgentId()}`);
  console.log(`   Scopes:      ${agent.getScopes().join(", ")}`);
  console.log(`   Expires:     ${tokenData.expiresAt}`);
  console.log(`   Manifest ID: ${tokenData.manifestId}`);
  console.log(`   Token:       ${tokenData.signature.slice(0, 40)}...`);

  // Verify identity against Envoy
  console.log("\n--- Verifying identity ---");
  const headers = agent.toAuthHeaders();
  console.log(`   Auth header: ${headers.Authorization.slice(0, 50)}...`);

  const verifyRes = await fetch(`${ENVOY_URL}/api/v1/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: tokenData.signature }),
  });
  const verifyData = (await verifyRes.json()) as Record<string, unknown> & {
    data?: { valid: boolean; revoked: boolean };
  };
  console.log(`   Valid:   ${verifyData.data?.valid}`);
  console.log(`   Revoked: ${verifyData.data?.revoked}`);

  console.log("\n=== ✅ Identity acquired and verified! ===");
} catch (err) {
  console.error("❌ Pairing failed:", err instanceof Error ? err.message : err);
  process.exit(1);
}
