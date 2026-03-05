"use client";

import { Card, CardContent, Badge, CopyButton } from "@envoy/ui";
import { formatDate, truncateId } from "@/lib/format";
import { getAgentAvatarUrl, getAgentInitials } from "@/lib/avatar";
import { useState } from "react";

const statusConfig: Record<string, { variant: "success" | "danger" | "warning" | "muted"; label: string; dot: string }> = {
  active: { variant: "success", label: "Active", dot: "bg-success" },
  suspended: { variant: "warning", label: "Suspended", dot: "bg-yellow-500" },
  revoked: { variant: "danger", label: "Revoked", dot: "bg-danger" },
};

interface AgentInfoCardProps {
  agent: {
    id: string;
    name: string;
    description: string | null;
    username: string | null;
    avatarUrl: string | null;
    socialMoltbook: string | null;
    socialX: string | null;
    scopes: string[];
    status: string;
    walletAddress?: string | null;
    registryAssetId?: string | null;
    createdAt: string;
    revokedAt: string | null;
  };
}

export function AgentInfoCard({ agent }: AgentInfoCardProps) {
  const [imgError, setImgError] = useState(false);
  const avatarSrc = getAgentAvatarUrl(agent.id, agent.avatarUrl);
  const status = statusConfig[agent.status] ?? { variant: "muted" as const, label: agent.status, dot: "bg-muted" };

  return (
    <Card>
      <CardContent className="p-6">
        {/* Top: Avatar + Name + Status */}
        <div className="flex items-start gap-4">
          {imgError ? (
            <div className="flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-full bg-elevated text-[18px] font-semibold text-muted">
              {getAgentInitials(agent.name)}
            </div>
          ) : (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={avatarSrc}
              alt={agent.name}
              className="h-[72px] w-[72px] shrink-0 rounded-full bg-elevated object-cover"
              onError={() => setImgError(true)}
            />
          )}

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-[18px] font-semibold text-foreground">{agent.name}</h2>
                {agent.username && (
                  <p className="mt-0.5 text-[13px] text-muted">@{agent.username}</p>
                )}
              </div>
              <div className="flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1">
                <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
                <span className="text-[12px] font-medium text-foreground capitalize">
                  {status.label}
                </span>
              </div>
            </div>
            {agent.description && (
              <p className="mt-2 text-[13px] leading-[20px] text-muted">
                {agent.description}
              </p>
            )}
          </div>
        </div>

        {/* Details Grid */}
        <div className="mt-6 grid gap-4 border-t border-border pt-6 sm:grid-cols-2">
          <div>
            <dt className="text-[12px] font-medium uppercase tracking-wider text-muted">Agent ID</dt>
            <dd className="mt-1 flex items-center gap-1.5 font-mono text-[13px] text-foreground">
              {truncateId(agent.id)}
              <CopyButton value={agent.id} />
            </dd>
          </div>
          <div>
            <dt className="text-[12px] font-medium uppercase tracking-wider text-muted">Wallet</dt>
            <dd className="mt-1 flex items-center gap-1.5 font-mono text-[13px]">
              {agent.walletAddress ? (
                <>
                  <span className="text-foreground">{truncateId(agent.walletAddress)}</span>
                  <CopyButton value={agent.walletAddress} />
                </>
              ) : (
                <span className="text-muted">Not provisioned</span>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-[12px] font-medium uppercase tracking-wider text-muted">8004 Registry</dt>
            <dd className="mt-1 flex items-center gap-1.5 font-mono text-[13px]">
              {agent.registryAssetId ? (
                <>
                  <span className="h-1.5 w-1.5 rounded-full bg-success" />
                  <a
                    href={`https://8004market.io/asset/${agent.registryAssetId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-foreground transition-colors hover:text-accent"
                  >
                    {truncateId(agent.registryAssetId)}
                  </a>
                  <CopyButton value={agent.registryAssetId} />
                </>
              ) : (
                <>
                  <span className="h-1.5 w-1.5 rounded-full bg-border" />
                  <span className="font-sans text-muted">Not registered</span>
                </>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-[12px] font-medium uppercase tracking-wider text-muted">Created</dt>
            <dd className="mt-1 text-[13px] text-foreground">{formatDate(agent.createdAt)}</dd>
          </div>
          {agent.revokedAt && (
            <div>
              <dt className="text-[12px] font-medium uppercase tracking-wider text-muted">Revoked</dt>
              <dd className="mt-1 text-[13px] text-danger">{formatDate(agent.revokedAt)}</dd>
            </div>
          )}
        </div>

        {/* Scopes */}
        {agent.scopes && agent.scopes.length > 0 && (
          <div className="mt-6 border-t border-border pt-6">
            <dt className="text-[12px] font-medium uppercase tracking-wider text-muted">Scopes</dt>
            <dd className="mt-2 flex flex-wrap gap-1.5">
              {agent.scopes.map((scope) => (
                <span
                  key={scope}
                  className="rounded-md border border-border bg-elevated px-2 py-0.5 font-mono text-[11px] text-foreground"
                >
                  {scope}
                </span>
              ))}
            </dd>
          </div>
        )}

        {/* Social Links */}
        {(agent.socialMoltbook || agent.socialX) && (
          <div className="mt-6 border-t border-border pt-6">
            <dt className="text-[12px] font-medium uppercase tracking-wider text-muted">Links</dt>
            <dd className="mt-2 flex items-center gap-4">
              {agent.socialMoltbook && (
                <a
                  href={agent.socialMoltbook}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-[13px] text-muted transition-colors hover:text-foreground"
                >
                  Moltbook
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25" />
                  </svg>
                </a>
              )}
              {agent.socialX && (
                <a
                  href={agent.socialX}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-[13px] text-muted transition-colors hover:text-foreground"
                >
                  X
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25" />
                  </svg>
                </a>
              )}
            </dd>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
