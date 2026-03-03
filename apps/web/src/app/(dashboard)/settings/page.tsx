"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, Skeleton } from "@envoy/ui";
import { PageHeader } from "@/components/layout/page-header";
import { useAuthFetch } from "@/hooks/use-auth-fetch";
import { apiGet } from "@/lib/api";
import { formatDate } from "@/lib/format";

interface UserInfo {
  user: {
    userId: string;
    privyUserId: string;
    email: string | null;
  };
}

export default function SettingsPage() {
  const authFetch = useAuthFetch();
  const [user, setUser] = useState<UserInfo["user"] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const data = await apiGet<UserInfo>("/api/v1/me", authFetch);
        setUser(data.user);
      } catch {
        // Silently fail
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [authFetch]);

  return (
    <div>
      <PageHeader title="Settings" description="Account and configuration" />

      <div className="max-w-lg space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Account</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-5 w-64" />
              </div>
            ) : user ? (
              <dl className="space-y-3 text-sm">
                {user.email && (
                  <div>
                    <dt className="text-muted">Email</dt>
                    <dd className="mt-0.5 text-foreground">{user.email}</dd>
                  </div>
                )}
                <div>
                  <dt className="text-muted">Privy ID</dt>
                  <dd className="mt-0.5 font-mono text-xs text-foreground">
                    {user.privyUserId}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted">User ID</dt>
                  <dd className="mt-0.5 font-mono text-xs text-foreground">
                    {user.userId}
                  </dd>
                </div>
              </dl>
            ) : (
              <p className="text-sm text-muted">Failed to load account info.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base text-muted">Notification Preferences</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted">Coming soon.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base text-danger">Danger Zone</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted">
              Account deletion will be available in a future update.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
