# CLAUDE.md — Envoy

## What Is This

Envoy is a human-controlled identity and authentication layer for autonomous AI agents. Built on Privy's login and agentic wallet infrastructure. Envoy does NOT replace Privy — it extends it with an identity delegation layer for agent ecosystems.

- **Domain:** useenvoy.dev
- **Tagline:** Human-owned agent identities trusted by platforms everywhere
- **PRD:** `docs/prd.md`

## Three-Entity Model

Every feature must account for all three stakeholders:

1. **Human Operator** — Root authority. Creates/controls/revokes agent identities. Authenticates via Privy.
2. **AI Agent Runtime** — Consumes Envoy-issued identity. Stores manifest + pairing secret. Presents tokens to platforms. Cannot self-issue or escalate.
3. **Platform / Relying Party** — Verifies agent tokens. Enforces scopes. Subscribes to revocation webhooks. Ships a `skill.md`.

## Stack

| Layer | Tech | Notes |
|---|---|---|
| Monorepo | Turborepo | `turbo.json` at root |
| Frontend | Next.js 15 (App Router) | `apps/web` — dashboard + marketing |
| Backend | Bun + Hono | `apps/api` — REST API service |
| Database | PostgreSQL + Drizzle ORM | `packages/db` — schema + migrations |
| Cache / Queue | Redis + BullMQ | Rate limiting, webhook delivery |
| UI | Tailwind CSS v4 + Radix Primitives | `packages/ui` — shared component library |
| Auth | Privy (`@privy-io/react-auth`, `@privy-io/server-auth`) | All login delegated to Privy |
| Token Signing | jose | RS256 / EdDSA manifests |
| Validation | Zod | All external inputs validated at boundary |
| Package Manager | bun | Workspace protocol for monorepo |

## Repo Structure

```
envoy/
├── CLAUDE.md
├── turbo.json
├── package.json
├── bun.lock
├── .gitignore
├── .env.example
│
├── apps/
│   ├── web/                           # Next.js 15
│   │   ├── src/
│   │   │   ├── app/
│   │   │   │   ├── (marketing)/       # Landing, docs, pricing
│   │   │   │   ├── (dashboard)/       # Auth'd dashboard
│   │   │   │   │   ├── agents/
│   │   │   │   │   ├── platforms/
│   │   │   │   │   ├── audit/
│   │   │   │   │   └── settings/
│   │   │   │   └── api/               # BFF route handlers
│   │   │   ├── components/
│   │   │   ├── lib/
│   │   │   └── hooks/
│   │   ├── public/
│   │   ├── next.config.ts
│   │   ├── tailwind.config.ts
│   │   └── package.json
│   │
│   └── api/                           # Bun + Hono
│       ├── src/
│       │   ├── index.ts
│       │   ├── routes/
│       │   ├── services/
│       │   ├── middleware/
│       │   └── lib/
│       ├── package.json
│       └── tsconfig.json
│
├── packages/
│   ├── db/                            # Drizzle ORM
│   ├── ui/                            # Shared components
│   ├── types/                         # Shared types + Zod
│   ├── sdk/                           # Platform verification SDK
│   └── config/                        # Shared tsconfig, eslint
│
├── skills/
│   └── envoy-onboarding/
│       └── SKILL.md
│
├── docs/                              # Gitignored markdown
│   ├── prd.md
│   ├── api-reference.md
│   └── platform-guide.md
│
└── infrastructure/
    ├── docker-compose.yml
    ├── Dockerfile.api
    ├── Dockerfile.web
    └── terraform/
```

## UI Design Direction

Initial decisions — will be replaced when brand assets arrive:

**Aesthetic:** Dark-first, utilitarian trust interface. "Mission control for agent identities." Dense but readable. Confident and precise, not flashy.

**Palette (placeholder):**
- Background: `#09090B` / Surface: `#18181B` / Elevated: `#27272A`
- Border: `#3F3F46` / Text: `#FAFAFA` / Text secondary: `#A1A1AA`
- Accent: `#3B82F6` / Danger: `#EF4444` / Success: `#22C55E`

**Typography (placeholder):**
- Headings: `Instrument Sans` or brand font
- Body: `Geist`
- Mono: `Geist Mono`

**Key Pages:**
- `/` — Marketing landing
- `/dashboard` — Overview
- `/dashboard/agents` — Agent list
- `/dashboard/agents/[id]` — Agent detail
- `/dashboard/agents/new` — Create agent
- `/dashboard/platforms` — Registered platforms
- `/dashboard/audit` — Audit log
- `/dashboard/settings` — Account + keys

## Commands

```bash
bun install                        # Install
bun run dev                        # All apps (Turborepo)
bun run dev --filter=web           # Next.js :3000
bun run dev --filter=api           # Hono :3001
bun run db:generate                # Drizzle migrations
bun run db:migrate                 # Run migrations
bun run db:studio                  # Drizzle Studio
bun run build                      # Build all
bun run typecheck                  # Type-check
bun run lint                       # Lint
bun run test                       # Test
```

## Code Conventions

- TypeScript strict mode everywhere. No `any` without a comment.
- API envelope: `{ success: boolean, data?: T, error?: { code, message } }`
- Zod at every boundary.
- Privy is a dependency — use their SDK, never re-implement.
- Manifests are immutable — change by issue new + revoke old.
- Pairing secrets: single-use, 10min TTL.
- Revocation: synchronous, webhook propagation < 1s.
- Soft-delete agents — never hard-delete.

## API Routes

```
POST   /api/v1/agents              # Create agent
GET    /api/v1/agents              # List agents
GET    /api/v1/agents/:id          # Get agent + manifest
PATCH  /api/v1/agents/:id          # Update metadata
DELETE /api/v1/agents/:id          # Revoke
POST   /api/v1/agents/:id/pair     # Pair
POST   /api/v1/agents/:id/refresh  # Refresh manifest
GET    /api/v1/agents/:id/audit    # Audit log

POST   /api/v1/platforms/register  # Register platform
GET    /api/v1/platforms           # List platforms
POST   /api/v1/verify              # Verify token
GET    /api/v1/revocations/:id     # Check revocation

GET    /.well-known/envoy-issuer   # Issuer metadata + JWKS
POST   /api/v1/webhooks/subscribe  # Webhook subscription
```

## Database

PostgreSQL via Drizzle. All tables: `id` (UUID), `created_at`, `updated_at`. Soft-delete via `revoked_at`.

Tables: `users`, `agents`, `manifests`, `pairings`, `platforms`, `platform_api_keys`, `audit_logs`, `revocations`, `webhook_subscriptions`.

## Security Checklist

- [ ] Tokens short-lived (1hr default, 24hr max)
- [ ] Manifests signed RS256/EdDSA via jose
- [ ] Pairing secrets hashed (argon2)
- [ ] Rate limiting on public endpoints
- [ ] Webhook payloads signed (HMAC-SHA256)
- [ ] Audit logs append-only
- [ ] No cross-agent access without owner auth
- [ ] Platform API keys scoped + rotatable
- [ ] Privy app secret never on client
- [ ] Wallet signing server-side only

## Environment Variables

```
PRIVY_APP_ID=
PRIVY_APP_SECRET=
ENVOY_ISSUER_PRIVATE_KEY=
ENVOY_ISSUER_KEY_ID=
DATABASE_URL=
REDIS_URL=
WEBHOOK_SIGNING_SECRET=
NODE_ENV=
```

## Notes for Claude

- Consider all three stakeholders in every feature decision.
- Privy is a dependency — use their SDK.
- The manifest is the central artifact.
- Skills are markdown — simple, literal, LLM-parseable.
- Security is non-negotiable.
- Default to restrictive permissions.
- When brand assets arrive, update `tailwind.config.ts` + `packages/ui`.
- `docs/*.md` is gitignored. `skills/**/SKILL.md` is NOT gitignored.
