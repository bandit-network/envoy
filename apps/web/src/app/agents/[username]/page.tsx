import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

interface PublicAgent {
  id: string;
  name: string;
  username: string;
  description: string | null;
  avatarUrl: string | null;
  status: string;
  walletAddress: string | null;
  registryAssetId: string | null;
  socialMoltbook: string | null;
  socialX: string | null;
  scopes: string[];
  createdAt: string;
}

async function getPublicAgent(
  username: string
): Promise<PublicAgent | null> {
  try {
    const res = await fetch(
      `${API_BASE_URL}/api/v1/agents/public/${encodeURIComponent(username)}`,
      { next: { revalidate: 60 } }
    );
    if (!res.ok) return null;
    const json = (await res.json()) as {
      success: boolean;
      data: PublicAgent;
    };
    return json.success ? json.data : null;
  } catch {
    return null;
  }
}

function getAvatarUrl(agentId: string, avatarUrl: string | null): string {
  if (avatarUrl) return avatarUrl;
  return `https://api.dicebear.com/9.x/identicon/svg?seed=${agentId}`;
}

function truncateAddress(address: string): string {
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/* ── Metadata (SSR) ─────────────────────────────────────────────── */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const { username } = await params;
  const agent = await getPublicAgent(username);

  if (!agent) {
    return { title: "Agent Not Found | Envoy" };
  }

  const description =
    agent.description ?? `${agent.name} is a verified AI agent on Envoy.`;

  return {
    title: `${agent.name} (@${agent.username}) | Envoy`,
    description,
    openGraph: {
      title: `${agent.name} (@${agent.username})`,
      description,
      type: "profile",
    },
  };
}

/* ── Page ────────────────────────────────────────────────────────── */

export default async function AgentPublicProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const agent = await getPublicAgent(username);
  if (!agent) notFound();

  const avatarSrc = getAvatarUrl(agent.id, agent.avatarUrl);
  const hasOnchainIdentity = !!agent.walletAddress;
  const hasRegistryId = !!agent.registryAssetId;

  return (
    <div className="mx-auto max-w-lg px-4 py-12 sm:py-16">
      {/* Profile Card */}
      <div className="rounded-2xl border border-border bg-surface p-6 sm:p-8">
        {/* Avatar + Identity */}
        <div className="flex flex-col items-center text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={avatarSrc}
            alt={agent.name}
            className="h-20 w-20 rounded-full border-2 border-border bg-background"
          />

          <h1 className="mt-4 text-[20px] font-semibold text-foreground">
            {agent.name}
          </h1>
          <p className="text-[14px] text-muted">@{agent.username}</p>

          {/* Badges */}
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full border border-success/30 bg-success/10 px-2.5 py-0.5 text-[12px] font-medium text-success">
              <svg
                className="h-3 w-3"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              Active
            </span>

            {hasOnchainIdentity && (
              <span className="inline-flex items-center gap-1 rounded-full border border-accent/30 bg-accent/10 px-2.5 py-0.5 text-[12px] font-medium text-accent">
                <svg
                  className="h-3 w-3"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m9.86-2.813a4.5 4.5 0 00-1.242-7.244l4.5-4.5a4.5 4.5 0 016.364 6.364l-1.757 1.757"
                  />
                </svg>
                On-Chain Identity
              </span>
            )}

            {hasRegistryId && (
              <a
                href={`https://8004market.io/asset/${agent.registryAssetId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-full border border-purple-500/30 bg-purple-500/10 px-2.5 py-0.5 text-[12px] font-medium text-purple-400 transition-colors hover:bg-purple-500/20"
              >
                <svg
                  className="h-3 w-3"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5"
                  />
                </svg>
                8004 Registered
              </a>
            )}
          </div>
        </div>

        {/* Description */}
        {agent.description && (
          <p className="mt-6 text-center text-[14px] leading-relaxed text-muted">
            {agent.description}
          </p>
        )}

        {/* Details */}
        <div className="mt-6 space-y-0 divide-y divide-border">
          {/* Wallet Address */}
          {agent.walletAddress && (
            <div className="flex items-center justify-between py-3">
              <span className="text-[12px] font-medium uppercase tracking-wider text-muted">
                Wallet
              </span>
              <span className="font-mono text-[13px] text-foreground">
                {truncateAddress(agent.walletAddress)}
              </span>
            </div>
          )}

          {/* 8004 Registry */}
          {agent.registryAssetId && (
            <div className="flex items-center justify-between py-3">
              <span className="text-[12px] font-medium uppercase tracking-wider text-muted">
                8004 Asset
              </span>
              <a
                href={`https://8004market.io/asset/${agent.registryAssetId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-[13px] text-foreground transition-colors hover:text-accent"
              >
                {truncateAddress(agent.registryAssetId)}
              </a>
            </div>
          )}

          {/* Scopes */}
          {agent.scopes.length > 0 && (
            <div className="py-3">
              <span className="text-[12px] font-medium uppercase tracking-wider text-muted">
                Scopes
              </span>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {agent.scopes.map((scope) => (
                  <span
                    key={scope}
                    className="rounded-md border border-border bg-background px-2 py-0.5 text-[12px] text-foreground"
                  >
                    {scope}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Social Links */}
          {(agent.socialX || agent.socialMoltbook) && (
            <div className="flex items-center justify-between py-3">
              <span className="text-[12px] font-medium uppercase tracking-wider text-muted">
                Social
              </span>
              <div className="flex items-center gap-3">
                {agent.socialX && (
                  <a
                    href={
                      agent.socialX.startsWith("http")
                        ? agent.socialX
                        : `https://x.com/${agent.socialX}`
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[13px] text-muted transition-colors hover:text-foreground"
                  >
                    𝕏
                  </a>
                )}
                {agent.socialMoltbook && (
                  <a
                    href={agent.socialMoltbook}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[13px] text-muted transition-colors hover:text-foreground"
                  >
                    Moltbook
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Created */}
          <div className="flex items-center justify-between py-3">
            <span className="text-[12px] font-medium uppercase tracking-wider text-muted">
              Created
            </span>
            <span className="text-[13px] text-foreground">
              {formatDate(agent.createdAt)}
            </span>
          </div>
        </div>

        {/* Verified on Envoy badge */}
        <div className="mt-6 flex justify-center">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-[12px] font-medium text-muted transition-colors hover:text-foreground"
          >
            <svg
              className="h-3.5 w-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"
              />
            </svg>
            Verified on Envoy
          </Link>
        </div>
      </div>
    </div>
  );
}
