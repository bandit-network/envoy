"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Card, CardContent, Skeleton, CopyButton } from "@envoy/ui";
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
    <div className="animate-fade-in">
      <PageHeader title="Settings" description="Account and configuration" />

      <div className="max-w-[640px] space-y-4">
        {/* Account */}
        <Card>
          <CardContent className="p-6">
            <h3 className="text-[14px] font-semibold text-foreground">Account</h3>
            {loading ? (
              <div className="mt-4 space-y-3">
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-5 w-64" />
              </div>
            ) : user ? (
              <div className="mt-4 space-y-0 divide-y divide-border">
                {user.email && (
                  <div className="flex items-center justify-between py-3 first:pt-0">
                    <div>
                      <dt className="text-[12px] font-medium uppercase tracking-wider text-muted">Email</dt>
                      <dd className="mt-0.5 text-[13px] text-foreground">{user.email}</dd>
                    </div>
                  </div>
                )}
                <div className="flex items-center justify-between py-3">
                  <div className="min-w-0">
                    <dt className="text-[12px] font-medium uppercase tracking-wider text-muted">Privy ID</dt>
                    <dd className="mt-0.5 truncate font-mono text-[12px] text-foreground">
                      {user.privyUserId}
                    </dd>
                  </div>
                  <CopyButton value={user.privyUserId} />
                </div>
                <div className="flex items-center justify-between py-3">
                  <div className="min-w-0">
                    <dt className="text-[12px] font-medium uppercase tracking-wider text-muted">User ID</dt>
                    <dd className="mt-0.5 truncate font-mono text-[12px] text-foreground">
                      {user.userId}
                    </dd>
                  </div>
                  <CopyButton value={user.userId} />
                </div>
              </div>
            ) : (
              <p className="mt-4 text-[13px] text-muted">Failed to load account info.</p>
            )}
          </CardContent>
        </Card>

        {/* Appearance */}
        <Card>
          <CardContent className="p-6">
            <h3 className="text-[14px] font-semibold text-foreground">Appearance</h3>
            <p className="mt-1 text-[13px] text-muted">
              Choose your preferred theme
            </p>
            {mounted ? (
              <div className="mt-4 inline-flex rounded-lg border border-border p-0.5">
                {THEME_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setTheme(option.value)}
                    className={`rounded-md px-4 py-1.5 text-[13px] font-medium transition-colors ${
                      theme === option.value
                        ? "bg-foreground text-background"
                        : "text-muted hover:text-foreground"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            ) : (
              <Skeleton className="mt-4 h-9 w-48" />
            )}
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card>
          <CardContent className="p-6">
            <h3 className="text-[14px] font-semibold text-muted">Notifications</h3>
            <div className="mt-4 space-y-0 divide-y divide-border">
              {[
                { label: "Agent revocation alerts", desc: "Get notified when an agent is revoked" },
                { label: "Pairing events", desc: "Get notified when an agent pairs with a runtime" },
                { label: "Platform registrations", desc: "Get notified when a new platform registers" },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between py-3 first:pt-0">
                  <div>
                    <p className="text-[13px] text-muted">{item.label}</p>
                    <p className="text-[12px] text-muted/60">{item.desc}</p>
                  </div>
                  {/* Disabled toggle */}
                  <div className="h-5 w-9 rounded-full bg-elevated" />
                </div>
              ))}
            </div>
            <p className="mt-3 text-[12px] text-muted">Coming soon</p>
          </CardContent>
        </Card>

        {/* Danger Zone */}
        <Card className="border-danger/20">
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <svg className="h-4 w-4 text-danger" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
              <h3 className="text-[14px] font-semibold text-danger">Danger Zone</h3>
            </div>
            <p className="mt-2 text-[13px] text-muted">
              Permanently delete your account and all associated data. This action cannot be undone.
            </p>
            <button
              disabled
              className="mt-4 rounded-lg border border-danger/30 px-4 py-2 text-[13px] font-medium text-danger opacity-50"
            >
              Delete Account
            </button>
            <p className="mt-2 text-[12px] text-muted">Available in a future update</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
