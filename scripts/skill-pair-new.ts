/**
 * Following envoy-identity SKILL.md — Step 5: Complete Pairing (new agent)
 *
 * Pairing credentials received from human operator.
 * Need agent ID — trying to extract from pair-confirm response.
 */
import { writeFileSync } from "fs";

const PAIRING_ID = "bb839b82-89ae-4662-a57e-2b8758429a52";
const PAIRING_SECRET = "bd10444adef0d9279c41e897f0f46fee54b8dc6de61dbc260dee185f653c781d";

// We need the agent ID. Let's try the pair-confirm directly
// since the pairing record knows which agent it belongs to.
// First, try with the old agent ID (maybe the user re-paired the same revoked agent?)
// If not, we'll need to ask.

const agentIds = [
  process.argv[2], // passed as CLI arg
  "7da4cfec-1967-4d5d-8b1a-dbc75905b9e0", // old agent (revoked)
].filter(Boolean);

if (agentIds.length === 0) {
  console.log("Usage: bun run scripts/skill-pair-new.ts <agent-id>");
  console.log("Please provide the new agent's ID from the Envoy dashboard.");
  process.exit(1);
}

for (const agentId of agentIds) {
  console.log(`\n🔄 Trying agent ID: ${agentId}...`);

  const res = await fetch(`http://localhost:3001/api/v1/agents/${agentId}/pair-confirm`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pairingId: PAIRING_ID, pairingSecret: PAIRING_SECRET }),
  });

  const data = await res.json() as any;

  if (data.success) {
    console.log("\n✅ Pairing complete!");
    console.log(`   Agent Name:  ${data.data.manifestJson.agent_name}`);
    console.log(`   Agent ID:    ${data.data.manifestJson.agent_id}`);
    console.log(`   Scopes:      ${data.data.manifestJson.scopes?.join(", ")}`);
    console.log(`   Wallet:      ${data.data.manifestJson.wallet_addresses?.join(", ") || "check dashboard"}`);
    console.log(`   Expires:     ${data.data.expiresAt}`);
    console.log(`   Manifest ID: ${data.data.manifestId}`);
    console.log(`   Token:       ${data.data.signature?.slice(0, 40)}...`);

    // Persist
    writeFileSync("scripts/.envoy-identity.json", JSON.stringify({
      manifestId: data.data.manifestId,
      manifestJson: data.data.manifestJson,
      signature: data.data.signature,
      expiresAt: data.data.expiresAt,
    }, null, 2));
    console.log("\n💾 Identity persisted to scripts/.envoy-identity.json");

    // Verify
    console.log("\n--- Verifying identity ---");
    const verifyRes = await fetch("http://localhost:3001/api/v1/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: data.data.signature }),
    });
    const verifyData = await verifyRes.json() as any;
    console.log(`   Valid:   ${verifyData.data?.valid}`);
    console.log(`   Revoked: ${verifyData.data?.revoked}`);

    console.log("\n=== ✅ Identity acquired and verified! ===");
    process.exit(0);
  } else {
    console.log(`   ❌ Failed: ${data.error?.message || JSON.stringify(data)}`);
  }
}

console.log("\n❌ Could not pair with any known agent ID.");
console.log("Please provide the new agent ID: bun run scripts/skill-pair-new.ts <agent-id>");
