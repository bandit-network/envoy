/**
 * Following envoy-identity SKILL.md — Step 5: Complete Pairing
 *
 * This script demonstrates how a real agent runtime would use
 * @envoy/agent-sdk after receiving pairing credentials from its human operator.
 */
import { EnvoyAgent } from "@envoy/agent-sdk";
import { writeFileSync } from "fs";

// Credentials received from human operator (Step 4)
const AGENT_ID = "7da4cfec-1967-4d5d-8b1a-dbc75905b9e0";
const PAIRING_ID = "1510b49e-1ed0-436f-8914-c1244a056f45";
const PAIRING_SECRET = "6ad78328beaead8c3d9b499ed61d611cb0342d2155b960d55753bc2e975b020a";

// Step 5: Create agent instance and pair
const agent = new EnvoyAgent({
  envoyUrl: "http://localhost:3001",
  agentId: AGENT_ID,
  onTokenReceived: (data) => {
    // Step 6: Store identity securely (persistence callback)
    writeFileSync("scripts/.envoy-identity.json", JSON.stringify(data, null, 2));
    console.log("💾 Identity persisted to scripts/.envoy-identity.json");
  },
});

console.log("🔄 Exchanging pairing credentials for signed manifest...\n");

try {
  const tokenData = await agent.pair(PAIRING_ID, PAIRING_SECRET);

  // Step 7: Confirm success to human
  console.log("✅ Pairing complete!");
  console.log(`   Agent Name:  ${tokenData.manifestJson.agent_name}`);
  console.log(`   Agent ID:    ${tokenData.manifestJson.agent_id}`);
  console.log(`   Scopes:      ${tokenData.manifestJson.scopes.join(", ")}`);
  console.log(`   Expires:     ${tokenData.expiresAt}`);
  console.log(`   Manifest ID: ${tokenData.manifestId}`);
  console.log(`   Token:       ${tokenData.signature.slice(0, 40)}...`);

  // Present identity to verify it works (Skill: "Presenting Your Identity")
  console.log("\n--- Presenting identity to platform for verification ---");
  const headers = agent.toAuthHeaders();
  console.log(`   Authorization: ${headers.Authorization.slice(0, 60)}...`);

  const verifyRes = await fetch("http://localhost:3001/api/v1/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: agent.getToken() }),
  });
  const verifyData = (await verifyRes.json()) as any;
  console.log(`   Verified: ${verifyData.data?.valid}`);
  console.log(`   Revoked:  ${verifyData.data?.revoked}`);
  console.log(`   Scopes:   ${verifyData.data?.scopes?.join(", ")}`);

  // Check JWKS endpoint (Skill: "Platforms verify via Envoy's .well-known/envoy-issuer JWKS endpoint")
  console.log("\n--- JWKS Discovery ---");
  const jwksRes = await fetch("http://localhost:3001/.well-known/envoy-issuer");
  const jwksData = (await jwksRes.json()) as any;
  console.log(`   Keys found: ${jwksData.keys?.length ?? 0}`);
  console.log(`   Key ID:     ${jwksData.keys?.[0]?.kid ?? "none"}`);

  // Check revocation status
  console.log("\n--- Revocation Check ---");
  const revRes = await fetch(`http://localhost:3001/api/v1/revocations/${tokenData.manifestId}`);
  const revData = (await revRes.json()) as any;
  console.log(`   Revoked: ${revData.data?.revoked}`);

  console.log("\n=== ✅ Identity acquired and verified! ===");
  console.log("I can now authenticate with any platform that trusts Envoy as an issuer.");

} catch (err: any) {
  // Skill: "Handling Errors"
  if (err.message?.includes("expired")) {
    console.error("⏰ Pairing secret expired (10-min TTL). Please generate a new one from the dashboard.");
  } else if (err.message?.includes("Invalid")) {
    console.error("❌ Invalid pairing secret. Secrets are single-use — please generate a new pairing.");
  } else {
    console.error("❌ Pairing failed:", err.message);
  }
  process.exit(1);
}
