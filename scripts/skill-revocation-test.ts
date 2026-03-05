/**
 * Following envoy-identity SKILL.md — Testing Revocation
 *
 * Skill says: "Your human (or Envoy) has revoked this agent identity.
 * The token is permanently invalid."
 *
 * This script loads the persisted identity and checks if it's still valid.
 * Run this BEFORE and AFTER revoking the agent from the dashboard.
 */
import { EnvoyAgent } from "@envoy/agent-sdk";
import { readFileSync } from "fs";

// Load persisted identity (Step 6: "Store all four values securely")
const savedData = JSON.parse(readFileSync("scripts/.envoy-identity.json", "utf-8"));

// Restore identity on a new agent instance (simulating restart)
const agent = new EnvoyAgent({
  envoyUrl: "http://localhost:3001",
  agentId: "7da4cfec-1967-4d5d-8b1a-dbc75905b9e0",
});

agent.loadToken(savedData);

console.log("=== Revocation Test ===\n");
console.log(`Agent:       ${agent.getManifest().agent_name}`);
console.log(`Manifest ID: ${agent.getTokenData().manifestId}`);
console.log(`isPaired:    ${agent.isPaired()}`);
console.log(`isExpired:   ${agent.isExpired()}`);

// Verify token (Skill: "Present identity to platforms")
console.log("\n--- Token Verification ---");
try {
  const token = agent.getToken();
  const verifyRes = await fetch("http://localhost:3001/api/v1/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  });
  const verifyData = (await verifyRes.json()) as any;
  console.log(`   Valid:   ${verifyData.data?.valid ?? "N/A"}`);
  console.log(`   Revoked: ${verifyData.data?.revoked ?? "N/A"}`);
  console.log(`   Expired: ${verifyData.data?.expired ?? "N/A"}`);
  console.log(`   Scopes:  ${verifyData.data?.scopes?.join(", ") ?? "N/A"}`);

  if (verifyData.data?.valid) {
    console.log("\n🟢 Token is VALID. To test revocation:");
    console.log("   1. Go to the Envoy dashboard (http://localhost:3000)");
    console.log("   2. Navigate to first-test-bot's detail page");
    console.log("   3. Click 'Revoke' to revoke the agent");
    console.log("   4. Run this script again to see it rejected");
  } else if (verifyData.data?.revoked) {
    console.log("\n🔴 Token is REVOKED! The platform correctly rejects this agent.");
    console.log("   As per the skill: 'The token is permanently invalid.'");
    console.log("   You'll need a completely new agent identity to be created.");
  } else if (verifyData.data?.expired) {
    console.log("\n⏰ Token has EXPIRED.");
    console.log("   As per the skill: 'Please go to my agent page on Envoy and click Refresh'");
  }
} catch (err: any) {
  if (err.name === "EnvoyTokenExpiredError") {
    console.log("   ⏰ Token expired locally — cannot present to platform.");
  } else {
    console.error("   ❌ Error:", err.message);
  }
}

// Check revocation endpoint directly
console.log("\n--- Revocation Endpoint ---");
const revRes = await fetch(`http://localhost:3001/api/v1/revocations/${savedData.manifestId}`);
const revData = (await revRes.json()) as any;
console.log(`   Revoked:    ${revData.data?.revoked}`);
console.log(`   Revoked At: ${revData.data?.revokedAt ?? "null"}`);

console.log("\n=== Done ===");
