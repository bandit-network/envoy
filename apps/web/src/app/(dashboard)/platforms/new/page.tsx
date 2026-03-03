"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, CardContent, CardHeader, CardTitle, Input } from "@envoy/ui";
import { PageHeader } from "@/components/layout/page-header";
import { useAuthFetch } from "@/hooks/use-auth-fetch";
import { apiPost, ApiError } from "@/lib/api";

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
        },
        authFetch
      );
      router.push(`/platforms/${platform.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to register platform");
      setLoading(false);
    }
  }

  return (
    <div>
      <PageHeader title="Register Platform" description="Add a new relying party platform" />

      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle>Platform details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="name" className="mb-1.5 block text-sm font-medium text-foreground">
                Name
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
              <label htmlFor="domain" className="mb-1.5 block text-sm font-medium text-foreground">
                Domain
              </label>
              <Input
                id="domain"
                placeholder="platform.example.com"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                required
                maxLength={255}
              />
            </div>

            <div>
              <label htmlFor="webhookUrl" className="mb-1.5 block text-sm font-medium text-foreground">
                Webhook URL <span className="text-muted">(optional)</span>
              </label>
              <Input
                id="webhookUrl"
                placeholder="https://platform.example.com/webhooks/envoy"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                type="url"
              />
            </div>

            {error && (
              <div className="rounded-md bg-danger/10 px-4 py-3 text-sm text-danger">{error}</div>
            )}

            <div className="flex gap-3 pt-2">
              <Button type="submit" loading={loading}>
                Register Platform
              </Button>
              <Button type="button" variant="ghost" onClick={() => router.back()}>
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
