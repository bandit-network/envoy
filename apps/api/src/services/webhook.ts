import { db, webhookSubscriptions } from "@envoy/db";
import { createHmac } from "crypto";
import { enqueueWebhook } from "./webhook-queue";

const WEBHOOK_SIGNING_SECRET = process.env.WEBHOOK_SIGNING_SECRET ?? "dev-webhook-secret";

export type WebhookEventType = "manifest.revoked" | "agent.revoked" | "manifest.issued" | "manifest.expiring";

interface WebhookEvent {
  type: WebhookEventType;
  data: Record<string, unknown>;
}

/**
 * Sign a webhook payload with HMAC-SHA256.
 */
export function signWebhookPayload(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

/**
 * Deliver a webhook event by enqueueing it to the BullMQ queue.
 * The worker will pick it up and deliver to matching subscriptions.
 */
export function deliverWebhook(event: WebhookEvent): void {
  enqueueWebhook(event.type, event.data).catch((err) => {
    console.error("[webhook] failed to enqueue:", err);
  });
}

/**
 * Execute webhook delivery to all matching subscriptions.
 * Called by the BullMQ worker. Throws on failure so the job retries.
 */
export async function executeWebhookDelivery(
  type: string,
  data: Record<string, unknown>
): Promise<void> {
  const payload = JSON.stringify({
    id: crypto.randomUUID(),
    type,
    data,
    timestamp: new Date().toISOString(),
  });

  // Fetch all subscriptions and filter by event type in JS
  // (JSONB array containment needs raw SQL, this is simpler for now)
  const allSubs = await db.select().from(webhookSubscriptions);
  const matchingSubs = allSubs.filter((sub) => {
    const types = sub.eventTypes as string[];
    return types.includes(type);
  });

  if (matchingSubs.length === 0) return;

  const signature = signWebhookPayload(payload, WEBHOOK_SIGNING_SECRET);

  const results = await Promise.allSettled(
    matchingSubs.map((sub) => deliverToUrl(sub.url, payload, signature, type))
  );

  // If any delivery failed, throw so BullMQ retries the job
  const failures = results.filter((r) => r.status === "rejected");
  if (failures.length > 0) {
    throw new Error(
      `${failures.length}/${matchingSubs.length} webhook deliveries failed`
    );
  }
}

async function deliverToUrl(
  url: string,
  payload: string,
  signature: string,
  eventType: string
): Promise<void> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Envoy-Signature": signature,
      "X-Envoy-Event": eventType,
    },
    body: payload,
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    // 4xx errors (except 429) are not retryable
    if (response.status >= 400 && response.status < 500 && response.status !== 429) {
      console.warn(`[webhook] non-retryable ${response.status} from ${url}, dropping`);
      return;
    }
    throw new Error(`HTTP ${response.status} from ${url}`);
  }
}
