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
  CopyButton,
} from "@envoy/ui";
import { useAuthFetch } from "@/hooks/use-auth-fetch";
import { apiPost, ApiError } from "@/lib/api";

interface PairingResult {
  pairingId: string;
  pairingSecret: string;
  expiresAt: string;
}

interface PairingDialogProps {
  agentId: string;
}

export function PairingDialog({ agentId }: PairingDialogProps) {
  const authFetch = useAuthFetch();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PairingResult | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);

  useEffect(() => {
    if (!result) return;

    const interval = setInterval(() => {
      const remaining = Math.max(
        0,
        Math.floor((new Date(result.expiresAt).getTime() - Date.now()) / 1000)
      );
      setTimeLeft(remaining);
      if (remaining <= 0) clearInterval(interval);
    }, 1000);

    return () => clearInterval(interval);
  }, [result]);

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    try {
      const data = await apiPost<PairingResult>(
        `/api/v1/agents/${agentId}/pair`,
        {},
        authFetch
      );
      setResult(data);
      setTimeLeft(
        Math.floor((new Date(data.expiresAt).getTime() - Date.now()) / 1000)
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to generate pairing secret");
    } finally {
      setLoading(false);
    }
  }

  function handleOpenChange(isOpen: boolean) {
    setOpen(isOpen);
    if (!isOpen) {
      setResult(null);
      setError(null);
    }
  }

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          Generate Pairing Secret
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Pairing Secret</DialogTitle>
          <DialogDescription>
            Generate a one-time secret to pair an agent runtime with this identity.
          </DialogDescription>
        </DialogHeader>

        {!result ? (
          <div className="space-y-4">
            {error && (
              <div className="rounded-md bg-danger/10 px-4 py-3 text-sm text-danger">
                {error}
              </div>
            )}
            <p className="text-sm text-muted">
              The secret will be shown once and cannot be retrieved later.
              It expires in 10 minutes.
            </p>
            <Button onClick={handleGenerate} loading={loading}>
              Generate Secret
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-md bg-background p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="mb-1 text-xs font-medium text-muted">Pairing Secret</p>
                  <code className="break-all font-mono text-sm text-foreground">
                    {result.pairingSecret}
                  </code>
                </div>
                <CopyButton value={result.pairingSecret} />
              </div>
              <div className="mt-3">
                <p className="mb-1 text-xs font-medium text-muted">Pairing ID</p>
                <code className="break-all font-mono text-xs text-muted">
                  {result.pairingId}
                </code>
                <CopyButton value={result.pairingId} />
              </div>
            </div>

            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted">Expires in:</span>
              <span className={timeLeft < 60 ? "font-mono text-danger" : "font-mono text-foreground"}>
                {minutes}:{seconds.toString().padStart(2, "0")}
              </span>
            </div>

            <div className="rounded-md bg-yellow-500/10 px-4 py-3 text-sm text-yellow-500">
              Copy this secret now. It will not be shown again.
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
