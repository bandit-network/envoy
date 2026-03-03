"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Button,
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CopyButton,
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
import { ApiKeyDialog } from "@/components/platforms/api-key-dialog";
import { useAuthFetch } from "@/hooks/use-auth-fetch";
import { apiGet, apiDelete, ApiError } from "@/lib/api";
import { formatDate, truncateId } from "@/lib/format";
import { toast } from "sonner";

interface Platform {
  id: string;
  name: string;
  domain: string;
  webhookUrl: string | null;
  createdAt: string;
  revokedAt: string | null;
}

interface PlatformDetailResponse {
  platform: Platform;
  apiKeyCount: number;
}

interface ApiKeyRow {
  id: string;
  keyPrefix: string;
  label: string | null;
  scopes: string[];
  revokedAt: string | null;
  createdAt: string;
}

interface ApiKeysResponse {
  keys: ApiKeyRow[];
}

export default function PlatformDetailPage() {
  const params = useParams();
  const router = useRouter();
  const authFetch = useAuthFetch();
  const platformId = params.id as string;

  const [platform, setPlatform] = useState<Platform | null>(null);
  const [keys, setKeys] = useState<ApiKeyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadPlatform = useCallback(async () => {
    try {
      const [detailData, keysData] = await Promise.all([
        apiGet<PlatformDetailResponse>(`/api/v1/platforms/${platformId}`, authFetch),
        apiGet<ApiKeysResponse>(`/api/v1/platforms/${platformId}/api-keys`, authFetch),
      ]);
      setPlatform(detailData.platform);
      setKeys(keysData.keys);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load platform");
    } finally {
      setLoading(false);
    }
  }, [platformId, authFetch]);

  useEffect(() => {
    loadPlatform();
  }, [loadPlatform]);

  async function handleRevokeKey(keyId: string) {
    try {
      await apiDelete(`/api/v1/platforms/${platformId}/api-keys/${keyId}`, authFetch);
      toast.success("API key revoked");
      await loadPlatform();
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to revoke API key";
      toast.error(message);
      setError(message);
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

  if (error && !platform) {
    return (
      <div className="space-y-4">
        <PageHeader title="Platform" />
        <div className="rounded-md bg-danger/10 px-4 py-3 text-sm text-danger">{error}</div>
        <Button variant="ghost" onClick={() => router.push("/platforms")}>
          Back to platforms
        </Button>
      </div>
    );
  }

  if (!platform) return null;

  const activeKeys = keys.filter((k) => !k.revokedAt);
  const revokedKeys = keys.filter((k) => k.revokedAt);

  return (
    <div>
      <PageHeader
        title={platform.name}
        action={
          <Button variant="ghost" asChild>
            <Link href="/platforms">Back to platforms</Link>
          </Button>
        }
      />

      {error && (
        <div className="mb-4 rounded-md bg-danger/10 px-4 py-3 text-sm text-danger">{error}</div>
      )}

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Platform Info</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-muted">Platform ID</dt>
                <dd className="mt-0.5 flex items-center gap-1 font-mono text-xs">
                  {truncateId(platform.id)}
                  <CopyButton value={platform.id} />
                </dd>
              </div>
              <div>
                <dt className="text-muted">Domain</dt>
                <dd className="mt-0.5">{platform.domain}</dd>
              </div>
              <div>
                <dt className="text-muted">Created</dt>
                <dd className="mt-0.5">{formatDate(platform.createdAt)}</dd>
              </div>
              {platform.webhookUrl && (
                <div>
                  <dt className="text-muted">Webhook URL</dt>
                  <dd className="mt-0.5 truncate font-mono text-xs">{platform.webhookUrl}</dd>
                </div>
              )}
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">API Keys</CardTitle>
              {!platform.revokedAt && (
                <ApiKeyDialog platformId={platformId} onCreated={() => loadPlatform()} />
              )}
            </div>
          </CardHeader>
          <CardContent>
            {keys.length === 0 ? (
              <EmptyState
                title="No API keys"
                description="Generate an API key to enable token verification."
                className="py-6"
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Key</TableHead>
                    <TableHead>Label</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...activeKeys, ...revokedKeys].map((key) => (
                    <TableRow key={key.id}>
                      <TableCell className="font-mono text-xs">
                        {key.keyPrefix}...
                      </TableCell>
                      <TableCell className="text-muted">
                        {key.label ?? "--"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={key.revokedAt ? "danger" : "success"}>
                          {key.revokedAt ? "revoked" : "active"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted">
                        {formatDate(key.createdAt)}
                      </TableCell>
                      <TableCell>
                        {!key.revokedAt && (
                          <button
                            type="button"
                            onClick={() => handleRevokeKey(key.id)}
                            className="text-xs font-medium text-danger hover:text-danger/80"
                          >
                            Revoke
                          </button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
