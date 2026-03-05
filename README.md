# Envoy

**Human-owned agent identities trusted by platforms everywhere.**

Envoy is an open-source identity and authentication layer for autonomous AI agents. Humans control the keys. Agents carry signed manifests. Platforms verify trust. On-chain registration via the [Solana Agent Registry](https://8004market.io) makes agent identities trustless and publicly discoverable.

> Create. Delegate. Verify. Revoke. All under human control.

---

## The Problem

AI agents today operate with fragmented identity. Every platform invents its own auth, agents use static API keys or embedded secrets, and there is no human-revocable control layer. No unified mechanism exists to verify that an agent acts for a specific human with defined permissions.

## How It Works

Envoy introduces a **three-entity model**:

| Entity | Role |
|--------|------|
| **Human Operator** | Root authority. Creates, controls, and revokes agent identities. |
| **AI Agent Runtime** | Consumes Envoy-issued identity. Presents signed manifests to platforms. Cannot self-issue or escalate. |
| **Platform / Relying Party** | Verifies agent tokens. Enforces scopes. Subscribes to revocation webhooks. |

```
Human                    Agent                    Platform
  |                        |                        |
  |-- Create Agent ------> |                        |
  |-- Issue Manifest -----> |                        |
  |                        |-- Present Token ------> |
  |                        |                        |-- Verify --> Envoy API
  |                        |                        |<-- Valid ---/
  |-- Revoke ------------> |                        |
  |                        |  (token rejected)      |
```

**Manifests** are cryptographically signed documents (JWS) containing agent name, owner, scopes, and expiry. They are short-lived (1hr default), immutable, and instantly revocable.

## Solana Agent Registry

Envoy integrates with the [Solana Agent Registry](https://8004market.io) to provide on-chain identity for AI agents:

- **Trustless verification** -- anyone can verify an agent's identity on-chain without trusting Envoy
- **Public discoverability** -- registered agents are browsable on the Solana blockchain
- **Platform enforcement** -- platforms can require on-chain identity as a prerequisite for access
- **IPFS metadata** -- agent metadata stored via Metaplex Core NFTs with Pinata IPFS

Registration uses a **human-pays model**: Envoy prepares the transaction, the human signs and pays fees from their Solana wallet.

```
POST /api/v1/agents/:id/register-prepare   # Server prepares unsigned tx
POST /api/v1/agents/:id/register-confirm   # Human signs, sends, confirms
```

Platforms can enforce on-chain identity per API key. Agents without on-chain registration receive an `ONCHAIN_REQUIRED` error with instructions to register.

## Architecture

| Layer | Tech |
|-------|------|
| Monorepo | Turborepo + Bun workspaces |
| Frontend | Next.js 15 (App Router), Tailwind CSS v4 |
| Backend | Bun + Hono |
| Database | PostgreSQL + Drizzle ORM |
| Cache / Queue | Redis + BullMQ |
| Auth | Solana Wallet Adapter (Phantom, Solflare, etc.) |
| Token Signing | jose (RS256 / EdDSA) |
| On-Chain | Solana + Metaplex Core + IPFS (Pinata) |
| Validation | Zod |

```
envoy/
  apps/
    web/             # Next.js 15 -- Dashboard + marketing + docs
    api/             # Bun + Hono -- REST API
  packages/
    db/              # PostgreSQL + Drizzle ORM -- schema + migrations
    ui/              # Shared component library
    types/           # Shared types + Zod schemas
    sdk/             # Platform verification SDK (@envoy/sdk)
    agent-sdk/       # Agent runtime SDK (@envoy/agent-sdk)
    config/          # Shared tsconfig
  skills/
    envoy-identity/  # SKILL.md -- LLM-parseable onboarding guide
  infrastructure/
    docker-compose.yml
    Dockerfile.api
    Dockerfile.web
```

## Self-Hosting

### Prerequisites

- [Bun](https://bun.sh) v1.2+
- [Docker](https://docs.docker.com/get-docker/) (for Postgres + Redis)

### 1. Clone and install

```bash
git clone https://github.com/bandit-network/envoy.git
cd envoy
bun install
```

### 2. Start infrastructure

```bash
docker compose -f infrastructure/docker-compose.yml up -d
```

This starts PostgreSQL 16 and Redis 7 with default credentials.

### 3. Generate signing keys

Envoy signs agent manifests with RS256. Generate a 2048-bit RSA key pair:

```bash
# Generate private key (PKCS#8 PEM format)
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out private.pem

# View the key (you'll paste this into .env)
cat private.pem
```

### 4. Configure environment

```bash
cp .env.example .env
```

Fill in the required values:

```bash
# Signing key (paste the full PEM including -----BEGIN/END----- lines)
ENVOY_ISSUER_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----
MIIEv...your key here...
-----END PRIVATE KEY-----"

# Key ID (any unique string -- published in your JWKS endpoint)
ENVOY_ISSUER_KEY_ID=my-key-1

# Webhook signing secret
WEBHOOK_SIGNING_SECRET=$(openssl rand -hex 32)

# Database + Redis (defaults match docker-compose)
DATABASE_URL=postgresql://envoy:envoy@localhost:5432/envoy
REDIS_URL=redis://localhost:6379

# Solana Agent Registry (optional)
REGISTRY_ENABLED=true
REGISTRY_CLUSTER=devnet
REGISTRY_RPC_URL=https://api.devnet.solana.com
PINATA_JWT=your-pinata-jwt
```

### 5. Run database migrations

```bash
bun run db:migrate
```

### 6. Start development servers

```bash
bun run dev
```

- **Web dashboard** at http://localhost:3000
- **API server** at http://localhost:3001

### 7. Verify it's running

```bash
# Health check
curl http://localhost:3001/health

# JWKS endpoint (your public keys)
curl http://localhost:3001/.well-known/envoy-issuer
```

## SDKs

### For Platforms -- `@envoy/sdk`

Verify agent tokens on your platform:

```ts
import { EnvoyVerifier } from "@envoy/sdk";

const verifier = new EnvoyVerifier({
  issuerUrl: "https://api.useenvoy.dev",
});

// Verify an agent token
const result = await verifier.verify(token);

if (result.valid) {
  console.log("Agent:", result.manifest.agent_name);
  console.log("Scopes:", result.scopes);
  console.log("On-chain:", result.onchainIdentity?.verified);
}

// Enforce scopes
verifier.requireScopes(result, ["trade", "read"]);

// Create reusable middleware
const verify = verifier.createMiddleware({
  requiredScopes: ["api_access"],
});
```

### For Agents -- `@envoy/agent-sdk`

Acquire and present identity in your agent runtime:

```ts
import { EnvoyAgent } from "@envoy/agent-sdk";

const agent = new EnvoyAgent({
  envoyUrl: "https://api.useenvoy.dev",
  autoRefresh: true,
  onTokenReceived: (data) => saveToStorage(data),
});

// Complete pairing (one-time)
await agent.pair(pairingId, pairingSecret);

// Get auth headers for API calls
const headers = agent.toAuthHeaders();
// { "Authorization": "Bearer <signed-manifest>" }
```

## Skill-Based Onboarding

Agents onboard via a `skill.md` file -- a plain markdown document that any LLM can parse. The skill walks agents through pairing, token storage, and presenting credentials to platforms. No custom integration code needed. Just point your agent at the skill file.

## API Endpoints

```
POST   /api/v1/agents                          # Create agent
GET    /api/v1/agents                          # List agents
GET    /api/v1/agents/:id                      # Get agent + manifest
PATCH  /api/v1/agents/:id                      # Update metadata
DELETE /api/v1/agents/:id                      # Revoke agent

POST   /api/v1/pair-confirm                    # Exchange pairing for token
POST   /api/v1/token/refresh                   # Refresh token
GET    /api/v1/token/status                    # Check token status

POST   /api/v1/verify                          # Verify agent token
GET    /api/v1/revocations/:id                 # Check revocation

POST   /api/v1/agents/:id/register-prepare     # Prepare on-chain registration
POST   /api/v1/agents/:id/register-confirm     # Confirm on-chain registration

POST   /api/v1/platforms                       # Register platform
GET    /api/v1/platforms                       # List platforms
POST   /api/v1/platforms/:id/api-keys           # Generate API key
POST   /api/v1/platforms/:id/api-keys/:kid/rotate  # Rotate API key

POST   /api/v1/webhooks/subscribe              # Subscribe to events
GET    /.well-known/envoy-issuer               # JWKS + issuer metadata
GET    /health                                 # Health check
```

## Key Features

- **Cryptographic manifests** -- RS256/EdDSA signed, short-lived, immutable
- **Scoped permissions** -- Fine-grained access control per agent
- **Instant revocation** -- Revoke any agent immediately, webhook propagation < 1s
- **Solana Agent Registry** -- Trustless on-chain verification via Metaplex Core NFTs
- **Platform API keys** -- Scoped keys with atomic rotation
- **Scope enforcement** -- Platform keys can require specific agent scopes
- **Webhook delivery** -- HMAC-signed payloads with exponential backoff retry
- **Rate limiting** -- Redis sliding-window, per-endpoint configuration
- **Audit trail** -- Append-only logs for every action
- **Skill-based integration** -- LLM-parseable markdown onboarding
- **Agent discovery** -- Public directory of registered agents

## Security

- Manifests signed with RS256/EdDSA via jose
- Pairing secrets hashed with Argon2
- Webhook payloads signed with HMAC-SHA256
- Platform API keys stored as SHA-256 hashes
- Rate limiting on all public endpoints
- No cross-agent access without owner authentication
- Audit logs are append-only and immutable
- Agents soft-deleted (never hard-deleted)

## Commands

```bash
bun install                # Install dependencies
bun run dev                # Start all apps
bun run build              # Build all packages
bun run typecheck          # Type-check everything
bun run test               # Run all tests
bun run db:generate        # Generate Drizzle migrations
bun run db:migrate         # Run migrations
bun run db:studio          # Open Drizzle Studio
```

## Production Deployment

For production:

1. Use a managed Postgres (Neon, Supabase, RDS)
2. Use a managed Redis (Upstash, ElastiCache)
3. Set `NODE_ENV=production`
4. Build: `bun run build`
5. Run behind a reverse proxy (Nginx, Caddy, or platforms like Fly.io / Railway)
6. Point your domain -- it becomes your `issuerUrl` that platforms trust

Dockerfiles are provided in `infrastructure/`.

## Contributing

Envoy is open source. Contributions, issues, and feature requests are welcome.

## License

MIT

## Links

- [useenvoy.dev](https://useenvoy.dev)
- [Solana Agent Registry](https://8004market.io)
- [GitHub](https://github.com/bandit-network/envoy)
