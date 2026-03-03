"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  Badge,
  Button,
  Card,
  CardContent,
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

const actionDotColor: Record<string, string> = {
  agent_created: "bg-success",
  agent_revoked: "bg-danger",
  agent_updated: "bg-muted",
  manifest_issued: "bg-success",
  manifest_revoked: "bg-danger",
  pairing_created: "bg-muted",
  pairing_confirmed: "bg-success",
  api_key_created: "bg-success",
  api_key_revoked: "bg-danger",
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
      setError(
        err instanceof ApiError ? err.message : "Failed to load audit log"
      );
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
    <div className="animate-fade-in">
      <PageHeader
        title="Audit Log"
        description="Activity log across all your agents"
      />

      {error && (
        <div className="mb-4 rounded-lg border border-danger/20 bg-danger/5 px-4 py-3 text-[13px] text-danger">
          {error}
        </div>
      )}

      {loading ? (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="px-4 py-3">
                  <Skeleton className="h-4 w-64" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : entries.length === 0 ? (
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
                  d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
                />
              </svg>
            }
            title="No activity yet"
            description="Audit entries will appear here as you create and manage agents."
          />
        </Card>
      ) : (
        <>
          <Card>
            <CardContent className="p-0">
              <div className="divide-y divide-border">
                {entries.map((entry) => (
                  <React.Fragment key={entry.id}>
                    <div
                      className={`flex items-center justify-between px-4 py-3 transition-colors ${
                        entry.metadata ? "cursor-pointer hover:bg-surface/50" : ""
                      }`}
                      onClick={() => {
                        if (entry.metadata) {
                          setExpandedId(expandedId === entry.id ? null : entry.id);
                        }
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                            actionDotColor[entry.action] ?? "bg-muted"
                          }`}
                        />
                        <span className="text-[13px] text-foreground">
                          {actionLabels[entry.action] ?? entry.action}
                        </span>
                        {entry.agentName && (
                          <span className="text-[13px] text-muted">
                            · {entry.agentName}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[12px] text-muted">
                          {formatDateTime(entry.createdAt)}
                        </span>
                        {entry.metadata && (
                          <svg
                            className={`h-3 w-3 text-muted transition-transform ${
                              expandedId === entry.id ? "rotate-90" : ""
                            }`}
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                          </svg>
                        )}
                      </div>
                    </div>
                    {expandedId === entry.id && entry.metadata && (
                      <div className="border-t border-border bg-surface/50 px-4 py-3">
                        <pre className="overflow-auto font-mono text-[11px] leading-relaxed text-muted">
                          {JSON.stringify(entry.metadata, null, 2)}
                        </pre>
                      </div>
                    )}
                  </React.Fragment>
                ))}
              </div>
            </CardContent>
          </Card>

          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <p className="text-[13px] text-muted">
                Page {currentPage} of {totalPages}
                <span className="ml-1 text-muted/60">({total} entries)</span>
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
