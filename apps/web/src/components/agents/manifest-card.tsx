"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, Badge, CopyButton } from "@envoy/ui";
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

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <CardTitle className="text-base">Active Manifest</CardTitle>
          <Badge variant={isActive ? "success" : isRevoked ? "danger" : "warning"}>
            {isRevoked ? "revoked" : isExpired ? "expired" : "active"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted">Manifest ID</dt>
            <dd className="mt-0.5 flex items-center gap-1 font-mono text-xs">
              {truncateId(manifest.id)}
              <CopyButton value={manifest.id} />
            </dd>
          </div>
          <div>
            <dt className="text-muted">Issued</dt>
            <dd className="mt-0.5">{formatDateTime(manifest.issuedAt)}</dd>
          </div>
          <div>
            <dt className="text-muted">Expires</dt>
            <dd className="mt-0.5">{formatDateTime(manifest.expiresAt)}</dd>
          </div>
          {walletAddresses.length > 0 && (
            <div>
              <dt className="text-muted">Wallet Addresses</dt>
              <dd className="mt-0.5 flex flex-wrap gap-1">
                {walletAddresses.map((addr) => (
                  <span key={addr} className="flex items-center gap-1 font-mono text-xs">
                    {addr.slice(0, 6)}...{addr.slice(-4)}
                    <CopyButton value={addr} />
                  </span>
                ))}
              </dd>
            </div>
          )}
          {scopes.length > 0 && (
            <div>
              <dt className="text-muted">Scopes</dt>
              <dd className="mt-0.5 flex flex-wrap gap-1">
                {scopes.map((scope) => (
                  <Badge key={scope} variant="muted">{scope}</Badge>
                ))}
              </dd>
            </div>
          )}
        </dl>

        <div>
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="text-xs font-medium text-accent hover:text-accent/80"
          >
            {expanded ? "Hide" : "Show"} signed token (JWT)
          </button>
          {expanded && (
            <div className="mt-2 rounded-md bg-background p-3">
              <div className="flex items-start justify-between gap-2">
                <code className="block max-h-32 overflow-auto break-all font-mono text-xs text-muted">
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
