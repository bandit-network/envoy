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

Follow these steps to acquire your identity. Communicate each step clearly to your human operator.

### Step 1: Create Your Agent Identity

Tell your human:

> "I need a verified identity to interact with platforms. Please create an agent identity for me. You can do this either:
>
> - On the **Envoy dashboard** at `https://useenvoy.dev` — sign in, go to Agents, and click Create New Agent
> - Through the **platform's own UI** if it integrates Envoy's agent creation flow"

### Step 2: Configure Agent Details

Ask your human to fill in:

- **Name** — A recognizable name for you (e.g., "Trading Assistant")
- **Description** — What you do (optional but helpful)
- **Scopes** — The permissions you need. Common scopes:
  - `api_access` — Basic API authentication (always required)
  - `data_read` — Read data from platforms
  - `write` — Write/modify data on platforms
  - `trade` — Execute trades or financial operations

If you know which platform you'll be interacting with, check its `skill.md` for required scopes.

### Step 3: Initiate Pairing

Tell your human:

> "Now I need you to generate pairing credentials. Go to your agent's detail page on Envoy (or the platform's UI) and click **Pair**. You'll receive a **pairing ID** and a **secret**. Please share both with me — the secret expires in 10 minutes and can only be used once."

### Step 4: Receive Pairing Credentials

Your human will provide you with:

- A **pairing ID** (UUID format)
- A **pairing secret** (64-character hex string)

### Step 5: Complete Pairing

Exchange the credentials for your signed manifest by calling the Envoy pair-confirm API:

```
POST <envoy-url>/api/v1/agents/<your-agent-id>/pair-confirm
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
  agentId: "<your-agent-id>",
  onTokenReceived: (data) => {
    // Persist to disk or database for restarts
    saveTokenData(data);
  },
});

const tokenData = await agent.pair(pairingId, secret);
```

### Step 6: Store Your Identity

On success, you receive:

- `manifestId` — UUID of your manifest
- `manifestJson` — Your decoded identity (name, scopes, expiry)
- `signature` — Your Bearer token (signed JWS)
- `expiresAt` — When the token expires

**Store all four values securely.** You'll need them across restarts. If using the SDK, the `onTokenReceived` callback handles this. On next startup, restore with `agent.loadToken(savedData)`.

### Step 7: Confirm Success

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

**Always check expiry before presenting your token.** If expired, you'll need your human to refresh it.

## Handling Errors

### Pairing Secret Expired

The secret has a 10-minute TTL. If you see this error, ask your human to generate a new pairing from the Envoy dashboard.

### Invalid Pairing Secret

Secrets are single-use. If already consumed, your human needs to create a new pairing.

### Token Expired

Your manifest token has a limited lifetime (typically 1-24 hours). Ask your human:

> "My identity token has expired. Please go to my agent page on Envoy and click **Refresh** to issue a new manifest. Then we'll need to pair again."

### Agent Revoked

Your human (or Envoy) has revoked this agent identity. The token is permanently invalid. You'll need a completely new agent identity to be created.

### Network Errors

If the Envoy API is unreachable, retry with exponential backoff. If the issue persists, inform your human that the identity service may be temporarily unavailable.

## API Reference

The minimal API surface you need:

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/api/v1/agents/:id/pair-confirm` | POST | None (public) | Exchange pairing credentials for manifest |
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
