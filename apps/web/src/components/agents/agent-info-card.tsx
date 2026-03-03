"use client";

import { Card, CardContent, CardHeader, CardTitle, Badge, CopyButton } from "@envoy/ui";
import { formatDate, truncateId } from "@/lib/format";

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
    status: string;
    walletAddress?: string | null;
    createdAt: string;
    revokedAt: string | null;
  };
}

export function AgentInfoCard({ agent }: AgentInfoCardProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle>{agent.name}</CardTitle>
            {agent.description && (
              <p className="mt-1 text-sm text-muted">{agent.description}</p>
            )}
          </div>
          <Badge variant={statusBadgeVariant[agent.status] ?? "muted"}>
            {agent.status}
          </Badge>
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
        </dl>
      </CardContent>
    </Card>
  );
}
