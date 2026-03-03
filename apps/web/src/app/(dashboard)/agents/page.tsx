"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Button,
  Badge,
  Card,
  CardContent,
  Skeleton,
  EmptyState,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@envoy/ui";
import { PageHeader } from "@/components/layout/page-header";
import { useAuthFetch } from "@/hooks/use-auth-fetch";
import { apiGet, apiDelete, ApiError } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { getAgentAvatarUrl } from "@/lib/avatar";
import { toast } from "sonner";

interface AgentRow {
  id: string;
  name: string;
  description: string | null;
  username: string | null;
  avatarUrl: string | null;
  scopes?: string[];
  status: string;
  createdAt: string;
}

interface AgentListResponse {
  agents: AgentRow[];
  total: number;
  limit: number;
  offset: number;
}

const statusConfig: Record<string, { variant: "success" | "danger" | "warning" | "muted"; dot: string }> = {
  active: { variant: "success", dot: "bg-success" },
  suspended: { variant: "warning", dot: "bg-yellow-500" },
  revoked: { variant: "danger", dot: "bg-danger" },
};

export default function AgentsPage() {
  const authFetch = useAuthFetch();
  const router = useRouter();
  const [agents, setAgents] = useState<AgentRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAgents = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiGet<AgentListResponse>("/api/v1/agents", authFetch);
      setAgents(data.agents);
      setTotal(data.total);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load agents");
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    loadAgents();
  }, [loadAgents]);

  async function handleRevoke(agentId: string) {
    try {
      await apiDelete(`/api/v1/agents/${agentId}`, authFetch);
      toast.success("Agent revoked");
      await loadAgents();
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to revoke agent";
      toast.error(message);
      setError(message);
    }
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Agents"
        description={`${total} agent${total !== 1 ? "s" : ""} registered`}
        action={
          <Button asChild>
            <Link href="/agents/new">Create Agent</Link>
          </Button>
        }
      />

      {error && (
        <div className="mb-4 rounded-lg border border-danger/20 bg-danger/5 px-4 py-3 text-[13px] text-danger">
          {error}
        </div>
      )}

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>
                <Skeleton className="mt-4 h-3 w-full" />
                <Skeleton className="mt-2 h-3 w-3/4" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : agents.length === 0 ? (
        <Card>
          <EmptyState
            icon={
              <svg
                className="h-10 w-10"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
                />
              </svg>
            }
            title="No agents yet"
            description="Create your first agent to get started with Envoy identity management."
            action={
              <Button asChild>
                <Link href="/agents/new">Create Agent</Link>
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {agents.map((agent) => {
            const status = statusConfig[agent.status] ?? {
              variant: "muted" as const,
              dot: "bg-muted",
            };
            const displayScopes = agent.scopes?.slice(0, 3) ?? [];
            const extraScopes = (agent.scopes?.length ?? 0) - 3;

            return (
              <Card
                key={agent.id}
                className="group transition-colors hover:border-muted/40"
              >
                <CardContent className="p-4">
                  {/* Header: Avatar + Name + Menu */}
                  <div className="flex items-start justify-between">
                    <Link
                      href={`/agents/${agent.id}`}
                      className="flex items-start gap-3"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={getAgentAvatarUrl(agent.id, agent.avatarUrl)}
                        alt={agent.name}
                        className="h-10 w-10 shrink-0 rounded-full bg-elevated object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src =
                            getAgentAvatarUrl(agent.id, null);
                        }}
                      />
                      <div className="min-w-0">
                        <p className="text-[14px] font-medium text-foreground">
                          {agent.name}
                        </p>
                        {agent.username && (
                          <p className="text-[12px] text-muted">
                            @{agent.username}
                          </p>
                        )}
                      </div>
                    </Link>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="rounded-md p-1 text-muted opacity-0 transition-opacity hover:bg-elevated hover:text-foreground group-hover:opacity-100">
                          <svg
                            className="h-4 w-4"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M12 6.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 12.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 18.75a.75.75 0 110-1.5.75.75 0 010 1.5z"
                            />
                          </svg>
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => router.push(`/agents/${agent.id}`)}
                        >
                          View details
                        </DropdownMenuItem>
                        {agent.status !== "revoked" && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              destructive
                              onClick={() => handleRevoke(agent.id)}
                            >
                              Revoke agent
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {/* Description */}
                  {agent.description && (
                    <p className="mt-3 line-clamp-2 text-[13px] leading-[20px] text-muted">
                      {agent.description}
                    </p>
                  )}

                  {/* Footer: Status + Scopes + Date */}
                  <div className="mt-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
                        <span className="text-[12px] capitalize text-muted">
                          {agent.status}
                        </span>
                      </div>
                    </div>
                    <span className="text-[12px] text-muted">
                      {formatDate(agent.createdAt)}
                    </span>
                  </div>

                  {/* Scopes */}
                  {displayScopes.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {displayScopes.map((scope) => (
                        <Badge key={scope} variant="muted" className="text-[11px]">
                          {scope.replace("_", " ")}
                        </Badge>
                      ))}
                      {extraScopes > 0 && (
                        <Badge variant="muted" className="text-[11px]">
                          +{extraScopes}
                        </Badge>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
