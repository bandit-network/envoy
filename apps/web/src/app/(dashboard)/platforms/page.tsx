"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Button,
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
      const data = await apiGet<PlatformListResponse>("/api/v1/platforms", authFetch);
      setPlatforms(data.platforms);
      setTotal(data.total);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load platforms");
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
      const message = err instanceof ApiError ? err.message : "Failed to revoke platform";
      toast.error(message);
      setError(message);
    }
  }

  return (
    <div>
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
        <div className="mb-4 rounded-md bg-danger/10 px-4 py-3 text-sm text-danger">{error}</div>
      )}

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : platforms.length === 0 ? (
        <EmptyState
          icon={
            <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 14.25h13.5m-13.5 0a3 3 0 01-3-3m3 3a3 3 0 100 6h13.5a3 3 0 100-6m-16.5-3a3 3 0 013-3h13.5a3 3 0 013 3m-19.5 0a4.5 4.5 0 01.9-2.7L5.737 5.1a3.375 3.375 0 012.7-1.35h7.126c1.062 0 2.062.5 2.7 1.35l2.587 3.45a4.5 4.5 0 01.9 2.7m0 0a3 3 0 01-3 3m0 3h.008v.008h-.008v-.008zm0-6h.008v.008h-.008v-.008zm-3 6h.008v.008h-.008v-.008zm0-6h.008v.008h-.008v-.008z" />
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
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Domain</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {platforms.map((platform) => (
              <TableRow key={platform.id}>
                <TableCell>
                  <Link
                    href={`/platforms/${platform.id}`}
                    className="font-medium text-foreground hover:text-accent"
                  >
                    {platform.name}
                  </Link>
                </TableCell>
                <TableCell className="text-muted">{platform.domain}</TableCell>
                <TableCell className="text-muted">{formatDate(platform.createdAt)}</TableCell>
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
                      <DropdownMenuItem onClick={() => router.push(`/platforms/${platform.id}`)}>
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
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
