"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, CardContent, Input } from "@envoy/ui";
import { useAuthFetch } from "@/hooks/use-auth-fetch";
import { apiPost, ApiError } from "@/lib/api";
import { toast } from "sonner";
import Link from "next/link";

interface CreatePlatformResponse {
  id: string;
  name: string;
}

export default function CreatePlatformPage() {
  const authFetch = useAuthFetch();
  const router = useRouter();
  const [name, setName] = useState("");
  const [domain, setDomain] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [requireOnchain, setRequireOnchain] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const platform = await apiPost<CreatePlatformResponse>(
        "/api/v1/platforms",
        {
          name: name.trim(),
          domain: domain.trim(),
          ...(webhookUrl.trim() ? { webhookUrl: webhookUrl.trim() } : {}),
          requireOnchainIdentity: requireOnchain,
        },
        authFetch
      );
      toast.success("Platform registered");
      router.push(`/platforms/${platform.id}`);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Failed to register platform"
      );
      setLoading(false);
    }
  }

  return (
    <div className="animate-fade-in">
      {/* Header with back */}
      <div className="mb-8 flex items-center gap-3">
        <Link
          href="/platforms"
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted transition-colors hover:bg-surface hover:text-foreground"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </Link>
        <div>
          <h1 className="text-[20px] font-semibold text-foreground">Register Platform</h1>
          <p className="text-[13px] text-muted">Add a new relying party platform</p>
        </div>
      </div>

      <Card className="max-w-[640px]">
        <CardContent className="p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <h3 className="text-[13px] font-medium uppercase tracking-wider text-muted">Platform Details</h3>
              <div className="mt-4 space-y-4">
                <div>
                  <label
                    htmlFor="name"
                    className="mb-1.5 block text-[13px] font-medium text-foreground"
                  >
                    Name <span className="text-danger">*</span>
                  </label>
                  <Input
                    id="name"
                    placeholder="My Platform"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    maxLength={255}
                  />
                </div>

                <div>
                  <label
                    htmlFor="domain"
                    className="mb-1.5 block text-[13px] font-medium text-foreground"
                  >
                    Domain <span className="text-danger">*</span>
                  </label>
                  <Input
                    id="domain"
                    placeholder="platform.example.com"
                    value={domain}
                    onChange={(e) => setDomain(e.target.value)}
                    required
                    maxLength={255}
                  />
                  <p className="mt-1 text-[12px] text-muted">
                    The domain where your platform is hosted
                  </p>
                </div>
              </div>
            </div>

            <div className="border-t border-border" />

            <div>
              <h3 className="text-[13px] font-medium uppercase tracking-wider text-muted">Webhook</h3>
              <div className="mt-4">
                <label
                  htmlFor="webhookUrl"
                  className="mb-1.5 block text-[13px] font-medium text-foreground"
                >
                  Webhook URL <span className="text-muted">(optional)</span>
                </label>
                <Input
                  id="webhookUrl"
                  placeholder="https://platform.example.com/webhooks/envoy"
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  type="url"
                />
                <p className="mt-1 text-[12px] text-muted">
                  Receive real-time revocation notifications
                </p>
              </div>
            </div>

            <div className="border-t border-border" />

            <div>
              <h3 className="text-[13px] font-medium uppercase tracking-wider text-muted">Requirements</h3>
              <div className="mt-4">
                <label className="flex cursor-pointer items-start gap-3">
                  <div className="relative mt-0.5">
                    <input
                      type="checkbox"
                      checked={requireOnchain}
                      onChange={(e) => setRequireOnchain(e.target.checked)}
                      className="peer sr-only"
                    />
                    <div className="h-5 w-9 rounded-full bg-border transition-colors peer-checked:bg-registry" />
                    <div className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-foreground transition-transform peer-checked:translate-x-4" />
                  </div>
                  <div>
                    <span className="text-[13px] font-medium text-foreground">
                      Require On-Chain Identity
                    </span>
                    <p className="mt-0.5 text-[12px] text-muted">
                      When enabled, only agents with a verified Solana wallet and 8004 registry entry can authenticate with this platform
                    </p>
                  </div>
                </label>
              </div>
            </div>

            {error && (
              <div className="rounded-lg border border-danger/20 bg-danger/5 px-4 py-3 text-[13px] text-danger">
                {error}
              </div>
            )}

            <div className="flex items-center gap-3 border-t border-border pt-6">
              <Button type="submit" loading={loading}>
                Register Platform
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => router.back()}
              >
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
