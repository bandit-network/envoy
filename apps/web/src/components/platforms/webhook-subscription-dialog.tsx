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
import { toast } from "sonner";

interface SubscriptionResult {
  id: string;
  url: string;
  eventTypes: string[];
  signingSecret: string;
  createdAt: string;
}

interface WebhookSubscriptionDialogProps {
  platformId: string;
  onCreated: () => void;
}

const EVENT_TYPE_OPTIONS = [
  { value: "manifest.revoked", label: "Manifest Revoked", desc: "When a manifest is revoked" },
  { value: "agent.revoked", label: "Agent Revoked", desc: "When an agent is permanently revoked" },
  { value: "manifest.issued", label: "Manifest Issued", desc: "When a new manifest is issued" },
  { value: "manifest.expiring", label: "Manifest Expiring", desc: "Before a manifest expires" },
];

export function WebhookSubscriptionDialog({ platformId, onCreated }: WebhookSubscriptionDialogProps) {
  const authFetch = useAuthFetch();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SubscriptionResult | null>(null);

  // Form state
  const [url, setUrl] = useState("");
  const [eventTypes, setEventTypes] = useState<string[]>([]);

  function toggleEventType(value: string) {
    setEventTypes((prev) =>
      prev.includes(value)
        ? prev.filter((e) => e !== value)
        : [...prev, value]
    );
  }

  function handleOpenChange(isOpen: boolean) {
    setOpen(isOpen);
    if (!isOpen) {
      setUrl("");
      setEventTypes([]);
      setResult(null);
      setError(null);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const data = await apiPost<SubscriptionResult>(
        "/api/v1/webhooks/subscribe",
        { platformId, url: url.trim(), eventTypes },
        authFetch
      );
      setResult(data);
      toast.success("Webhook subscription created");
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create subscription");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <svg
            className="mr-1.5 h-3.5 w-3.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Add Webhook
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Webhook Subscription</DialogTitle>
          <DialogDescription>
            Subscribe to events with a webhook endpoint. The signing secret will be shown once.
          </DialogDescription>
        </DialogHeader>

        {!result ? (
          <form onSubmit={handleCreate} className="space-y-5">
            <div>
              <label htmlFor="webhook-url" className="mb-1 block text-[13px] font-medium text-foreground">
                Webhook URL <span className="text-danger">*</span>
              </label>
              <Input
                id="webhook-url"
                type="url"
                placeholder="https://your-platform.com/webhook"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                required
              />
            </div>

            <div className="space-y-3">
              <h4 className="text-[12px] font-medium uppercase tracking-wider text-muted">
                Event Types <span className="text-danger">*</span>
              </h4>
              <div className="grid gap-2 sm:grid-cols-2">
                {EVENT_TYPE_OPTIONS.map((event) => {
                  const isSelected = eventTypes.includes(event.value);
                  return (
                    <button
                      key={event.value}
                      type="button"
                      onClick={() => toggleEventType(event.value)}
                      className={`rounded-lg border p-3 text-left transition-colors ${
                        isSelected
                          ? "border-foreground/30 bg-surface"
                          : "border-border hover:border-muted/40 hover:bg-surface/50"
                      }`}
                    >
                      <p className={`text-[13px] font-medium ${isSelected ? "text-foreground" : "text-muted"}`}>
                        {event.label}
                      </p>
                      <p className="mt-0.5 text-[11px] text-muted">{event.desc}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {error && (
              <div className="rounded-lg border border-danger/20 bg-danger/5 px-4 py-3 text-[13px] text-danger">
                {error}
              </div>
            )}

            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="ghost">Cancel</Button>
              </DialogClose>
              <Button type="submit" loading={loading} disabled={eventTypes.length === 0}>
                Create Subscription
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="rounded-md bg-background p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="mb-1 text-xs font-medium text-muted">Signing Secret</p>
                  <code className="break-all font-mono text-sm text-foreground">
                    {result.signingSecret}
                  </code>
                </div>
                <CopyButton value={result.signingSecret} />
              </div>
            </div>

            <div className="rounded-md bg-yellow-500/10 px-4 py-3 text-sm text-yellow-500">
              Copy this secret now. It will not be shown again.
            </div>

            <div className="text-[13px] text-muted">
              <p><span className="font-medium text-foreground">URL:</span> {result.url}</p>
              <p className="mt-1">
                <span className="font-medium text-foreground">Events:</span>{" "}
                {result.eventTypes.join(", ")}
              </p>
            </div>

            <DialogFooter>
              <DialogClose asChild>
                <Button variant="ghost">Close</Button>
              </DialogClose>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
