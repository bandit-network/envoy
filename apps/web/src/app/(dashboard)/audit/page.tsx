"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  Badge,
  Button,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Skeleton,
  EmptyState,
} from "@envoy/ui";
import { PageHeader } from "@/components/layout/page-header";
import { useAuthFetch } from "@/hooks/use-auth-fetch";
import { apiGet, ApiError } from "@/lib/api";
import { formatDateTime } from "@/lib/format";

interface AuditEntry {
  id: string;
  action: string;
  agentId: string | null;
  agentName: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

interface AuditResponse {
  entries: AuditEntry[];
  total: number;
  limit: number;
  offset: number;
}

const actionVariant: Record<string, "success" | "danger" | "warning" | "muted" | "default"> = {
  agent_created: "success",
  agent_revoked: "danger",
  agent_updated: "default",
  manifest_issued: "success",
  manifest_revoked: "danger",
  pairing_created: "default",
  pairing_confirmed: "success",
  api_key_created: "success",
  api_key_revoked: "danger",
};

export default function AuditPage() {
  const authFetch = useAuthFetch();
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const limit = 20;

  const loadAudit = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiGet<AuditResponse>(
        `/api/v1/audit?limit=${limit}&offset=${offset}`,
        authFetch
      );
      setEntries(data.entries);
      setTotal(data.total);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load audit log");
    } finally {
      setLoading(false);
    }
  }, [authFetch, offset]);

  useEffect(() => {
    loadAudit();
  }, [loadAudit]);

  const totalPages = Math.ceil(total / limit);
  const currentPage = Math.floor(offset / limit) + 1;

  return (
    <div>
      <PageHeader
        title="Audit Log"
        description="Activity log across all your agents"
      />

      {error && (
        <div className="mb-4 rounded-md bg-danger/10 px-4 py-3 text-sm text-danger">{error}</div>
      )}

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <EmptyState
          icon={
            <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
          }
          title="No activity yet"
          description="Audit entries will appear here as you create and manage agents."
        />
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Action</TableHead>
                <TableHead>Agent</TableHead>
                <TableHead>Timestamp</TableHead>
                <TableHead className="w-20">Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((entry) => (
                <React.Fragment key={entry.id}>
                  <TableRow>
                    <TableCell>
                      <Badge variant={actionVariant[entry.action] ?? "muted"}>
                        {entry.action}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted">
                      {entry.agentName ?? "--"}
                    </TableCell>
                    <TableCell className="text-muted">
                      {formatDateTime(entry.createdAt)}
                    </TableCell>
                    <TableCell>
                      {entry.metadata && (
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedId(expandedId === entry.id ? null : entry.id)
                          }
                          className="text-xs font-medium text-accent hover:text-accent/80"
                        >
                          {expandedId === entry.id ? "Hide" : "View"}
                        </button>
                      )}
                    </TableCell>
                  </TableRow>
                  {expandedId === entry.id && entry.metadata && (
                    <TableRow>
                      <TableCell colSpan={4}>
                        <pre className="rounded-md bg-background p-3 font-mono text-xs text-muted">
                          {JSON.stringify(entry.metadata, null, 2)}
                        </pre>
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              ))}
            </TableBody>
          </Table>

          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <p className="text-sm text-muted">
                Page {currentPage} of {totalPages} ({total} entries)
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={offset === 0}
                  onClick={() => setOffset(Math.max(0, offset - limit))}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={offset + limit >= total}
                  onClick={() => setOffset(offset + limit)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
