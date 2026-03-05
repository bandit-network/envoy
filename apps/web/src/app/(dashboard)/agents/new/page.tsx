"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, CardContent, Input, Textarea, Badge } from "@envoy/ui";
import { PageHeader } from "@/components/layout/page-header";
import { useAuthFetch } from "@/hooks/use-auth-fetch";
import { apiGet, apiPost, ApiError } from "@/lib/api";
import { getAgentAvatarUrl } from "@/lib/avatar";
import { toast } from "sonner";
import Link from "next/link";

interface Org {
  id: string;
  name: string;
  slug: string;
  role: string;
}

interface OrgListResponse {
  organizations: Org[];
}

interface PairingData {
  pairingId: string;
  pairingSecret: string;
  expiresAt: string;
}

interface CreateAgentResponse {
  id: string;
  name: string;
  pairing?: PairingData;
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
  const [defaultTtl, setDefaultTtl] = useState("");
  const [orgId, setOrgId] = useState<string | null>(null);
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdAgent, setCreatedAgent] = useState<CreateAgentResponse | null>(null);
  const [copied, setCopied] = useState<"id" | "secret" | "prompt" | null>(null);

  const loadOrgs = useCallback(async () => {
    try {
      const data = await apiGet<OrgListResponse>(
        "/api/v1/organizations",
        authFetch
      );
      // Only show orgs where user can create agents (owner, admin, member)
      setOrgs(data.organizations.filter((o) => o.role !== "viewer"));
    } catch {
      setOrgs([]);
    }
  }, [authFetch]);

  useEffect(() => {
    loadOrgs();
  }, [loadOrgs]);

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
          defaultTtl: defaultTtl ? Number(defaultTtl) : undefined,
          orgId: orgId || undefined,
        },
        authFetch
      );
      toast.success("Agent created");

      if (agent.pairing) {
        // Show pairing credentials immediately — no extra step
        setCreatedAgent(agent);
        setLoading(false);
      } else {
        // Fallback: pairing didn't auto-generate, go to detail page
        router.push(`/agents/${agent.id}`);
      }
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

  async function copyToClipboard(text: string, field: "id" | "secret" | "prompt") {
    await navigator.clipboard.writeText(text);
    setCopied(field);
    setTimeout(() => setCopied(null), 2000);
  }

  // ── Success screen: show pairing credentials ──────────────────────
  if (createdAgent?.pairing) {
    return (
      <div className="animate-fade-in">
        <div className="mx-auto max-w-lg">
          {/* Success icon */}
          <div className="mb-6 flex justify-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-success/10">
              <svg className="h-7 w-7 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </div>

          <h1 className="text-center text-[20px] font-semibold text-foreground">
            Agent Created
          </h1>
          <p className="mt-2 text-center text-[13px] text-muted">
            Give these pairing credentials to your agent. The secret is shown once and expires in 10 minutes.
          </p>

          <Card className="mt-6">
            <CardContent className="space-y-4 p-5">
              {/* Pairing ID */}
              <div>
                <label className="mb-1.5 block text-[12px] font-medium uppercase tracking-wider text-muted">
                  Pairing ID
                </label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 rounded-lg border border-border bg-elevated px-3 py-2.5 font-mono text-[13px] text-foreground break-all">
                    {createdAgent.pairing.pairingId}
                  </code>
                  <button
                    onClick={() => copyToClipboard(createdAgent.pairing!.pairingId, "id")}
                    className="shrink-0 rounded-lg border border-border p-2.5 text-muted transition-colors hover:bg-surface hover:text-foreground"
                    title="Copy"
                  >
                    {copied === "id" ? (
                      <svg className="h-4 w-4 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {/* Pairing Secret */}
              <div>
                <label className="mb-1.5 block text-[12px] font-medium uppercase tracking-wider text-muted">
                  Pairing Secret
                </label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 rounded-lg border border-border bg-elevated px-3 py-2.5 font-mono text-[13px] text-foreground break-all">
                    {createdAgent.pairing.pairingSecret}
                  </code>
                  <button
                    onClick={() => copyToClipboard(createdAgent.pairing!.pairingSecret, "secret")}
                    className="shrink-0 rounded-lg border border-border p-2.5 text-muted transition-colors hover:bg-surface hover:text-foreground"
                    title="Copy"
                  >
                    {copied === "secret" ? (
                      <svg className="h-4 w-4 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {/* Warning */}
              <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/5 px-4 py-3">
                <p className="text-[13px] text-yellow-600 dark:text-yellow-400">
                  <strong>Copy these now.</strong> The secret is only shown once and expires in 10 minutes. Your agent only needs these two values to complete pairing.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Agent prompt — copy-pasteable instruction for any agent */}
          {(() => {
            const domain = process.env.NEXT_PUBLIC_APP_URL ?? "https://useenvoy.dev";
            const prompt = `You have been assigned an Envoy identity. Read ${domain}/skill.md and complete pairing with these credentials:

ENVOY_PAIRING_ID=${createdAgent.pairing.pairingId}
ENVOY_PAIRING_SECRET=${createdAgent.pairing.pairingSecret}`;

            return (
              <div className="mt-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[13px] font-medium text-foreground">
                    Agent Prompt
                  </p>
                  <button
                    onClick={() => copyToClipboard(prompt, "prompt")}
                    className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-[12px] font-medium text-muted transition-colors hover:bg-surface hover:text-foreground"
                  >
                    {copied === "prompt" ? (
                      <>
                        <svg className="h-3.5 w-3.5 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                        Copied
                      </>
                    ) : (
                      <>
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
                        </svg>
                        Copy Prompt
                      </>
                    )}
                  </button>
                </div>
                <pre className="rounded-lg border border-border bg-elevated px-4 py-3 font-mono text-[12px] text-muted leading-relaxed whitespace-pre-wrap break-all">
                  {prompt}
                </pre>
                <p className="mt-1.5 text-[12px] text-muted">
                  Paste this into your agent&apos;s system prompt or config. The skill.md has everything it needs.
                </p>
              </div>
            );
          })()}

          {/* Action buttons */}
          <div className="mt-6 flex items-center justify-center gap-3">
            <Button onClick={() => router.push(`/agents/${createdAgent.id}`)}>
              Go to Agent
            </Button>
            <Button variant="ghost" onClick={() => router.push("/agents")}>
              Back to Agents
            </Button>
          </div>
        </div>
      </div>
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
                        onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""))}
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

              {/* Team / Organization */}
              {orgs.length > 0 && (
                <>
                  <div>
                    <h3 className="text-[13px] font-medium uppercase tracking-wider text-muted">Team</h3>
                    <div className="mt-4">
                      <label htmlFor="orgId" className="mb-1.5 block text-[13px] font-medium text-foreground">
                        Assign to Team
                      </label>
                      <select
                        id="orgId"
                        value={orgId ?? ""}
                        onChange={(e) => setOrgId(e.target.value || null)}
                        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-[13px] text-foreground focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                      >
                        <option value="">Personal (no team)</option>
                        {orgs.map((org) => (
                          <option key={org.id} value={org.id}>
                            {org.name}
                          </option>
                        ))}
                      </select>
                      <p className="mt-1 text-[12px] text-muted">
                        Team members will be able to view and manage this agent
                      </p>
                    </div>
                  </div>

                  {/* Divider */}
                  <div className="border-t border-border" />
                </>
              )}

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

              {/* Divider */}
              <div className="border-t border-border" />

              {/* Token Configuration */}
              <div>
                <h3 className="text-[13px] font-medium uppercase tracking-wider text-muted">
                  Token Configuration
                </h3>
                <div className="mt-4">
                  <label htmlFor="defaultTtl" className="mb-1.5 block text-[13px] font-medium text-foreground">
                    Default Token TTL (seconds)
                  </label>
                  <div className="flex items-center gap-3">
                    <Input
                      id="defaultTtl"
                      type="number"
                      placeholder="3600"
                      min={60}
                      max={86400}
                      value={defaultTtl}
                      onChange={(e) => setDefaultTtl(e.target.value)}
                      className="max-w-[180px]"
                    />
                    <span className="text-[12px] text-muted">
                      {defaultTtl
                        ? `= ${Number(defaultTtl) >= 3600
                            ? `${Math.floor(Number(defaultTtl) / 3600)}h ${Math.floor((Number(defaultTtl) % 3600) / 60)}m`
                            : `${Math.floor(Number(defaultTtl) / 60)}m`
                          }`
                        : "Default: 1 hour"}
                    </span>
                  </div>
                  <p className="mt-1 text-[12px] text-muted">
                    How long manifests are valid. Min: 60s, Max: 86400s (24h). Leave empty for default (1 hour).
                  </p>
                </div>
              </div>

              {/* Divider */}
              <div className="border-t border-border" />

              {/* On-Chain Identity — informational */}
              <div>
                <h3 className="text-[13px] font-medium uppercase tracking-wider text-muted">
                  On-Chain Identity (8004)
                </h3>
                <div className="mt-3 rounded-lg border border-border bg-surface px-4 py-3">
                  <p className="text-[13px] text-foreground font-medium">
                    Optional - register after creation
                  </p>
                  <p className="mt-1 text-[12px] text-muted leading-relaxed">
                    Some platforms require agents to have on-chain identity on the 8004 Solana registry.
                    Check with the platform your agent will interact with. You can register on 8004 from
                    the agent detail page after creation. It costs a small amount of SOL paid from your connected wallet.
                  </p>
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
