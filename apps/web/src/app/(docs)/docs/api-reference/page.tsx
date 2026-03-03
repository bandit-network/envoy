import {
  EndpointCard,
  CodeBlock,
  Section,
  Prose,
} from "@/components/docs/doc-layout";

export default function ApiReferencePage() {
  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-3xl font-bold text-foreground">API Reference</h1>
        <p className="mt-2 text-sm text-muted">
          Base URL: <code className="text-foreground">https://api.useenvoy.dev</code>
        </p>
        <p className="mt-1 text-sm text-muted">
          All responses follow the envelope format:{" "}
          <code className="text-foreground">{"{ success, data?, error? }"}</code>
        </p>
      </div>

      {/* Agents */}
      <Section id="agents" title="Agents">
        <Prose>
          <p>
            Agents are AI runtime identities owned by human operators.
            All agent endpoints require a Bearer token from Privy authentication.
          </p>
        </Prose>

        <div className="mt-4 space-y-4">
          <EndpointCard
            method="POST"
            path="/api/v1/agents"
            description="Create a new agent identity."
          >
            <CodeBlock title="Request">{`{
  "name": "My Trading Agent",
  "description": "Handles DeFi operations"
}`}</CodeBlock>
            <CodeBlock title="Response (201)">{`{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "My Trading Agent",
    "status": "active",
    "walletAddress": "0x...",
    "createdAt": "2026-03-01T..."
  }
}`}</CodeBlock>
          </EndpointCard>

          <EndpointCard
            method="GET"
            path="/api/v1/agents"
            description="List agents owned by the authenticated user. Supports ?status, ?limit, ?offset query params."
          />

          <EndpointCard
            method="GET"
            path="/api/v1/agents/:id"
            description="Get agent details including the latest active manifest."
          />

          <EndpointCard
            method="PATCH"
            path="/api/v1/agents/:id"
            description="Update agent metadata (name, description, status)."
          >
            <CodeBlock title="Request">{`{
  "name": "Updated Name",
  "description": "New description"
}`}</CodeBlock>
          </EndpointCard>

          <EndpointCard
            method="DELETE"
            path="/api/v1/agents/:id"
            description="Revoke an agent (soft delete). All active manifests are also revoked."
          />
        </div>
      </Section>

      {/* Manifests */}
      <Section id="manifests" title="Manifests">
        <Prose>
          <p>
            Manifests are signed identity tokens (JWTs) issued for agents.
            They contain the agent identity, scopes, wallet addresses, and expiry.
            Manifests are immutable -- to change, issue a new one and revoke the old.
          </p>
        </Prose>

        <div className="mt-4 space-y-4">
          <EndpointCard
            method="POST"
            path="/api/v1/agents/:id/manifest"
            description="Issue a new signed manifest for an agent. Returns the JWT token."
          >
            <CodeBlock title="Request (optional)">{`{
  "ttl": 3600  // TTL in seconds (max 86400)
}`}</CodeBlock>
            <CodeBlock title="Response (201)">{`{
  "success": true,
  "data": {
    "manifestId": "uuid",
    "signature": "eyJhbGciOiJSUzI1NiI...",
    "manifestJson": {
      "agent_name": "My Agent",
      "agent_id": "uuid",
      "owner_ref": "user-uuid",
      "wallet_addresses": ["0x..."],
      "scopes": ["api_access"],
      "issued_at": "...",
      "expires_at": "..."
    },
    "expiresAt": "2026-03-01T..."
  }
}`}</CodeBlock>
          </EndpointCard>

          <EndpointCard
            method="POST"
            path="/api/v1/agents/:id/refresh"
            description="Revoke the current manifest and issue a new one in a single operation."
          />
        </div>
      </Section>

      {/* Pairing */}
      <Section id="pairing" title="Pairing">
        <Prose>
          <p>
            Pairing securely connects an agent runtime to its identity.
            The human operator generates a pairing secret, shares it with the agent,
            and the agent confirms by presenting the secret. On success, a manifest is issued.
          </p>
        </Prose>

        <div className="mt-4 space-y-4">
          <EndpointCard
            method="POST"
            path="/api/v1/agents/:id/pair"
            description="Generate a one-time pairing secret (10 min TTL). Requires Bearer token."
          >
            <CodeBlock title="Response (201)">{`{
  "success": true,
  "data": {
    "pairingId": "uuid",
    "pairingSecret": "hex-string",
    "expiresAt": "2026-03-01T..."
  }
}`}</CodeBlock>
          </EndpointCard>

          <EndpointCard
            method="POST"
            path="/api/v1/agents/:id/pair-confirm"
            auth="None"
            description="Confirm pairing with the secret. No auth required (called by agent runtime)."
          >
            <CodeBlock title="Request">{`{
  "pairingId": "uuid",
  "pairingSecret": "hex-string"
}`}</CodeBlock>
          </EndpointCard>
        </div>
      </Section>

      {/* Platforms */}
      <Section id="platforms" title="Platforms">
        <Prose>
          <p>
            Platforms are services that verify agent identities. They register with Envoy,
            generate API keys, and use the SDK or verify endpoint to validate agent tokens.
          </p>
        </Prose>

        <div className="mt-4 space-y-4">
          <EndpointCard
            method="POST"
            path="/api/v1/platforms"
            description="Register a new platform."
          >
            <CodeBlock title="Request">{`{
  "name": "My DeFi Platform",
  "domain": "myplatform.com",
  "webhookUrl": "https://myplatform.com/webhook"
}`}</CodeBlock>
          </EndpointCard>

          <EndpointCard
            method="GET"
            path="/api/v1/platforms"
            description="List platforms owned by the authenticated user."
          />

          <EndpointCard
            method="POST"
            path="/api/v1/platforms/:id/api-keys"
            description="Generate a new API key for the platform. The full key is returned once."
          />

          <EndpointCard
            method="GET"
            path="/api/v1/platforms/:id/api-keys"
            description="List API keys for a platform (prefix only, never full key)."
          />

          <EndpointCard
            method="DELETE"
            path="/api/v1/platforms/:id/api-keys/:keyId"
            description="Revoke an API key."
          />
        </div>
      </Section>

      {/* Verification */}
      <Section id="verification" title="Verification">
        <div className="space-y-4">
          <EndpointCard
            method="POST"
            path="/api/v1/verify"
            auth="None"
            description="Verify an agent manifest token. Public endpoint for platforms."
          >
            <CodeBlock title="Request">{`{
  "token": "eyJhbGciOiJSUzI1NiI..."
}`}</CodeBlock>
            <CodeBlock title="Response (200)">{`{
  "success": true,
  "data": {
    "valid": true,
    "manifest": { ... },
    "scopes": ["api_access"],
    "revoked": false,
    "expired": false
  }
}`}</CodeBlock>
          </EndpointCard>

          <EndpointCard
            method="GET"
            path="/api/v1/revocations/:manifestId"
            auth="None"
            description="Check if a specific manifest has been revoked."
          />
        </div>
      </Section>

      {/* Webhooks */}
      <Section id="webhooks" title="Webhooks">
        <Prose>
          <p>
            Subscribe to real-time events. Webhook payloads are signed with HMAC-SHA256
            using the signing secret returned on subscription.
          </p>
        </Prose>

        <div className="mt-4 space-y-4">
          <EndpointCard
            method="POST"
            path="/api/v1/webhooks/subscribe"
            description="Create a webhook subscription. Returns signing secret once."
          >
            <CodeBlock title="Request">{`{
  "platformId": "uuid",
  "url": "https://myplatform.com/webhook",
  "eventTypes": ["manifest.revoked", "agent.revoked", "manifest.issued"]
}`}</CodeBlock>
          </EndpointCard>

          <EndpointCard
            method="GET"
            path="/api/v1/webhooks"
            description="List webhook subscriptions for the user's platforms."
          />

          <EndpointCard
            method="DELETE"
            path="/api/v1/webhooks/:id"
            description="Delete a webhook subscription."
          />
        </div>
      </Section>

      {/* Well-Known */}
      <Section id="well-known" title="Well-Known Endpoints">
        <div className="space-y-4">
          <EndpointCard
            method="GET"
            path="/.well-known/envoy-issuer"
            auth="None"
            description="JWKS endpoint serving the public signing key. Used by SDKs for offline verification."
          >
            <CodeBlock title="Response">{`{
  "issuer": "envoy",
  "keys": [{
    "kty": "RSA",
    "alg": "RS256",
    "kid": "key-1",
    "use": "sig",
    "n": "...",
    "e": "AQAB"
  }]
}`}</CodeBlock>
          </EndpointCard>

          <EndpointCard
            method="GET"
            path="/health"
            auth="None"
            description="Health check endpoint."
          />
        </div>
      </Section>
    </div>
  );
}
