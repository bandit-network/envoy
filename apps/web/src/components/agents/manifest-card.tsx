"use client";

import { useState } from "react";
import { Card, CardContent, Badge, CopyButton } from "@envoy/ui";
import { formatDateTime, truncateId } from "@/lib/format";

interface ManifestCardProps {
  manifest: {
    id: string;
    signature: string;
    manifestJson: Record<string, unknown>;
    issuedAt: string;
    expiresAt: string;
    revokedAt: string | null;
  };
}

export function ManifestCard({ manifest }: ManifestCardProps) {
  const [expanded, setExpanded] = useState(false);
  const isExpired = new Date(manifest.expiresAt) < new Date();
  const isRevoked = !!manifest.revokedAt;
  const isActive = !isExpired && !isRevoked;

  const scopes = (manifest.manifestJson.scopes as string[]) ?? [];
  const walletAddresses = (manifest.manifestJson.wallet_addresses as string[]) ?? [];

  const statusConfig = isActive
    ? { label: "Active", dot: "bg-success", variant: "success" as const }
    : isRevoked
    ? { label: "Revoked", dot: "bg-danger", variant: "danger" as const }
    : { label: "Expired", dot: "bg-yellow-500", variant: "warning" as const };

  return (
    <Card>
      <CardContent className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h3 className="text-[14px] font-semibold text-foreground">Manifest</h3>
          <div className="flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1">
            <span className={`h-1.5 w-1.5 rounded-full ${statusConfig.dot}`} />
            <span className="text-[12px] font-medium text-foreground">
              {statusConfig.label}
            </span>
          </div>
        </div>

        {/* Details */}
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-[12px] font-medium uppercase tracking-wider text-muted">Manifest ID</dt>
            <dd className="mt-1 flex items-center gap-1.5 font-mono text-[13px] text-foreground">
              {truncateId(manifest.id)}
              <CopyButton value={manifest.id} />
            </dd>
          </div>
          <div>
            <dt className="text-[12px] font-medium uppercase tracking-wider text-muted">Issued</dt>
            <dd className="mt-1 text-[13px] text-foreground">{formatDateTime(manifest.issuedAt)}</dd>
          </div>
          <div>
            <dt className="text-[12px] font-medium uppercase tracking-wider text-muted">Expires</dt>
            <dd className="mt-1 text-[13px] text-foreground">{formatDateTime(manifest.expiresAt)}</dd>
          </div>
          {walletAddresses.length > 0 && (
            <div>
              <dt className="text-[12px] font-medium uppercase tracking-wider text-muted">Wallets</dt>
              <dd className="mt-1 flex flex-wrap gap-1.5">
                {walletAddresses.map((addr) => (
                  <span key={addr} className="inline-flex items-center gap-1 font-mono text-[12px] text-foreground">
                    {addr.slice(0, 6)}...{addr.slice(-4)}
                    <CopyButton value={addr} />
                  </span>
                ))}
              </dd>
            </div>
          )}
        </div>

        {/* Scopes */}
        {scopes.length > 0 && (
          <div className="mt-5 border-t border-border pt-5">
            <dt className="text-[12px] font-medium uppercase tracking-wider text-muted">Scopes</dt>
            <dd className="mt-2 flex flex-wrap gap-1.5">
              {scopes.map((scope) => (
                <span
                  key={scope}
                  className="rounded-md border border-border bg-elevated px-2 py-0.5 font-mono text-[11px] text-foreground"
                >
                  {scope}
                </span>
              ))}
            </dd>
          </div>
        )}

        {/* Signature */}
        <div className="mt-5 border-t border-border pt-5">
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="inline-flex items-center gap-1.5 text-[12px] font-medium text-muted transition-colors hover:text-foreground"
          >
            <svg
              className={`h-3 w-3 transition-transform ${expanded ? "rotate-90" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
            {expanded ? "Hide" : "Show"} signed token
          </button>
          {expanded && (
            <div className="mt-3 rounded-lg border border-border bg-elevated p-3">
              <div className="flex items-start justify-between gap-2">
                <code className="block max-h-32 overflow-auto break-all font-mono text-[11px] leading-relaxed text-muted">
                  {manifest.signature}
                </code>
                <CopyButton value={manifest.signature} />
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
