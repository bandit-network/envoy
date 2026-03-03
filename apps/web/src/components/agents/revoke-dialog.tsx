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
} from "@envoy/ui";
import { useAuthFetch } from "@/hooks/use-auth-fetch";
import { apiDelete, ApiError } from "@/lib/api";
import { toast } from "sonner";

interface RevokeDialogProps {
  agentId: string;
  agentName: string;
  onRevoked: () => void;
}

export function RevokeDialog({ agentId, agentName, onRevoked }: RevokeDialogProps) {
  const authFetch = useAuthFetch();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRevoke() {
    setLoading(true);
    setError(null);
    try {
      await apiDelete(`/api/v1/agents/${agentId}`, authFetch);
      toast.success("Agent revoked");
      setOpen(false);
      onRevoked();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to revoke agent");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="danger" size="sm">
          Revoke Agent
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Revoke Agent</DialogTitle>
          <DialogDescription>
            This will permanently revoke the agent &quot;{agentName}&quot; and all its active
            manifests. Platforms will no longer accept tokens from this agent.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="rounded-md bg-danger/10 px-4 py-3 text-sm text-danger">
            {error}
          </div>
        )}

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost">Cancel</Button>
          </DialogClose>
          <Button variant="danger" onClick={handleRevoke} loading={loading}>
            Revoke
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
