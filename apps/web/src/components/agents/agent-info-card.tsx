"use client";

import { Card, CardContent, CardHeader, CardTitle, Badge, CopyButton } from "@envoy/ui";
import { formatDate, truncateId } from "@/lib/format";
import { getAgentAvatarUrl, getAgentInitials } from "@/lib/avatar";
import { useState } from "react";

const statusBadgeVariant: Record<string, "success" | "danger" | "warning" | "muted"> = {
  active: "success",
  suspended: "warning",
  revoked: "danger",
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
    createdAt: string;
    revokedAt: string | null;
  };
}

export function AgentInfoCard({ agent }: AgentInfoCardProps) {
  const [imgError, setImgError] = useState(false);
  const avatarSrc = getAgentAvatarUrl(agent.id, agent.avatarUrl);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start gap-4">
          {/* Avatar */}
          {imgError ? (
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-surface text-sm font-medium text-muted">
              {getAgentInitials(agent.name)}
            </div>
          ) : (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={avatarSrc}
              alt={agent.name}
              className="h-12 w-12 shrink-0 rounded-full bg-surface object-cover"
              onError={() => setImgError(true)}
            />
          )}

          <div className="flex-1">
            <div className="flex items-start justify-between">
              <div>
                <CardTitle>{agent.name}</CardTitle>
                {agent.username && (
                  <p className="mt-0.5 text-sm text-muted">@{agent.username}</p>
                )}
                {agent.description && (
                  <p className="mt-1 text-sm text-muted">{agent.description}</p>
                )}
              </div>
              <Badge variant={statusBadgeVariant[agent.status] ?? "muted"}>
                {agent.status}
              </Badge>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted">Agent ID</dt>
            <dd className="mt-0.5 flex items-center gap-1 font-mono text-xs">
              {truncateId(agent.id)}
              <CopyButton value={agent.id} />
            </dd>
          </div>
          <div>
            <dt className="text-muted">Wallet</dt>
            <dd className="mt-0.5 flex items-center gap-1 font-mono text-xs">
              {agent.walletAddress ? (
                <>
                  {truncateId(agent.walletAddress)}
                  <CopyButton value={agent.walletAddress} />
                </>
              ) : (
                <span className="text-muted">Not provisioned</span>
              )}
            </dd>
          </div>
          {agent.scopes && agent.scopes.length > 0 && (
            <div className="sm:col-span-2">
              <dt className="text-muted">Scopes</dt>
              <dd className="mt-1 flex flex-wrap gap-1.5">
                {agent.scopes.map((scope) => (
                  <Badge key={scope} variant="muted">
                    {scope.replace("_", " ")}
                  </Badge>
                ))}
              </dd>
            </div>
          )}
          <div>
            <dt className="text-muted">Created</dt>
            <dd className="mt-0.5">{formatDate(agent.createdAt)}</dd>
          </div>
          {agent.revokedAt && (
            <div>
              <dt className="text-muted">Revoked</dt>
              <dd className="mt-0.5 text-danger">{formatDate(agent.revokedAt)}</dd>
            </div>
          )}
          {(agent.socialMoltbook || agent.socialX) && (
            <div className="sm:col-span-2">
              <dt className="text-muted">Socials</dt>
              <dd className="mt-0.5 flex items-center gap-3">
                {agent.socialMoltbook && (
                  <a
                    href={agent.socialMoltbook}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-accent hover:text-accent/80"
                  >
                    Moltbook ↗
                  </a>
                )}
                {agent.socialX && (
                  <a
                    href={agent.socialX}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-accent hover:text-accent/80"
                  >
                    X ↗
                  </a>
                )}
              </dd>
            </div>
          )}
        </dl>
      </CardContent>
    </Card>
  );
}
