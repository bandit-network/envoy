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
            Envoy uses <strong>Solana wallet-based authentication</strong> by default. When a user
            connects their wallet (Phantom, Solflare, Backpack) through the dashboard, they sign
            a challenge message to prove ownership. Envoy then issues a short-lived session JWT.
          </p>
          <p>
            Hosters can optionally configure Privy or other auth providers via the
            <code>AUTH_PROVIDER</code> environment variable.
          </p>
          <p>
            There are three types of authentication depending on who is calling the API:
          </p>
          <ul>
            <li><strong>Human operators</strong> use Envoy session JWTs (via wallet challenge-response)</li>
            <li><strong>Agent runtimes</strong> use pairing secrets (one-time, no auth)</li>
            <li><strong>Platforms</strong> use API keys or the public verify endpoint</li>
          </ul>
        </Prose>
      </Section>

      <Section id="wallet-auth" title="Wallet Authentication (Human Operators)">
        <Prose>
          <p>
            Human operators authenticate by connecting a Solana wallet and signing a challenge message.
            This is a two-step process:
          </p>
          <ol>
            <li>Request a challenge nonce from the API</li>
            <li>Sign the challenge with your wallet and submit for verification</li>
          </ol>
        </Prose>

        <CodeBlock title="Step 1: Request challenge">{`curl -X POST https://api.useenvoy.dev/api/v1/auth/challenge \\
  -H "Content-Type: application/json" \\
  -d '{"walletAddress": "<base58-public-key>"}'

# Response:
# {
#   "success": true,
#   "data": {
#     "nonce": "abc123...",
#     "message": "Sign this message to authenticate with Envoy.\\n\\nNonce: abc123...",
#     "expiresAt": "2026-03-01T00:05:00.000Z"
#   }
# }`}</CodeBlock>

        <CodeBlock title="Step 2: Sign and verify">{`curl -X POST https://api.useenvoy.dev/api/v1/auth/verify \\
  -H "Content-Type: application/json" \\
  -d '{
    "walletAddress": "<base58-public-key>",
    "signature": "<base58-encoded-signature>",
    "nonce": "abc123..."
  }'

# Response:
# {
#   "success": true,
#   "data": {
#     "token": "eyJhbGciOiJIUzI1NiI...",
#     "expiresAt": "2026-03-01T01:00:00.000Z",
#     "user": { "userId": "uuid", "walletAddress": "..." }
#   }
# }`}</CodeBlock>
      </Section>

      <Section id="bearer-tokens" title="Bearer Tokens">
        <Prose>
          <p>
            Most API endpoints require a Bearer token in the Authorization header. This token
            is obtained after completing the wallet challenge-response flow.
          </p>
        </Prose>

        <CodeBlock title="Authenticated request">{`curl -X GET https://api.useenvoy.dev/api/v1/agents \\
  -H "Authorization: Bearer <session-jwt>" \\
  -H "Content-Type: application/json"`}</CodeBlock>

        <div className="mt-4">
          <Prose>
            <p>
              The API middleware extracts the token, verifies the HS256 signature,
              and injects the authenticated user into the request context. If the token is
              invalid or expired, the API returns a <code>401 Unauthorized</code> response.
            </p>
          </Prose>
        </div>
      </Section>

      <Section id="token-lifecycle" title="Token Lifecycle">
        <Prose>
          <p>
            Session JWTs have a 1-hour lifespan by default (configurable via
            <code>TOKEN_DEFAULT_TTL</code>). When the token expires, the user must
            re-authenticate by signing a new challenge message.
          </p>
        </Prose>

        <CodeBlock title="Dashboard flow">{`// 1. User connects Solana wallet (Phantom, Solflare, etc.)
// 2. User signs challenge message
// 3. Dashboard stores JWT in localStorage
// 4. Dashboard uses authFetch for API calls:

const authFetch = useAuthFetch();
const agents = await apiGet("/api/v1/agents", authFetch);

// authFetch automatically:
// - Retrieves the stored session token
// - Attaches it as Authorization: Bearer <token>
// - Throws if token is expired (user must re-sign)`}</CodeBlock>
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

      <Section id="auth-providers" title="Auth Provider Configuration">
        <Prose>
          <p>
            Envoy supports a pluggable auth provider model. The default is Solana wallet adapter,
            but hosters can configure alternative providers:
          </p>
          <ul>
            <li><strong>wallet</strong> (default) — Solana wallet adapter with challenge-response</li>
            <li><strong>privy</strong> — Privy server SDK (requires <code>PRIVY_APP_ID</code> and <code>PRIVY_APP_SECRET</code>)</li>
          </ul>
          <p>
            Set the <code>AUTH_PROVIDER</code> environment variable to switch providers.
            When using wallet auth, you must also set <code>ENVOY_SESSION_SECRET</code>
            (generate with <code>openssl rand -hex 32</code>).
          </p>
        </Prose>
      </Section>

      <Section id="security" title="Security Notes">
        <Prose>
          <ul>
            <li><strong>Tokens are short-lived:</strong> 1 hour default, 24 hour maximum TTL</li>
            <li><strong>Challenge nonces are single-use:</strong> 5 minute TTL, deleted after verification</li>
            <li><strong>Signatures are Ed25519:</strong> verified using the wallet&apos;s public key</li>
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
