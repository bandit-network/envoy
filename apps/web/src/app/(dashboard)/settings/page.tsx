"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import Link from "next/link";
import { Card, CardContent, Skeleton, CopyButton } from "@envoy/ui";
import { PageHeader } from "@/components/layout/page-header";
import { useAuthFetch } from "@/hooks/use-auth-fetch";
import { apiGet } from "@/lib/api";

interface UserInfo {
  user: {
    userId: string;
    walletAddress: string;
    privyUserId: string | null;
    email: string | null;
  };
}

interface PlatformRow {
  id: string;
  name: string;
  domain: string;
}

interface PlatformListResponse {
  platforms: PlatformRow[];
  total: number;
}

interface IssuerInfo {
  issuer: string;
  jwks_uri: string;
  key_id: string;
  algorithms: string[];
}

const THEME_OPTIONS = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
] as const;

export default function SettingsPage() {
  const authFetch = useAuthFetch();
  const [user, setUser] = useState<UserInfo["user"] | null>(null);
  const [platforms, setPlatforms] = useState<PlatformRow[]>([]);
  const [issuer, setIssuer] = useState<IssuerInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    async function load() {
      try {
        const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";
        const [userData, platformData, issuerData] = await Promise.all([
          apiGet<UserInfo>("/api/v1/me", authFetch),
          apiGet<PlatformListResponse>("/api/v1/platforms?limit=100", authFetch).catch(
            () => ({ platforms: [], total: 0 })
          ),
          fetch(`${apiBase}/.well-known/envoy-issuer`)
            .then((r) => r.json() as Promise<{ success: boolean; data: IssuerInfo }>)
            .then((r) => r.data)
            .catch(() => null),
        ]);
        setUser(userData.user);
        setPlatforms(platformData.platforms);
        setIssuer(issuerData);
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
                {user.walletAddress && (
                  <div className="flex items-center justify-between py-3">
                    <div className="min-w-0">
                      <dt className="text-[12px] font-medium uppercase tracking-wider text-muted">Wallet Address</dt>
                      <dd className="mt-0.5 truncate font-mono text-[12px] text-foreground">
                        {user.walletAddress}
                      </dd>
                    </div>
                    <CopyButton value={user.walletAddress} />
                  </div>
                )}
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

        {/* Platforms Overview */}
        <Card>
          <CardContent className="p-6">
            <h3 className="text-[14px] font-semibold text-foreground">Platforms</h3>
            <p className="mt-1 text-[13px] text-muted">
              Platforms you&apos;ve registered for token verification
            </p>
            {loading ? (
              <div className="mt-4 space-y-3">
                <Skeleton className="h-5 w-48" />
              </div>
            ) : platforms.length === 0 ? (
              <div className="mt-4">
                <p className="text-[13px] text-muted">No platforms registered yet.</p>
                <Link
                  href="/platforms/new"
                  className="mt-2 inline-block text-[13px] font-medium text-foreground underline-offset-4 hover:underline"
                >
                  Register a platform →
                </Link>
              </div>
            ) : (
              <div className="mt-4 space-y-0 divide-y divide-border">
                {platforms.map((p) => (
                  <Link
                    key={p.id}
                    href={`/platforms/${p.id}`}
                    className="flex items-center justify-between py-3 first:pt-0 transition-colors hover:text-foreground"
                  >
                    <div>
                      <p className="text-[13px] font-medium text-foreground">{p.name}</p>
                      <p className="text-[12px] text-muted">{p.domain}</p>
                    </div>
                    <svg className="h-4 w-4 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                    </svg>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Webhooks */}
        <Card>
          <CardContent className="p-6">
            <h3 className="text-[14px] font-semibold text-foreground">Webhooks</h3>
            <p className="mt-1 text-[13px] text-muted">
              Receive real-time notifications when agent events occur: manifests issued, revoked, or expiring.
            </p>
            <p className="mt-3 text-[13px] text-muted">
              Webhook subscriptions are managed per-platform. Go to a platform&apos;s detail page to add or remove webhook endpoints.
            </p>
            {platforms.length > 0 ? (
              <Link
                href={`/platforms/${platforms[0].id}`}
                className="mt-3 inline-block text-[13px] font-medium text-foreground underline-offset-4 hover:underline"
              >
                Manage webhooks →
              </Link>
            ) : (
              <Link
                href="/platforms/new"
                className="mt-3 inline-block text-[13px] font-medium text-foreground underline-offset-4 hover:underline"
              >
                Register a platform to enable webhooks →
              </Link>
            )}
          </CardContent>
        </Card>

        {/* Issuer Info */}
        <Card>
          <CardContent className="p-6">
            <h3 className="text-[14px] font-semibold text-foreground">Issuer</h3>
            <p className="mt-1 text-[13px] text-muted">
              Public key metadata for token verification. Platforms use this to verify agent identity tokens.
            </p>
            {issuer ? (
              <div className="mt-4 space-y-0 divide-y divide-border">
                <div className="flex items-center justify-between py-3 first:pt-0">
                  <div className="min-w-0">
                    <dt className="text-[12px] font-medium uppercase tracking-wider text-muted">Issuer URL</dt>
                    <dd className="mt-0.5 truncate font-mono text-[12px] text-foreground">{issuer.issuer}</dd>
                  </div>
                  <CopyButton value={issuer.issuer} />
                </div>
                <div className="flex items-center justify-between py-3">
                  <div className="min-w-0">
                    <dt className="text-[12px] font-medium uppercase tracking-wider text-muted">Key ID</dt>
                    <dd className="mt-0.5 truncate font-mono text-[12px] text-foreground">{issuer.key_id}</dd>
                  </div>
                  <CopyButton value={issuer.key_id} />
                </div>
                <div className="py-3">
                  <dt className="text-[12px] font-medium uppercase tracking-wider text-muted">Algorithms</dt>
                  <dd className="mt-0.5 text-[13px] text-foreground">{issuer.algorithms.join(", ")}</dd>
                </div>
                <div className="flex items-center justify-between py-3">
                  <div className="min-w-0">
                    <dt className="text-[12px] font-medium uppercase tracking-wider text-muted">JWKS URI</dt>
                    <dd className="mt-0.5 truncate font-mono text-[12px] text-foreground">{issuer.jwks_uri}</dd>
                  </div>
                  <CopyButton value={issuer.jwks_uri} />
                </div>
              </div>
            ) : (
              <p className="mt-4 text-[13px] text-muted">Could not load issuer metadata.</p>
            )}
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
            <p className="mt-2 text-[12px] text-muted">Contact support to delete your account</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
