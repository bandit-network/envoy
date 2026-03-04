"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Button,
  Badge,
  Card,
  CardContent,
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
import { ApiKeyDialog } from "@/components/platforms/api-key-dialog";
import { WebhookSubscriptionDialog } from "@/components/platforms/webhook-subscription-dialog";
import { useAuthFetch } from "@/hooks/use-auth-fetch";
import { apiGet, apiPatch, apiDelete, ApiError } from "@/lib/api";
import { formatDate, truncateId } from "@/lib/format";
import { toast } from "sonner";

interface Platform {
  id: string;
  name: string;
  domain: string;
  webhookUrl: string | null;
  requireOnchainIdentity: boolean;
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

interface WebhookSubscription {
  id: string;
  platformId: string;
  url: string;
  eventTypes: string[];
  createdAt: string;
}

interface WebhooksResponse {
  subscriptions: WebhookSubscription[];
}

export default function PlatformDetailPage() {
  const params = useParams();
  const router = useRouter();
  const authFetch = useAuthFetch();
  const platformId = params.id as string;

  const [platform, setPlatform] = useState<Platform | null>(null);
  const [keys, setKeys] = useState<ApiKeyRow[]>([]);
  const [webhooks, setWebhooks] = useState<WebhookSubscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadPlatform = useCallback(async () => {
    try {
      const [detailData, keysData, webhooksData] = await Promise.all([
        apiGet<PlatformDetailResponse>(
          `/api/v1/platforms/${platformId}`,
          authFetch
        ),
        apiGet<ApiKeysResponse>(
          `/api/v1/platforms/${platformId}/api-keys`,
          authFetch
        ),
        apiGet<WebhooksResponse>("/api/v1/webhooks", authFetch).catch(() => ({
          subscriptions: [],
        })),
      ]);
      setPlatform(detailData.platform);
      setKeys(keysData.keys);
      // Filter webhooks to this platform
      setWebhooks(
        webhooksData.subscriptions.filter((s) => s.platformId === platformId)
      );
      setError(null);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Failed to load platform"
      );
    } finally {
      setLoading(false);
    }
  }, [platformId, authFetch]);

  useEffect(() => {
    loadPlatform();
  }, [loadPlatform]);

  async function handleRevokeKey(keyId: string) {
    try {
      await apiDelete(
        `/api/v1/platforms/${platformId}/api-keys/${keyId}`,
        authFetch
      );
      toast.success("API key revoked");
      await loadPlatform();
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to revoke API key";
      toast.error(message);
      setError(message);
    }
  }

  async function handleDeleteWebhook(subscriptionId: string) {
    try {
      await apiDelete(`/api/v1/webhooks/${subscriptionId}`, authFetch);
      toast.success("Webhook subscription deleted");
      await loadPlatform();
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : "Failed to delete subscription";
      toast.error(message);
    }
  }

  async function handleToggleOnchain() {
    if (!platform) return;
    try {
      await apiPatch(
        `/api/v1/platforms/${platformId}`,
        { requireOnchainIdentity: !platform.requireOnchainIdentity },
        authFetch
      );
      toast.success(
        platform.requireOnchainIdentity
          ? "On-chain identity requirement disabled"
          : "On-chain identity requirement enabled"
      );
      await loadPlatform();
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to update setting";
      toast.error(message);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    );
  }

  if (error && !platform) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-danger/20 bg-danger/5 px-4 py-3 text-[13px] text-danger">
          {error}
        </div>
        <Button variant="ghost" onClick={() => router.push("/platforms")}>
          ← Back to platforms
        </Button>
      </div>
    );
  }

  if (!platform) return null;

  const activeKeys = keys.filter((k) => !k.revokedAt);
  const revokedKeys = keys.filter((k) => k.revokedAt);

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/platforms"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted transition-colors hover:bg-surface hover:text-foreground"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </Link>
          <div>
            <h1 className="text-[20px] font-semibold text-foreground">{platform.name}</h1>
            <p className="text-[13px] text-muted">{platform.domain}</p>
          </div>
        </div>
        {!platform.revokedAt && (
          <div className="flex flex-wrap items-center gap-2">
            <ApiKeyDialog platformId={platformId} onCreated={() => loadPlatform()} />
            <WebhookSubscriptionDialog platformId={platformId} onCreated={() => loadPlatform()} />
          </div>
        )}
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-danger/20 bg-danger/5 px-4 py-3 text-[13px] text-danger">
          {error}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Platform Info */}
        <Card>
          <CardContent className="p-6">
            <h3 className="text-[14px] font-semibold text-foreground">Platform Info</h3>
            <div className="mt-5 space-y-0 divide-y divide-border">
              <div className="flex items-center justify-between py-3 first:pt-0">
                <div>
                  <dt className="text-[12px] font-medium uppercase tracking-wider text-muted">Platform ID</dt>
                  <dd className="mt-0.5 font-mono text-[12px] text-foreground">{truncateId(platform.id)}</dd>
                </div>
                <CopyButton value={platform.id} />
              </div>
              <div className="py-3">
                <dt className="text-[12px] font-medium uppercase tracking-wider text-muted">Domain</dt>
                <dd className="mt-0.5 text-[13px] text-foreground">{platform.domain}</dd>
              </div>
              <div className="py-3">
                <dt className="text-[12px] font-medium uppercase tracking-wider text-muted">Created</dt>
                <dd className="mt-0.5 text-[13px] text-foreground">{formatDate(platform.createdAt)}</dd>
              </div>
              <div className="py-3">
                <dt className="text-[12px] font-medium uppercase tracking-wider text-muted">Webhook</dt>
                <dd className="mt-0.5 flex items-center gap-2">
                  {platform.webhookUrl ? (
                    <>
                      <span className="h-1.5 w-1.5 rounded-full bg-success" />
                      <span className="truncate font-mono text-[12px] text-foreground">
                        {platform.webhookUrl}
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="h-1.5 w-1.5 rounded-full bg-border" />
                      <span className="text-[13px] text-muted">Not configured</span>
                    </>
                  )}
                </dd>
              </div>
              <div className="py-3">
                <dt className="text-[12px] font-medium uppercase tracking-wider text-muted">
                  On-Chain Identity
                </dt>
                <dd className="mt-0.5 flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        platform.requireOnchainIdentity ? "bg-success" : "bg-border"
                      }`}
                    />
                    <span className="text-[13px] text-foreground">
                      {platform.requireOnchainIdentity ? "Required" : "Not required"}
                    </span>
                  </span>
                  {!platform.revokedAt && (
                    <button
                      type="button"
                      onClick={handleToggleOnchain}
                      className="text-[12px] font-medium text-accent transition-colors hover:text-accent/80"
                    >
                      {platform.requireOnchainIdentity ? "Disable" : "Enable"}
                    </button>
                  )}
                </dd>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* API Keys */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <h3 className="text-[14px] font-semibold text-foreground">
                API Keys
                {keys.length > 0 && (
                  <span className="ml-2 text-[12px] font-normal text-muted">
                    {activeKeys.length} active
                  </span>
                )}
              </h3>
            </div>

            {keys.length === 0 ? (
              <div className="mt-6 text-center">
                <p className="text-[13px] text-muted">No API keys yet</p>
                <p className="mt-1 text-[12px] text-muted">
                  Generate an API key to enable token verification.
                </p>
              </div>
            ) : (
              <div className="mt-4 space-y-0 divide-y divide-border">
                {[...activeKeys, ...revokedKeys].map((key) => (
                  <div key={key.id} className="flex items-center justify-between py-3 first:pt-0">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <code className="font-mono text-[12px] text-foreground">{key.keyPrefix}...</code>
                        <span className={`h-1.5 w-1.5 rounded-full ${key.revokedAt ? "bg-danger" : "bg-success"}`} />
                      </div>
                      <div className="mt-0.5 flex items-center gap-2">
                        <span className="text-[12px] text-muted">
                          {key.label ?? "Unlabeled"}
                        </span>
                        <span className="text-[11px] text-muted">·</span>
                        <span className="text-[12px] text-muted">
                          {formatDate(key.createdAt)}
                        </span>
                      </div>
                    </div>
                    {!key.revokedAt && (
                      <button
                        type="button"
                        onClick={() => handleRevokeKey(key.id)}
                        className="shrink-0 text-[12px] font-medium text-danger transition-colors hover:text-danger/80"
                      >
                        Revoke
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Webhook Subscriptions */}
      <div className="mt-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <h3 className="text-[14px] font-semibold text-foreground">
                Webhook Subscriptions
                {webhooks.length > 0 && (
                  <span className="ml-2 text-[12px] font-normal text-muted">
                    {webhooks.length} active
                  </span>
                )}
              </h3>
            </div>

            {webhooks.length === 0 ? (
              <div className="mt-6 text-center">
                <p className="text-[13px] text-muted">No webhook subscriptions</p>
                <p className="mt-1 text-[12px] text-muted">
                  Add a webhook to receive real-time event notifications.
                </p>
              </div>
            ) : (
              <div className="mt-4 space-y-0 divide-y divide-border">
                {webhooks.map((sub) => (
                  <div key={sub.id} className="flex items-center justify-between py-3 first:pt-0">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-success" />
                        <code className="truncate font-mono text-[12px] text-foreground">
                          {sub.url}
                        </code>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        {sub.eventTypes.map((et) => (
                          <span
                            key={et}
                            className="rounded-md border border-border bg-surface px-1.5 py-0.5 text-[10px] font-medium text-muted"
                          >
                            {et}
                          </span>
                        ))}
                        <span className="text-[11px] text-muted">·</span>
                        <span className="text-[11px] text-muted">
                          {formatDate(sub.createdAt)}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteWebhook(sub.id)}
                      className="shrink-0 text-[12px] font-medium text-danger transition-colors hover:text-danger/80"
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
