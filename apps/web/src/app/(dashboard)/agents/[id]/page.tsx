"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button, Card, CardContent, Skeleton, Badge } from "@envoy/ui";
import { PageHeader } from "@/components/layout/page-header";
import { AgentInfoCard } from "@/components/agents/agent-info-card";
import { ManifestCard } from "@/components/agents/manifest-card";
import { RevokeDialog } from "@/components/agents/revoke-dialog";
import { EditAgentDialog } from "@/components/agents/edit-agent-dialog";
import { useAuthFetch } from "@/hooks/use-auth-fetch";
import { apiGet, apiPost, apiPatch, ApiError } from "@/lib/api";
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
  scopes: string[];
  status: string;
  walletAddress: string | null;
  registryAssetId: string | null;
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

const actionLabels: Record<string, string> = {
  agent_created: "Agent created",
  agent_revoked: "Agent revoked",
  agent_updated: "Agent updated",
  manifest_issued: "Manifest issued",
  manifest_revoked: "Manifest revoked",
  pairing_created: "Pairing initiated",
  pairing_confirmed: "Pairing confirmed",
  agent_registry_registered: "Registered on 8004",
};

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
        apiGet<AuditResponse>(
          `/api/v1/agents/${agentId}/audit?limit=8`,
          authFetch
        ),
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

  async function handleRefreshManifest() {
    setActionLoading("refresh");
    try {
      await apiPost(`/api/v1/agents/${agentId}/refresh`, {}, authFetch);
      toast.success("Manifest refreshed");
      await loadAgent();
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to refresh manifest";
      toast.error(message);
      setError(message);
    } finally {
      setActionLoading(null);
    }
  }

  async function handleSuspend() {
    setActionLoading("suspend");
    try {
      await apiPatch(`/api/v1/agents/${agentId}`, { status: "suspended" }, authFetch);
      toast.success("Agent suspended");
      await loadAgent();
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to suspend agent";
      toast.error(message);
    } finally {
      setActionLoading(null);
    }
  }

  async function handleRegisterOnChain() {
    setActionLoading("register");
    try {
      await apiPost(`/api/v1/agents/${agentId}/register`, {}, authFetch);
      toast.success("Agent registered on 8004 registry");
      await loadAgent();
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to register on-chain";
      toast.error(message);
    } finally {
      setActionLoading(null);
    }
  }

  async function handleUnsuspend() {
    setActionLoading("unsuspend");
    try {
      await apiPatch(`/api/v1/agents/${agentId}`, { status: "active" }, authFetch);
      toast.success("Agent reactivated");
      await loadAgent();
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to reactivate agent";
      toast.error(message);
    } finally {
      setActionLoading(null);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="space-y-4">
        <PageHeader title="Agent" />
        <div className="rounded-lg border border-danger/20 bg-danger/5 px-4 py-3 text-[13px] text-danger">
          {error}
        </div>
        <Button variant="ghost" onClick={() => router.push("/agents")}>
          ← Back to agents
        </Button>
      </div>
    );
  }

  if (!data) return null;

  const { agent, manifest } = data;
  const isActive = agent.status === "active";
  const isSuspended = agent.status === "suspended";

  return (
    <div className="animate-fade-in">
      {/* Header with actions */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/agents"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted transition-colors hover:bg-surface hover:text-foreground"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </Link>
          <div>
            <h1 className="text-[20px] font-semibold text-foreground">{agent.name}</h1>
            {agent.username && (
              <p className="text-[13px] text-muted">@{agent.username}</p>
            )}
          </div>
        </div>

        {isActive && (
          <div className="flex flex-wrap items-center gap-2">
            <EditAgentDialog agent={agent} onSaved={() => loadAgent()} />
            {manifest && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleRefreshManifest}
                loading={actionLoading === "refresh"}
              >
                Refresh Manifest
              </Button>
            )}
            {agent.walletAddress && !agent.registryAssetId && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleRegisterOnChain}
                loading={actionLoading === "register"}
                className="border-accent/30 text-accent hover:bg-accent/10"
              >
                Register on 8004
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={handleSuspend}
              loading={actionLoading === "suspend"}
              className="border-yellow-500/30 text-yellow-600 hover:bg-yellow-500/10 dark:text-yellow-400"
            >
              <svg className="mr-1.5 h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25v13.5m-7.5-13.5v13.5" />
              </svg>
              Suspend
            </Button>
            <RevokeDialog
              agentId={agentId}
              agentName={agent.name}
              onRevoked={() => loadAgent()}
            />
          </div>
        )}

        {isSuspended && (
          <div className="flex flex-wrap items-center gap-2">
            <EditAgentDialog agent={agent} onSaved={() => loadAgent()} />
            <Button
              size="sm"
              onClick={handleUnsuspend}
              loading={actionLoading === "unsuspend"}
            >
              <svg className="mr-1.5 h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
              </svg>
              Reactivate
            </Button>
            <RevokeDialog
              agentId={agentId}
              agentName={agent.name}
              onRevoked={() => loadAgent()}
            />
          </div>
        )}
      </div>

      {/* Suspension banner */}
      {isSuspended && (
        <div className="mb-4 flex items-center gap-3 rounded-lg border border-yellow-500/20 bg-yellow-500/5 px-4 py-3">
          <svg className="h-4 w-4 shrink-0 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
          <p className="text-[13px] text-yellow-600 dark:text-yellow-400">
            This agent is suspended. Manifests cannot be issued until reactivated.
          </p>
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-lg border border-danger/20 bg-danger/5 px-4 py-3 text-[13px] text-danger">
          {error}
        </div>
      )}

      {/* Two-column layout */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <AgentInfoCard agent={agent} />
        </div>
        <div className="space-y-4">
          {manifest && <ManifestCard manifest={manifest} />}

          {/* Activity Timeline */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <h3 className="text-[14px] font-semibold text-foreground">Activity</h3>
                <Link
                  href={`/audit?agent=${agentId}`}
                  className="text-[12px] font-medium text-muted transition-colors hover:text-foreground"
                >
                  View all →
                </Link>
              </div>

              {audit.length === 0 ? (
                <p className="mt-4 text-[13px] text-muted">No activity recorded yet.</p>
              ) : (
                <div className="mt-5 space-y-0">
                  {audit.map((entry, i) => (
                    <div key={entry.id} className="relative flex gap-3 pb-4">
                      {/* Timeline connector */}
                      <div className="flex flex-col items-center">
                        <div className="mt-1 h-2 w-2 shrink-0 rounded-full border-2 border-border bg-background" />
                        {i < audit.length - 1 && (
                          <div className="mt-1 h-full w-px bg-border" />
                        )}
                      </div>
                      <div className="flex flex-1 items-start justify-between pb-1">
                        <span className="text-[13px] text-foreground">
                          {actionLabels[entry.action] ?? entry.action}
                        </span>
                        <span className="shrink-0 text-[12px] text-muted">
                          {formatRelativeTime(entry.createdAt)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
