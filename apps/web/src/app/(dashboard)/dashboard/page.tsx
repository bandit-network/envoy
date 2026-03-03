"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, Skeleton, Button } from "@envoy/ui";
import { PageHeader } from "@/components/layout/page-header";
import { useAuthFetch } from "@/hooks/use-auth-fetch";
import { apiGet } from "@/lib/api";
import { formatRelativeTime } from "@/lib/format";

interface AgentRow {
  id: string;
  name: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

interface AgentListResponse {
  agents: AgentRow[];
  total: number;
  limit: number;
  offset: number;
}

interface PlatformRow {
  id: string;
  name: string;
  domain: string;
  createdAt: string;
}

interface PlatformListResponse {
  platforms: PlatformRow[];
  total: number;
  limit: number;
  offset: number;
}

interface AuditEntry {
  id: string;
  action: string;
  agentName: string | null;
  createdAt: string;
}

interface AuditResponse {
  entries: AuditEntry[];
  total: number;
}

interface Stats {
  totalAgents: number;
  activeAgents: number;
  revokedAgents: number;
  totalPlatforms: number;
  recentActivity: AuditEntry[];
  lastActivity: string | null;
}

const actionLabels: Record<string, string> = {
  agent_created: "Agent created",
  agent_revoked: "Agent revoked",
  agent_updated: "Agent updated",
  manifest_issued: "Manifest issued",
  manifest_revoked: "Manifest revoked",
  pairing_created: "Pairing initiated",
  pairing_confirmed: "Pairing confirmed",
  api_key_created: "API key created",
  api_key_revoked: "API key revoked",
};

export default function DashboardPage() {
  const authFetch = useAuthFetch();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [agentData, platformData, auditData] = await Promise.all([
          apiGet<AgentListResponse>("/api/v1/agents?limit=100", authFetch),
          apiGet<PlatformListResponse>("/api/v1/platforms?limit=100", authFetch).catch(() => ({ platforms: [], total: 0, limit: 100, offset: 0 })),
          apiGet<AuditResponse>("/api/v1/audit?limit=5", authFetch).catch(() => ({ entries: [], total: 0 })),
        ]);

        const agents = agentData.agents;
        const active = agents.filter((a) => a.status === "active").length;
        const revoked = agents.filter((a) => a.status === "revoked").length;
        const sorted = [...agents].sort(
          (a, b) =>
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        );

        setStats({
          totalAgents: agentData.total,
          activeAgents: active,
          revokedAgents: revoked,
          totalPlatforms: platformData.total,
          recentActivity: auditData.entries,
          lastActivity: sorted[0]?.updatedAt ?? null,
        });
      } catch {
        setStats({
          totalAgents: 0,
          activeAgents: 0,
          revokedAgents: 0,
          totalPlatforms: 0,
          recentActivity: [],
          lastActivity: null,
        });
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [authFetch]);

  const statCards = [
    {
      label: "Total Agents",
      value: stats?.totalAgents ?? 0,
      icon: (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
        </svg>
      ),
    },
    {
      label: "Active",
      value: stats?.activeAgents ?? 0,
      icon: (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      label: "Platforms",
      value: stats?.totalPlatforms ?? 0,
      icon: (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 17.25v-.228a4.5 4.5 0 00-.12-1.03l-2.268-9.64a3.375 3.375 0 00-3.285-2.602H7.923a3.375 3.375 0 00-3.285 2.602l-2.268 9.64a4.5 4.5 0 00-.12 1.03v.228m19.5 0a3 3 0 01-3 3H5.25a3 3 0 01-3-3m19.5 0a3 3 0 00-3-3H5.25a3 3 0 00-3 3m16.5 0h.008v.008h-.008v-.008zm-3 0h.008v.008h-.008v-.008z" />
        </svg>
      ),
    },
    {
      label: "Revoked",
      value: stats?.revokedAgents ?? 0,
      icon: (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
        </svg>
      ),
    },
  ];

  const quickActions = [
    {
      label: "Create Agent",
      description: "Register a new agent identity",
      href: "/agents/new",
      icon: (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
      ),
    },
    {
      label: "Register Platform",
      description: "Add a relying party",
      href: "/platforms/new",
      icon: (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 17.25v-.228a4.5 4.5 0 00-.12-1.03l-2.268-9.64a3.375 3.375 0 00-3.285-2.602H7.923a3.375 3.375 0 00-3.285 2.602l-2.268 9.64a4.5 4.5 0 00-.12 1.03v.228m19.5 0a3 3 0 01-3 3H5.25a3 3 0 01-3-3m19.5 0a3 3 0 00-3-3H5.25a3 3 0 00-3 3m16.5 0h.008v.008h-.008v-.008zm-3 0h.008v.008h-.008v-.008z" />
        </svg>
      ),
    },
    {
      label: "View Audit Log",
      description: "Review all activity",
      href: "/audit",
      icon: (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
        </svg>
      ),
    },
  ];

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Overview"
        description="Agent identity overview"
        action={
          <Button asChild>
            <Link href="/agents/new">Create Agent</Link>
          </Button>
        }
      />

      {/* Stats */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((card) => (
          <Card key={card.label} className="transition-colors hover:border-muted/40">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-[13px] text-muted">{card.label}</span>
                <span className="text-muted">{card.icon}</span>
              </div>
              {loading ? (
                <Skeleton className="mt-2 h-8 w-16" />
              ) : (
                <p className="mt-1 text-[28px] font-bold tracking-tight text-foreground">
                  {card.value}
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="mt-8">
        <h2 className="mb-3 text-[13px] font-medium text-muted">Quick Actions</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {quickActions.map((action) => (
            <Link key={action.href} href={action.href}>
              <Card className="h-full transition-colors hover:border-muted/40">
                <CardContent className="flex items-start gap-3 p-4">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] border border-border bg-background text-foreground">
                    {action.icon}
                  </div>
                  <div>
                    <p className="text-[13px] font-medium text-foreground">{action.label}</p>
                    <p className="mt-0.5 text-[12px] text-muted">{action.description}</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[13px] font-medium text-muted">Recent Activity</h2>
          <Link
            href="/audit"
            className="text-[12px] font-medium text-muted transition-colors hover:text-foreground"
          >
            View all →
          </Link>
        </div>
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="space-y-0 divide-y divide-border">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="px-4 py-3">
                    <Skeleton className="h-4 w-48" />
                  </div>
                ))}
              </div>
            ) : stats?.recentActivity && stats.recentActivity.length > 0 ? (
              <div className="divide-y divide-border">
                {stats.recentActivity.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between px-4 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-1.5 w-1.5 rounded-full bg-muted" />
                      <span className="text-[13px] text-foreground">
                        {actionLabels[entry.action] ?? entry.action}
                      </span>
                      {entry.agentName && (
                        <span className="text-[13px] text-muted">
                          · {entry.agentName}
                        </span>
                      )}
                    </div>
                    <span className="text-[12px] text-muted">
                      {formatRelativeTime(entry.createdAt)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="px-4 py-8 text-center">
                <p className="text-[13px] text-muted">No activity yet. Create an agent to get started.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
