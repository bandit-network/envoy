import { EnvoyAgent } from "@envoy/agent-sdk";

const TOKEN = "eyJhbGciOiJSUzI1NiIsImtpZCI6ImVudm95LWlzc3Vlci1kZXYtMSJ9.eyJhZ2VudF9uYW1lIjoiZmlyc3QtdGVzdC1ib3QiLCJhZ2VudF91c2VybmFtZSI6InRlc3QtYm90IiwiYWdlbnRfaWQiOiI3ZGE0Y2ZlYy0xOTY3LTRkNWQtOGIxYS1kYmM3NTkwNWI5ZTAiLCJvd25lcl9yZWYiOiIwNmY3ZjczNS0yN2U4LTQ2ZDMtOTIzMS1lOGQwOGIzZjlkMTMiLCJ3YWxsZXRfYWRkcmVzc2VzIjpbXSwic2NvcGVzIjpbImFwaV9hY2Nlc3MiLCJ0cmFkZSIsImRhdGFfcmVhZCIsIndyaXRlIl0sInBvbGljeV9yZWZzIjp7fSwiaXNzdWVkX2F0IjoiMjAyNi0wMy0wNFQxMToyMTo1My4wNjlaIiwiZXhwaXJlc19hdCI6IjIwMjYtMDMtMDRUMTI6MjE6NTMuMDY5WiIsImlhdCI6MTc3MjYyMzMxMywiZXhwIjoxNzcyNjI2OTEzfQ.FT0Y-YZpLjWGhkcJiFfHzxpFDVh1bBfLcqoG3IxfE1_ZXvhqaKH1GMWn-FoG3y1q1e9CXQJKjUUjQGHqELNLWVLzZ9DfvD4wU_UxlC12Oc52zCE0yCGP6HZaHzX5E3u2qPajgPMXNYHWNR8iuFUcTFH0kaxpuIFZ4FCkL6CmmVjACyopPFepAI5B3d_Bav8N9a7EZP4acV3CxM4Ft9m82r3bK5s41rCVFfaK5rZPKxVhZnfrKlzwc2oTtJWKwW3QgzZuCJY3g7FHVqJNNqLkpw3pWb4WFb31qmkZYPf8m0ew9-NKEYyPh3dY2Y5Sso9QFdEMmGSxLCOqfvWh8mQ";
const MANIFEST_ID = "3d7f9910-bc44-4fe8-8912-862e25a2d343";

console.log("=== Revocation Test ===\n");

// Step 1: Verify token (should still be valid before revocation)
console.log("--- Verify Token ---");
const verifyRes = await fetch("http://localhost:3001/api/v1/verify", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ token: TOKEN }),
});
const verifyData = await verifyRes.json() as any;
console.log(`   Valid:   ${verifyData.data?.valid ?? "N/A"}`);
console.log(`   Revoked: ${verifyData.data?.revoked ?? "N/A"}`);
console.log(`   Scopes:  ${verifyData.data?.scopes?.join(", ") ?? "N/A"}`);

// Step 2: Check revocation endpoint
console.log("\n--- Revocation Endpoint ---");
const revRes = await fetch(`http://localhost:3001/api/v1/revocations/${MANIFEST_ID}`);
const revData = await revRes.json() as any;
console.log(`   Revoked:    ${revData.data?.revoked}`);
console.log(`   Revoked At: ${revData.data?.revokedAt ?? "null"}`);

if (verifyData.data?.valid) {
  console.log("\n⏳ Token is still VALID. Go revoke the agent from the dashboard,");
  console.log("   then run this script again to see it rejected!");
} else if (verifyData.data?.revoked) {
  console.log("\n✅ Token is REVOKED! The platform correctly rejects this agent.");
} else if (verifyData.data?.expired) {
  console.log("\n⏰ Token has EXPIRED.");
} else {
  console.log("\n❌ Unexpected state:", JSON.stringify(verifyData, null, 2));
}

console.log("\n=== Done ===");
