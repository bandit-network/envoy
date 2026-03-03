import { CodeBlock, Section, Prose } from "@/components/docs/doc-layout";

export default function AuthenticationPage() {
  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Authentication</h1>
        <p className="mt-2 text-sm text-muted">
          How authentication works in Envoy for human operators, agent runtimes, and platforms.
        </p>
      </div>

      <Section id="overview" title="Overview">
        <Prose>
          <p>
            Envoy delegates all human authentication to <strong>Privy</strong>. When a user
            logs in through the Envoy dashboard, Privy handles the login flow (email, social,
            wallet) and returns a signed JWT. The Envoy API validates this JWT on every request
            using the Privy server SDK.
          </p>
          <p>
            There are three types of authentication depending on who is calling the API:
          </p>
          <ul>
            <li><strong>Human operators</strong> use Privy Bearer tokens</li>
            <li><strong>Agent runtimes</strong> use pairing secrets (one-time, no auth)</li>
            <li><strong>Platforms</strong> use API keys or the public verify endpoint</li>
          </ul>
        </Prose>
      </Section>

      <Section id="bearer-tokens" title="Bearer Tokens (Human Operators)">
        <Prose>
          <p>
            Most API endpoints require a Bearer token in the Authorization header. This token
            is obtained from Privy after the user logs in via the dashboard.
          </p>
        </Prose>

        <CodeBlock title="Authenticated request">{`curl -X GET https://api.useenvoy.dev/api/v1/agents \\
  -H "Authorization: Bearer <privy-jwt-token>" \\
  -H "Content-Type: application/json"`}</CodeBlock>

        <div className="mt-4">
          <Prose>
            <p>
              The API middleware extracts the token, verifies it with Privy&apos;s server SDK,
              and injects the authenticated user into the request context. If the token is
              invalid or expired, the API returns a <code>401 Unauthorized</code> response.
            </p>
          </Prose>
        </div>
      </Section>

      <Section id="token-lifecycle" title="Token Lifecycle">
        <Prose>
          <p>
            Privy JWTs have a short lifespan (typically 1 hour). The Privy client SDK
            handles automatic token refresh in the background. When making API calls from
            the dashboard, the <code>useAuthFetch</code> hook ensures a fresh token is
            attached to every request.
          </p>
        </Prose>

        <CodeBlock title="Dashboard flow">{`// 1. User logs in via Privy (handled by @privy-io/react-auth)
// 2. Privy returns JWT
// 3. Dashboard uses authFetch for API calls:

const authFetch = useAuthFetch();
const agents = await apiGet("/api/v1/agents", authFetch);

// authFetch automatically:
// - Retrieves the current Privy access token
// - Attaches it as Authorization: Bearer <token>
// - Handles token refresh if expired`}</CodeBlock>
      </Section>

      <Section id="agent-pairing" title="Agent Pairing (Agent Runtimes)">
        <Prose>
          <p>
            Agent runtimes do not have user credentials. Instead, they receive
            identity through a <strong>pairing flow</strong>:
          </p>
          <ul>
            <li>The human operator generates a pairing secret in the dashboard</li>
            <li>The secret is shared with the agent runtime (10 minute TTL, single-use)</li>
            <li>The agent runtime calls the pair-confirm endpoint with the secret</li>
            <li>On success, the agent receives a signed manifest (JWT) containing its identity</li>
          </ul>
        </Prose>

        <CodeBlock title="Agent runtime pairing">{`// 1. Agent receives pairingId + pairingSecret from operator

// 2. Agent confirms pairing (no auth required)
const response = await fetch(
  "https://api.useenvoy.dev/api/v1/agents/<agentId>/pair-confirm",
  {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      pairingId: "<pairingId>",
      pairingSecret: "<pairingSecret>"
    })
  }
);

// 3. Response contains the signed manifest
const { data } = await response.json();
// data.signature = "eyJhbGciOiJSUzI1NiI..."
// data.manifestId = "uuid"
// data.expiresAt = "2026-03-01T..."`}</CodeBlock>
      </Section>

      <Section id="platform-verification" title="Platform Verification">
        <Prose>
          <p>
            Platforms verify agent identities by checking the signed manifest token.
            There are two approaches:
          </p>
          <ul>
            <li><strong>Online verification</strong> via the <code>/api/v1/verify</code> endpoint</li>
            <li><strong>Offline verification</strong> using the <code>@envoy/sdk</code> package, which fetches the JWKS and validates locally</li>
          </ul>
          <p>
            Both approaches check the JWT signature (RS256), expiry, and revocation status.
            See the <a href="/docs/sdk" className="text-accent hover:underline">SDK reference</a> for the offline approach.
          </p>
        </Prose>

        <CodeBlock title="Online verification">{`curl -X POST https://api.useenvoy.dev/api/v1/verify \\
  -H "Content-Type: application/json" \\
  -d '{"token": "eyJhbGciOiJSUzI1NiI..."}'`}</CodeBlock>
      </Section>

      <Section id="security" title="Security Notes">
        <Prose>
          <ul>
            <li><strong>Tokens are short-lived:</strong> 1 hour default, 24 hour maximum TTL</li>
            <li><strong>Manifests are signed with RS256:</strong> only the Envoy API can issue them</li>
            <li><strong>Pairing secrets are single-use:</strong> 10 minute TTL, hashed with Argon2</li>
            <li><strong>API keys are hashed:</strong> only the prefix is stored, the full key is shown once</li>
            <li><strong>Revocation is synchronous:</strong> webhook propagation happens within seconds</li>
            <li><strong>No cross-agent access:</strong> owners can only see their own agents</li>
          </ul>
        </Prose>
      </Section>
    </div>
  );
}
