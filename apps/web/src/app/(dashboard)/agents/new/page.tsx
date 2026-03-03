"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, CardContent, Input, Textarea, Badge } from "@envoy/ui";
import { PageHeader } from "@/components/layout/page-header";
import { useAuthFetch } from "@/hooks/use-auth-fetch";
import { apiPost, ApiError } from "@/lib/api";
import { getAgentAvatarUrl } from "@/lib/avatar";
import { toast } from "sonner";
import Link from "next/link";

interface CreateAgentResponse {
  id: string;
  name: string;
}

const scopeOptions = [
  {
    value: "api_access",
    label: "API Access",
    desc: "Basic API authentication and access",
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
      </svg>
    ),
  },
  {
    value: "trade",
    label: "Trade",
    desc: "Execute trades and financial operations",
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 7.5L7.5 3m0 0L12 7.5M7.5 3v13.5m13.5-4.5L16.5 16.5m0 0L12 12m4.5 4.5V7.5" />
      </svg>
    ),
  },
  {
    value: "write",
    label: "Write",
    desc: "Create and modify resources",
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
      </svg>
    ),
  },
  {
    value: "data_read",
    label: "Data Read",
    desc: "Read-only access to data endpoints",
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
];

export default function CreateAgentPage() {
  const authFetch = useAuthFetch();
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [username, setUsername] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [socialMoltbook, setSocialMoltbook] = useState("");
  const [socialX, setSocialX] = useState("");
  const [scopes, setScopes] = useState<string[]>(["api_access"]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const previewSeed = username || name || "new-agent";
  const previewAvatar = avatarUrl.trim()
    ? avatarUrl.trim()
    : getAgentAvatarUrl(previewSeed, null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const agent = await apiPost<CreateAgentResponse>(
        "/api/v1/agents",
        {
          name: name.trim(),
          description: description.trim() || null,
          username: username.trim() || undefined,
          avatarUrl: avatarUrl.trim() || null,
          socialMoltbook: socialMoltbook.trim() || null,
          socialX: socialX.trim() || null,
          scopes,
        },
        authFetch
      );
      toast.success("Agent created");
      router.push(`/agents/${agent.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create agent");
      setLoading(false);
    }
  }

  function toggleScope(value: string) {
    setScopes((prev) =>
      prev.includes(value)
        ? prev.filter((s) => s !== value)
        : [...prev, value]
    );
  }

  return (
    <div className="animate-fade-in">
      {/* Header with back */}
      <div className="mb-8 flex items-center gap-3">
        <Link
          href="/agents"
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted transition-colors hover:bg-surface hover:text-foreground"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </Link>
        <div>
          <h1 className="text-[20px] font-semibold text-foreground">Create Agent</h1>
          <p className="text-[13px] text-muted">Register a new agent identity</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr,320px]">
        {/* Form */}
        <Card>
          <CardContent className="p-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Identity Section */}
              <div>
                <h3 className="text-[13px] font-medium uppercase tracking-wider text-muted">Identity</h3>
                <div className="mt-4 space-y-4">
                  {/* Name */}
                  <div>
                    <label htmlFor="name" className="mb-1.5 block text-[13px] font-medium text-foreground">
                      Name <span className="text-danger">*</span>
                    </label>
                    <Input
                      id="name"
                      placeholder="My Trading Bot"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                      maxLength={255}
                    />
                  </div>

                  {/* Username */}
                  <div>
                    <label htmlFor="username" className="mb-1.5 block text-[13px] font-medium text-foreground">
                      Username
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-muted">@</span>
                      <Input
                        id="username"
                        placeholder="trading-bot"
                        value={username}
                        onChange={(e) => setUsername(e.target.value.toLowerCase())}
                        maxLength={39}
                        className="pl-7"
                      />
                    </div>
                    <p className="mt-1 text-[12px] text-muted">
                      3–39 chars, lowercase, numbers, hyphens
                    </p>
                  </div>

                  {/* Description */}
                  <div>
                    <label htmlFor="description" className="mb-1.5 block text-[13px] font-medium text-foreground">
                      Description
                    </label>
                    <Textarea
                      id="description"
                      placeholder="What does this agent do?"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      maxLength={1000}
                      rows={3}
                    />
                  </div>

                  {/* Avatar URL */}
                  <div>
                    <label htmlFor="avatarUrl" className="mb-1.5 block text-[13px] font-medium text-foreground">
                      Avatar URL
                    </label>
                    <Input
                      id="avatarUrl"
                      type="url"
                      placeholder="https://example.com/avatar.png"
                      value={avatarUrl}
                      onChange={(e) => setAvatarUrl(e.target.value)}
                    />
                    <p className="mt-1 text-[12px] text-muted">
                      Leave empty for auto-generated avatar
                    </p>
                  </div>
                </div>
              </div>

              {/* Divider */}
              <div className="border-t border-border" />

              {/* Social Links */}
              <div>
                <h3 className="text-[13px] font-medium uppercase tracking-wider text-muted">Social Links</h3>
                <div className="mt-4 space-y-4">
                  <div>
                    <label htmlFor="socialX" className="mb-1.5 block text-[13px] font-medium text-foreground">
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
                  <div>
                    <label htmlFor="socialMoltbook" className="mb-1.5 block text-[13px] font-medium text-foreground">
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
                </div>
              </div>

              {/* Divider */}
              <div className="border-t border-border" />

              {/* Permissions */}
              <div>
                <h3 className="text-[13px] font-medium uppercase tracking-wider text-muted">
                  Permissions <span className="text-danger">*</span>
                </h3>
                <p className="mt-1 text-[12px] text-muted">
                  Select at least one scope for this agent
                </p>
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  {scopeOptions.map((scope) => {
                    const isSelected = scopes.includes(scope.value);
                    return (
                      <button
                        key={scope.value}
                        type="button"
                        onClick={() => toggleScope(scope.value)}
                        className={`flex items-start gap-3 rounded-lg border p-3.5 text-left transition-colors ${
                          isSelected
                            ? "border-foreground/30 bg-surface"
                            : "border-border hover:border-muted/40 hover:bg-surface/50"
                        }`}
                      >
                        <div className={`mt-0.5 shrink-0 ${isSelected ? "text-foreground" : "text-muted"}`}>
                          {scope.icon}
                        </div>
                        <div>
                          <p className={`text-[13px] font-medium ${isSelected ? "text-foreground" : "text-muted"}`}>
                            {scope.label}
                          </p>
                          <p className="mt-0.5 text-[12px] text-muted">{scope.desc}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="rounded-lg border border-danger/20 bg-danger/5 px-4 py-3 text-[13px] text-danger">
                  {error}
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center gap-3 border-t border-border pt-6">
                <Button type="submit" loading={loading} disabled={scopes.length === 0}>
                  Create Agent
                </Button>
                <Button type="button" variant="ghost" onClick={() => router.back()}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Live Preview */}
        <div className="hidden lg:block">
          <div className="sticky top-8">
            <h3 className="mb-3 text-[13px] font-medium text-muted">Preview</h3>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={previewAvatar}
                    alt="Preview"
                    className="h-12 w-12 rounded-full bg-elevated object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = getAgentAvatarUrl(previewSeed, null);
                    }}
                  />
                  <div className="min-w-0">
                    <p className="text-[14px] font-medium text-foreground">
                      {name || "Agent Name"}
                    </p>
                    {username && (
                      <p className="text-[12px] text-muted">@{username}</p>
                    )}
                  </div>
                </div>

                {description && (
                  <p className="mt-3 text-[13px] leading-[20px] text-muted">
                    {description}
                  </p>
                )}

                {scopes.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {scopes.map((s) => (
                      <span
                        key={s}
                        className="rounded-md border border-border bg-elevated px-2 py-0.5 font-mono text-[11px] text-foreground"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                )}

                <div className="mt-4 flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-success" />
                  <span className="text-[12px] text-muted">Active</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
