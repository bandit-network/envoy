"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Button,
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
import { toast } from "sonner";

interface PlatformRow {
  id: string;
  name: string;
  domain: string;
  webhookUrl: string | null;
  createdAt: string;
}

interface PlatformListResponse {
  platforms: PlatformRow[];
  total: number;
  limit: number;
  offset: number;
}

export default function PlatformsPage() {
  const authFetch = useAuthFetch();
  const router = useRouter();
  const [platforms, setPlatforms] = useState<PlatformRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadPlatforms = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiGet<PlatformListResponse>(
        "/api/v1/platforms",
        authFetch
      );
      setPlatforms(data.platforms);
      setTotal(data.total);
      setError(null);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Failed to load platforms"
      );
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    loadPlatforms();
  }, [loadPlatforms]);

  async function handleDelete(platformId: string) {
    try {
      await apiDelete(`/api/v1/platforms/${platformId}`, authFetch);
      toast.success("Platform revoked");
      await loadPlatforms();
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to revoke platform";
      toast.error(message);
      setError(message);
    }
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Platforms"
        description={`${total} platform${total !== 1 ? "s" : ""} registered`}
        action={
          <Button asChild>
            <Link href="/platforms/new">Register Platform</Link>
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
                <Skeleton className="h-4 w-32" />
                <Skeleton className="mt-2 h-3 w-48" />
                <Skeleton className="mt-4 h-3 w-24" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : platforms.length === 0 ? (
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
                  d="M21.75 17.25v-.228a4.5 4.5 0 00-.12-1.03l-2.268-9.64a3.375 3.375 0 00-3.285-2.602H7.923a3.375 3.375 0 00-3.285 2.602l-2.268 9.64a4.5 4.5 0 00-.12 1.03v.228m19.5 0a3 3 0 01-3 3H5.25a3 3 0 01-3-3m19.5 0a3 3 0 00-3-3H5.25a3 3 0 00-3 3m16.5 0h.008v.008h-.008v-.008zm0-6h.008v.008h-.008v-.008zm-3 6h.008v.008h-.008v-.008zm0-6h.008v.008h-.008v-.008z"
                />
              </svg>
            }
            title="No platforms yet"
            description="Register a platform to enable token verification and webhook subscriptions."
            action={
              <Button asChild>
                <Link href="/platforms/new">Register Platform</Link>
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {platforms.map((platform) => (
            <Card
              key={platform.id}
              className="group transition-colors hover:border-muted/40"
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <Link
                    href={`/platforms/${platform.id}`}
                    className="min-w-0 flex-1"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-elevated text-muted">
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 17.25v-.228a4.5 4.5 0 00-.12-1.03l-2.268-9.64a3.375 3.375 0 00-3.285-2.602H7.923a3.375 3.375 0 00-3.285 2.602l-2.268 9.64a4.5 4.5 0 00-.12 1.03v.228m19.5 0a3 3 0 01-3 3H5.25a3 3 0 01-3-3m19.5 0a3 3 0 00-3-3H5.25a3 3 0 00-3 3m16.5 0h.008v.008h-.008v-.008zm-3 0h.008v.008h-.008v-.008z" />
                        </svg>
                      </div>
                      <div className="min-w-0">
                        <p className="text-[14px] font-medium text-foreground">
                          {platform.name}
                        </p>
                        <p className="truncate text-[12px] text-muted">
                          {platform.domain}
                        </p>
                      </div>
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
                        onClick={() =>
                          router.push(`/platforms/${platform.id}`)
                        }
                      >
                        View details
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        destructive
                        onClick={() => handleDelete(platform.id)}
                      >
                        Revoke platform
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* Footer */}
                <div className="mt-4 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        platform.webhookUrl ? "bg-success" : "bg-border"
                      }`}
                    />
                    <span className="text-[12px] text-muted">
                      {platform.webhookUrl ? "Webhook active" : "No webhook"}
                    </span>
                  </div>
                  <span className="text-[12px] text-muted">
                    {formatDate(platform.createdAt)}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
