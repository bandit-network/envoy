"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Textarea } from "@envoy/ui";
import { PageHeader } from "@/components/layout/page-header";
import { useAuthFetch } from "@/hooks/use-auth-fetch";
import { apiPost, ApiError } from "@/lib/api";

interface CreateAgentResponse {
  id: string;
  name: string;
}

export default function CreateAgentPage() {
  const authFetch = useAuthFetch();
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const agent = await apiPost<CreateAgentResponse>("/api/v1/agents", {
        name: name.trim(),
        description: description.trim() || null,
      }, authFetch);
      router.push(`/agents/${agent.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create agent");
      setLoading(false);
    }
  }

  return (
    <div>
      <PageHeader title="Create Agent" description="Register a new agent identity" />

      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle>Agent details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="name" className="mb-1.5 block text-sm font-medium text-foreground">
                Name
              </label>
              <Input
                id="name"
                placeholder="My Agent"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                maxLength={255}
                error={!!error}
              />
            </div>

            <div>
              <label htmlFor="description" className="mb-1.5 block text-sm font-medium text-foreground">
                Description
              </label>
              <Textarea
                id="description"
                placeholder="Optional description of what this agent does"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={1000}
                rows={3}
              />
            </div>

            {error && (
              <div className="rounded-md bg-danger/10 px-4 py-3 text-sm text-danger">
                {error}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <Button type="submit" loading={loading}>
                Create Agent
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
