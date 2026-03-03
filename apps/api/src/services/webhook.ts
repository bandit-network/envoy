import { db, webhookSubscriptions } from "@envoy/db";
import { eq } from "drizzle-orm";
import { createHmac } from "crypto";

const WEBHOOK_SIGNING_SECRET = process.env.WEBHOOK_SIGNING_SECRET ?? "dev-webhook-secret";
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;

export type WebhookEventType = "manifest.revoked" | "agent.revoked" | "manifest.issued";

interface WebhookEvent {
  type: WebhookEventType;
  data: Record<string, unknown>;
  timestamp?: string;
}

/**
 * Sign a webhook payload with HMAC-SHA256.
 */
export function signWebhookPayload(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

/**
 * Deliver a webhook event to all matching subscriptions.
 * Fire-and-forget: runs async, does not block the caller.
 * Retries up to 3 times with exponential backoff.
 */
export function deliverWebhook(event: WebhookEvent): void {
  // Run async, don't await
  deliverWebhookAsync(event).catch((err) => {
    console.error("[webhook] delivery error:", err);
  });
}

async function deliverWebhookAsync(event: WebhookEvent): Promise<void> {
  const payload = JSON.stringify({
    id: crypto.randomUUID(),
    type: event.type,
    data: event.data,
    timestamp: event.timestamp ?? new Date().toISOString(),
  });

  // Find all subscriptions that include this event type
  const subscriptions = await db
    .select()
    .from(webhookSubscriptions)
    .where(eq(webhookSubscriptions.eventTypes, [event.type] as unknown as string[]));

  // Actually we need to filter in-app since JSONB array containment needs a raw query.
  // Fetch all subscriptions and filter by event type in JS.
  const allSubs = await db.select().from(webhookSubscriptions);
  const matchingSubs = allSubs.filter((sub) => {
    const types = sub.eventTypes as string[];
    return types.includes(event.type);
  });

  if (matchingSubs.length === 0) return;

  const signature = signWebhookPayload(payload, WEBHOOK_SIGNING_SECRET);

  const deliveries = matchingSubs.map((sub) =>
    deliverToUrl(sub.url, payload, signature)
  );

  await Promise.allSettled(deliveries);
}

async function deliverToUrl(
  url: string,
  payload: string,
  signature: string
): Promise<void> {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Envoy-Signature": signature,
          "X-Envoy-Event": JSON.parse(payload).type,
        },
        body: payload,
        signal: AbortSignal.timeout(10_000),
      });

      if (response.ok || (response.status >= 200 && response.status < 300)) {
        return; // Success
      }

      // 4xx errors are not retryable (except 429)
      if (response.status >= 400 && response.status < 500 && response.status !== 429) {
        console.warn(
          `[webhook] non-retryable ${response.status} from ${url}, dropping`
        );
        return;
      }
    } catch (err) {
      console.warn(
        `[webhook] attempt ${attempt + 1}/${MAX_RETRIES} failed for ${url}:`,
        err instanceof Error ? err.message : err
      );
    }

    // Exponential backoff: 1s, 4s, 16s
    if (attempt < MAX_RETRIES - 1) {
      const delay = BASE_DELAY_MS * Math.pow(4, attempt);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  console.error(`[webhook] all ${MAX_RETRIES} attempts failed for ${url}`);
}
