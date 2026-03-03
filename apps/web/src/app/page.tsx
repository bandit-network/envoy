import Link from "next/link";

function ArrowRightIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
    </svg>
  );
}

function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
    </svg>
  );
}

function ShieldCheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
    </svg>
  );
}

function UserIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
    </svg>
  );
}

function CpuIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 3v1.5M4.5 8.25H3M21 8.25h-1.5M4.5 12H3M21 12h-1.5M4.5 15.75H3M21 15.75h-1.5M8.25 19.5V21M12 3v1.5M12 19.5V21M15.75 3v1.5M15.75 19.5V21M6.75 6.75h10.5v10.5H6.75V6.75z" />
    </svg>
  );
}

function ServerIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 17.25v-.228a4.5 4.5 0 00-.12-1.03l-2.268-9.64a3.375 3.375 0 00-3.285-2.602H7.923a3.375 3.375 0 00-3.285 2.602l-2.268 9.64a4.5 4.5 0 00-.12 1.03v.228m19.5 0a3 3 0 01-3 3H5.25a3 3 0 01-3-3m19.5 0a3 3 0 00-3-3H5.25a3 3 0 00-3 3m16.5 0h.008v.008h-.008v-.008zm-3 0h.008v.008h-.008v-.008z" />
    </svg>
  );
}

function KeyIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
    </svg>
  );
}

function LinkIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function DocumentIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  );
}

function BoltIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
    </svg>
  );
}

const steps = [
  {
    step: "01",
    title: "Create Agent Identity",
    description:
      "Register an agent in the Envoy dashboard. Define scopes, metadata, and permissions that control what the agent can do.",
  },
  {
    step: "02",
    title: "Pair the Runtime",
    description:
      "Generate a one-time pairing secret. The agent runtime exchanges it for a cryptographically signed manifest.",
  },
  {
    step: "03",
    title: "Verify on Platforms",
    description:
      "Platforms verify agent tokens against Envoy's public keys. Scopes, expiry, and revocation — checked in one call.",
  },
];

const entities = [
  {
    label: "Human Operator",
    sublabel: "Root Authority",
    description:
      "Creates, controls, and revokes agent identities. Full audit trail of every action taken.",
    icon: <UserIcon className="h-5 w-5" />,
  },
  {
    label: "Envoy",
    sublabel: "Identity Layer",
    description:
      "Issues signed manifests, manages scopes, and propagates revocations to all connected platforms.",
    icon: <ShieldCheckIcon className="h-5 w-5" />,
  },
  {
    label: "AI Agent",
    sublabel: "Runtime",
    description:
      "Carries signed manifests. Presents tokens to platforms. Cannot self-issue or escalate permissions.",
    icon: <CpuIcon className="h-5 w-5" />,
  },
  {
    label: "Platform",
    sublabel: "Relying Party",
    description:
      "Verifies agent tokens. Enforces scopes. Subscribes to revocation webhooks for real-time updates.",
    icon: <ServerIcon className="h-5 w-5" />,
  },
];

const features = [
  {
    title: "RS256 Manifest Signing",
    description:
      "Manifests are signed JWTs. Public keys available via standard JWKS endpoint.",
    icon: <KeyIcon className="h-[18px] w-[18px]" />,
  },
  {
    title: "Secure Pairing",
    description:
      "One-time secrets hashed with argon2. 10-minute TTL. Single-use. Never stored in plaintext.",
    icon: <LinkIcon className="h-[18px] w-[18px]" />,
  },
  {
    title: "Token Verification",
    description:
      "Public API + SDK for platforms. Signature, expiry, and revocation checks in one call.",
    icon: <CheckIcon className="h-[18px] w-[18px]" />,
  },
  {
    title: "Append-Only Audit",
    description:
      "Every action is logged — creation, issuance, pairing, revocation. Full traceability.",
    icon: <DocumentIcon className="h-[18px] w-[18px]" />,
  },
  {
    title: "Instant Revocation",
    description:
      "Revoke an agent and all manifests are invalidated immediately. Webhook delivery to platforms.",
    icon: <ShieldCheckIcon className="h-[18px] w-[18px]" />,
  },
  {
    title: "Platform API Keys",
    description:
      "Platforms register and get scoped API keys. SHA-256 hashed. Prefix-based display.",
    icon: <BoltIcon className="h-[18px] w-[18px]" />,
  },
];

const terminalLines = [
  { prompt: true, text: "envoy agents create --name trading-bot" },
  { prompt: false, text: '✓ Agent created  id: a1b2c3d4' },
  { prompt: true, text: "envoy pair --agent a1b2c3d4" },
  { prompt: false, text: '✓ Manifest issued  expires: 24h' },
  { prompt: false, text: '✓ Token ready  scopes: api_access, trade' },
];

export default function Home() {
  return (
    <main className="min-h-screen">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-border/80 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1100px] items-center justify-between px-6 py-3">
          <div className="flex items-center gap-8">
            <Link href="/" className="text-[13px] font-bold tracking-[0.2em] text-foreground">
              ENVOY
            </Link>
            <div className="hidden items-center gap-6 md:flex">
              <Link
                href="/docs"
                className="text-[13px] text-muted transition-colors hover:text-foreground"
              >
                Docs
              </Link>
              <Link
                href="/docs/api-reference"
                className="text-[13px] text-muted transition-colors hover:text-foreground"
              >
                API
              </Link>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="rounded-[8px] bg-foreground px-4 py-[7px] text-[13px] font-medium text-background transition-opacity hover:opacity-90"
            >
              Dashboard
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="mx-auto max-w-[1100px] px-6 pb-20 pt-24 sm:pt-32">
        <div className="flex flex-col items-center text-center">
          {/* Pill badge */}
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3.5 py-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-success" />
            <span className="text-[12px] font-medium text-muted">Identity Layer for AI Agents</span>
          </div>

          <h1 className="max-w-3xl text-[clamp(36px,5.5vw,64px)] font-bold leading-[1.08] tracking-[-0.04em] text-foreground">
            Human-owned agent identities
          </h1>
          <p className="mx-auto mt-5 max-w-[540px] text-[16px] leading-[26px] text-muted">
            Envoy is the identity and authentication layer for autonomous AI agents. 
            Humans control the keys. Agents carry signed manifests. Platforms verify trust.
          </p>

          <div className="mt-8 flex items-center gap-3">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 rounded-[8px] bg-foreground px-5 py-[9px] text-[14px] font-medium text-background transition-opacity hover:opacity-90"
            >
              Get Started
              <ArrowRightIcon className="h-3.5 w-3.5" />
            </Link>
            <Link
              href="/docs"
              className="inline-flex items-center gap-2 rounded-[8px] border border-border px-5 py-[9px] text-[14px] font-medium text-foreground transition-colors hover:bg-surface"
            >
              Documentation
            </Link>
          </div>
        </div>

        {/* Terminal Preview */}
        <div className="mx-auto mt-16 max-w-[640px]">
          <div className="overflow-hidden rounded-[12px] border border-border bg-surface">
            {/* Terminal header */}
            <div className="flex items-center gap-2 border-b border-border px-4 py-3">
              <div className="flex gap-1.5">
                <div className="h-[11px] w-[11px] rounded-full bg-border" />
                <div className="h-[11px] w-[11px] rounded-full bg-border" />
                <div className="h-[11px] w-[11px] rounded-full bg-border" />
              </div>
              <span className="ml-2 text-[11px] font-medium text-muted">Terminal</span>
            </div>
            {/* Terminal body */}
            <div className="p-4 font-mono text-[13px] leading-[22px]">
              {terminalLines.map((line, i) => (
                <div key={i} className="flex">
                  {line.prompt && (
                    <span className="mr-2 select-none text-muted">$</span>
                  )}
                  <span className={line.prompt ? "text-foreground" : "text-muted"}>
                    {line.text}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Trust Model — Four entity flow */}
      <section className="border-t border-border">
        <div className="mx-auto max-w-[1100px] px-6 py-20 sm:py-24">
          <div className="text-center">
            <h2 className="text-[13px] font-semibold uppercase tracking-[0.15em] text-muted">
              Trust Model
            </h2>
            <p className="mt-3 text-[28px] font-bold tracking-[-0.03em] text-foreground sm:text-[32px]">
              Four entities, one trust chain
            </p>
            <p className="mx-auto mt-3 max-w-md text-[15px] leading-relaxed text-muted">
              Every action flows through a verifiable chain from human authority to platform verification.
            </p>
          </div>

          <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {entities.map((entity, i) => (
              <div
                key={entity.label}
                className="group relative rounded-[12px] border border-border bg-surface p-5 transition-colors hover:border-muted/40"
              >
                {/* Connector arrow on larger screens */}
                {i < entities.length - 1 && (
                  <div className="absolute -right-[12px] top-1/2 z-10 hidden -translate-y-1/2 lg:block">
                    <ChevronRightIcon className="h-4 w-4 text-border" />
                  </div>
                )}
                <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-[8px] border border-border bg-background text-foreground">
                  {entity.icon}
                </div>
                <h3 className="text-[14px] font-semibold text-foreground">{entity.label}</h3>
                <p className="mt-0.5 text-[12px] font-medium text-muted">{entity.sublabel}</p>
                <p className="mt-2.5 text-[13px] leading-[20px] text-muted">
                  {entity.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-t border-border bg-surface/50">
        <div className="mx-auto max-w-[1100px] px-6 py-20 sm:py-24">
          <div className="text-center">
            <h2 className="text-[13px] font-semibold uppercase tracking-[0.15em] text-muted">
              How it works
            </h2>
            <p className="mt-3 text-[28px] font-bold tracking-[-0.03em] text-foreground sm:text-[32px]">
              Three steps to platform trust
            </p>
          </div>

          <div className="mx-auto mt-14 max-w-[720px] space-y-0">
            {steps.map((s, i) => (
              <div key={s.step} className="relative flex gap-6 pb-10">
                {/* Vertical connector */}
                <div className="flex flex-col items-center">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-background font-mono text-[12px] font-bold text-foreground">
                    {s.step}
                  </div>
                  {i < steps.length - 1 && (
                    <div className="mt-2 h-full w-px bg-border" />
                  )}
                </div>
                <div className="pb-2 pt-1.5">
                  <h3 className="text-[15px] font-semibold text-foreground">{s.title}</h3>
                  <p className="mt-1.5 text-[13px] leading-[21px] text-muted">{s.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="border-t border-border">
        <div className="mx-auto max-w-[1100px] px-6 py-20 sm:py-24">
          <div className="text-center">
            <h2 className="text-[13px] font-semibold uppercase tracking-[0.15em] text-muted">
              Security
            </h2>
            <p className="mt-3 text-[28px] font-bold tracking-[-0.03em] text-foreground sm:text-[32px]">
              Built for zero-trust
            </p>
            <p className="mx-auto mt-3 max-w-md text-[15px] leading-relaxed text-muted">
              Every layer designed with zero-trust principles. No shortcuts.
            </p>
          </div>

          <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <div
                key={f.title}
                className="rounded-[12px] border border-border bg-surface p-5 transition-colors hover:border-muted/40"
              >
                <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-[6px] border border-border bg-background text-foreground">
                  {f.icon}
                </div>
                <h3 className="text-[14px] font-semibold text-foreground">{f.title}</h3>
                <p className="mt-1.5 text-[13px] leading-[20px] text-muted">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-border bg-surface/50">
        <div className="mx-auto max-w-[1100px] px-6 py-20 text-center sm:py-24">
          <p className="text-[28px] font-bold tracking-[-0.03em] text-foreground sm:text-[32px]">
            Ready to get started?
          </p>
          <p className="mx-auto mt-3 max-w-sm text-[15px] leading-relaxed text-muted">
            Create your first agent identity in under a minute. Free during the beta.
          </p>
          <Link
            href="/dashboard"
            className="mt-7 inline-flex items-center gap-2 rounded-[8px] bg-foreground px-6 py-[9px] text-[14px] font-medium text-background transition-opacity hover:opacity-90"
          >
            Open Dashboard
            <ArrowRightIcon className="h-3.5 w-3.5" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border">
        <div className="mx-auto max-w-[1100px] px-6 py-6">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <span className="text-[12px] font-bold tracking-[0.15em] text-muted">ENVOY</span>
            <div className="flex items-center gap-6">
              <Link href="/docs" className="text-[12px] text-muted transition-colors hover:text-foreground">
                Docs
              </Link>
              <Link href="/docs/api-reference" className="text-[12px] text-muted transition-colors hover:text-foreground">
                API
              </Link>
              <span className="text-[12px] text-muted">
                &copy; {new Date().getFullYear()} Envoy
              </span>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}
