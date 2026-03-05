import { CodeBlock, Section, Prose } from "@/components/docs/doc-layout";

export default function SdkPage() {
  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-3xl font-bold text-foreground">SDK Reference</h1>
        <p className="mt-2 text-sm text-muted">
          TypeScript SDK for verifying Envoy agent tokens in your platform.
        </p>
      </div>

      <Section id="installation" title="Installation">
        <CodeBlock>{`npm install @envoy/sdk
# or
bun add @envoy/sdk
# or
yarn add @envoy/sdk`}</CodeBlock>
      </Section>

      <Section id="quick-start" title="Quick Start">
        <CodeBlock>{`import { EnvoyVerifier } from "@envoy/sdk";

const verifier = new EnvoyVerifier({
  issuerUrl: "https://api.useenvoy.dev",
});

// Verify a token (online: signature + expiry + revocation)
const result = await verifier.verify(token);

if (result.valid) {
  console.log("Agent:", result.manifest.agent_name);
  console.log("Scopes:", result.scopes);
} else {
  console.log("Invalid:", result.error);
}`}</CodeBlock>
      </Section>

      <Section id="constructor" title="Constructor">
        <Prose>
          <p>
            Create an <code>EnvoyVerifier</code> instance with configuration options.
          </p>
        </Prose>

        <CodeBlock title="EnvoyVerifierOptions">{`interface EnvoyVerifierOptions {
  // Base URL of the Envoy API
  issuerUrl: string;

  // Optional: custom fetch implementation
  // Defaults to globalThis.fetch
  fetch?: typeof globalThis.fetch;
}

// Example:
const verifier = new EnvoyVerifier({
  issuerUrl: "https://api.useenvoy.dev",
  fetch: customFetch, // optional
});`}</CodeBlock>
      </Section>

      <Section id="verify" title="verify(token)">
        <Prose>
          <p>
            Full online verification. Validates the JWT signature against Envoy&apos;s JWKS,
            checks expiry, and makes an API call to check revocation status.
          </p>
          <p>
            <strong>Use this</strong> when you need the strongest guarantee that a token
            is valid and has not been revoked.
          </p>
        </Prose>

        <CodeBlock>{`const result = await verifier.verify(token);

// result: VerificationResult
// {
//   valid: boolean,
//   manifest: ManifestPayload | null,
//   expired: boolean,
//   revoked: boolean,
//   scopes: string[],
//   error?: string
// }`}</CodeBlock>

        <div className="mt-3 rounded-lg border border-border bg-surface p-3">
          <p className="text-xs text-muted">
            <strong className="text-foreground">Fallback behavior:</strong>{" "}
            If the revocation check fails (network error), the SDK falls back to the offline
            result and logs a warning. This means a revoked token may be accepted temporarily
            during network issues.
          </p>
        </div>
      </Section>

      <Section id="verify-offline" title="verifyOffline(token)">
        <Prose>
          <p>
            Offline verification. Validates the JWT signature and expiry only,
            <strong> without checking revocation status</strong>. Faster than <code>verify()</code>
            since it avoids an API call.
          </p>
          <p>
            <strong>Use this</strong> for low-latency verification where revocation is
            checked separately or periodically.
          </p>
        </Prose>

        <CodeBlock>{`const result = await verifier.verifyOffline(token);

// Same return type as verify()
// result.revoked is always false (not checked)`}</CodeBlock>
      </Section>

      <Section id="reset-keys" title="resetKeys()">
        <Prose>
          <p>
            Invalidates the cached JWKS. Call this if you suspect key rotation has occurred
            and the SDK is using stale keys. The next verification call will fetch fresh keys.
          </p>
        </Prose>

        <CodeBlock>{`verifier.resetKeys();`}</CodeBlock>
      </Section>

      <Section id="types" title="Types">
        <CodeBlock title="ManifestPayload">{`interface ManifestPayload {
  agent_name: string;        // Display name of the agent
  agent_id: string;          // UUID of the agent
  owner_ref: string;         // UUID of the human operator
  wallet_addresses: string[]; // Provisioned wallet addresses
  scopes: string[];          // Granted permission scopes
  policy_refs: Record<string, string>;
  issued_at: string;         // ISO 8601 datetime
  expires_at: string;        // ISO 8601 datetime
}`}</CodeBlock>

        <CodeBlock title="VerificationResult">{`interface VerificationResult {
  // Whether the token is valid
  valid: boolean;

  // Decoded manifest, or null if signature failed
  manifest: ManifestPayload | null;

  // Whether the token has expired
  expired: boolean;

  // Whether the token has been revoked (online only)
  revoked: boolean;

  // Scopes from the manifest
  scopes: string[];

  // Error message if not valid
  error?: string;
}`}</CodeBlock>
      </Section>

      <Section id="error-handling" title="Error Handling">
        <Prose>
          <p>
            The SDK never throws exceptions from <code>verify()</code> or{" "}
            <code>verifyOffline()</code>. Instead, errors are returned in the result object:
          </p>
        </Prose>

        <CodeBlock>{`const result = await verifier.verify(token);

if (!result.valid) {
  if (result.expired) {
    // Token TTL exceeded - agent should refresh
    console.log("Token expired");
  } else if (result.revoked) {
    // Token explicitly revoked by operator
    console.log("Token revoked");
  } else {
    // Signature invalid or malformed
    console.log("Invalid token:", result.error);
  }
}`}</CodeBlock>
      </Section>

      <Section id="examples" title="Framework Examples">
        <CodeBlock title="Express middleware">{`import { EnvoyVerifier } from "@envoy/sdk";

const verifier = new EnvoyVerifier({
  issuerUrl: "https://api.useenvoy.dev",
});

function requireAgent(req, res, next) {
  const token = req.headers["x-agent-token"];

  if (!token) {
    return res.status(401).json({ error: "Missing agent token" });
  }

  verifier.verify(token).then((result) => {
    if (!result.valid) {
      return res.status(401).json({ error: result.error });
    }

    req.agent = result.manifest;
    req.scopes = result.scopes;
    next();
  });
}

app.get("/api/data", requireAgent, (req, res) => {
  res.json({ agent: req.agent.agent_name });
});`}</CodeBlock>

        <CodeBlock title="Hono middleware">{`import { EnvoyVerifier } from "@envoy/sdk";
import { Hono } from "hono";

const verifier = new EnvoyVerifier({
  issuerUrl: "https://api.useenvoy.dev",
});

const app = new Hono();

app.use("/api/*", async (c, next) => {
  const token = c.req.header("X-Agent-Token");

  if (!token) {
    return c.json({ error: "Missing agent token" }, 401);
  }

  const result = await verifier.verify(token);

  if (!result.valid) {
    return c.json({ error: result.error }, 401);
  }

  c.set("agent", result.manifest);
  await next();
});`}</CodeBlock>
      </Section>
    </div>
  );
}
