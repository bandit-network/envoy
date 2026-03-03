"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Textarea } from "@envoy/ui";
import { PageHeader } from "@/components/layout/page-header";
import { useAuthFetch } from "@/hooks/use-auth-fetch";
import { apiPost, ApiError } from "@/lib/api";
import { getAgentAvatarUrl } from "@/lib/avatar";
import { toast } from "sonner";

interface CreateAgentResponse {
  id: string;
  name: string;
}

export default function CreateAgentPage() {
  const authFetch = useAuthFetch();
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [username, setUsername] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [socialMoltbook, setSocialMoltbook] = useState("");
  const [socialX, setSocialX] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Preview avatar: use entered URL or a placeholder based on username/name
  const previewSeed = username || name || "new-agent";
  const previewAvatar = avatarUrl.trim()
    ? avatarUrl.trim()
    : getAgentAvatarUrl(previewSeed, null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const agent = await apiPost<CreateAgentResponse>("/api/v1/agents", {
        name: name.trim(),
        description: description.trim() || null,
        username: username.trim() || undefined,
        avatarUrl: avatarUrl.trim() || null,
        socialMoltbook: socialMoltbook.trim() || null,
        socialX: socialX.trim() || null,
      }, authFetch);
      toast.success("Agent created");
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
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Avatar preview */}
            <div className="flex items-center gap-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewAvatar}
                alt="Agent avatar preview"
                className="h-16 w-16 rounded-full bg-surface object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = getAgentAvatarUrl(previewSeed, null);
                }}
              />
              <div className="flex-1">
                <label htmlFor="avatarUrl" className="mb-1.5 block text-sm font-medium text-foreground">
                  Avatar URL
                </label>
                <Input
                  id="avatarUrl"
                  type="url"
                  placeholder="https://example.com/avatar.png"
                  value={avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                />
                <p className="mt-1 text-xs text-muted">
                  Leave empty for auto-generated avatar
                </p>
              </div>
            </div>

            {/* Name */}
            <div>
              <label htmlFor="name" className="mb-1.5 block text-sm font-medium text-foreground">
                Name <span className="text-danger">*</span>
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

            {/* Username */}
            <div>
              <label htmlFor="username" className="mb-1.5 block text-sm font-medium text-foreground">
                Username
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted">@</span>
                <Input
                  id="username"
                  placeholder="my-agent"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase())}
                  maxLength={39}
                  className="pl-7"
                />
              </div>
              <p className="mt-1 text-xs text-muted">
                3-39 chars, lowercase letters, numbers, and hyphens
              </p>
            </div>

            {/* Description */}
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

            {/* Social links */}
            <div className="space-y-3">
              <p className="text-sm font-medium text-foreground">Social Links</p>
              <div>
                <label htmlFor="socialMoltbook" className="mb-1.5 block text-xs text-muted">
                  Moltbook
                </label>
                <Input
                  id="socialMoltbook"
                  type="url"
                  placeholder="https://moltbook.com/your-agent"
                  value={socialMoltbook}
                  onChange={(e) => setSocialMoltbook(e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="socialX" className="mb-1.5 block text-xs text-muted">
                  X (Twitter)
                </label>
                <Input
                  id="socialX"
                  type="url"
                  placeholder="https://x.com/your-agent"
                  value={socialX}
                  onChange={(e) => setSocialX(e.target.value)}
                />
              </div>
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
