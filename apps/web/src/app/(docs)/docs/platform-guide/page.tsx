import { CodeBlock, Section, Prose } from "@/components/docs/doc-layout";

export default function PlatformGuidePage() {
  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Platform Integration Guide</h1>
        <p className="mt-2 text-sm text-muted">
          Step-by-step guide for platforms to verify Envoy agent identities and subscribe to events.
        </p>
      </div>

      <Section id="overview" title="Overview">
        <Prose>
          <p>
            As a platform (relying party), you receive identity tokens from AI agents
            that claim to act on behalf of human operators. Envoy provides the infrastructure
            to <strong>verify these claims</strong> cryptographically and receive
            real-time <strong>revocation notifications</strong>.
          </p>
          <p>Integration takes four steps:</p>
          <ul>
            <li>Register your platform with Envoy</li>
            <li>Generate an API key</li>
            <li>Install the SDK and verify agent tokens</li>
            <li>Subscribe to webhook events</li>
          </ul>
        </Prose>
      </Section>

      <Section id="step-1" title="Step 1: Register Your Platform">
        <Prose>
          <p>
            Log in to the Envoy dashboard, navigate to <strong>Platforms</strong>, and
            register your platform with a name and domain. You can also do this via the API:
          </p>
        </Prose>

        <CodeBlock title="Register platform">{`curl -X POST https://api.useenvoy.dev/api/v1/platforms \\
  -H "Authorization: Bearer <your-token>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "My DeFi Platform",
    "domain": "myplatform.com",
    "webhookUrl": "https://myplatform.com/envoy/webhook"
  }'`}</CodeBlock>

        <div className="mt-3">
          <Prose>
            <p>
              Save the <code>id</code> from the response -- you will need it to generate API keys
              and subscribe to webhooks.
            </p>
          </Prose>
        </div>
      </Section>

      <Section id="step-2" title="Step 2: Generate an API Key">
        <Prose>
          <p>
            API keys let you authenticate with Envoy for platform-specific operations.
            The full key is shown <strong>exactly once</strong>, so store it securely.
          </p>
        </Prose>

        <CodeBlock title="Generate API key">{`curl -X POST https://api.useenvoy.dev/api/v1/platforms/<platformId>/api-keys \\
  -H "Authorization: Bearer <your-token>" \\
  -H "Content-Type: application/json" \\
  -d '{ "label": "production" }'

# Response:
# {
#   "data": {
#     "keyId": "uuid",
#     "key": "envk_a1b2c3d4e5f6...",     <-- store this securely
#     "keyPrefix": "envk_a1b2c3d4",
#     "label": "production"
#   }
# }`}</CodeBlock>
      </Section>

      <Section id="step-3" title="Step 3: Install SDK & Verify Tokens">
        <Prose>
          <p>
            Install the <code>@envoy/sdk</code> package and verify agent tokens in your
            API middleware or request handlers.
          </p>
        </Prose>

        <CodeBlock title="Install">{`npm install @envoy/sdk
# or
bun add @envoy/sdk`}</CodeBlock>

        <CodeBlock title="Verify agent tokens">{`import { EnvoyVerifier } from "@envoy/sdk";

const verifier = new EnvoyVerifier({
  issuerUrl: "https://api.useenvoy.dev",
});

// In your API middleware:
async function verifyAgent(req) {
  const token = req.headers.get("X-Agent-Token");

  if (!token) {
    return new Response("Missing agent token", { status: 401 });
  }

  const result = await verifier.verify(token);

  if (!result.valid) {
    return new Response(result.error, { status: 401 });
  }

  // Token is valid! Access the agent identity:
  console.log("Agent:", result.manifest.agent_name);
  console.log("Agent ID:", result.manifest.agent_id);
  console.log("Scopes:", result.scopes);
  console.log("Wallets:", result.manifest.wallet_addresses);

  // Proceed with the request...
}`}</CodeBlock>

        <div className="mt-3">
          <Prose>
            <p>
              The <code>verify()</code> method performs three checks:
            </p>
            <ul>
              <li>Validates the JWT signature using Envoy&apos;s JWKS (RS256)</li>
              <li>Checks expiry (tokens have a max 24-hour TTL)</li>
              <li>Checks revocation status via the Envoy API</li>
            </ul>
            <p>
              For low-latency use cases, use <code>verifyOffline()</code> which skips the
              revocation check. See the <a href="/docs/sdk" className="text-accent hover:underline">SDK reference</a>.
            </p>
          </Prose>
        </div>
      </Section>

      <Section id="step-4" title="Step 4: Subscribe to Webhooks">
        <Prose>
          <p>
            Subscribe to webhook events to receive real-time notifications when manifests or
            agents are revoked. This enables you to immediately invalidate cached tokens.
          </p>
        </Prose>

        <CodeBlock title="Subscribe to events">{`curl -X POST https://api.useenvoy.dev/api/v1/webhooks/subscribe \\
  -H "Authorization: Bearer <your-token>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "platformId": "<your-platform-id>",
    "url": "https://myplatform.com/envoy/webhook",
    "eventTypes": ["manifest.revoked", "agent.revoked", "manifest.issued"]
  }'

# Response includes a signing secret (shown once):
# "signingSecret": "whsec_abc123..."`}</CodeBlock>

        <CodeBlock title="Verify webhook signatures">{`import { createHmac } from "crypto";

function verifyWebhookSignature(body, signature, secret) {
  const expected = createHmac("sha256", secret)
    .update(body)
    .digest("hex");

  return \`sha256=\${expected}\` === signature;
}

// In your webhook handler:
app.post("/envoy/webhook", (req, res) => {
  const signature = req.headers["x-envoy-signature"];
  const body = JSON.stringify(req.body);

  if (!verifyWebhookSignature(body, signature, WEBHOOK_SECRET)) {
    return res.status(401).send("Invalid signature");
  }

  const { type, data, timestamp } = req.body;

  switch (type) {
    case "manifest.revoked":
      // Invalidate cached token for data.manifestId
      break;
    case "agent.revoked":
      // Block all tokens for data.agentId
      break;
    case "manifest.issued":
      // Optionally log new manifest issuance
      break;
  }

  res.status(200).send("OK");
});`}</CodeBlock>
      </Section>

      <Section id="events" title="Webhook Event Types">
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface">
                <th className="px-4 py-2 text-left font-medium text-foreground">Event</th>
                <th className="px-4 py-2 text-left font-medium text-foreground">Description</th>
                <th className="px-4 py-2 text-left font-medium text-foreground">Data</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-border">
                <td className="px-4 py-2 font-mono text-xs text-foreground">manifest.revoked</td>
                <td className="px-4 py-2 text-muted">A manifest token was revoked</td>
                <td className="px-4 py-2 font-mono text-xs text-muted">manifestId, reason</td>
              </tr>
              <tr className="border-b border-border">
                <td className="px-4 py-2 font-mono text-xs text-foreground">agent.revoked</td>
                <td className="px-4 py-2 text-muted">An agent identity was revoked</td>
                <td className="px-4 py-2 font-mono text-xs text-muted">agentId, agentName</td>
              </tr>
              <tr>
                <td className="px-4 py-2 font-mono text-xs text-foreground">manifest.issued</td>
                <td className="px-4 py-2 text-muted">A new manifest was issued</td>
                <td className="px-4 py-2 font-mono text-xs text-muted">manifestId, agentId, expiresAt</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
}
