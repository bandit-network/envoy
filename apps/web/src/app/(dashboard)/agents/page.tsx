"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Button,
  Badge,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
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
import { formatDate, truncateId } from "@/lib/format";
import { toast } from "sonner";

interface AgentRow {
  id: string;
  name: string;
  description: string | null;
  status: string;
  createdAt: string;
}

interface AgentListResponse {
  agents: AgentRow[];
  total: number;
  limit: number;
  offset: number;
}

const statusBadgeVariant: Record<string, "success" | "danger" | "warning" | "muted"> = {
  active: "success",
  suspended: "warning",
  revoked: "danger",
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
      const message = err instanceof ApiError ? err.message : "Failed to revoke agent";
      toast.error(message);
      setError(message);
    }
  }

  return (
    <div>
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
        <div className="mb-4 rounded-md bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : agents.length === 0 ? (
        <EmptyState
          icon={
            <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
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
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>ID</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {agents.map((agent) => (
              <TableRow key={agent.id}>
                <TableCell>
                  <Link
                    href={`/agents/${agent.id}`}
                    className="font-medium text-foreground hover:text-accent"
                  >
                    {agent.name}
                  </Link>
                </TableCell>
                <TableCell className="font-mono text-xs text-muted">
                  {truncateId(agent.id)}
                </TableCell>
                <TableCell>
                  <Badge variant={statusBadgeVariant[agent.status] ?? "muted"}>
                    {agent.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted">
                  {formatDate(agent.createdAt)}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="rounded p-1 text-muted hover:bg-elevated hover:text-foreground">
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 12.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 18.75a.75.75 0 110-1.5.75.75 0 010 1.5z" />
                        </svg>
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => router.push(`/agents/${agent.id}`)}>
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
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
