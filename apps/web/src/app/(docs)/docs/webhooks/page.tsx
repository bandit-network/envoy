import { CodeBlock, Section, Prose, EndpointCard } from "@/components/docs/doc-layout";

export default function WebhooksPage() {
  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Webhooks</h1>
        <p className="mt-2 text-sm text-muted">
          Real-time event notifications for platforms. Subscribe to agent lifecycle
          events and receive signed webhook payloads.
        </p>
      </div>

      <Section id="overview" title="Overview">
        <Prose>
          <p>
            Envoy sends webhook notifications to platforms when important events
            occur — agent revocation, manifest issuance, and more. This enables
            platforms to react in real-time rather than polling for changes.
          </p>
          <p>
            Webhooks are delivered with <strong>at-least-once</strong> semantics
            and include HMAC-SHA256 signatures for authenticity verification.
          </p>
        </Prose>
      </Section>

      <Section id="subscribing" title="Subscribing to Webhooks">
        <EndpointCard
          method="POST"
          path="/api/v1/webhooks/subscribe"
          auth="API Key"
          description="Register a webhook endpoint to receive event notifications."
        >
          <CodeBlock title="Request">{`{
  "url": "https://your-platform.com/webhooks/envoy",
  "events": ["agent.revoked", "manifest.issued"],
  "secret": "your-webhook-signing-secret"
}`}</CodeBlock>

          <CodeBlock title="Response">{`{
  "success": true,
  "data": {
    "id": "wh_abc123",
    "url": "https://your-platform.com/webhooks/envoy",
    "events": ["agent.revoked", "manifest.issued"],
    "createdAt": "2025-03-01T10:00:00Z"
  }
}`}</CodeBlock>
        </EndpointCard>
      </Section>

      <Section id="events" title="Event Types">
        <Prose>
          <p>Available webhook event types:</p>
        </Prose>

        <div className="space-y-3">
          <div className="rounded-lg border border-border bg-surface p-4">
            <div className="flex items-center gap-2">
              <code className="rounded bg-red-500/20 px-2 py-0.5 text-xs font-medium text-red-400">agent.revoked</code>
            </div>
            <p className="mt-2 text-sm text-muted">
              Fired when an agent is revoked by its owner. All active manifests
              are also revoked. Platforms should immediately invalidate any cached
              tokens for this agent.
            </p>
            <CodeBlock title="Payload">{`{
  "type": "agent.revoked",
  "timestamp": "2025-03-01T12:00:00Z",
  "data": {
    "agentId": "uuid",
    "agentName": "My Agent"
  }
}`}</CodeBlock>
          </div>

          <div className="rounded-lg border border-border bg-surface p-4">
            <div className="flex items-center gap-2">
              <code className="rounded bg-blue-500/20 px-2 py-0.5 text-xs font-medium text-blue-400">manifest.issued</code>
            </div>
            <p className="mt-2 text-sm text-muted">
              Fired when a new manifest is issued for an agent. Useful for
              tracking agent lifecycle events.
            </p>
            <CodeBlock title="Payload">{`{
  "type": "manifest.issued",
  "timestamp": "2025-03-01T12:00:00Z",
  "data": {
    "agentId": "uuid",
    "manifestId": "uuid",
    "expiresAt": "2025-03-02T12:00:00Z"
  }
}`}</CodeBlock>
          </div>

          <div className="rounded-lg border border-border bg-surface p-4">
            <div className="flex items-center gap-2">
              <code className="rounded bg-amber-500/20 px-2 py-0.5 text-xs font-medium text-amber-400">manifest.expiring</code>
            </div>
            <p className="mt-2 text-sm text-muted">
              Fired when a manifest is approaching expiry (15 minutes before).
              Useful for alerting operators to refresh tokens.
            </p>
          </div>
        </div>
      </Section>

      <Section id="verification" title="Signature Verification">
        <Prose>
          <p>
            Every webhook payload is signed with <strong>HMAC-SHA256</strong> using
            the secret you provided during subscription. The signature is sent in
            the <code>X-Envoy-Signature</code> header.
          </p>
        </Prose>

        <CodeBlock title="Verifying webhook signatures (Node.js)">{`import crypto from "crypto";

function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expected = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex");

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  );
}

// In your webhook handler:
app.post("/webhooks/envoy", (req, res) => {
  const signature = req.headers["x-envoy-signature"];
  const body = JSON.stringify(req.body);

  if (!verifyWebhookSignature(body, signature, WEBHOOK_SECRET)) {
    return res.status(401).json({ error: "Invalid signature" });
  }

  // Process the event
  const { type, data } = req.body;

  switch (type) {
    case "agent.revoked":
      // Invalidate cached tokens for this agent
      invalidateAgent(data.agentId);
      break;
    case "manifest.issued":
      // Log or track new manifest
      break;
  }

  res.status(200).json({ received: true });
});`}</CodeBlock>
      </Section>

      <Section id="retry-policy" title="Retry Policy">
        <Prose>
          <p>
            Envoy uses an exponential backoff retry policy for failed webhook
            deliveries:
          </p>
          <ul>
            <li><strong>Max retries:</strong> 5 attempts</li>
            <li><strong>Backoff:</strong> 30s, 2m, 10m, 30m, 1h</li>
            <li><strong>Success:</strong> HTTP 2xx response within 10 seconds</li>
            <li><strong>Failure:</strong> Any non-2xx response, timeout, or connection error</li>
          </ul>
          <p>
            After all retries are exhausted, the webhook delivery is marked as
            failed. Failed deliveries can be inspected via the audit log.
          </p>
        </Prose>
      </Section>

      <Section id="best-practices" title="Best Practices">
        <Prose>
          <ul>
            <li><strong>Respond quickly</strong> — return a 200 response within 10 seconds. Process events asynchronously if needed.</li>
            <li><strong>Idempotency</strong> — webhooks may be delivered more than once. Use event IDs to deduplicate.</li>
            <li><strong>Always verify signatures</strong> — never process unsigned or incorrectly signed payloads.</li>
            <li><strong>Use HTTPS</strong> — webhook URLs must use HTTPS in production.</li>
            <li><strong>Monitor failures</strong> — check the audit log for failed webhook deliveries and fix endpoint issues promptly.</li>
          </ul>
        </Prose>
      </Section>
    </div>
  );
}
