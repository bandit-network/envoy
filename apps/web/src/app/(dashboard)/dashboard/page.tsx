"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, Skeleton, Button } from "@envoy/ui";
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

interface Stats {
  total: number;
  active: number;
  revoked: number;
  lastActivity: string | null;
}

export default function DashboardPage() {
  const authFetch = useAuthFetch();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const data = await apiGet<AgentListResponse>("/api/v1/agents?limit=100", authFetch);
        const agents = data.agents;
        const active = agents.filter((a) => a.status === "active").length;
        const revoked = agents.filter((a) => a.status === "revoked").length;

        // Find most recent activity
        const sorted = [...agents].sort(
          (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        );

        setStats({
          total: data.total,
          active,
          revoked,
          lastActivity: sorted[0]?.updatedAt ?? null,
        });
      } catch {
        // Silently fail, show zeros
        setStats({ total: 0, active: 0, revoked: 0, lastActivity: null });
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [authFetch]);

  const statCards = [
    { label: "Total Agents", value: stats?.total ?? 0 },
    { label: "Active", value: stats?.active ?? 0 },
    { label: "Revoked", value: stats?.revoked ?? 0 },
  ];

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Agent identity overview"
        action={
          <Button asChild>
            <Link href="/agents/new">Create Agent</Link>
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        {statCards.map((card) => (
          <Card key={card.label}>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted">
                {card.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <p className="text-3xl font-bold text-foreground">{card.value}</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {!loading && stats?.lastActivity && (
        <p className="mt-6 text-sm text-muted">
          Last activity: {formatRelativeTime(stats.lastActivity)}
        </p>
      )}
    </div>
  );
}
