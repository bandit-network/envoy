"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button, Card, CardContent, CardHeader, CardTitle, Skeleton, Badge } from "@envoy/ui";
import { PageHeader } from "@/components/layout/page-header";
import { AgentInfoCard } from "@/components/agents/agent-info-card";
import { ManifestCard } from "@/components/agents/manifest-card";
import { PairingDialog } from "@/components/agents/pairing-dialog";
import { RevokeDialog } from "@/components/agents/revoke-dialog";
import { useAuthFetch } from "@/hooks/use-auth-fetch";
import { apiGet, apiPost, ApiError } from "@/lib/api";
import { formatRelativeTime } from "@/lib/format";
import { toast } from "sonner";

interface Agent {
  id: string;
  name: string;
  description: string | null;
  username: string | null;
  avatarUrl: string | null;
  socialMoltbook: string | null;
  socialX: string | null;
  status: string;
  walletAddress: string | null;
  createdAt: string;
  updatedAt: string;
  revokedAt: string | null;
}

interface Manifest {
  id: string;
  signature: string;
  manifestJson: Record<string, unknown>;
  issuedAt: string;
  expiresAt: string;
  revokedAt: string | null;
}

interface AgentDetailResponse {
  agent: Agent;
  manifest: Manifest | null;
}

interface AuditEntry {
  id: string;
  action: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

interface AuditResponse {
  entries: AuditEntry[];
  total: number;
}

export default function AgentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const authFetch = useAuthFetch();
  const agentId = params.id as string;

  const [data, setData] = useState<AgentDetailResponse | null>(null);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const loadAgent = useCallback(async () => {
    try {
      const [agentData, auditData] = await Promise.all([
        apiGet<AgentDetailResponse>(`/api/v1/agents/${agentId}`, authFetch),
        apiGet<AuditResponse>(`/api/v1/agents/${agentId}/audit?limit=5`, authFetch),
      ]);
      setData(agentData);
      setAudit(auditData.entries);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load agent");
    } finally {
      setLoading(false);
    }
  }, [agentId, authFetch]);

  useEffect(() => {
    loadAgent();
  }, [loadAgent]);

  async function handleIssueManifest() {
    setActionLoading("issue");
    try {
      await apiPost(`/api/v1/agents/${agentId}/manifest`, {}, authFetch);
      toast.success("Manifest issued");
      await loadAgent();
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to issue manifest";
      toast.error(message);
      setError(message);
    } finally {
      setActionLoading(null);
    }
  }

  async function handleRefreshManifest() {
    setActionLoading("refresh");
    try {
      await apiPost(`/api/v1/agents/${agentId}/refresh`, {}, authFetch);
      toast.success("Manifest refreshed");
      await loadAgent();
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to refresh manifest";
      toast.error(message);
      setError(message);
    } finally {
      setActionLoading(null);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="space-y-4">
        <PageHeader title="Agent" />
        <div className="rounded-md bg-danger/10 px-4 py-3 text-sm text-danger">{error}</div>
        <Button variant="ghost" onClick={() => router.push("/agents")}>
          Back to agents
        </Button>
      </div>
    );
  }

  if (!data) return null;

  const { agent, manifest } = data;
  const isActive = agent.status === "active";

  return (
    <div>
      <PageHeader
        title={agent.name}
        action={
          <Button variant="ghost" asChild>
            <Link href="/agents">Back to agents</Link>
          </Button>
        }
      />

      {error && (
        <div className="mb-4 rounded-md bg-danger/10 px-4 py-3 text-sm text-danger">{error}</div>
      )}

      <div className="space-y-6">
        <AgentInfoCard agent={agent} />

        {manifest && <ManifestCard manifest={manifest} />}

        {isActive && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3">
                {!manifest ? (
                  <Button
                    size="sm"
                    onClick={handleIssueManifest}
                    loading={actionLoading === "issue"}
                  >
                    Issue Manifest
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleRefreshManifest}
                    loading={actionLoading === "refresh"}
                  >
                    Refresh Manifest
                  </Button>
                )}

                <PairingDialog agentId={agentId} />

                <RevokeDialog
                  agentId={agentId}
                  agentName={agent.name}
                  onRevoked={() => loadAgent()}
                />
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Recent Activity</CardTitle>
              <Link
                href={`/audit?agent=${agentId}`}
                className="text-xs font-medium text-accent hover:text-accent/80"
              >
                View all
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {audit.length === 0 ? (
              <p className="text-sm text-muted">No activity recorded yet.</p>
            ) : (
              <div className="space-y-3">
                {audit.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between text-sm"
                  >
                    <div className="flex items-center gap-2">
                      <Badge variant="muted">{entry.action}</Badge>
                    </div>
                    <span className="text-xs text-muted">
                      {formatRelativeTime(entry.createdAt)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
