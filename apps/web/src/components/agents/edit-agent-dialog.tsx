"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
  Button,
  Input,
  Textarea,
} from "@envoy/ui";
import { useAuthFetch } from "@/hooks/use-auth-fetch";
import { apiPatch, ApiError } from "@/lib/api";
import { toast } from "sonner";

interface Agent {
  id: string;
  name: string;
  description: string | null;
  username: string | null;
  avatarUrl: string | null;
  socialMoltbook: string | null;
  socialX: string | null;
  scopes: string[];
}

interface EditAgentDialogProps {
  agent: Agent;
  onSaved: () => void;
}

const scopeOptions = [
  { value: "api_access", label: "API Access", desc: "Basic API authentication and access" },
  { value: "trade", label: "Trade", desc: "Execute trades and financial operations" },
  { value: "write", label: "Write", desc: "Create and modify resources" },
  { value: "data_read", label: "Data Read", desc: "Read-only access to data endpoints" },
];

export function EditAgentDialog({ agent, onSaved }: EditAgentDialogProps) {
  const authFetch = useAuthFetch();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState(agent.name);
  const [description, setDescription] = useState(agent.description ?? "");
  const [username, setUsername] = useState(agent.username ?? "");
  const [avatarUrl, setAvatarUrl] = useState(agent.avatarUrl ?? "");
  const [socialMoltbook, setSocialMoltbook] = useState(agent.socialMoltbook ?? "");
  const [socialX, setSocialX] = useState(agent.socialX ?? "");
  const [scopes, setScopes] = useState<string[]>(agent.scopes);

  // Reset form when dialog opens or agent changes
  useEffect(() => {
    if (open) {
      setName(agent.name);
      setDescription(agent.description ?? "");
      setUsername(agent.username ?? "");
      setAvatarUrl(agent.avatarUrl ?? "");
      setSocialMoltbook(agent.socialMoltbook ?? "");
      setSocialX(agent.socialX ?? "");
      setScopes(agent.scopes);
      setError(null);
    }
  }, [open, agent]);

  function toggleScope(value: string) {
    setScopes((prev) =>
      prev.includes(value)
        ? prev.filter((s) => s !== value)
        : [...prev, value]
    );
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await apiPatch(
        `/api/v1/agents/${agent.id}`,
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
      toast.success("Agent updated");
      setOpen(false);
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update agent");
    } finally {
      setLoading(false);
    }
  }

  const scopesChanged =
    JSON.stringify([...scopes].sort()) !==
    JSON.stringify([...agent.scopes].sort());

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <svg
            className="mr-1.5 h-3.5 w-3.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10"
            />
          </svg>
          Edit
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Agent</DialogTitle>
          <DialogDescription>
            Update agent metadata and permissions.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSave} className="space-y-5">
          {/* Identity */}
          <div className="space-y-3">
            <h4 className="text-[12px] font-medium uppercase tracking-wider text-muted">
              Identity
            </h4>

            <div>
              <label htmlFor="edit-name" className="mb-1 block text-[13px] font-medium text-foreground">
                Name <span className="text-danger">*</span>
              </label>
              <Input
                id="edit-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                maxLength={255}
              />
            </div>

            <div>
              <label htmlFor="edit-username" className="mb-1 block text-[13px] font-medium text-foreground">
                Username
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-muted">@</span>
                <Input
                  id="edit-username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase())}
                  maxLength={39}
                  className="pl-7"
                />
              </div>
            </div>

            <div>
              <label htmlFor="edit-description" className="mb-1 block text-[13px] font-medium text-foreground">
                Description
              </label>
              <Textarea
                id="edit-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={1000}
                rows={3}
              />
            </div>

            <div>
              <label htmlFor="edit-avatarUrl" className="mb-1 block text-[13px] font-medium text-foreground">
                Avatar URL
              </label>
              <Input
                id="edit-avatarUrl"
                type="url"
                placeholder="https://example.com/avatar.png"
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
              />
            </div>
          </div>

          {/* Social */}
          <div className="space-y-3 border-t border-border pt-4">
            <h4 className="text-[12px] font-medium uppercase tracking-wider text-muted">
              Social Links
            </h4>

            <div>
              <label htmlFor="edit-socialX" className="mb-1 block text-[13px] font-medium text-foreground">
                X (Twitter)
              </label>
              <Input
                id="edit-socialX"
                type="url"
                placeholder="https://x.com/your-agent"
                value={socialX}
                onChange={(e) => setSocialX(e.target.value)}
              />
            </div>

            <div>
              <label htmlFor="edit-socialMoltbook" className="mb-1 block text-[13px] font-medium text-foreground">
                Moltbook
              </label>
              <Input
                id="edit-socialMoltbook"
                type="url"
                placeholder="https://moltbook.com/your-agent"
                value={socialMoltbook}
                onChange={(e) => setSocialMoltbook(e.target.value)}
              />
            </div>
          </div>

          {/* Scopes */}
          <div className="space-y-3 border-t border-border pt-4">
            <h4 className="text-[12px] font-medium uppercase tracking-wider text-muted">
              Permissions
            </h4>

            <div className="grid gap-2 sm:grid-cols-2">
              {scopeOptions.map((scope) => {
                const isSelected = scopes.includes(scope.value);
                return (
                  <button
                    key={scope.value}
                    type="button"
                    onClick={() => toggleScope(scope.value)}
                    className={`rounded-lg border p-3 text-left transition-colors ${
                      isSelected
                        ? "border-foreground/30 bg-surface"
                        : "border-border hover:border-muted/40 hover:bg-surface/50"
                    }`}
                  >
                    <p className={`text-[13px] font-medium ${isSelected ? "text-foreground" : "text-muted"}`}>
                      {scope.label}
                    </p>
                    <p className="mt-0.5 text-[11px] text-muted">{scope.desc}</p>
                  </button>
                );
              })}
            </div>

            {scopesChanged && (
              <div className="rounded-md bg-yellow-500/10 px-3 py-2 text-[12px] text-yellow-600 dark:text-yellow-400">
                Scope changes take effect on next manifest refresh.
              </div>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="rounded-lg border border-danger/20 bg-danger/5 px-4 py-3 text-[13px] text-danger">
              {error}
            </div>
          )}

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="ghost">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" loading={loading} disabled={scopes.length === 0}>
              Save Changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
