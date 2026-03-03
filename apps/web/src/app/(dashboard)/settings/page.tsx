"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Card, CardContent, CardHeader, CardTitle, Skeleton } from "@envoy/ui";
import { PageHeader } from "@/components/layout/page-header";
import { useAuthFetch } from "@/hooks/use-auth-fetch";
import { apiGet } from "@/lib/api";

interface UserInfo {
  user: {
    userId: string;
    privyUserId: string;
    email: string | null;
  };
}

const THEME_OPTIONS = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
] as const;

export default function SettingsPage() {
  const authFetch = useAuthFetch();
  const [user, setUser] = useState<UserInfo["user"] | null>(null);
  const [loading, setLoading] = useState(true);
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

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
            <CardTitle className="text-base">Appearance</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-3 text-sm text-muted">
              Choose your preferred theme
            </p>
            {mounted ? (
              <div className="flex gap-2">
                {THEME_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setTheme(option.value)}
                    className={`rounded-md border px-4 py-2 text-sm font-medium transition-colors ${
                      theme === option.value
                        ? "border-accent bg-accent text-accent-fg"
                        : "border-border bg-transparent text-foreground hover:bg-surface"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            ) : (
              <Skeleton className="h-10 w-48" />
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
