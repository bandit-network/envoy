import Link from "next/link";

function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
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

function CheckCircleIcon({ className }: { className?: string }) {
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
    title: "Create Agent",
    description: "Register an agent identity in the Envoy dashboard. Define scopes, policies, and metadata.",
  },
  {
    step: "02",
    title: "Pair Runtime",
    description: "Generate a one-time pairing secret. Hand it to the agent runtime. It exchanges the secret for a signed manifest.",
  },
  {
    step: "03",
    title: "Verify Tokens",
    description: "Platforms verify agent tokens against Envoy's public keys. Check scopes, expiry, and revocation in real-time.",
  },
];

const entities = [
  {
    title: "Human Operator",
    description: "Root authority. Creates, controls, and revokes agent identities. Full audit trail of every action.",
    icon: <ShieldIcon className="h-6 w-6" />,
  },
  {
    title: "AI Agent Runtime",
    description: "Consumes Envoy-issued identity. Presents signed manifests to platforms. Cannot self-issue or escalate.",
    icon: <BoltIcon className="h-6 w-6" />,
  },
  {
    title: "Platform / Relying Party",
    description: "Verifies agent tokens. Enforces scopes. Subscribes to revocation webhooks. Ships a skill.md.",
    icon: <CheckCircleIcon className="h-6 w-6" />,
  },
];

const features = [
  {
    title: "RS256 Manifest Signing",
    description: "Manifests are signed JWTs with RS256. Public keys available via JWKS endpoint.",
    icon: <KeyIcon className="h-5 w-5" />,
  },
  {
    title: "Secure Pairing",
    description: "One-time secrets hashed with argon2. 10-minute TTL. Single-use. Never stored in plaintext.",
    icon: <LinkIcon className="h-5 w-5" />,
  },
  {
    title: "Token Verification",
    description: "Public API endpoint + SDK for platforms. Signature, expiry, and revocation checks in one call.",
    icon: <CheckCircleIcon className="h-5 w-5" />,
  },
  {
    title: "Append-Only Audit Log",
    description: "Every action is logged. Agent creation, manifest issuance, pairing, revocation. Full traceability.",
    icon: <DocumentIcon className="h-5 w-5" />,
  },
  {
    title: "Instant Revocation",
    description: "Revoke an agent and all its manifests are invalidated immediately. Webhook delivery to platforms.",
    icon: <ShieldIcon className="h-5 w-5" />,
  },
  {
    title: "Platform API Keys",
    description: "Platforms register and receive API keys for verification. SHA-256 hashed. Prefix-based display.",
    icon: <BoltIcon className="h-5 w-5" />,
  },
];

export default function Home() {
  return (
    <main className="min-h-screen">
      {/* Nav */}
      <nav className="border-b border-border/50">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <span className="text-sm font-bold tracking-widest text-foreground">ENVOY</span>
          <div className="flex items-center gap-4">
            <Link
              href="/docs"
              className="text-sm font-medium text-muted transition-colors hover:text-foreground"
            >
              Docs
            </Link>
            <Link
              href="/dashboard"
              className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent/90"
            >
              Dashboard
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="mx-auto max-w-5xl px-6 py-24 text-center">
        <h1 className="text-5xl font-bold tracking-tight text-foreground sm:text-6xl">
          Human-owned agent identities
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-muted">
          Envoy is the identity and authentication layer for autonomous AI agents.
          Humans control the keys. Agents carry signed manifests. Platforms verify trust.
        </p>
        <div className="mt-10 flex items-center justify-center gap-4">
          <Link
            href="/dashboard"
            className="rounded-md bg-accent px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-accent/90"
          >
            Get Started
          </Link>
          <Link
            href="/docs"
            className="rounded-md border border-border px-6 py-3 text-sm font-medium text-foreground transition-colors hover:bg-surface"
          >
            View Docs
          </Link>
        </div>
      </section>

      {/* How it works */}
      <section className="border-t border-border/50 bg-surface/30">
        <div className="mx-auto max-w-5xl px-6 py-20">
          <h2 className="text-center text-2xl font-bold text-foreground">How it works</h2>
          <p className="mx-auto mt-2 max-w-lg text-center text-sm text-muted">
            Three steps from agent creation to platform trust.
          </p>
          <div className="mt-12 grid gap-8 sm:grid-cols-3">
            {steps.map((s) => (
              <div key={s.step} className="text-center">
                <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full border border-accent/30 bg-accent/10 font-mono text-sm font-bold text-accent">
                  {s.step}
                </div>
                <h3 className="mt-4 text-base font-semibold text-foreground">{s.title}</h3>
                <p className="mt-2 text-sm text-muted">{s.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Three-entity model */}
      <section className="border-t border-border/50">
        <div className="mx-auto max-w-5xl px-6 py-20">
          <h2 className="text-center text-2xl font-bold text-foreground">Three-entity model</h2>
          <p className="mx-auto mt-2 max-w-lg text-center text-sm text-muted">
            Every feature accounts for all three stakeholders.
          </p>
          <div className="mt-12 grid gap-6 sm:grid-cols-3">
            {entities.map((e) => (
              <div key={e.title} className="rounded-lg border border-border bg-surface p-6">
                <div className="text-accent">{e.icon}</div>
                <h3 className="mt-4 text-base font-semibold text-foreground">{e.title}</h3>
                <p className="mt-2 text-sm text-muted">{e.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="border-t border-border/50 bg-surface/30">
        <div className="mx-auto max-w-5xl px-6 py-20">
          <h2 className="text-center text-2xl font-bold text-foreground">Built for security</h2>
          <p className="mx-auto mt-2 max-w-lg text-center text-sm text-muted">
            Every layer designed with zero-trust principles.
          </p>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <div key={f.title} className="rounded-lg border border-border bg-surface p-5">
                <div className="text-accent">{f.icon}</div>
                <h3 className="mt-3 text-sm font-semibold text-foreground">{f.title}</h3>
                <p className="mt-1.5 text-sm text-muted">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-border/50">
        <div className="mx-auto max-w-5xl px-6 py-20 text-center">
          <h2 className="text-2xl font-bold text-foreground">Ready to get started?</h2>
          <p className="mt-2 text-sm text-muted">
            Create your first agent identity in under a minute.
          </p>
          <Link
            href="/dashboard"
            className="mt-6 inline-block rounded-md bg-accent px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-accent/90"
          >
            Open Dashboard
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50">
        <div className="mx-auto max-w-5xl px-6 py-8">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold tracking-widest text-muted">ENVOY</span>
            <p className="text-xs text-muted">
              &copy; {new Date().getFullYear()} Envoy. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </main>
  );
}
