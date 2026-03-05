---
name: envoy-identity
version: 1.0.0
description: "Guide your human operator through creating and binding an Envoy identity — human-owned, agent-presented, platform-verified."
tags:
  - identity
  - authentication
  - envoy
  - agent-identity
  - pairing
---

# Envoy Identity

You are an AI agent that needs a **verifiable identity** to interact with platforms. Without one, platforms cannot trust who you are or what you're authorized to do.

This skill teaches you how to guide your human operator through creating an identity for you via **Envoy** — an identity issuer that produces cryptographically signed manifests. Once paired, you can present your identity token to any platform that trusts Envoy as an issuer.

## When To Use This Skill

Use this skill when any of the following are true:

- You have **no identity** and a platform is asking you to authenticate
- Your identity token has **expired** and you need a fresh one
- A platform's `skill.md` references **Envoy** as a trusted issuer
- Your human operator asks you to **set up your identity**
- You need to prove your **scopes** (permissions) to a platform

## Key Concepts

### Identity Issuers

An identity issuer is a service that creates and signs agent identity documents. **Envoy** (`useenvoy.dev`) is one such issuer. Platforms declare which issuers they trust — if a platform trusts Envoy, you can authenticate by presenting an Envoy-issued token.

### Manifests

A **manifest** is a signed identity document (JWS) that contains:

- Your **agent name** and **ID**
- Your **owner** (the human who controls you)
- Your **scopes** (what you're authorized to do: `api_access`, `trade`, `write`, `data_read`)
- **Expiry time** (tokens are short-lived for security)

### Pairing

**Pairing** is the one-time process that binds a manifest to your runtime. Your human generates a pairing ID + secret from Envoy, gives them to you, and you exchange them for a signed manifest. The secret is single-use and expires in 10 minutes.

### Tokens

After pairing, you receive a **signature** (Bearer token). Include it in the `Authorization` header when making requests to platforms. Platforms verify the signature against Envoy's public keys.

## Step-by-Step: Guide Your Human

Follow these steps to acquire your identity. The process is streamlined — your human only needs to do **one thing** on the Envoy dashboard, and you handle the rest.

### Step 1: Create Your Agent Identity

Tell your human:

> "I need a verified identity to interact with platforms. Please go to the **Envoy dashboard** at `https://useenvoy.dev`, sign in, and click **Create New Agent**. Fill in a name for me and select the permissions I need. When you click Create, you'll immediately see a **pairing ID** and **secret** — please share both with me. That's all I need."

Your human fills in:

- **Name** — A recognizable name for you (e.g., "Trading Assistant")
- **Description** — What you do (optional but helpful)
- **Scopes** — The permissions you need. Common scopes:
  - `api_access` — Basic API authentication (always required)
  - `data_read` — Read data from platforms
  - `write` — Write/modify data on platforms
  - `trade` — Execute trades or financial operations

If you know which platform you'll be interacting with, check its `skill.md` for required scopes.

**When your human clicks "Create Agent", Envoy automatically generates pairing credentials and shows them immediately.** No extra steps needed.

### Step 2: Receive Pairing Credentials

Your human will provide you with just **two values** (shown right after agent creation):

- A **pairing ID** (UUID format)
- A **pairing secret** (64-character hex string)

You do **not** need the agent ID — Envoy resolves it automatically from the pairing record. The secret expires in 10 minutes and can only be used once.

### Step 3: Complete Pairing

Exchange the credentials for your signed manifest. The direct pair-confirm endpoint resolves your agent identity automatically — no agent ID needed:

```
POST <envoy-url>/api/v1/pair-confirm
Content-Type: application/json

{
  "pairingId": "<pairing-id-from-human>",
  "pairingSecret": "<secret-from-human>"
}
```

If you have `@envoy/agent-sdk` available:

```typescript
import { EnvoyAgent } from "@envoy/agent-sdk";

const agent = new EnvoyAgent({
  envoyUrl: "https://api.useenvoy.dev",
  onTokenReceived: (data) => {
    // Persist to disk or database for restarts
    saveTokenData(data);
  },
});

// Agent ID is resolved automatically from the pairing record
const tokenData = await agent.pair(pairingId, secret);
// agent.getAgentId() now returns the resolved agent ID
```

### Step 4: Store Your Identity

On success, you receive:

- `manifestId` — UUID of your manifest
- `manifestJson` — Your decoded identity (name, scopes, expiry)
- `signature` — Your Bearer token (signed JWS)
- `expiresAt` — When the token expires

**Store all four values securely.** You'll need them across restarts. If using the SDK, the `onTokenReceived` callback handles this. On next startup, restore with `agent.loadToken(savedData)`.

### Step 5: Confirm Success

Tell your human:

> "Pairing complete! I now have a verified identity as **[agent name]** with scopes: **[list scopes]**. My token expires at **[expiry time]**. I can now authenticate with platforms that trust Envoy."

## Presenting Your Identity

When a platform requires authentication, include your token in the request:

```
Authorization: Bearer <your-signature-token>
```

If using the SDK:

```typescript
const headers = agent.toAuthHeaders();
// Returns: { Authorization: "Bearer eyJ..." }
await fetch("https://platform.xyz/api/action", { headers });
```

Platforms verify your token by checking the signature against Envoy's public keys at:

```
GET <envoy-url>/.well-known/envoy-issuer
```

**Always check expiry before presenting your token.** If expired, refresh it yourself (see below).

## Platform Requirements

Platforms may enforce additional requirements beyond basic identity verification. When verifying your token, a platform can include its API key — Envoy then checks platform-specific requirements and returns actionable errors if they aren't met.

### On-Chain Identity

Some platforms require agents to have **on-chain identity** — a Solana wallet registered on the 8004 registry. If a platform requires this and your agent doesn't have it, verification will fail with error code `ONCHAIN_REQUIRED`.

**What to do when you see `ONCHAIN_REQUIRED`:**

Tell your human:

> "The platform I'm trying to authenticate with requires on-chain identity. Please go to my agent page on the Envoy dashboard and click **Register on 8004** to create my on-chain identity. Once registered, I can retry authentication."

The error response includes an `instructions` field with:
- `for_human` — what the human operator should do
- `for_agent` — what you should communicate
- `dashboardUrl` — direct link to the agent's page

After your human registers you on 8004, retry the same request. No re-pairing is needed — your existing token remains valid.

### How Platforms Enforce Requirements

When a platform verifies your token, it sends its API key along with the request:

```
POST <envoy-url>/api/v1/verify
Content-Type: application/json
X-API-Key: <platform-api-key>

{
  "token": "<your-token>"
}
```

Or included in the body:

```json
{
  "token": "<your-token>",
  "platformApiKey": "<platform-api-key>"
}
```

If the platform doesn't include its API key, requirement checks are skipped and only basic token validity is verified.

### Scope Requirements

Platforms may also require specific scopes. When your token is missing a required scope, the platform will reject your request. Check the platform's `skill.md` or documentation for required scopes before asking your human to create your agent identity.

## Token Refresh

Your token expires after a limited lifetime (typically 1 hour). **You can refresh it yourself** — no human intervention needed.

### Auto-Refresh (SDK)

If using `@envoy/agent-sdk`, enable auto-refresh and the SDK handles everything:

```typescript
const agent = new EnvoyAgent({
  envoyUrl: "https://api.useenvoy.dev",
  autoRefresh: true,           // Automatically refreshes before expiry
  refreshBeforeExpiry: 300,    // 5 minutes before expiry (default)
  onTokenReceived: (data) => saveToFile(data),
  onRefreshError: (err) => console.error("Refresh failed:", err),
});
```

### Manual Refresh (SDK)

```typescript
const newToken = await agent.refresh();
// Token data is updated in-place and onTokenReceived is called
```

### Manual Refresh (HTTP)

```
POST <envoy-url>/api/v1/token/refresh
Authorization: Bearer <your-current-token>
```

The server verifies your current token, revokes it, and issues a fresh one. There's a 5-minute grace period after expiry — so if you're slightly late, you can still recover.

### Status Check

You can check your own status at any time:

```typescript
const status = await agent.status();
// { agentId, agentName, status, tokenExpired, tokenRevoked, tokenExpiresAt, scopes }
```

Or via HTTP:
```
GET <envoy-url>/api/v1/token/status
Authorization: Bearer <your-current-token>
```

### When Refresh Fails

- **Token revoked**: Your human revoked your identity. Refresh is permanently blocked. You need a new identity.
- **Agent suspended/revoked**: Your human changed your agent status. Refresh is blocked until reactivated.
- **Expired beyond grace period**: More than 5 minutes past expiry. Ask your human to re-pair you.

## Handling Errors

### Pairing Secret Expired

The secret has a 10-minute TTL. If you see this error, ask your human to generate a new pairing from the Envoy dashboard.

### Invalid Pairing Secret

Secrets are single-use. If already consumed, your human needs to create a new pairing.

### Token Expired

Try `agent.refresh()` first — it works within a 5-minute grace window. If that fails, ask your human:

> "My identity token has expired beyond the grace period. Please go to my agent page on Envoy and generate a new pairing so I can re-authenticate."

### Agent Revoked

Your human (or Envoy) has revoked this agent identity. The token is permanently invalid. You'll need a completely new agent identity to be created.

### On-Chain Identity Required (`ONCHAIN_REQUIRED`)

The platform requires on-chain identity but your agent isn't registered on the 8004 Solana registry. Tell your human:

> "This platform requires on-chain identity. Please go to my agent page on the Envoy dashboard and click **Register on 8004** to create my on-chain identity. Once done, I can retry without re-pairing."

The error response includes an `instructions` object with specific guidance for both you and your human.

### Network Errors

If the Envoy API is unreachable, retry with exponential backoff. If the issue persists, inform your human that the identity service may be temporarily unavailable.

## API Reference

The API surface you need:

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/api/v1/pair-confirm` | POST | None (public) | Exchange pairing credentials for manifest (preferred — auto-resolves agent) |
| `/api/v1/token/refresh` | POST | Bearer token | Refresh your manifest token (agent self-service) |
| `/api/v1/token/status` | GET | Bearer token | Check your agent status and token validity |
| `/api/v1/agents/:id/pair-confirm` | POST | None (public) | Legacy: exchange pairing credentials with explicit agent ID |
| `/.well-known/envoy-issuer` | GET | None (public) | Issuer metadata + JWKS public keys |

### Pair-Confirm Request

```json
{
  "pairingId": "uuid-of-pairing",
  "pairingSecret": "64-char-hex-secret"
}
```

### Pair-Confirm Response (Success)

```json
{
  "success": true,
  "data": {
    "manifestId": "uuid-of-manifest",
    "manifestJson": {
      "agent_name": "My Agent",
      "agent_id": "uuid",
      "owner_ref": "user-id",
      "scopes": ["api_access", "data_read"],
      "issued_at": "2026-03-04T00:00:00.000Z",
      "expires_at": "2026-03-04T01:00:00.000Z"
    },
    "signature": "eyJhbGciOiJSUzI1NiJ9...",
    "expiresAt": "2026-03-04T01:00:00.000Z"
  }
}
```

### Pair-Confirm Response (Error)

```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Invalid pairing secret"
  }
}
```
