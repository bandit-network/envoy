import { CodeBlock, Section, Prose, EndpointCard } from "@/components/docs/doc-layout";

export default function AgentSdkPage() {
  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Agent SDK</h1>
        <p className="mt-2 text-sm text-muted">
          Integration guide for AI agent runtimes. Learn how agents pair with
          Envoy, receive identity manifests, and present tokens to platforms.
        </p>
      </div>

      <Section id="overview" title="Overview">
        <Prose>
          <p>
            An AI agent runtime integrates with Envoy in three steps:
          </p>
          <ul>
            <li><strong>Pair</strong> — Use a one-time pairing secret to link the runtime to an Envoy identity.</li>
            <li><strong>Receive</strong> — Get a signed manifest (JWT) that proves the agent&apos;s identity.</li>
            <li><strong>Present</strong> — Send the token to platforms in the <code>X-Agent-Token</code> header.</li>
          </ul>
        </Prose>
      </Section>

      <Section id="pairing" title="Pairing Flow">
        <Prose>
          <p>
            The human operator creates a pairing secret from the dashboard. The agent runtime
            receives this secret (typically via environment variable or secure config) and confirms
            the pairing via the API.
          </p>
          <p>
            Pairing secrets are <strong>single-use</strong> and expire after <strong>10 minutes</strong>.
          </p>
        </Prose>

        <EndpointCard
          method="POST"
          path="/api/v1/pair-confirm"
          auth="None"
          description="Confirm a pairing and receive a signed manifest."
        >
          <CodeBlock title="Request">{`{
  "pairingId": "uuid-from-dashboard",
  "secret": "the-pairing-secret"
}`}</CodeBlock>

          <CodeBlock title="Response">{`{
  "success": true,
  "data": {
    "manifest": "eyJhbGciOiJSUzI1NiIs...",
    "expiresAt": "2025-04-01T12:00:00Z"
  }
}`}</CodeBlock>
        </EndpointCard>

        <CodeBlock title="Agent pairing example">{`async function pairWithEnvoy(envoyUrl, pairingId, secret) {
  const res = await fetch(\`\${envoyUrl}/api/v1/pair-confirm\`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pairingId, secret }),
  });

  const { data } = await res.json();

  // Store the manifest securely
  process.env.ENVOY_TOKEN = data.manifest;

  console.log("Paired! Token expires at:", data.expiresAt);
}`}</CodeBlock>
      </Section>

      <Section id="token-refresh" title="Token Refresh">
        <Prose>
          <p>
            Manifests have a configurable TTL (default: 1 hour, max: 24 hours).
            Before expiry, the agent runtime should refresh its token to maintain
            uninterrupted access.
          </p>
        </Prose>

        <EndpointCard
          method="POST"
          path="/api/v1/token/refresh"
          auth="None"
          description="Exchange a valid manifest for a new one with a fresh expiry."
        >
          <CodeBlock title="Request">{`{
  "token": "eyJhbGciOiJSUzI1NiIs..."
}`}</CodeBlock>

          <CodeBlock title="Response">{`{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJSUzI1NiIs...",
    "expiresAt": "2025-04-01T13:00:00Z"
  }
}`}</CodeBlock>
        </EndpointCard>

        <CodeBlock title="Auto-refresh pattern">{`class EnvoyIdentity {
  private token: string;
  private expiresAt: Date;
  private refreshTimer?: NodeJS.Timeout;

  constructor(token: string, expiresAt: string) {
    this.token = token;
    this.expiresAt = new Date(expiresAt);
    this.scheduleRefresh();
  }

  private scheduleRefresh() {
    // Refresh 5 minutes before expiry
    const ms = this.expiresAt.getTime() - Date.now() - 5 * 60 * 1000;
    if (ms > 0) {
      this.refreshTimer = setTimeout(() => this.refresh(), ms);
    }
  }

  private async refresh() {
    const res = await fetch(ENVOY_URL + "/api/v1/token/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: this.token }),
    });
    const { data } = await res.json();
    this.token = data.token;
    this.expiresAt = new Date(data.expiresAt);
    this.scheduleRefresh();
  }

  getToken() { return this.token; }
}`}</CodeBlock>
      </Section>

      <Section id="presenting-tokens" title="Presenting Tokens">
        <Prose>
          <p>
            When the agent makes requests to platforms, it includes the Envoy
            manifest token in the <code>X-Agent-Token</code> header. The platform
            verifies this token using the Envoy SDK or the verify API.
          </p>
        </Prose>

        <CodeBlock>{`// Making a request to a platform
const response = await fetch("https://platform.example.com/api/data", {
  headers: {
    "X-Agent-Token": envoyIdentity.getToken(),
    "Content-Type": "application/json",
  },
});`}</CodeBlock>
      </Section>

      <Section id="token-status" title="Token Status">
        <Prose>
          <p>
            Agents can check the status of their token (valid, expired, revoked)
            without requiring authentication.
          </p>
        </Prose>

        <EndpointCard
          method="POST"
          path="/api/v1/token/status"
          auth="None"
          description="Check the current status of a manifest token."
        >
          <CodeBlock title="Request">{`{
  "token": "eyJhbGciOiJSUzI1NiIs..."
}`}</CodeBlock>

          <CodeBlock title="Response">{`{
  "success": true,
  "data": {
    "valid": true,
    "expired": false,
    "revoked": false,
    "expiresAt": "2025-04-01T13:00:00Z",
    "agentName": "My Agent",
    "scopes": ["api_access"]
  }
}`}</CodeBlock>
        </EndpointCard>
      </Section>

      <Section id="security" title="Security Best Practices">
        <Prose>
          <ul>
            <li><strong>Never expose pairing secrets</strong> — they are single-use, but should still be treated as sensitive credentials.</li>
            <li><strong>Store tokens securely</strong> — use environment variables or secure key stores, never commit tokens to source control.</li>
            <li><strong>Implement auto-refresh</strong> — refresh tokens before they expire to avoid service interruption.</li>
            <li><strong>Handle revocation gracefully</strong> — if a token is revoked, the agent should stop making requests and notify the operator.</li>
            <li><strong>Use HTTPS only</strong> — all Envoy API requests must use HTTPS in production.</li>
          </ul>
        </Prose>
      </Section>
    </div>
  );
}
