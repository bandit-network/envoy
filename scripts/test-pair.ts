import { EnvoyAgent } from "@envoy/agent-sdk";

// --- Fill in from the dashboard ---
const AGENT_ID = process.argv[2] || "";
const PAIRING_ID = process.argv[3] || "1a2b0330-7241-4915-92a2-281da0913f00";
const PAIRING_SECRET = process.argv[4] || "bb20f59a77656f257072bc2605d2443a39366dfb4b0598cd785dbd090aa0e3ba";

if (!AGENT_ID) {
  console.error("Usage: bun run scripts/test-pair.ts <agent-id> [pairing-id] [secret]");
  process.exit(1);
}

console.log("=== Envoy E2E Test: Agent Pairing ===\n");
console.log(`Agent ID:   ${AGENT_ID}`);
console.log(`Pairing ID: ${PAIRING_ID}`);
console.log(`Secret:     ${PAIRING_SECRET.slice(0, 8)}...${PAIRING_SECRET.slice(-8)}\n`);

// Step 1: Create agent instance
const agent = new EnvoyAgent({
  envoyUrl: "http://localhost:3001",
  agentId: AGENT_ID,
  onTokenReceived: (data) => {
    console.log("✅ onTokenReceived callback fired!");
    console.log(`   Manifest ID: ${data.manifestId}`);
    console.log(`   Expires At:  ${data.expiresAt}`);
  },
});

console.log(`isPaired before: ${agent.isPaired()}`);
console.log(`isExpired before: ${agent.isExpired()}\n`);

// Step 2: Pair
console.log("--- Step 1: Pairing ---");
try {
  const tokenData = await agent.pair(PAIRING_ID, PAIRING_SECRET);
  console.log(`\n✅ Pairing successful!`);
  console.log(`   Agent Name:  ${tokenData.manifestJson.agent_name}`);
  console.log(`   Agent ID:    ${tokenData.manifestJson.agent_id}`);
  console.log(`   Scopes:      ${tokenData.manifestJson.scopes.join(", ")}`);
  console.log(`   Expires:     ${tokenData.expiresAt}`);
  console.log(`   Token:       ${tokenData.signature.slice(0, 50)}...`);
} catch (err) {
  console.error(`❌ Pairing failed:`, err);
  process.exit(1);
}

console.log(`\nisPaired after:  ${agent.isPaired()}`);
console.log(`isExpired after: ${agent.isExpired()}\n`);

// Step 3: Get auth headers
console.log("--- Step 2: Auth Headers ---");
const headers = agent.toAuthHeaders();
console.log(`   Authorization: ${headers.Authorization.slice(0, 60)}...\n`);

// Step 4: Verify token via API
console.log("--- Step 3: Verify Token (as a platform would) ---");
const verifyRes = await fetch("http://localhost:3001/api/v1/verify", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ token: agent.getToken() }),
});
const verifyData = await verifyRes.json();
console.log(`   Status: ${verifyRes.status}`);
console.log(`   Response:`, JSON.stringify(verifyData, null, 2));

// Step 5: Check JWKS endpoint
console.log("\n--- Step 4: JWKS Discovery ---");
const jwksRes = await fetch("http://localhost:3001/.well-known/envoy-issuer");
const jwksData = await jwksRes.json();
console.log(`   Keys found: ${(jwksData as any).keys?.length ?? 0}`);
console.log(`   Key ID:     ${(jwksData as any).keys?.[0]?.kid ?? "none"}`);

// Step 6: Check revocation
console.log("\n--- Step 5: Revocation Check ---");
const manifest = agent.getManifest();
const tokenData = agent.getTokenData();
const revRes = await fetch(`http://localhost:3001/api/v1/revocations/${tokenData.manifestId}`);
const revData = await revRes.json();
console.log(`   Manifest ID: ${tokenData.manifestId}`);
console.log(`   Response:`, JSON.stringify(revData, null, 2));

// Step 7: Test loadToken (persistence simulation)
console.log("\n--- Step 6: Persistence (loadToken) ---");
const saved = agent.getTokenData();
const agent2 = new EnvoyAgent({
  envoyUrl: "http://localhost:3001",
  agentId: AGENT_ID,
});
agent2.loadToken(saved);
console.log(`   New instance isPaired: ${agent2.isPaired()}`);
console.log(`   New instance token matches: ${agent2.getToken() === agent.getToken()}`);
console.log(`   New instance scopes: ${agent2.getScopes().join(", ")}`);

console.log("\n=== ✅ E2E Test Complete! ===");
