import { db, manifests, agents } from "@envoy/db";
import { eq, and, isNull, between } from "drizzle-orm";
import { deliverWebhook } from "./webhook";

/**
 * How often to run the scanner (ms). Default: 5 minutes.
 */
const SCAN_INTERVAL_MS = Number(process.env.EXPIRY_SCAN_INTERVAL_MS) || 5 * 60 * 1000;

/**
 * How far ahead to look for expiring manifests (ms). Default: 15 minutes.
 * The scanner fires webhooks for manifests expiring within this window.
 */
const EXPIRY_WINDOW_MS = Number(process.env.EXPIRY_WINDOW_MS) || 15 * 60 * 1000;

let scannerTimer: ReturnType<typeof setInterval> | null = null;

/**
 * Scan for manifests about to expire and fire "manifest.expiring" webhooks.
 *
 * Finds active manifests (not revoked, not already notified) expiring within
 * the next EXPIRY_WINDOW_MS and delivers a webhook for each.
 */
export async function scanExpiringManifests(): Promise<number> {
  const now = new Date();
  const windowEnd = new Date(now.getTime() + EXPIRY_WINDOW_MS);

  // Find manifests expiring within the window that haven't been notified
  const expiringManifests = await db
    .select({
      id: manifests.id,
      agentId: manifests.agentId,
      expiresAt: manifests.expiresAt,
    })
    .from(manifests)
    .where(
      and(
        isNull(manifests.revokedAt),
        isNull(manifests.expiryNotifiedAt),
        between(manifests.expiresAt, now, windowEnd)
      )
    );

  if (expiringManifests.length === 0) {
    return 0;
  }

  // Look up agent names for the webhook payload
  const agentIds = [...new Set(expiringManifests.map((m) => m.agentId))];
  const agentRows = await Promise.all(
    agentIds.map((id) =>
      db.query.agents.findFirst({ where: eq(agents.id, id) })
    )
  );
  const agentMap = new Map(
    agentRows.filter(Boolean).map((a) => [a!.id, a!.name])
  );

  // Fire webhooks and mark as notified
  for (const manifest of expiringManifests) {
    const minutesUntilExpiry = Math.round(
      (manifest.expiresAt.getTime() - now.getTime()) / 60_000
    );

    deliverWebhook({
      type: "manifest.expiring",
      data: {
        manifestId: manifest.id,
        agentId: manifest.agentId,
        agentName: agentMap.get(manifest.agentId) ?? "unknown",
        expiresAt: manifest.expiresAt.toISOString(),
        minutesUntilExpiry,
      },
    });

    // Mark as notified to prevent duplicate webhooks
    await db
      .update(manifests)
      .set({ expiryNotifiedAt: now })
      .where(eq(manifests.id, manifest.id));
  }

  console.log(`[expiry-scanner] notified ${expiringManifests.length} expiring manifest(s)`);
  return expiringManifests.length;
}

/**
 * Start the expiry scanner. Runs on a fixed interval.
 */
export function startExpiryScanner(): void {
  if (scannerTimer) return;

  scannerTimer = setInterval(() => {
    scanExpiringManifests().catch((err) => {
      console.error("[expiry-scanner] scan failed:", err);
    });
  }, SCAN_INTERVAL_MS);

  console.log(`[expiry-scanner] started (interval: ${SCAN_INTERVAL_MS / 1000}s, window: ${EXPIRY_WINDOW_MS / 60_000}min)`);
}

/**
 * Stop the expiry scanner.
 */
export function stopExpiryScanner(): void {
  if (scannerTimer) {
    clearInterval(scannerTimer);
    scannerTimer = null;
    console.log("[expiry-scanner] stopped");
  }
}
