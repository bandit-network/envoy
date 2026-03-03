import Link from "next/link";

const sections = [
  {
    title: "API Reference",
    description: "Complete REST API documentation with request/response schemas and curl examples.",
    href: "/docs/api-reference",
  },
  {
    title: "Authentication",
    description: "How authentication works: Privy login, Bearer tokens, and token lifecycle.",
    href: "/docs/authentication",
  },
  {
    title: "Platform Guide",
    description: "Step-by-step guide for platforms integrating with Envoy to verify agent identities.",
    href: "/docs/platform-guide",
  },
  {
    title: "SDK Reference",
    description: "TypeScript SDK for verifying Envoy agent tokens in your platform.",
    href: "/docs/sdk",
  },
];

export default function DocsPage() {
  return (
    <div>
      <h1 className="text-3xl font-bold text-foreground">Envoy Documentation</h1>
      <p className="mt-2 text-base text-muted">
        Human-owned agent identities trusted by platforms everywhere.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {sections.map((section) => (
          <Link
            key={section.href}
            href={section.href}
            className="group rounded-lg border border-border bg-surface p-5 transition-colors hover:border-accent/50"
          >
            <h2 className="font-semibold text-foreground group-hover:text-accent">
              {section.title}
            </h2>
            <p className="mt-1.5 text-sm text-muted">{section.description}</p>
          </Link>
        ))}
      </div>

      <div className="mt-10 rounded-lg border border-border bg-surface p-5">
        <h2 className="font-semibold text-foreground">Three-Entity Model</h2>
        <p className="mt-2 text-sm text-muted">
          Envoy operates with three stakeholders in every interaction:
        </p>
        <dl className="mt-4 space-y-3 text-sm">
          <div>
            <dt className="font-medium text-foreground">Human Operator</dt>
            <dd className="text-muted">Root authority. Creates, controls, and revokes agent identities.</dd>
          </div>
          <div>
            <dt className="font-medium text-foreground">AI Agent Runtime</dt>
            <dd className="text-muted">Consumes Envoy-issued identity. Stores manifest and presents tokens to platforms.</dd>
          </div>
          <div>
            <dt className="font-medium text-foreground">Platform / Relying Party</dt>
            <dd className="text-muted">Verifies agent tokens, enforces scopes, and subscribes to revocation webhooks.</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
