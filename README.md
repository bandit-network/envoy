# Envoy

Human-owned agent identities trusted by platforms everywhere.

Envoy is an open-source identity and authentication layer for autonomous AI agents. Humans control the keys. Agents carry signed manifests. Platforms verify trust.

## Three-Entity Model

Every feature accounts for all three stakeholders:

- **Human Operator** — Root authority. Creates, controls, and revokes agent identities.
- **AI Agent Runtime** — Consumes Envoy-issued identity. Presents signed manifests to platforms. Cannot self-issue or escalate.
- **Platform / Relying Party** — Verifies agent tokens. Enforces scopes. Subscribes to revocation webhooks.

## How It Works

1. **Create Agent** — Register an agent identity in the dashboard. Define scopes, policies, and metadata.
2. **Pair Runtime** — Generate a one-time pairing secret. Hand it to the agent runtime. It exchanges the secret for a signed manifest.
3. **Verify Tokens** — Platforms verify agent tokens against the issuer's public keys. Check scopes, expiry, and revocation in real-time.

## Architecture

| Layer | Tech |
|-------|------|
| Monorepo | Turborepo + Bun workspaces |
| Frontend | Next.js 15 (App Router) |
| Backend | Bun + Hono |
| Database | PostgreSQL + Drizzle ORM |
| Cache / Queue | Redis + BullMQ |
| Auth | Privy |
| Token Signing | jose (RS256) |
| Validation | Zod |
| UI | Tailwind CSS v4 + Radix Primitives |

## Self-Hosting

### Prerequisites

- [Bun](https://bun.sh) v1.2+
- [Docker](https://docs.docker.com/get-docker/) (for Postgres + Redis)
- A [Privy](https://privy.io) account (app ID + secret)

### 1. Clone and install

```bash
git clone https://github.com/your-org/envoy.git
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
# Privy (get these from https://dashboard.privy.io)
PRIVY_APP_ID=your-privy-app-id
PRIVY_APP_SECRET=your-privy-app-secret
NEXT_PUBLIC_PRIVY_APP_ID=your-privy-app-id

# Signing key (paste the full PEM including -----BEGIN/END----- lines)
ENVOY_ISSUER_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----
MIIEv...your key here...
-----END PRIVATE KEY-----"

# Key ID (any unique string — published in your JWKS endpoint)
ENVOY_ISSUER_KEY_ID=my-key-1

# Webhook signing secret (generate a random string)
WEBHOOK_SIGNING_SECRET=$(openssl rand -hex 32)

# Database + Redis (defaults match docker-compose)
DATABASE_URL=postgresql://envoy:envoy@localhost:5432/envoy
REDIS_URL=redis://localhost:6379
```

### 5. Run database migrations

```bash
bun run db:migrate
```

### 6. Start development servers

```bash
bun run dev
```

This starts both apps:
- **Web dashboard** → http://localhost:3000
- **API server** → http://localhost:3001

### 7. Verify it's running

```bash
# Health check
curl http://localhost:3001/health

# JWKS endpoint (your public keys)
curl http://localhost:3001/.well-known/envoy-issuer
```

The JWKS endpoint is what platforms use to verify tokens issued by your instance.

## Production Deployment

For production, you'll want to:

1. **Use a real Postgres instance** — managed database (Neon, Supabase, RDS, etc.)
2. **Use a real Redis instance** — managed Redis (Upstash, ElastiCache, etc.)
3. **Set `NODE_ENV=production`**
4. **Build the apps**:
   ```bash
   bun run build
   ```
5. **Run behind a reverse proxy** — Nginx, Caddy, or a platform like Fly.io / Railway
6. **Point your domain** — the domain becomes your `issuerUrl` that platforms trust

### Docker

Dockerfiles are provided in `infrastructure/`:

```bash
# API
docker build -f infrastructure/Dockerfile.api -t envoy-api .

# Web
docker build -f infrastructure/Dockerfile.web -t envoy-web .
```

## Platform Verification SDK

Platforms verify agent tokens using the `@envoy/sdk` package:

```bash
npm install @envoy/sdk
```

```ts
import { EnvoyVerifier } from "@envoy/sdk";

const verifier = new EnvoyVerifier({
  // Point to any Envoy instance
  issuerUrl: "https://your-envoy-instance.com",
});

const result = await verifier.verify(token);

if (result.valid) {
  console.log("Agent:", result.manifest.agent_name);
  console.log("Scopes:", result.scopes);
}
```

See the [SDK README](packages/sdk/README.md) for full documentation.

## Project Structure

```
envoy/
├── apps/
│   ├── web/           # Next.js 15 — dashboard + docs
│   └── api/           # Bun + Hono — REST API
├── packages/
│   ├── db/            # Drizzle ORM — schema + migrations
│   ├── ui/            # Shared component library
│   ├── types/         # Shared types + Zod schemas
│   ├── sdk/           # Platform verification SDK
│   └── config/        # Shared tsconfig
└── infrastructure/
    ├── docker-compose.yml
    ├── Dockerfile.api
    └── Dockerfile.web
```

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

## API Endpoints

```
POST   /api/v1/agents              # Create agent
GET    /api/v1/agents              # List agents
GET    /api/v1/agents/:id          # Get agent + manifest
PATCH  /api/v1/agents/:id          # Update metadata
DELETE /api/v1/agents/:id          # Revoke agent
POST   /api/v1/agents/:id/pair     # Generate pairing secret
POST   /api/v1/agents/:id/refresh  # Refresh manifest
GET    /api/v1/agents/:id/audit    # Audit log

POST   /api/v1/platforms/register  # Register platform
GET    /api/v1/platforms           # List platforms
POST   /api/v1/verify              # Verify agent token
GET    /api/v1/revocations/:id     # Check revocation

GET    /.well-known/envoy-issuer   # JWKS public keys
POST   /api/v1/webhooks/subscribe  # Subscribe to events
GET    /health                     # Health check
```

## Key Rotation

To rotate your signing key:

1. Generate a new key pair (step 3 above)
2. Update `ENVOY_ISSUER_PRIVATE_KEY` and `ENVOY_ISSUER_KEY_ID` in your environment
3. Restart the API server
4. The new public key appears in the JWKS endpoint immediately
5. Platforms using the SDK will pick up the new key automatically (JWKS is cached with TTL)
6. Previously issued manifests remain valid until they expire

## License

MIT
