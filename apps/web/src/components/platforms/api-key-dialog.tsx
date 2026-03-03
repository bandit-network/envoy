"use client";

import { useState } from "react";
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
  CopyButton,
} from "@envoy/ui";
import { useAuthFetch } from "@/hooks/use-auth-fetch";
import { apiPost, ApiError } from "@/lib/api";

interface ApiKeyResult {
  keyId: string;
  key: string;
  keyPrefix: string;
  label: string | null;
  scopes: string[];
}

interface ApiKeyDialogProps {
  platformId: string;
  onCreated: () => void;
}

export function ApiKeyDialog({ platformId, onCreated }: ApiKeyDialogProps) {
  const authFetch = useAuthFetch();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ApiKeyResult | null>(null);
  const [label, setLabel] = useState("");

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    try {
      const data = await apiPost<ApiKeyResult>(
        `/api/v1/platforms/${platformId}/api-keys`,
        { label: label.trim() || undefined },
        authFetch
      );
      setResult(data);
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to generate API key");
    } finally {
      setLoading(false);
    }
  }

  function handleOpenChange(isOpen: boolean) {
    setOpen(isOpen);
    if (!isOpen) {
      setResult(null);
      setError(null);
      setLabel("");
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm">Generate API Key</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Generate API Key</DialogTitle>
          <DialogDescription>
            Create a new API key for this platform to verify agent tokens.
          </DialogDescription>
        </DialogHeader>

        {!result ? (
          <div className="space-y-4">
            <div>
              <label htmlFor="key-label" className="mb-1.5 block text-sm font-medium text-foreground">
                Label <span className="text-muted">(optional)</span>
              </label>
              <Input
                id="key-label"
                placeholder="Production key"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                maxLength={255}
              />
            </div>

            {error && (
              <div className="rounded-md bg-danger/10 px-4 py-3 text-sm text-danger">{error}</div>
            )}

            <Button onClick={handleGenerate} loading={loading}>
              Generate Key
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-md bg-background p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="mb-1 text-xs font-medium text-muted">API Key</p>
                  <code className="block break-all font-mono text-sm text-foreground">
                    {result.key}
                  </code>
                </div>
                <CopyButton value={result.key} />
              </div>
            </div>

            <div className="rounded-md bg-yellow-500/10 px-4 py-3 text-sm text-yellow-500">
              Copy this key now. It will not be shown again.
            </div>
          </div>
        )}

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost">Close</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
